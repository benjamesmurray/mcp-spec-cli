# Spec CLI (MCP)

[![npm version](https://img.shields.io/npm/v/spec-cli.svg)](https://www.npmjs.com/package/spec-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.com)

[English](README.md) | [简体中文](README-zh.md)

**Spec CLI** is a state-aware Model Context Protocol (MCP) server that transforms your AI agent into a spec-driven product engineer. It provides a robust, zero-shot "just works" workflow that guides AI to systematically move from **Requirements → Design → Tasks** with minimal token usage and maximum autonomy.

## Why Spec CLI?

The traditional approach to AI coding often leads to scope creep and forgotten requirements. `spec-cli` fixes this by providing:

*   **State-Aware Autopilot:** The tool knows exactly what stage the project is in. The AI doesn't have to track whether it's doing "Requirements" or "Design"—it just calls `sc_exec plan` and the tool handles the transition automatically.
*   **Fuzzy Path Resolution:** The AI doesn't need to hunt for the project folder. You can say `sc_exec plan` and the tool instantly figures out the context from the most recently active feature (`.spec_last_used`).
*   **The "GPS Breadcrumb" System:** At the end of every tool call, `spec-cli` outputs an explicit "Next Step" directive. For example, if Requirements are finished, the tool outputs: *"Success: Specifications created. Next Step: Run `sc_exec plan` to create an implementation plan (design)."* This turns the tool into an autonomous GPS, heavily reducing the need for lengthy system prompts.
*   **Dense Markdown Context (TOON):** Instead of dumping massive JSON objects, `spec-cli` returns compact, actionable Markdown summaries that tell the AI exactly what to do next.

## Workflow Diagram

```mermaid
stateDiagram-v2
    [*] --> Requirements: sc_exec init
    Requirements --> Design: sc_exec plan (approve reqs)
    Design --> Implementation: sc_exec plan (approve design)
    Implementation --> Tasks: sc_exec todo (start/complete)
    Tasks --> [*]: All tasks completed
```

## The 4 Semantic Tools

| Tool Name | Purpose | Example Arguments |
| :--- | :--- | :--- |
| `sc_exec` | The primary workhorse tool. Performs init, plan, todo actions. | `{"action": "init", "flags": {"name": "auth-system"}}` |
| `sc_status` | Returns a health check and next steps. | `{}` |
| `sc_help` | Learn how to use the CLI tools and get deep documentation. | `{"topic": "exec"}` |
| `sc_verify` | A dedicated tool to validate that the last action worked. | `{"feature": "auth-system"}` |

## Command Reference

| Command | Description |
| :--- | :--- |
| `spec-cli exec init --name <feature>` | Initialize a new spec folder. |
| `spec-cli status` | Check current progress. |
| `spec-cli help` | Show help documentation. |

## Configuration

| Variable | Description | Default |
| :--- | :--- | :--- |
| `SPEC_DIR` | Directory for storing specifications | `./specs` |

## Installation & Setup

### Prerequisites
* **Node.js**: Version 18.0.0 or higher.
* **Package Manager**: npm, yarn, or pnpm.

### Installation Options

#### Option 1: Quick Start (npx)
Run it without installing globally:
```bash
npx -y spec-cli@latest
```

#### Option 2: Global Installation
For frequent use as a standalone CLI:
```bash
npm install -g spec-cli
```

#### Option 3: MCP Client Configuration
To use this with AI assistants, add it to your configuration file:

**Claude Desktop**
Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):
```json
{
  "mcpServers": {
    "spec-cli": {
      "command": "npx",
      "args": ["-y", "spec-cli@latest"]
    }
  }
}
```

**Cursor**
Add to `~/.cursor/config.json` (or `.cursor/mcp.json`).

**Claude Code**
```bash
claude mcp add spec-cli -s user -- npx -y spec-cli@latest
```

**Gemini CLI**
Configure `spec-cli` globally in `~/.gemini/settings.json` or locally in `.gemini/settings.json`:
```json
{
  "mcpServers": {
    "spec-cli": {
      "command": "npx",
      "args": ["-y", "spec-cli@latest"]
    }
  }
}
```
*Context Instruction (`GEMINI.md`):*
To ensure context efficiency, add the following to your project's `GEMINI.md`:
> "You have access to the `spec-cli` MCP server. Always use `sc_status` to orient yourself before beginning work on a feature. Rely on the `> Next Steps:` output from the tool to guide your workflow transitions autonomously. Keep manual tool usage queries to a minimum."

**Continue.dev**
Add the server to your `~/.continue/config.json` (or `.continue/mcpServers/tools.json`):
```json
{
  "mcpServers": [
    {
      "name": "spec-cli",
      "command": "npx",
      "args": ["-y", "spec-cli@latest"]
    }
  ]
}
```
*Rule Configuration (`.continue/rules/spec-workflow.prompt`):*
To integrate this seamlessly into your Continue.dev workflow, create a rule file:
```markdown
---
name: Spec Workflow
description: Always use spec-cli to scaffold and plan new features
---
When asked to build a new feature, do not guess the architecture immediately. Instead, use the `sc_exec` tool with the `init` action to scaffold the feature. Read the "Next Steps" provided by the tool's output to navigate the Requirements -> Design -> Implementation workflow autonomously.
```

## Workflow Example (AI Perspective)

1.  **Initialize:** The AI runs `sc_exec {"action": "init", "flags": {"name": "payment-gateway"}}`. The tool scaffolds the project and writes a `requirements.md`.
2.  **Plan:** The AI runs `sc_exec {"action": "plan", "flags": {"instruction": "Ensure we support Stripe"}}`. The tool sees `requirements.md` is complete, so it confirms it and scaffolds `design.md`, embedding the Stripe instruction directly into the document.
3.  **Implement:** The AI runs `sc_status` and sees:
    `Requirements: Approved | Design: Approved | Tasks: Pending Edits`
    `Next Step: Run sc_exec plan to scaffold tasks.`
4.  **Execute:** The AI finishes the planning, runs `sc_exec {"action": "todo", "resource": "complete", "flags": {"id": "1.1"}}`, and begins modifying source code.

## Development

### Getting Started

1.  **Clone the Repo**:
    ```bash
    git clone https://github.com/benjamesmurray/spec-cli.git
    cd spec-cli
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Build the Project**:
    ```bash
    npm run build
    ```
4.  **Watch Mode** (for active development):
    ```bash
    npm run watch
    ```

### Testing & Debugging

* **Local Testing (`npm link`)**: 
    Run `npm link` in the root directory to test the `spec-cli` command globally using your local code.
* **MCP Inspector**: 
    Use the official MCP Inspector to test the server's tools without needing Claude or Cursor:
    ```bash
    npx @modelcontextprotocol/inspector dist/index.js
    ```
* **Logging**:
    Standard MCP servers use `stderr` for logging since `stdout` is reserved for the protocol. Use `console.error()` for debugging logs as they will appear in the MCP client's log window.

### Project Structure
* `src/`: TypeScript source files.
* `src/tools/`: Definitions for the individual MCP tools.
* `dist/`: Compiled JavaScript output.

## License
MITt.

## License
MIT
MITnse
MITt.

## License
MITicense
MIT License
MIT