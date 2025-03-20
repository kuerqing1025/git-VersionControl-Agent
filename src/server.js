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
   * Get all registered handler names
   * @returns {string[]} Array of handler names
   */
  getHandlerNames() {
    return Object.keys(this.handlersMap || {});
  }

  /**
   * Check if a handler exists
   * @param {string} name - Handler name to check
   * @returns {boolean} True if handler exists
   */
  hasHandler(name) {
    return Boolean(this.handlersMap && this.handlersMap[name]);
  }

  /**
   * Set up tool handlers for the server
   */
  setupToolHandlers() {
    // Store tools list for dynamic updates
    this.toolsList = [
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
      {
        name: "git_checkout_branch",
        description: "Create and/or checkout a branch.",
        inputSchema: {
          type: "object",
          properties: {
            repo_path: {
              type: "string",
              description: "The path to the local Git repository",
            },
            branch_name: {
              type: "string",
              description: "The name of the branch to checkout",
            },
            start_point: {
              type: "string",
              description: "Starting point for the branch (optional)",
            },
            create: {
              type: "boolean",
              description: "Whether to create a new branch",
              default: false,
            },
          },
          required: ["repo_path", "branch_name"],
        },
      },
      {
        name: "git_delete_branch",
        description: "Delete a branch from the repository.",
        inputSchema: {
          type: "object",
          properties: {
            repo_path: {
              type: "string",
              description: "The path to the local Git repository",
            },
            branch_name: {
              type: "string",
              description: "The name of the branch to delete",
            },
            force: {
              type: "boolean",
              description: "Whether to force deletion",
              default: false,
            },
          },
          required: ["repo_path", "branch_name"],
        },
      },
      {
        name: "git_merge_branch",
        description: "Merge a source branch into the current or target branch.",
        inputSchema: {
          type: "object",
          properties: {
            repo_path: {
              type: "string",
              description: "The path to the local Git repository",
            },
            source_branch: {
              type: "string",
              description: "Branch to merge from",
            },
            target_branch: {
              type: "string",
              description:
                "Branch to merge into (optional, uses current branch if not provided)",
            },
            no_fast_forward: {
              type: "boolean",
              description:
                "Whether to create a merge commit even if fast-forward is possible",
              default: false,
            },
          },
          required: ["repo_path", "source_branch"],
        },
      },

      // Commit Operations
      {
        name: "git_commit_history",
        description: "Get commit history for a branch with optional filtering.",
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
        name: "git_commit",
        description: "Create a commit with the specified message.",
        inputSchema: {
          type: "object",
          properties: {
            repo_path: {
              type: "string",
              description: "The path to the local Git repository",
            },
            message: {
              type: "string",
              description: "The commit message",
            },
          },
          required: ["repo_path", "message"],
        },
      },
      {
        name: "git_track",
        description: "Track (stage) specific files or all files.",
        inputSchema: {
          type: "object",
          properties: {
            repo_path: {
              type: "string",
              description: "The path to the local Git repository",
            },
            files: {
              type: "array",
              items: { type: "string" },
              description:
                'Array of file paths to track/stage (use ["."] for all files)',
              default: ["."],
            },
          },
          required: ["repo_path"],
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

      // Remote Operations
      {
        name: "git_push",
        description: "Push changes to a remote repository.",
        inputSchema: {
          type: "object",
          properties: {
            repo_path: {
              type: "string",
              description: "The path to the local Git repository",
            },
            remote: {
              type: "string",
              description: "Remote name",
              default: "origin",
            },
            branch: {
              type: "string",
              description: "Branch to push (default: current branch)",
            },
            force: {
              type: "boolean",
              description: "Whether to force push",
              default: false,
            },
          },
          required: ["repo_path"],
        },
      },
      {
        name: "git_pull",
        description: "Pull changes from a remote repository.",
        inputSchema: {
          type: "object",
          properties: {
            repo_path: {
              type: "string",
              description: "The path to the local Git repository",
            },
            remote: {
              type: "string",
              description: "Remote name",
              default: "origin",
            },
            branch: {
              type: "string",
              description: "Branch to pull (default: current branch)",
            },
            rebase: {
              type: "boolean",
              description: "Whether to rebase instead of merge",
              default: false,
            },
          },
          required: ["repo_path"],
        },
      },

      // Stash Operations
      {
        name: "git_stash",
        description: "Create or apply a stash.",
        inputSchema: {
          type: "object",
          properties: {
            repo_path: {
              type: "string",
              description: "The path to the local Git repository",
            },
            action: {
              type: "string",
              description: "Stash action (save, pop, apply, list, drop)",
              default: "save",
              enum: ["save", "pop", "apply", "list", "drop"],
            },
            message: {
              type: "string",
              description: "Stash message (for save action)",
              default: "",
            },
            index: {
              type: "integer",
              description: "Stash index (for pop, apply, drop actions)",
              default: 0,
            },
          },
          required: ["repo_path"],
        },
      },

      // Tag Operations
      {
        name: "git_create_tag",
        description: "Create a tag.",
        inputSchema: {
          type: "object",
          properties: {
            repo_path: {
              type: "string",
              description: "The path to the local Git repository",
            },
            tag_name: {
              type: "string",
              description: "Name of the tag",
            },
            message: {
              type: "string",
              description: "Tag message (for annotated tags)",
              default: "",
            },
            annotated: {
              type: "boolean",
              description: "Whether to create an annotated tag",
              default: true,
            },
          },
          required: ["repo_path", "tag_name"],
        },
      },

      // Advanced Operations
      {
        name: "git_rebase",
        description: "Rebase the current branch onto another branch or commit.",
        inputSchema: {
          type: "object",
          properties: {
            repo_path: {
              type: "string",
              description: "The path to the local Git repository",
            },
            onto: {
              type: "string",
              description: "Branch or commit to rebase onto",
            },
            interactive: {
              type: "boolean",
              description: "Whether to perform an interactive rebase",
              default: false,
            },
          },
          required: ["repo_path", "onto"],
        },
      },

      // Configuration
      {
        name: "git_config",
        description: "Configure git settings for the repository.",
        inputSchema: {
          type: "object",
          properties: {
            repo_path: {
              type: "string",
              description: "The path to the local Git repository",
            },
            scope: {
              type: "string",
              description: "Configuration scope (local, global, system)",
              default: "local",
              enum: ["local", "global", "system"],
            },
            key: {
              type: "string",
              description: "Configuration key",
            },
            value: {
              type: "string",
              description: "Configuration value",
            },
          },
          required: ["repo_path", "key", "value"],
        },
      },

      // Repo Management
      {
        name: "git_reset",
        description: "Reset repository to specified commit or state.",
        inputSchema: {
          type: "object",
          properties: {
            repo_path: {
              type: "string",
              description: "The path to the local Git repository",
            },
            mode: {
              type: "string",
              description: "Reset mode (soft, mixed, hard)",
              default: "mixed",
              enum: ["soft", "mixed", "hard"],
            },
            to: {
              type: "string",
              description: "Commit or reference to reset to",
              default: "HEAD",
            },
          },
          required: ["repo_path"],
        },
      },
    ];

    // Set up dynamic tool listing handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.toolsList,
    }));

    // Handler categories for organization and improved discoverability
    this.handlerCategories = {
      read: [
        "git_directory_structure",
        "git_read_files",
        "git_branch_diff",
        "git_commit_history",
        "git_commits_details",
        "git_local_changes",
        "git_search_code",
      ],
      write: ["git_commit", "git_track", "git_reset"],
      branch: [
        "git_checkout_branch",
        "git_delete_branch",
        "git_merge_branch",
        "git_branch_diff",
      ],
      remote: ["git_push", "git_pull"],
      stash: ["git_stash"],
      config: ["git_config"],
      tag: ["git_create_tag"],
      advanced: ["git_rebase"],
    };

    // Create handler aliases for improved usability
    this.handlerAliases = {
      git_ls: "git_directory_structure",
      git_show: "git_read_files",
      git_diff: "git_branch_diff",
      git_log: "git_commit_history",
      git_status: "git_local_changes",
      git_grep: "git_search_code",
      git_add: "git_track",
      git_checkout: "git_checkout_branch",
      git_fetch: "git_pull",
    };

    // Initialize statistics tracking
    this.handlerStats = new Map();

    // Create a handlers mapping for O(1) lookup time
    this.handlersMap = {
      // Primary handlers
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

    // Register aliases for O(1) lookup
    Object.entries(this.handlerAliases).forEach(([alias, target]) => {
      if (this.handlersMap[target]) {
        this.handlersMap[alias] = this.handlersMap[target];
      }
    });

    // Log registered handlers
    console.error(
      `[INFO] Registered ${
        Object.keys(this.handlersMap).length
      } Git tool handlers`
    );

    // Add method to get handlers by category
    this.getHandlersByCategory = (category) => {
      return this.handlerCategories[category] || [];
    };

    // Add method to execute multiple Git operations in sequence
    this.executeSequence = async (operations) => {
      const results = [];
      for (const op of operations) {
        const { name, arguments: args } = op;
        const handler = this.handlersMap[name];
        if (!handler) {
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
        results.push(await handler(args));
      }
      return results;
    };

    // Add method to check if a repository is valid
    this.validateRepository = async (repoPath) => {
      try {
        // Implementation would verify if the path is a valid git repository
        return true;
      } catch (error) {
        return false;
      }
    };

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const startTime = Date.now();

      // Handle batch operations as a special case
      if (name === "git_batch") {
        if (!Array.isArray(args.operations)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Operations must be an array"
          );
        }
        return await this.executeSequence(args.operations);
      }

      try {
        // Resolve handler via direct match or alias
        const handler = this.handlersMap[name];
        if (handler) {
          // Track usage statistics
          const stats = this.handlerStats.get(name) || {
            count: 0,
            totalTime: 0,
          };
          stats.count++;
          this.handlerStats.set(name, stats);

          console.error(`[INFO] Executing Git tool: ${name}`);
          const result = await handler(args);

          const executionTime = Date.now() - startTime;
          stats.totalTime += executionTime;
          console.error(`[INFO] Completed ${name} in ${executionTime}ms`);

          return result;
        }

        // Suggest similar commands if not found
        const similarCommands = Object.keys(this.handlersMap)
          .filter((cmd) => cmd.includes(name.replace(/^git_/, "")))
          .slice(0, 3);

        const suggestion =
          similarCommands.length > 0
            ? `. Did you mean: ${similarCommands.join(", ")}?`
            : "";

        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}${suggestion}`
        );
      } catch (error) {
        // Enhanced error handling
        if (error instanceof McpError) {
          throw error;
        }
        console.error(`[ERROR] Failed to execute ${name}: ${error.message}`);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to execute ${name}: ${error.message}`
        );
      }
    });

    /**
     * Register a new handler at runtime
     * @param {string} name - The name of the handler
     * @param {Function} handler - The handler function
     * @param {Object} [toolInfo] - Optional tool information for ListToolsRequestSchema
     * @returns {boolean} True if registration was successful
     */
    this.registerHandler = (name, handler, toolInfo) => {
      if (typeof handler !== "function") {
        throw new Error(`Handler for ${name} must be a function`);
      }

      // Add to handlers map
      this.handlersMap[name] = handler;

      // Update tools list if toolInfo is provided
      if (toolInfo && typeof toolInfo === "object") {
        // Get current tools
        const currentTools = this.toolsList || [];

        // Add new tool info if not already present
        const exists = currentTools.some((tool) => tool.name === name);
        if (!exists) {
          this.toolsList = [...currentTools, { name, ...toolInfo }];
        }
      }

      console.error(`[INFO] Dynamically registered new handler: ${name}`);
      return true;
    };

    /**
     * Remove a handler
     * @param {string} name - The name of the handler to remove
     * @returns {boolean} True if removal was successful
     */
    this.unregisterHandler = (name) => {
      if (!this.handlersMap[name]) {
        return false;
      }

      delete this.handlersMap[name];
      console.error(`[INFO] Unregistered handler: ${name}`);
      return true;
    };
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
