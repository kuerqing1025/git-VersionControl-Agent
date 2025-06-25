import { simpleGit } from "./common.js";

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
