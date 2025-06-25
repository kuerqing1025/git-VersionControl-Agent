import { path, fs, simpleGit, execPromise } from "./common.js";

/**
 * Manages Git hooks in the repository
 * @param {string} repoPath - Path to the local repository
 * @param {string} action - Hook action (list, get, create, enable, disable)
 * @param {string} hookName - Name of the hook (e.g., "pre-commit", "post-merge")
 * @param {string} script - Script content for the hook (for create action)
 * @returns {Object} - Hook operation result
 */
export async function handleGitHooks({
  repo_path,
  action,
  hook_name = "",
  script = "",
}) {
  try {
    // Path to the hooks directory
    const hooksDir = path.join(repo_path, ".git", "hooks");

    switch (action) {
      case "list":
        // Get all available hooks
        const files = await fs.readdir(hooksDir);
        const hooks = [];

        for (const file of files) {
          // Filter out sample hooks
          if (!file.endsWith(".sample")) {
            const hookPath = path.join(hooksDir, file);
            const stats = await fs.stat(hookPath);

            hooks.push({
              name: file,
              path: hookPath,
              size: stats.size,
              executable: (stats.mode & 0o111) !== 0, // Check if executable
            });
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  hooks: hooks,
                },
                null,
                2
              ),
            },
          ],
        };

      case "get":
        if (!hook_name) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: "Hook name is required for get action" },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        const hookPath = path.join(hooksDir, hook_name);

        // Check if hook exists
        if (!(await fs.pathExists(hookPath))) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: `Hook '${hook_name}' does not exist` },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Read hook content
        const hookContent = await fs.readFile(hookPath, "utf8");
        const stats = await fs.stat(hookPath);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  name: hook_name,
                  content: hookContent,
                  executable: (stats.mode & 0o111) !== 0,
                },
                null,
                2
              ),
            },
          ],
        };

      case "create":
        if (!hook_name) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: "Hook name is required for create action" },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        if (!script) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: "Script content is required for create action" },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        const createHookPath = path.join(hooksDir, hook_name);

        // Write hook content
        await fs.writeFile(createHookPath, script);

        // Make hook executable
        await fs.chmod(createHookPath, 0o755);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Created hook '${hook_name}'`,
                  name: hook_name,
                  executable: true,
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
                { error: `Unknown hook action: ${action}` },
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
            { error: `Failed to manage hook: ${error.message}` },
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
 * Reverts a commit
 * @param {string} repoPath - Path to the local repository
 * @param {string} commit - Commit hash or reference to revert
 * @param {boolean} noCommit - Whether to stage changes without committing
 * @returns {Object} - Revert result
 */
export async function handleGitRevert({
  repo_path,
  commit,
  no_commit = false,
}) {
  try {
    const git = simpleGit(repo_path);

    if (!commit) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: "Commit reference is required" },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Build the revert command
    const revertOptions = [];
    if (no_commit) {
      revertOptions.push("--no-commit");
    }

    // Perform the revert
    const result = await git.raw(["revert", ...revertOptions, commit]);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: `Reverted commit ${commit}`,
              commit: commit,
              result: result,
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
              error: `Failed to revert commit: ${error.message}`,
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
 * Performs Git clean operations
 * @param {string} repoPath - Path to the local repository
 * @param {boolean} directories - Whether to remove directories as well
 * @param {boolean} force - Whether to force clean
 * @param {boolean} dryRun - Whether to perform a dry run (show what would be done)
 * @returns {Object} - Clean result
 */
export async function handleGitClean({
  repo_path,
  directories = false,
  force = false,
  dry_run = true,
}) {
  try {
    const git = simpleGit(repo_path);

    // At least one of force or dry_run must be true for safety
    if (!force && !dry_run) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: "For safety, either force or dry_run must be true" },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Build the clean command
    const cleanOptions = [];

    if (directories) {
      cleanOptions.push("-d");
    }

    if (force) {
      cleanOptions.push("-f");
    }

    if (dry_run) {
      cleanOptions.push("-n");
    }

    // Get the files that would be removed
    const preview = await git.clean([
      "--dry-run",
      ...(directories ? ["-d"] : []),
    ]);
    const filesToRemove = preview
      .split("\n")
      .filter((line) => line.startsWith("Would remove"))
      .map((line) => line.replace("Would remove ", "").trim());

    if (!dry_run) {
      // Perform the actual clean
      await git.clean(cleanOptions);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: dry_run
                ? `Would remove ${filesToRemove.length} files/directories`
                : `Removed ${filesToRemove.length} files/directories`,
              files: filesToRemove,
              dry_run: dry_run,
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
            { error: `Failed to clean repository: ${error.message}` },
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
 * Updates Git LFS objects
 * @param {string} repoPath - Path to the local repository
 * @param {boolean} dryRun - Whether to perform a dry run
 * @param {boolean} pointers - Whether to convert pointers to objects
 * @returns {Object} - LFS objects update result
 */
export async function handleGitLFSFetch({
  repo_path,
  dry_run = false,
  pointers = false,
}) {
  try {
    // Build the command
    let command = `cd "${repo_path}" && git lfs fetch`;

    if (dry_run) {
      command += " --dry-run";
    }

    if (pointers) {
      command += " --pointers";
    }

    // Execute the command
    const { stdout, stderr } = await execPromise(command);

    // Parse the output
    const output = stdout.trim();
    const errors = stderr.trim();

    if (errors && !output) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: errors }, null, 2),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: "Git LFS fetch completed",
              output: output,
              dry_run: dry_run,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    // Special handling for "git lfs not installed" error
    if (error.message.includes("git: lfs is not a git command")) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: "Git LFS is not installed on the system" },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { error: `Failed to fetch LFS objects: ${error.message}` },
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
 * Gets blame information for a file
 * @param {string} repoPath - Path to the local repository
 * @param {string} filePath - Path to the file
 * @param {string} rev - Revision to blame (default: HEAD)
 * @returns {Object} - Blame result
 */
export async function handleGitBlame({ repo_path, file_path, rev = "HEAD" }) {
  try {
    const git = simpleGit(repo_path);

    // Run git blame
    const blameResult = await git.raw([
      "blame",
      "--line-porcelain",
      rev,
      "--",
      file_path,
    ]);

    // Parse the output
    const lines = blameResult.split("\n");
    const blameInfo = [];

    let currentCommit = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Start of a new blame entry
      if (line.match(/^[0-9a-f]{40}/)) {
        if (currentCommit) {
          blameInfo.push(currentCommit);
        }

        const parts = line.split(" ");
        currentCommit = {
          hash: parts[0],
          originalLine: parseInt(parts[1]),
          finalLine: parseInt(parts[2]),
          lineCount: parseInt(parts[3] || 1),
          author: "",
          authorMail: "",
          authorTime: 0,
          subject: "",
          content: "",
        };
      } else if (line.startsWith("author ") && currentCommit) {
        currentCommit.author = line.substring(7);
      } else if (line.startsWith("author-mail ") && currentCommit) {
        currentCommit.authorMail = line.substring(12).replace(/[<>]/g, "");
      } else if (line.startsWith("author-time ") && currentCommit) {
        currentCommit.authorTime = parseInt(line.substring(12));
      } else if (line.startsWith("summary ") && currentCommit) {
        currentCommit.subject = line.substring(8);
      } else if (line.startsWith("\t") && currentCommit) {
        // This is the content line
        currentCommit.content = line.substring(1);
        blameInfo.push(currentCommit);
        currentCommit = null;
      }
    }

    // Add the last commit if there is one
    if (currentCommit) {
      blameInfo.push(currentCommit);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              file: file_path,
              blame: blameInfo,
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
            { error: `Failed to get blame information: ${error.message}` },
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
 * Manages git attributes for files
 * @param {string} repoPath - Path to the local repository
 * @param {string} action - Action (get, set, list)
 * @param {string} pattern - File pattern
 * @param {string} attribute - Attribute to set
 * @returns {Object} - Operation result
 */
export async function handleGitAttributes({
  repo_path,
  action,
  pattern = "",
  attribute = "",
}) {
  try {
    const attributesPath = path.join(repo_path, ".gitattributes");

    switch (action) {
      case "list":
        // Check if .gitattributes exists
        if (!(await fs.pathExists(attributesPath))) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    attributes: [],
                    message: ".gitattributes file does not exist",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // Read and parse .gitattributes
        const content = await fs.readFile(attributesPath, "utf8");
        const lines = content
          .split("\n")
          .filter((line) => line.trim() && !line.startsWith("#"));

        const attributes = lines.map((line) => {
          const parts = line.trim().split(/\s+/);
          return {
            pattern: parts[0],
            attributes: parts.slice(1),
          };
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  attributes: attributes,
                },
                null,
                2
              ),
            },
          ],
        };

      case "get":
        if (!pattern) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: "Pattern is required for get action" },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Check if .gitattributes exists
        if (!(await fs.pathExists(attributesPath))) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    pattern: pattern,
                    attributes: [],
                    message: ".gitattributes file does not exist",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // Read and find pattern
        const getContent = await fs.readFile(attributesPath, "utf8");
        const getLines = getContent.split("\n");

        const matchingLines = getLines.filter((line) => {
          const parts = line.trim().split(/\s+/);
          return parts[0] === pattern;
        });

        if (matchingLines.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    pattern: pattern,
                    attributes: [],
                    message: `No attributes found for pattern '${pattern}'`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // Parse attributes
        const patternAttributes = matchingLines
          .map((line) => {
            const parts = line.trim().split(/\s+/);
            return parts.slice(1);
          })
          .flat();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  pattern: pattern,
                  attributes: patternAttributes,
                },
                null,
                2
              ),
            },
          ],
        };

      case "set":
        if (!pattern) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: "Pattern is required for set action" },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        if (!attribute) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: "Attribute is required for set action" },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Check if .gitattributes exists, create if not
        if (!(await fs.pathExists(attributesPath))) {
          await fs.writeFile(attributesPath, "");
        }

        // Read current content
        const setContent = await fs.readFile(attributesPath, "utf8");
        const setLines = setContent.split("\n");

        // Check if pattern already exists
        const patternIndex = setLines.findIndex((line) => {
          const parts = line.trim().split(/\s+/);
          return parts[0] === pattern;
        });

        if (patternIndex !== -1) {
          // Update existing pattern
          const parts = setLines[patternIndex].trim().split(/\s+/);

          // Check if attribute already exists
          if (!parts.includes(attribute)) {
            parts.push(attribute);
            setLines[patternIndex] = parts.join(" ");
          }
        } else {
          // Add new pattern
          setLines.push(`${pattern} ${attribute}`);
        }

        // Write back to file
        await fs.writeFile(
          attributesPath,
          setLines.filter(Boolean).join("\n") + "\n"
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Set attribute '${attribute}' for pattern '${pattern}'`,
                  pattern: pattern,
                  attribute: attribute,
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
                { error: `Unknown attributes action: ${action}` },
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
            { error: `Failed to manage git attributes: ${error.message}` },
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
 * Creates a git archive (zip or tar)
 * @param {string} repoPath - Path to the local repository
 * @param {string} outputPath - Output path for the archive
 * @param {string} format - Archive format (zip or tar)
 * @param {string} prefix - Prefix for files in the archive
 * @param {string} treeish - Tree-ish to archive (default: HEAD)
 * @returns {Object} - Archive result
 */
export async function handleGitArchive({
  repo_path,
  output_path,
  format = "zip",
  prefix = "",
  treeish = "HEAD",
}) {
  try {
    const git = simpleGit(repo_path);

    // Validate format
    if (!["zip", "tar"].includes(format)) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: `Invalid archive format: ${format}. Use 'zip' or 'tar'.`,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Build archive command
    const archiveArgs = ["archive", `--format=${format}`];

    if (prefix) {
      archiveArgs.push(`--prefix=${prefix}/`);
    }

    archiveArgs.push("-o", output_path, treeish);

    // Create archive
    await git.raw(archiveArgs);

    // Check if archive was created
    if (!(await fs.pathExists(output_path))) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: "Failed to create archive: output file not found" },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Get file size
    const stats = await fs.stat(output_path);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: `Created ${format} archive at ${output_path}`,
              format: format,
              output_path: output_path,
              size_bytes: stats.size,
              treeish: treeish,
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
            { error: `Failed to create archive: ${error.message}` },
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
 * Manages Git LFS (Large File Storage)
 * @param {string} repoPath - Path to the local repository
 * @param {string} action - LFS action (install, track, untrack, list)
 * @param {string|string[]} patterns - File patterns for track/untrack
 * @returns {Object} - Operation result
 */
export async function handleGitLFS({ repo_path, action, patterns = [] }) {
  try {
    // Make sure patterns is an array
    const patternsArray = Array.isArray(patterns) ? patterns : [patterns];

    switch (action) {
      case "install":
        // Install Git LFS in the repository
        const { stdout: installOutput } = await execPromise(
          `cd "${repo_path}" && git lfs install`
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: "Git LFS installed successfully",
                  output: installOutput.trim(),
                },
                null,
                2
              ),
            },
          ],
        };

      case "track":
        if (patternsArray.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: "At least one pattern is required for track action",
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Track files with LFS
        const trackResults = [];

        for (const pattern of patternsArray) {
          const { stdout: trackOutput } = await execPromise(
            `cd "${repo_path}" && git lfs track "${pattern}"`
          );
          trackResults.push({
            pattern: pattern,
            output: trackOutput.trim(),
          });
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Tracked ${patternsArray.length} pattern(s) with Git LFS`,
                  patterns: patternsArray,
                  results: trackResults,
                },
                null,
                2
              ),
            },
          ],
        };

      case "untrack":
        if (patternsArray.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error:
                      "At least one pattern is required for untrack action",
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Untrack files from LFS
        const untrackResults = [];

        for (const pattern of patternsArray) {
          const { stdout: untrackOutput } = await execPromise(
            `cd "${repo_path}" && git lfs untrack "${pattern}"`
          );
          untrackResults.push({
            pattern: pattern,
            output: untrackOutput.trim(),
          });
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Untracked ${patternsArray.length} pattern(s) from Git LFS`,
                  patterns: patternsArray,
                  results: untrackResults,
                },
                null,
                2
              ),
            },
          ],
        };

      case "list":
        // List tracked patterns
        const { stdout: listOutput } = await execPromise(
          `cd "${repo_path}" && git lfs track`
        );

        // Parse the output to extract patterns
        const trackedPatterns = listOutput
          .split("\n")
          .filter((line) => line.includes("("))
          .map((line) => {
            const match = line.match(/Tracking "([^"]+)"/);
            return match ? match[1] : null;
          })
          .filter(Boolean);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  tracked_patterns: trackedPatterns,
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
                { error: `Unknown LFS action: ${action}` },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    // Special handling for "git lfs not installed" error
    if (error.message.includes("git: lfs is not a git command")) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: "Git LFS is not installed on the system" },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { error: `Failed to perform LFS operation: ${error.message}` },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
