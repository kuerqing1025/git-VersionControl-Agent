import { simpleGit } from "./common.js";

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
