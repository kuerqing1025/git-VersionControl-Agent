import {
  execPromise,
  cloneRepo,
  getDirectoryTree,
  simpleGit,
  path,
  fs,
} from "./common.js";

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
