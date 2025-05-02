# Active Context: Git Commands MCP Server (2025-05-02)

## Current Focus

Completed a full code review of the `git-commands-mcp` server (`src/` directory) to understand its implementation details before evaluating the Smithery deployment PR. The review confirms the initial concern regarding containerization compatibility.

## Recent Changes

- Memory Bank initialized with core documentation files.
- Reviewed all source files in `src/`: `index.js`, `server.js`, `utils/git.js`, and all handler files in `src/handlers/`.

## Next Steps

1.  **Update Memory Bank:** Refine `productContext.md`, `systemPatterns.md`, and `progress.md` based on the detailed code review findings.
2.  **Present Findings:** Communicate the detailed analysis of `repo_url` vs. `repo_path` tool implementation and the resulting container incompatibility to the user.
3.  **Discuss Smithery PR:** Re-engage on the Smithery PR, specifically asking for the `Dockerfile` and config file contents, now with the full context of the server's limitations.
4.  **Evaluate Options:** Discuss potential paths forward regarding the Smithery deployment (e.g., deploying a limited subset of tools, modifying the server, or concluding it's unsuitable for this deployment model).

## Active Decisions & Considerations

- **Confirmation of Incompatibility:** The code review confirms that tools using `repo_path` directly interact with the local filesystem path provided, making them incompatible with standard container isolation.
- **`repo_url` Tool Feasibility:** Tools using `repo_url` operate on temporary clones within the server's environment. These _could_ work in a container if prerequisites (Git, network, permissions, auth) are met, but auth remains a major hurdle.
- **Deployment Scope:** Any potential Smithery deployment would likely be limited to the `repo_url`-based tools, significantly reducing the server's advertised functionality.

## Key Learnings/Insights

- **Explicit Design Distinction:** The codebase clearly separates `repo_url` tools (using `cloneRepo` for temporary local copies) from `repo_path` tools (using `simpleGit` or `fs` directly on the provided path).
- **Filesystem Dependency:** Many tools, including hooks and attributes management, rely on direct `fs` access within the target `repo_path`, further cementing the local execution dependency.
- **`execPromise` Usage:** Some tools (`git_search_code`, `git_lfs`, `git_lfs_fetch`) use direct command execution (`execPromise`), adding another layer of dependency on the execution environment's PATH and installed tools (like `git lfs`).
