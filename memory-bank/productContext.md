# Product Context: Git Commands MCP Server

## Problem Solved

Interacting with Git repositories often requires manual command-line usage or complex scripting. This MCP server aims to simplify Git interactions by providing a standardized, programmatic interface via MCP tools. This is particularly useful for:

- **AI Agents:** Enabling AI agents like Cline to perform Git operations as part of development tasks.
- **Automation:** Facilitating automated workflows that involve Git (e.g., CI/CD-like tasks, repository management).
- **Integration:** Providing a consistent way to integrate Git functionality into other applications or services that understand MCP.

## How It Should Work

- Users (or agents) invoke specific Git tools provided by the server (e.g., `git_directory_structure`, `git_commit`, `git_branch_diff`).
- The server receives the request, validates parameters, and routes to the appropriate handler.
- **`repo_url`-based Tools:** For tools operating on remote repositories (identified by `repo_url` parameter), the server uses a utility (`cloneRepo` in `src/utils/git.js`) to clone the repository into a temporary directory within the server's own execution environment. Subsequent operations for that request (e.g., reading files, getting history, diffing branches) are performed on this temporary local clone using `simple-git`, `fs`, or direct `git` commands (`execPromise`). This _might_ work in a container if prerequisites (Git installed, network, permissions, auth) are met.
- **`repo_path`-based Tools:** For tools operating on local repositories (identified by `repo_path` parameter), the server initializes `simple-git` directly with the provided path or uses `fs`/`execPromise` to interact with files/commands within that path. This requires the server process to have direct read/write access to the specified filesystem path. **This mode is fundamentally incompatible with standard containerized deployment (like Docker/Smithery) due to filesystem isolation.**
- The server processes the output from the underlying Git operation (via `simple-git`, `fs`, or `execPromise`) and returns a structured JSON response to the caller.

## User Experience Goals

- **Simplicity:** Abstract away the complexities of Git command-line syntax.
- **Reliability:** Execute Git commands accurately and handle errors gracefully.
- **Discoverability:** Clearly define available tools and their parameters through the MCP schema.
- **Flexibility:** Support a wide range of common Git operations for both local and remote workflows.

## Target Users

- AI Development Agents (like Cline)
- Developers building automation scripts
- Platform engineers integrating Git operations
