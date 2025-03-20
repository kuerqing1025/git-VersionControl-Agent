import { simpleGit, cloneRepo } from "./common.js";

/**
 * Handles the git_branch_diff tool request
 * @param {Object} params - Tool parameters
 * @param {string} params.repo_url - Repository URL
 * @param {string} params.source_branch - Source branch name
 * @param {string} params.target_branch - Target branch name
 * @param {boolean} params.show_patch - Whether to include diff patches
 * @returns {Object} - Tool response
 */
export async function handleGitBranchDiff({
  repo_url,
  source_branch,
  target_branch,
  show_patch = false,
}) {
  try {
    const repoPath = await cloneRepo(repo_url);
    const git = simpleGit(repoPath);

    // Make sure both branches exist locally
    const branches = await git.branch();
    if (!branches.all.includes(source_branch)) {
      await git.fetch("origin", source_branch);
      await git.checkout(source_branch);
    }

    if (!branches.all.includes(target_branch)) {
      await git.fetch("origin", target_branch);
    }

    // Get the diff between branches
    const diffOptions = ["--name-status"];
    if (show_patch) {
      diffOptions.push("--patch");
    }

    const diff = await git.diff([
      ...diffOptions,
      `${target_branch}...${source_branch}`,
    ]);

    // Get commit range information
    const logSummary = await git.log({
      from: target_branch,
      to: source_branch,
    });

    const result = {
      commits_count: logSummary.total,
      diff_summary: diff,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { error: `Failed to get branch diff: ${error.message}` },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Creates and checks out a new branch
 * @param {string} repoPath - Path to the local repository
 * @param {string} branchName - Name of the new branch
 * @param {string} startPoint - Starting point for the branch (optional)
 * @returns {Object} - Branch creation result
 */
export async function handleGitCheckoutBranch({
  repo_path,
  branch_name,
  start_point = null,
  create = false,
}) {
  try {
    const git = simpleGit(repo_path);

    if (create) {
      // Create and checkout a new branch
      if (start_point) {
        await git.checkoutBranch(branch_name, start_point);
      } else {
        await git.checkoutLocalBranch(branch_name);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: `Created and checked out new branch: ${branch_name}`,
                branch: branch_name,
              },
              null,
              2
            ),
          },
        ],
      };
    } else {
      // Just checkout an existing branch
      await git.checkout(branch_name);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: `Checked out branch: ${branch_name}`,
                branch: branch_name,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { error: `Failed to checkout branch: ${error.message}` },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Deletes a branch
 * @param {string} repoPath - Path to the local repository
 * @param {string} branchName - Name of the branch to delete
 * @param {boolean} force - Whether to force deletion
 * @returns {Object} - Branch deletion result
 */
export async function handleGitDeleteBranch({
  repo_path,
  branch_name,
  force = false,
}) {
  try {
    const git = simpleGit(repo_path);

    // Get current branch to prevent deleting the active branch
    const currentBranch = await git.branch();
    if (currentBranch.current === branch_name) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: "Cannot delete the currently checked out branch" },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Delete the branch
    if (force) {
      await git.deleteLocalBranch(branch_name, true);
    } else {
      await git.deleteLocalBranch(branch_name);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: `Deleted branch: ${branch_name}`,
              branch: branch_name,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { error: `Failed to delete branch: ${error.message}` },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Merges a source branch into the current branch
 * @param {string} repoPath - Path to the local repository
 * @param {string} sourceBranch - Branch to merge from
 * @param {string} targetBranch - Branch to merge into (optional, uses current branch if not provided)
 * @param {boolean} noFastForward - Whether to create a merge commit even if fast-forward is possible
 * @returns {Object} - Merge result
 */
export async function handleGitMergeBranch({
  repo_path,
  source_branch,
  target_branch = null,
  no_fast_forward = false,
}) {
  try {
    const git = simpleGit(repo_path);

    // If target branch is specified, checkout to it first
    if (target_branch) {
      await git.checkout(target_branch);
    }

    // Perform the merge
    let mergeOptions = [];
    if (no_fast_forward) {
      mergeOptions = ["--no-ff"];
    }

    const mergeResult = await git.merge([...mergeOptions, source_branch]);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              result: mergeResult,
              message: `Merged ${source_branch} into ${
                target_branch || "current branch"
              }`,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: `Failed to merge branches: ${error.message}`,
              conflicts: error.git ? error.git.conflicts : null,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
