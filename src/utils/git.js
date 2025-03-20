import { simpleGit } from "simple-git";
import fs from "fs-extra";
import path from "path";
import os from "os";
import crypto from "crypto";

/**
 * Clones a Git repository or reuses an existing clone
 * @param {string} repoUrl - The URL of the Git repository to clone
 * @returns {Promise<string>} - Path to the cloned repository
 */
export async function cloneRepo(repoUrl) {
  // Create deterministic directory name based on repo URL
  const repoHash = crypto
    .createHash("sha256")
    .update(repoUrl)
    .digest("hex")
    .slice(0, 12);
  const tempDir = path.join(os.tmpdir(), `github_tools_${repoHash}`);

  // Check if directory exists and is a valid git repo
  if (await fs.pathExists(tempDir)) {
    try {
      const git = simpleGit(tempDir);
      const remotes = await git.getRemotes(true);
      if (remotes.length > 0 && remotes[0].refs.fetch === repoUrl) {
        // Pull latest changes
        await git.pull();
        return tempDir;
      }
    } catch (error) {
      // If there's any error with existing repo, clean it up
      await fs.remove(tempDir);
    }
  }

  // Create directory and clone repository
  await fs.ensureDir(tempDir);
  try {
    await simpleGit().clone(repoUrl, tempDir);
    return tempDir;
  } catch (error) {
    // Clean up on error
    await fs.remove(tempDir);
    throw new Error(`Failed to clone repository: ${error.message}`);
  }
}

/**
 * Generates a tree representation of a directory structure
 * @param {string} dirPath - Path to the directory
 * @param {string} prefix - Prefix for the current line (used for recursion)
 * @returns {Promise<string>} - ASCII tree representation of the directory
 */
export async function getDirectoryTree(dirPath, prefix = "") {
  let output = "";
  const entries = await fs.readdir(dirPath);
  entries.sort();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.startsWith(".git")) continue;

    const isLast = i === entries.length - 1;
    const currentPrefix = isLast ? "└── " : "├── ";
    const nextPrefix = isLast ? "    " : "│   ";
    const entryPath = path.join(dirPath, entry);

    output += prefix + currentPrefix + entry + "\n";

    const stats = await fs.stat(entryPath);
    if (stats.isDirectory()) {
      output += await getDirectoryTree(entryPath, prefix + nextPrefix);
    }
  }

  return output;
}
