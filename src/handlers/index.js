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
 * @param {string} params.since - Date filter
 * @returns {Object} - Tool response
 */
export async function handleGitCommitHistory({
  repo_url,
  branch = "main",
  max_count = 10,
  author,
  since,
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
 * @returns {Object} - Tool response
 */
export async function handleGitCommitsDetails({
  repo_url,
  branch = "main",
  max_count = 10,
  include_diff = false,
}) {
  try {
    const repoPath = await cloneRepo(repo_url);
    const git = simpleGit(repoPath);

    // Ensure branch exists locally
    const branches = await git.branch();
    if (!branches.all.includes(branch)) {
      await git.fetch("origin", branch);
    }

    // Get commit history with full details
    const log = await git.log(
      {
        maxCount: max_count,
        "--format": "fuller", // Get more detailed commit info
      },
      branch
    );

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
