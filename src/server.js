import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  handleGitDirectoryStructure,
  handleGitReadFiles,
  handleGitBranchDiff,
  handleGitCommitHistory,
  handleGitCommitsDetails,
  handleGitLocalChanges,
  handleGitSearchCode,
  handleGitCommit,
  handleGitTrack,
  handleGitCheckoutBranch,
  handleGitDeleteBranch,
  handleGitMergeBranch,
  handleGitPush,
  handleGitPull,
  handleGitStash,
  handleGitCreateTag,
  handleGitRebase,
  handleGitConfig,
  handleGitReset,
  handleGitBranchDiff,
} from "./handlers/index.js";

/**
 * Main server class for the Git Repository Browser MCP server
 */
export class GitRepoBrowserServer {
  /**
   * Initialize the server
   */
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

  /**
   * Set up tool handlers for the server
   */
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
              until: {
                type: "string",
                description:
                  'Get commits before this date (e.g., "yesterday", "2023-12-31")',
              },
              grep: {
                type: "string",
                description: "Filter commits by message content (optional)",
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
              since: {
                type: "string",
                description:
                  'Get commits after this date (e.g., "1 week ago", "2023-01-01")',
              },
              until: {
                type: "string",
                description:
                  'Get commits before this date (e.g., "yesterday", "2023-12-31")',
              },
              author: {
                type: "string",
                description: "Filter by author (optional)",
              },
              grep: {
                type: "string",
                description: "Filter commits by message content (optional)",
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
        {
          name: "git_search_code",
          description: "Search for patterns in repository code.",
          inputSchema: {
            type: "object",
            properties: {
              repo_url: {
                type: "string",
                description: "The URL of the Git repository",
              },
              pattern: {
                type: "string",
                description: "Search pattern (regex or string)",
              },
              file_patterns: {
                type: "array",
                items: { type: "string" },
                description: 'Optional file patterns to filter (e.g., "*.js")',
              },
              case_sensitive: {
                type: "boolean",
                description: "Whether the search is case sensitive",
                default: false,
              },
              context_lines: {
                type: "integer",
                description: "Number of context lines to include",
                default: 2,
              },
            },
            required: ["repo_url", "pattern"],
          },
        },
      ],
    }));

    // Create a handlers mapping for O(1) lookup time
    const handlersMap = {
      git_directory_structure: handleGitDirectoryStructure,
      git_read_files: handleGitReadFiles,
      git_branch_diff: handleGitBranchDiff,
      git_commit_history: handleGitCommitHistory,
      git_commits_details: handleGitCommitsDetails,
      git_local_changes: handleGitLocalChanges,
      git_search_code: handleGitSearchCode,
      git_commit: handleGitCommit,
      git_track: handleGitTrack,
      git_checkout_branch: handleGitCheckoutBranch,
      git_delete_branch: handleGitDeleteBranch,
      git_merge_branch: handleGitMergeBranch,
      git_push: handleGitPush,
      git_pull: handleGitPull,
      git_stash: handleGitStash,
      git_create_tag: handleGitCreateTag,
      git_rebase: handleGitRebase,
      git_config: handleGitConfig,
      git_reset: handleGitReset,
    };

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const handler = handlersMap[request.params.name];
      if (handler) {
        return handler(request.params.arguments);
      }
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${request.params.name}`
      );
    });
  }

  /**
   * Start the server
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Git Repo Browser MCP server running on stdio");
  }
}
