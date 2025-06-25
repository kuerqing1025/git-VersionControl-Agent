import { simpleGit } from "./common.js";

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
 * Manages Git remotes
 * @param {string} repoPath - Path to the local repository
 * @param {string} action - Remote action (list, add, remove, set-url, prune, get-url, rename, show)
 * @param {string} name - Remote name
 * @param {string} url - Remote URL (for add and set-url)
 * @param {string} newName - New remote name (for rename)
 * @param {boolean} pushUrl - Whether to set push URL instead of fetch URL (for set-url)
 * @returns {Object} - Operation result
 */
export async function handleGitRemote({
  repo_path,
  action,
  name = "",
  url = "",
  new_name = "",
  push_url = false,
}) {
  try {
    const git = simpleGit(repo_path);

    switch (action) {
      case "list":
        // Get all remotes with their URLs
        const remotes = await git.remote(["-v"]);

        // Parse the output
        const remotesList = [];
        const lines = remotes.trim().split("\n");

        for (const line of lines) {
          const match = line.match(/^([^\s]+)\s+([^\s]+)\s+\(([^)]+)\)$/);
          if (match) {
            const remoteName = match[1];
            const remoteUrl = match[2];
            const purpose = match[3];

            // Check if this remote is already in our list
            const existingRemote = remotesList.find(
              (r) => r.name === remoteName
            );

            if (existingRemote) {
              if (purpose === "fetch") {
                existingRemote.fetch_url = remoteUrl;
              } else if (purpose === "push") {
                existingRemote.push_url = remoteUrl;
              }
            } else {
              const remote = { name: remoteName };

              if (purpose === "fetch") {
                remote.fetch_url = remoteUrl;
              } else if (purpose === "push") {
                remote.push_url = remoteUrl;
              }

              remotesList.push(remote);
            }
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  remotes: remotesList,
                },
                null,
                2
              ),
            },
          ],
        };

      case "add":
        if (!name) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: "Remote name is required for add action" },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        if (!url) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: "Remote URL is required for add action" },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Add the remote
        await git.remote(["add", name, url]);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Added remote '${name}' with URL '${url}'`,
                  name: name,
                  url: url,
                },
                null,
                2
              ),
            },
          ],
        };

      case "remove":
        if (!name) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: "Remote name is required for remove action" },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Remove the remote
        await git.remote(["remove", name]);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Removed remote '${name}'`,
                  name: name,
                },
                null,
                2
              ),
            },
          ],
        };

      case "set-url":
        if (!name) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: "Remote name is required for set-url action" },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        if (!url) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: "Remote URL is required for set-url action" },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Set the remote URL (fetch or push)
        const args = ["set-url"];
        if (push_url) {
          args.push("--push");
        }
        args.push(name, url);

        await git.remote(args);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Updated ${
                    push_url ? "push" : "fetch"
                  } URL for remote '${name}' to '${url}'`,
                  name: name,
                  url: url,
                  type: push_url ? "push" : "fetch",
                },
                null,
                2
              ),
            },
          ],
        };

      case "get-url":
        if (!name) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: "Remote name is required for get-url action" },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Get the remote URL(s)
        const getUrlArgs = ["get-url"];
        if (push_url) {
          getUrlArgs.push("--push");
        }
        getUrlArgs.push(name);

        const remoteUrl = await git.remote(getUrlArgs);
        const urls = remoteUrl.trim().split("\n");

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  name: name,
                  urls: urls,
                  type: push_url ? "push" : "fetch",
                },
                null,
                2
              ),
            },
          ],
        };

      case "rename":
        if (!name) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: "Remote name is required for rename action" },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        if (!new_name) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: "New remote name is required for rename action" },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Rename the remote
        await git.remote(["rename", name, new_name]);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Renamed remote '${name}' to '${new_name}'`,
                  old_name: name,
                  new_name: new_name,
                },
                null,
                2
              ),
            },
          ],
        };

      case "prune":
        if (!name) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: "Remote name is required for prune action" },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Prune the remote
        await git.remote(["prune", name]);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Pruned remote '${name}'`,
                  name: name,
                },
                null,
                2
              ),
            },
          ],
        };

      case "show":
        if (!name) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: "Remote name is required for show action" },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Show remote details
        const showOutput = await git.raw(["remote", "show", name]);

        // Parse the output to extract useful information
        const remoteLines = showOutput.trim().split("\n");
        const remoteInfo = {
          name: name,
          fetch_url: "",
          push_url: "",
          head_branch: "",
          remote_branches: [],
          local_branches: [],
        };

        for (const line of remoteLines) {
          const trimmed = line.trim();

          if (trimmed.startsWith("Fetch URL:")) {
            remoteInfo.fetch_url = trimmed
              .substring("Fetch URL:".length)
              .trim();
          } else if (trimmed.startsWith("Push  URL:")) {
            remoteInfo.push_url = trimmed.substring("Push  URL:".length).trim();
          } else if (trimmed.startsWith("HEAD branch:")) {
            remoteInfo.head_branch = trimmed
              .substring("HEAD branch:".length)
              .trim();
          } else if (trimmed.startsWith("Remote branch")) {
            // Skip the "Remote branches:" line
          } else if (trimmed.startsWith("Local branch")) {
            // Skip the "Local branches:" line
          } else if (trimmed.includes("merges with remote")) {
            const parts = trimmed.split("merges with remote");
            if (parts.length === 2) {
              const localBranch = parts[0].trim();
              const remoteBranch = parts[1].trim();
              remoteInfo.local_branches.push({
                local: localBranch,
                remote: remoteBranch,
              });
            }
          } else if (trimmed.includes("tracked")) {
            const branch = trimmed.split(" ")[0].trim();
            if (branch) {
              remoteInfo.remote_branches.push(branch);
            }
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  remote: remoteInfo,
                  raw_output: showOutput,
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
                { error: `Unknown remote action: ${action}` },
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
            { error: `Failed to manage remote: ${error.message}` },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
