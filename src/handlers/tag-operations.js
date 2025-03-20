import { simpleGit } from "./common.js";

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
