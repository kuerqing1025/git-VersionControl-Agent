# System Patterns: Git Commands MCP Server

## Core Architecture

The server follows a standard MCP server pattern:

1.  **Initialization:** Sets up an MCP server instance (`src/server.js`).
2.  **Tool Registration:** Defines and registers available Git tools with their input schemas (`src/handlers/index.js`). Each tool corresponds to a specific Git operation.
3.  **Request Handling:** Listens for incoming MCP requests. When a tool is invoked, the server routes the request to the appropriate handler function.
4.  **Git Interaction:** Handler functions utilize the `simple-git` library (`src/utils/git.js`) to interact with the Git command-line executable.
5.  **Response Formatting:** Handler functions process the output from `simple-git` (or handle errors) and return a structured JSON response conforming to the MCP standard.

## Key Design Patterns

- **Handler Mapping:** A map (`this.handlersMap` in `src/handlers/index.js`) associates tool names (e.g., `git_clone`) with their corresponding implementation functions (e.g., `handleGitClone`).
- **Tool Listing:** A separate list (`this.toolsList` in `src/handlers/index.js`) defines the tools exposed via the MCP interface, including their schemas. This ensures separation between internal implementation and external interface definition.
- **Categorization:** Handlers are grouped into categories (`this.handlerCategories` in `src/handlers/index.js`) for organization, although this is primarily for internal code structure.
- **Wrapper Library:** Abstraction of direct Git command execution through the `simple-git` library. This simplifies handler logic but introduces a dependency on the local Git environment.

## Critical Implementation Paths

- **`repo_path`-based Operations:** Tools accepting a `repo_path` parameter (e.g., `git_commit`, `git_push`, `git_local_changes`, `git_checkout_branch`) initialize `simpleGit` directly with this path or use `fs`/`execPromise` within this path. This requires the server process to have direct read/write access to the specified local filesystem path. **This path is incompatible with standard container isolation.**
- **`repo_url`-based Operations:** Tools accepting a `repo_url` parameter (e.g., `git_directory_structure`, `git_read_files`, `git_commit_history`) use the `cloneRepo` utility (`src/utils/git.js`). This clones the remote repo into a temporary directory within the server's execution environment (`os.tmpdir()`) and performs operations on that temporary clone. **This path _might_ be adaptable to containerization if prerequisites are met.**
- **Direct Command Execution:** Some tools (`git_search_code`, `git_lfs`, `git_lfs_fetch`) use `execPromise` to run `git` or `git lfs` commands directly, relying on these being available in the server environment's PATH.

## Dependencies

- **Local Git Installation:** `simple-git` and direct `git` commands require a functional Git executable available in the system's PATH where the server runs.
- **Node.js `fs` Module:** Used for direct file operations in some handlers (e.g., `handleGitHooks`, `handleGitAttributes`, reading files from temporary clones).
- **Node.js `os` Module:** Used by `cloneRepo` to determine the temporary directory location.
- **Node.js `crypto` Module:** Used by `cloneRepo` to generate deterministic temporary directory names.
- **Filesystem Access (`repo_path` tools):** Require direct read/write access to the user-specified local repository paths.
- **Filesystem Access (`repo_url` tools):** Require write access to the server's temporary directory (`os.tmpdir()`).
- **Network Access (`repo_url` tools):** Require network connectivity to clone remote Git repositories.
- **Authentication (`repo_url` tools):** Cloning private remote repositories requires credentials (e.g., SSH keys, HTTPS tokens) to be configured and accessible within the server's execution environment. This is a major challenge for containerized deployments.
- **Optional Tools:** `git lfs` commands require the `git-lfs` extension to be installed in the server's environment.
