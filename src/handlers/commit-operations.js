import { path, fs, simpleGit, cloneRepo } from "./common.js";

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
