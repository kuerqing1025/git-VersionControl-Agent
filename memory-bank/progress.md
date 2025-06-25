# Progress & Status: Git Commands MCP Server (2025-05-02)

## What Works

- The MCP server successfully exposes a wide range of Git commands as tools, defined in `src/server.js`.
- **`repo_url`-based Tools:** These tools (e.g., `git_directory_structure`, `git_read_files`, `git_commit_history`) function by cloning the remote repo into a temporary directory within the server's environment (`os.tmpdir()`) and operating on that clone. This works reliably when the server runs locally with network access and appropriate credentials (if needed).
- **`repo_path`-based Tools:** These tools (e.g., `git_commit`, `git_push`, `git_local_changes`, `git_checkout_branch`) function correctly _only when the server process has direct filesystem access_ to the specified `repo_path`.

## What's Left to Build / Current Tasks

- **Evaluate Smithery Deployment PR:** Analyze the feasibility of the proposed Docker/Smithery deployment in light of the confirmed incompatibility of `repo_path`-based tools with containerization. This requires reviewing the PR's `Dockerfile` and Smithery config file.
- **Address Container Compatibility:** Decide how to handle the incompatibility issue. Options include:
  - Deploying only the `repo_url`-based tools.
  - Modifying the server architecture (significant effort).
  - Rejecting the containerized deployment approach for this server.

## Current Status

- **Code Review Complete:** Full review of `src/` directory completed.
- **Memory Bank Updated:** Core memory bank files created and refined based on code review.
- **Blocked:** Further action on the Smithery PR is blocked pending review of its specific files (`Dockerfile`, config) and a decision on how to handle the `repo_path` tool incompatibility.

## Known Issues

- **Fundamental Container Incompatibility (`repo_path` tools):** Tools requiring `repo_path` cannot function in a standard isolated container (like Docker/Smithery) because the container lacks access to the user-specified host filesystem paths.
- **Container Prerequisites (`repo_url` tools):** For `repo_url` tools to work in a container, the container needs:
  - Git installed.
  - Network access.
  - Write permissions to its temporary directory.
  - A mechanism to handle authentication for private repositories (major challenge).
- **Dependency on Local Tools:** Some handlers rely on `git lfs` being installed locally.

## Evolution of Decisions

- The initial design leveraging `simple-git` and direct filesystem access (`repo_path`) is effective for local use but unsuitable for standard containerized deployment.
- The `cloneRepo` utility for `repo_url` tools provides a potential (but limited) path for containerization, focusing only on remote repository interactions.
- The Smithery PR necessitates a decision on whether to adapt the server, limit its deployed scope, or abandon containerization for this specific MCP.
