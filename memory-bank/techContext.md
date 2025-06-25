# Tech Context: Git Commands MCP Server

## Core Technologies

- **Language:** Node.js (JavaScript)
- **Package Manager:** Likely npm (presence of `package.json`, `package-lock.json`) or potentially Bun (presence of `bun.lock`). Requires clarification if both are used or if one is primary.
- **Core Library:** `simple-git` - A Node.js wrapper for the Git command-line interface. This is the primary mechanism for interacting with Git.
- **MCP Framework:** Relies on an underlying MCP server implementation (details likely in `src/server.js` or dependencies) to handle MCP communication.

## Development Setup

- Requires Node.js runtime installed.
- Requires Git executable installed and accessible in the system PATH.
- Dependencies are managed via `package.json` (and potentially `bun.lock`). Installation likely via `npm install` or `bun install`.
- Server is typically run using a command like `node src/index.js` or a script defined in `package.json`.

## Technical Constraints

- **Dependency on Local Git:** The use of `simple-git` inherently ties the server's execution environment to having a functional Git installation.
- **Filesystem Access Requirement:** Tools operating on `repo_path` require direct access to the host filesystem, which is problematic in isolated environments like Docker containers.
- **Authentication:** Handling authentication for remote private repositories relies on the Git configuration (e.g., SSH keys, credential helpers) available in the execution environment. This is difficult to replicate securely and consistently within a generic container.

## Tool Usage Patterns

- MCP tools are defined with JSON schemas for input validation.
- Handlers parse inputs and construct `simple-git` commands.
- Error handling wraps potential exceptions from `simple-git`.
