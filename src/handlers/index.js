import path from "path";
import fs from "fs-extra";
import { simpleGit } from "simple-git";
import { exec } from "child_process";
import { promisify } from "util";
import { cloneRepo, getDirectoryTree } from "../utils/git.js";

const execPromise = promisify(exec);

/**
 * Handles the git_directory_structure tool request
 * @param {Object} params - Tool parameters
 * @param {string} params.repo_url - Repository URL
 * @returns {Object} - Tool response
 */
export async function handleGitDirectoryStructure({ repo_url }) {
  try {
    const repoPath = await cloneRepo(repo_url);
    const tree = await getDirectoryTree(repoPath);
    return {
      content: [
        {
          type: "text",
          text: tree,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handles the git_read_files tool request
 * @param {Object} params - Tool parameters
 * @param {string} params.repo_url - Repository URL
 * @param {string[]} params.file_paths - File paths to read
 * @returns {Object} - Tool response
 */
export async function handleGitReadFiles({ repo_url, file_paths }) {
  try {
    const repoPath = await cloneRepo(repo_url);
    const results = {};

    for (const filePath of file_paths) {
      const fullPath = path.join(repoPath, filePath);
      try {
        if (await fs.pathExists(fullPath)) {
          results[filePath] = await fs.readFile(fullPath, "utf8");
        } else {
          results[filePath] = "Error: File not found";
        }
      } catch (error) {
        results[filePath] = `Error reading file: ${error.message}`;
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { error: `Failed to process repository: ${error.message}` },
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
 * Handles the git_commit_history tool request
 * @param {Object} params - Tool parameters
 * @param {string} params.repo_url - Repository URL
 * @param {string} params.branch - Branch name
 * @param {number} params.max_count - Maximum number of commits
 * @param {string} params.author - Author filter
 * @param {string} params.since - Date filter (after)
 * @param {string} params.until - Date filter (before)
 * @param {string} params.grep - Message content filter
 * @returns {Object} - Tool response
 */
export async function handleGitCommitHistory({
  repo_url,
  branch = "main",
  max_count = 10,
  author,
  since,
  until,
  grep,
}) {
  try {
    const repoPath = await cloneRepo(repo_url);
    const git = simpleGit(repoPath);

    // Prepare log options
    const logOptions = {
      maxCount: max_count,
    };

    if (author) {
      logOptions["--author"] = author;
    }

    if (since) {
      logOptions["--since"] = since;
    }

    if (until) {
      logOptions["--until"] = until;
    }

    if (grep) {
      logOptions["--grep"] = grep;
    }

    // Make sure branch exists locally
    const branches = await git.branch();
    if (!branches.all.includes(branch)) {
      await git.fetch("origin", branch);
    }

    // Get commit history
    const log = await git.log(logOptions, branch);

    // Format the commits
    const commits = log.all.map((commit) => ({
      hash: commit.hash,
      author: commit.author_name,
      email: commit.author_email,
      date: commit.date,
      message: commit.message,
      body: commit.body || "",
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ commits }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { error: `Failed to get commit history: ${error.message}` },
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
 * Handles the git_commits_details tool request
 * @param {Object} params - Tool parameters
 * @param {string} params.repo_url - Repository URL
 * @param {string} params.branch - Branch name
 * @param {number} params.max_count - Maximum number of commits
 * @param {boolean} params.include_diff - Whether to include diffs
 * @param {string} params.author - Author filter
 * @param {string} params.since - Date filter (after)
 * @param {string} params.until - Date filter (before)
 * @param {string} params.grep - Message content filter
 * @returns {Object} - Tool response
 */
export async function handleGitCommitsDetails({
  repo_url,
  branch = "main",
  max_count = 10,
  include_diff = false,
  author,
  since,
  until,
  grep,
}) {
  try {
    const repoPath = await cloneRepo(repo_url);
    const git = simpleGit(repoPath);

    // Ensure branch exists locally
    const branches = await git.branch();
    if (!branches.all.includes(branch)) {
      await git.fetch("origin", branch);
    }

    // Prepare log options with full details
    const logOptions = {
      maxCount: max_count,
      "--format": "fuller", // Get more detailed commit info
    };

    if (author) {
      logOptions["--author"] = author;
    }

    if (since) {
      logOptions["--since"] = since;
    }

    if (until) {
      logOptions["--until"] = until;
    }

    if (grep) {
      logOptions["--grep"] = grep;
    }

    // Get commit history with full details
    const log = await git.log(logOptions, branch);

    // Enhance with additional details
    const commitsDetails = [];

    for (const commit of log.all) {
      const commitDetails = {
        hash: commit.hash,
        author: commit.author_name,
        author_email: commit.author_email,
        committer: commit.committer_name,
        committer_email: commit.committer_email,
        date: commit.date,
        message: commit.message,
        body: commit.body || "",
        refs: commit.refs,
      };

      // Get the commit diff if requested
      if (include_diff) {
        if (commit.parents && commit.parents.length > 0) {
          // For normal commits with parents
          const diff = await git.diff([`${commit.hash}^..${commit.hash}`]);
          commitDetails.diff = diff;
        } else {
          // For initial commits with no parents
          const diff = await git.diff([
            "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
            commit.hash,
          ]);
          commitDetails.diff = diff;
        }

        // Get list of changed files
        const showResult = await git.show([
          "--name-status",
          "--oneline",
          commit.hash,
        ]);

        // Parse the changed files from the result
        const fileLines = showResult
          .split("\n")
          .slice(1) // Skip the first line (commit summary)
          .filter(Boolean); // Remove empty lines

        commitDetails.changed_files = fileLines
          .map((line) => {
            const match = line.match(/^([AMDTRC])\s+(.+)$/);
            if (match) {
              return {
                status: match[1],
                file: match[2],
              };
            }
            return null;
          })
          .filter(Boolean);
      }

      commitsDetails.push(commitDetails);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              commits: commitsDetails,
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
            { error: `Failed to get commit details: ${error.message}` },
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
 * Handles the git_local_changes tool request
 * @param {Object} params - Tool parameters
 * @param {string} params.repo_path - Local repository path
 * @returns {Object} - Tool response
 */
export async function handleGitLocalChanges({ repo_path }) {
  try {
    // Use the provided local repo path
    const git = simpleGit(repo_path);

    // Get status information
    const status = await git.status();

    // Get detailed diff for modified files
    let diffs = {};
    for (const file of status.modified) {
      diffs[file] = await git.diff([file]);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              branch: status.current,
              staged_files: status.staged,
              modified_files: status.modified,
              new_files: status.not_added,
              deleted_files: status.deleted,
              conflicted_files: status.conflicted,
              diffs: diffs,
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
            { error: `Failed to get local changes: ${error.message}` },
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
 * Handles the git_search_code tool request
 * @param {Object} params - Tool parameters
 * @param {string} params.repo_url - Repository URL
 * @param {string} params.pattern - Search pattern (regex or string)
 * @param {string[]} params.file_patterns - Optional file patterns to filter (e.g., "*.js")
 * @param {boolean} params.case_sensitive - Whether the search is case sensitive
 * @param {number} params.context_lines - Number of context lines to include
 * @returns {Object} - Tool response
 */
export async function handleGitSearchCode({
  repo_url,
  pattern,
  file_patterns = [],
  case_sensitive = false,
  context_lines = 2,
}) {
  try {
    const repoPath = await cloneRepo(repo_url);

    // Build the grep command
    let grepCommand = `cd "${repoPath}" && git grep`;

    // Add options
    if (!case_sensitive) {
      grepCommand += " -i";
    }

    // Add context lines
    grepCommand += ` -n -C${context_lines}`;

    // Add pattern (escape quotes in the pattern)
    const escapedPattern = pattern.replace(/"/g, '\\"');
    grepCommand += ` "${escapedPattern}"`;

    // Add file patterns if provided
    if (file_patterns && file_patterns.length > 0) {
      grepCommand += ` -- ${file_patterns.join(" ")}`;
    }

    // Execute the command
    const { stdout, stderr } = await execPromise(grepCommand);

    if (stderr) {
      console.error(`Search error: ${stderr}`);
    }

    // Process the results
    const results = [];
    if (stdout) {
      // Split by file sections (git grep output format)
      const fileMatches = stdout.split(/^(?=\S[^:]*:)/m);

      for (const fileMatch of fileMatches) {
        if (!fileMatch.trim()) continue;

        // Extract file name and matches
        const lines = fileMatch.split("\n");
        const firstLine = lines[0];
        const fileNameMatch = firstLine.match(/^([^:]+):/);

        if (fileNameMatch) {
          const fileName = fileNameMatch[1];
          const matches = [];

          // Process each line
          let currentMatch = null;
          let contextLines = [];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Skip empty lines
            if (!line.trim()) continue;

            // Check if this is a line number indicator
            const lineNumberMatch = line.match(/^([^-][^:]+):(\d+):(.*)/);

            if (lineNumberMatch) {
              // If we have a previous match, add it to the results
              if (currentMatch) {
                currentMatch.context_after = contextLines;
                matches.push(currentMatch);
                contextLines = [];
              }

              // Start a new match
              currentMatch = {
                file: fileName,
                line_number: parseInt(lineNumberMatch[2]),
                content: lineNumberMatch[3],
                context_before: contextLines,
                context_after: [],
              };
              contextLines = [];
            } else {
              // This is a context line
              const contextMatch = line.match(/^([^:]+)-(\d+)-(.*)/);
              if (contextMatch) {
                contextLines.push({
                  line_number: parseInt(contextMatch[2]),
                  content: contextMatch[3],
                });
              }
            }
          }

          // Add the last match if there is one
          if (currentMatch) {
            currentMatch.context_after = contextLines;
            matches.push(currentMatch);
          }

          if (matches.length > 0) {
            results.push({
              file: fileName,
              matches: matches,
            });
          }
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              pattern: pattern,
              case_sensitive: case_sensitive,
              context_lines: context_lines,
              file_patterns: file_patterns,
              results: results,
              total_matches: results.reduce(
                (sum, file) => sum + file.matches.length,
                0
              ),
              total_files: results.length,
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
            { error: `Failed to search repository: ${error.message}` },
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
 *
 * @param {string} commitMessage
 * @param {string} repoPath
 * @param {string} branch
 * @param {string} userName
 * @param {string} userEmail
 * @returns {Promise<{ commitMessage: string, commitMessageFile: string; commitHash: string; }>}
 */
export async function writeCommitMessage(commitMessage, repoPath) {
  const git = simpleGit(repoPath);
  const commitMessageFile = path.join(repoPath, ".git/COMMIT_EDITMSG");
  await fs.writeFile(commitMessageFile, commitMessage);
  await git.add([commitMessageFile]);
  const commitHash = await git.commit([
    "-F",
    commitMessageFile,
    "--author",
    `${userName} <${userEmail}>`,
  ]);
  return { commitMessage, commitMessageFile, commitHash };
}

/**
 * Creates a commit with the specified message
 * @param {string} repoPath - Path to the local repository
 * @param {string} message - Commit message
 * @returns {Object} - Commit result
 */
export async function handleGitCommit({ repo_path, message }) {
  try {
    const git = simpleGit(repo_path);

    // Create the commit (only commit what's in the staging area)
    const commitResult = await git.commit(message);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              commit_hash: commitResult.commit,
              commit_message: message,
              summary: commitResult.summary,
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
            { error: `Failed to create commit: ${error.message}` },
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
 * Tracks (stages) specific files or all files
 * @param {string} repoPath - Path to the local repository
 * @param {string[]} files - Array of file paths to track/stage (use ["."] for all files)
 * @returns {Object} - Tracking result
 */
export async function handleGitTrack({ repo_path, files = ["."] }) {
  try {
    const git = simpleGit(repo_path);

    // Add the specified files to the staging area
    await git.add(files);

    // Get status to show what files were tracked
    const status = await git.status();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: `Tracked ${
                files.length === 1 && files[0] === "."
                  ? "all files"
                  : files.length + " files"
              }`,
              staged: status.staged,
              not_staged: status.not_added,
              modified: status.modified,
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
            { error: `Failed to track files: ${error.message}` },
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

// ADDITIONAL FEATURES

/**
 * Pushes changes to a remote repository
 * @param {string} repoPath - Path to the local repository
 * @param {string} remote - Remote name (default: origin)
 * @param {string} branch - Branch to push (default: current branch)
 * @param {boolean} force - Whether to force push
 * @returns {Object} - Push result
 */
export async function handleGitPush({
  repo_path,
  remote = "origin",
  branch = null,
  force = false,
}) {
  try {
    const git = simpleGit(repo_path);

    // If no branch specified, get the current branch
    if (!branch) {
      const branchInfo = await git.branch();
      branch = branchInfo.current;
    }

    // Perform the push
    let pushOptions = [];
    if (force) {
      pushOptions.push("--force");
    }

    const pushResult = await git.push(remote, branch, pushOptions);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              result: pushResult,
              message: `Pushed ${branch} to ${remote}`,
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
            { error: `Failed to push changes: ${error.message}` },
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
 * Pulls changes from a remote repository
 * @param {string} repoPath - Path to the local repository
 * @param {string} remote - Remote name (default: origin)
 * @param {string} branch - Branch to pull (default: current branch)
 * @param {boolean} rebase - Whether to rebase instead of merge
 * @returns {Object} - Pull result
 */
export async function handleGitPull({
  repo_path,
  remote = "origin",
  branch = null,
  rebase = false,
}) {
  try {
    const git = simpleGit(repo_path);

    // If no branch specified, use current branch
    if (!branch) {
      const branchInfo = await git.branch();
      branch = branchInfo.current;
    }

    // Set up pull options
    const pullOptions = {};
    if (rebase) {
      pullOptions["--rebase"] = null;
    }

    // Perform the pull
    const pullResult = await git.pull(remote, branch, pullOptions);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              result: pullResult,
              message: `Pulled from ${remote}/${branch}`,
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
              error: `Failed to pull changes: ${error.message}`,
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

/**
 * Creates or applies a stash
 * @param {string} repoPath - Path to the local repository
 * @param {string} action - Stash action (save, pop, apply, list, drop)
 * @param {string} message - Stash message (for save action)
 * @param {number} index - Stash index (for pop, apply, drop actions)
 * @returns {Object} - Stash operation result
 */
export async function handleGitStash({
  repo_path,
  action = "save",
  message = "",
  index = 0,
}) {
  try {
    const git = simpleGit(repo_path);

    let result;
    switch (action) {
      case "save":
        result = await git.stash(["save", message]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: "Changes stashed successfully",
                  stash_message: message,
                },
                null,
                2
              ),
            },
          ],
        };

      case "pop":
        result = await git.stash(["pop", index.toString()]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Applied and dropped stash@{${index}}`,
                },
                null,
                2
              ),
            },
          ],
        };

      case "apply":
        result = await git.stash(["apply", index.toString()]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Applied stash@{${index}}`,
                },
                null,
                2
              ),
            },
          ],
        };

      case "list":
        result = await git.stash(["list"]);
        // Parse the stash list
        const stashList = result
          .trim()
          .split("\n")
          .filter((line) => line.trim() !== "")
          .map((line) => {
            const match = line.match(/stash@\{(\d+)\}: (.*)/);
            if (match) {
              return {
                index: parseInt(match[1]),
                description: match[2],
              };
            }
            return null;
          })
          .filter((item) => item !== null);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  stashes: stashList,
                },
                null,
                2
              ),
            },
          ],
        };

      case "drop":
        result = await git.stash(["drop", index.toString()]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Dropped stash@{${index}}`,
                },
                null,
                2
              ),
            },
          ],
        };

      default:
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { error: `Unknown stash action: ${action}` },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { error: `Failed to perform stash operation: ${error.message}` },
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
 * Creates a tag
 * @param {string} repoPath - Path to the local repository
 * @param {string} tagName - Name of the tag
 * @param {string} message - Tag message (for annotated tags)
 * @param {boolean} annotated - Whether to create an annotated tag
 * @returns {Object} - Tag creation result
 */
export async function handleGitCreateTag({
  repo_path,
  tag_name,
  message = "",
  annotated = true,
}) {
  try {
    const git = simpleGit(repo_path);

    if (annotated) {
      await git.addAnnotatedTag(tag_name, message);
    } else {
      await git.addTag(tag_name);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: `Created ${
                annotated ? "annotated " : ""
              }tag: ${tag_name}`,
              tag: tag_name,
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
            { error: `Failed to create tag: ${error.message}` },
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
 * Handles git rebase operations
 * @param {string} repoPath - Path to the local repository
 * @param {string} onto - Branch or commit to rebase onto
 * @param {boolean} interactive - Whether to perform an interactive rebase
 * @returns {Object} - Rebase result
 */
export async function handleGitRebase({
  repo_path,
  onto,
  interactive = false,
}) {
  try {
    // For interactive rebase, we need to use exec as simple-git doesn't support it well
    if (interactive) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: "Interactive rebase not supported through API" },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    const git = simpleGit(repo_path);
    const rebaseResult = await git.rebase([onto]);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: `Rebased onto ${onto}`,
              result: rebaseResult,
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
              error: `Failed to rebase: ${error.message}`,
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

/**
 * Configures git settings for the repository
 * @param {string} repoPath - Path to the local repository
 * @param {string} scope - Configuration scope (local, global, system)
 * @param {string} key - Configuration key
 * @param {string} value - Configuration value
 * @returns {Object} - Configuration result
 */
export async function handleGitConfig({
  repo_path,
  scope = "local",
  key,
  value,
}) {
  try {
    const git = simpleGit(repo_path);

    // Set the configuration
    await git.addConfig(key, value, false, scope);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: `Set ${scope} config ${key}=${value}`,
              key: key,
              value: value,
              scope: scope,
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
            { error: `Failed to set git config: ${error.message}` },
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
 * Resets repository to specified commit or state
 * @param {string} repoPath - Path to the local repository
 * @param {string} mode - Reset mode (soft, mixed, hard)
 * @param {string} to - Commit or reference to reset to
 * @returns {Object} - Reset result
 */
export async function handleGitReset({
  repo_path,
  mode = "mixed",
  to = "HEAD",
}) {
  try {
    const git = simpleGit(repo_path);

    // Check valid mode
    if (!["soft", "mixed", "hard"].includes(mode)) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: `Invalid reset mode: ${mode}. Use 'soft', 'mixed', or 'hard'.`,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Perform the reset
    await git.reset([`--${mode}`, to]);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: `Reset (${mode}) to ${to}`,
              mode: mode,
              target: to,
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
            { error: `Failed to reset repository: ${error.message}` },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
