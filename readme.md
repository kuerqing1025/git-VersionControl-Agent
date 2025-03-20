# MCP Git Repo Browser (Node.js)

A Node.js implementation of a Git repository browser using the Model Context Protocol (MCP).

## Configuration

Add this to your MCP settings configuration file:

```json
{
  "mcpServers": {
    "git-commands-mcp": {
      "command": "node",
      "args": ["/path/to/git-commands-mcp/src/index.js"]
    }
  }
}
```

## Features

The server provides the following tools:

### Basic Repository Operations

1. `git_directory_structure`: Returns a tree-like representation of a repository's directory structure

   - Input: Repository URL
   - Output: ASCII tree representation of the repository structure

2. `git_read_files`: Reads and returns the contents of specified files in a repository
   - Input: Repository URL and list of file paths
   - Output: Dictionary mapping file paths to their contents

### Branch Operations

3. `git_branch_diff`: Compare two branches and show files changed between them
   - Input: Repository URL, source branch, target branch, and optional show_patch flag
   - Output: JSON with commit count and diff summary

### Commit Operations

4. `git_commit_history`: Get commit history for a branch with optional filtering

   - Input: Repository URL, branch name, max count, author filter, and since date
   - Output: JSON with commit details

5. `git_commits_details`: Get detailed information about commits including full messages and diffs

   - Input: Repository URL, branch name, max count, and include_diff flag
   - Output: JSON with detailed commit information

6. `git_local_changes`: Get uncommitted changes in the working directory
   - Input: Local repository path
   - Output: JSON with status information and diffs

## Project Structure

```
git-commands-mcp/
├── src/
│   ├── index.js         # Entry point
│   ├── server.js        # Main server implementation
│   ├── handlers/        # Tool handlers
│   │   └── index.js     # Tool implementation functions
│   └── utils/           # Utility functions
│       └── git.js       # Git-related helper functions
├── package.json
└── readme.md
```

## Implementation Details

- Uses Node.js native modules (crypto, path, os) for core functionality
- Leverages fs-extra for enhanced file operations
- Uses simple-git for Git repository operations
- Implements clean error handling and resource cleanup
- Creates deterministic temporary directories based on repository URL hashes
- Reuses cloned repositories when possible for efficiency
- Modular code structure for better maintainability

## Requirements

- Node.js 14.x or higher
- Git installed on the system

## Installation

```bash
git clone <repository-url>
cd git-commands-mcp
npm install
```

## Usage

Start the server:

```bash
node src/index.js
```

The server runs on stdio, making it compatible with MCP clients.

## License

MIT License - see the [LICENSE](LICENSE) file for details.
