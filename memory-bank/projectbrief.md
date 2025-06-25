# Project Brief: Git Commands MCP Server

## Core Goal

To provide a Model Context Protocol (MCP) server that exposes common and advanced Git commands as tools. This allows users (or AI agents) to interact with Git repositories programmatically through the MCP interface.

## Key Features

- Expose a range of Git operations (cloning, committing, branching, merging, diffing, etc.) as distinct MCP tools.
- Operate on both remote repositories (via URL) and local repositories (via path).
- Return structured information from Git commands.

## Current Scope

The server currently implements a variety of Git commands using the `simple-git` library, which wraps the local Git executable.

## Project Status

Actively developed. A recent Pull Request proposes adding Docker and Smithery configuration for deployment, but there are concerns about compatibility due to the server's reliance on local Git execution via `simple-git`.
