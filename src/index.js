#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { simpleGit } from "simple-git";
import fs from "fs-extra";
import path from "path";
import os from "os";
import crypto from "crypto";

// Helper function to clone repository
async function cloneRepo(repoUrl) {
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

// Helper function to generate directory tree
async function getDirectoryTree(dirPath, prefix = "") {
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

class GitRepoBrowserServer {
  constructor() {
    this.server = new Server(
      {
        name: "mcp-git-repo-browser",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Basic Repository Operations
        {
          name: "git_directory_structure",
          description:
            "Clone a Git repository and return its directory structure in a tree format.",
          inputSchema: {
            type: "object",
            properties: {
              repo_url: {
                type: "string",
                description: "The URL of the Git repository",
              },
            },
            required: ["repo_url"],
          },
        },
        {
          name: "git_read_files",
          description:
            "Read the contents of specified files in a given git repository.",
          inputSchema: {
            type: "object",
            properties: {
              repo_url: {
                type: "string",
                description: "The URL of the Git repository",
              },
              file_paths: {
                type: "array",
                items: { type: "string" },
                description:
                  "List of file paths to read (relative to repository root)",
              },
            },
            required: ["repo_url", "file_paths"],
          },
        },

        // Branch Operations
        {
          name: "git_branch_diff",
          description:
            "Compare two branches and show files changed between them.",
          inputSchema: {
            type: "object",
            properties: {
              repo_url: {
                type: "string",
                description: "The URL of the Git repository",
              },
              source_branch: {
                type: "string",
                description: "The source branch name",
              },
              target_branch: {
                type: "string",
                description: "The target branch name",
              },
              show_patch: {
                type: "boolean",
                description: "Whether to include the actual diff patches",
                default: false,
              },
            },
            required: ["repo_url", "source_branch", "target_branch"],
          },
        },

        // Commit Operations
        {
          name: "git_commit_history",
          description:
            "Get commit history for a branch with optional filtering.",
          inputSchema: {
            type: "object",
            properties: {
              repo_url: {
                type: "string",
                description: "The URL of the Git repository",
              },
              branch: {
                type: "string",
                description: "The branch to get history from",
                default: "main",
              },
              max_count: {
                type: "integer",
                description: "Maximum number of commits to retrieve",
                default: 10,
              },
              author: {
                type: "string",
                description: "Filter by author (optional)",
              },
              since: {
                type: "string",
                description:
                  'Get commits after this date (e.g., "1 week ago", "2023-01-01")',
              },
            },
            required: ["repo_url"],
          },
        },
        {
          name: "git_commits_details",
          description:
            "Get detailed information about commits including full messages and diffs.",
          inputSchema: {
            type: "object",
            properties: {
              repo_url: {
                type: "string",
                description: "The URL of the Git repository",
              },
              branch: {
                type: "string",
                description: "The branch to get commits from",
                default: "main",
              },
              max_count: {
                type: "integer",
                description: "Maximum number of commits to retrieve",
                default: 10,
              },
              include_diff: {
                type: "boolean",
                description: "Whether to include the commit diffs",
                default: false,
              },
            },
            required: ["repo_url"],
          },
        },
        {
          name: "git_local_changes",
          description: "Get uncommitted changes in the working directory.",
          inputSchema: {
            type: "object",
            properties: {
              repo_path: {
                type: "string",
                description: "The path to the local Git repository",
              },
            },
            required: ["repo_path"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case "git_directory_structure":
          return this.handleGitDirectoryStructure(request.params.arguments);
        case "git_read_files":
          return this.handleGitReadFiles(request.params.arguments);
        case "git_branch_diff":
          return this.handleGitBranchDiff(request.params.arguments);
        case "git_commit_history":
          return this.handleGitCommitHistory(request.params.arguments);
        case "git_commits_details":
          return this.handleGitCommitsDetails(request.params.arguments);
        case "git_local_changes":
          return this.handleGitLocalChanges(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  async handleGitDirectoryStructure({ repo_url }) {
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

  async handleGitReadFiles({ repo_url, file_paths }) {
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

  async handleGitBranchDiff({
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

  async handleGitCommitHistory({
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

  async handleGitCommitsDetails({
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

  async handleGitLocalChanges({ repo_path }) {
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Git Repo Browser MCP server running on stdio");
  }
}

const server = new GitRepoBrowserServer();
server.run().catch(console.error);
