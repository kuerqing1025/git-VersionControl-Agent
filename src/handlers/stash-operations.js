import { simpleGit } from "./common.js";

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
