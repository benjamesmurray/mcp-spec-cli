# Spec CLI (MCP)

[![npm version](https://img.shields.io/npm/v/spec-cli.svg)](https://www.npmjs.com/package/spec-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.com)

[English](README.md) | [简体中文](README-zh.md)

**Spec CLI** is a state-aware Model Context Protocol (MCP) server that transforms your AI agent into a senior product engineer. It provides a robust, zero-shot "just works" workflow that guides AI to systematically move from **Requirements → Design → Tasks** with minimal token usage and maximum autonomy.

## Why Spec CLI?

The traditional approach to AI coding often leads to lost context, wandering implementations, and forgotten requirements. `spec-cli` fixes this by providing:

*   **State-Aware Autopilot:** The tool knows exactly what stage the project is in. The AI doesn't have to track whether it's doing "Requirements" or "Design"—it just calls `spec_plan` and the tool handles the transition automatically.
*   **Fuzzy Path Resolution:** The AI doesn't need to hunt for the project folder. You can say `spec_plan` and the tool instantly figures out the context from the most recently active feature (`.spec_last_used`).
*   **Dense Markdown Context (TOON):** Instead of dumping massive JSON objects, `spec-cli` returns compact, actionable Markdown summaries that tell the AI exactly what to do next.
*   **Cobra-Style Single Verbs:** Four simple commands handle the entire lifecycle.

## The 4 Semantic Tools

| Tool Name | Purpose | Example Arguments |
| :--- | :--- | :--- |
| `spec_init` | Scaffolds a new feature/project. | `{"name": "auth-system", "description": "Add JWT auth"}` |
| `spec_plan` | Advances state & injects guidance. | `{"instruction": "Use PostgreSQL"}` |
| `spec_todo` | Manages the task list progress. | `{"action": "start", "id": "1.1"}` |
| `spec_status` | Returns a health check and next steps. | `{}` |

### The "Zero-Shot" System Prompt
Because `spec-cli` coaches the AI through the workflow, your entire system prompt can be reduced to:

> "You have the `spec` workflow tool. Use `spec_status` to see current progress and follow the 'Next Steps' suggested in the tool output."

## Installation

### Cursor / VS Code (Claude Desktop)
Add the following to your `mcp.json` or `claude_desktop_config.json`:

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

## Workflow Example (AI Perspective)

1.  **Initialize:** The AI runs `spec_init {"name": "payment-gateway"}`. The tool scaffolds the project and writes a `requirements.md`.
2.  **Plan:** The AI runs `spec_plan {"instruction": "Ensure we support Stripe"}`. The tool sees `requirements.md` is complete, so it confirms it and scaffolds `design.md`, embedding the Stripe instruction directly into the document.
3.  **Implement:** The AI runs `spec_status` and sees:
    `✅ Requirements: Approved | ✅ Design: Approved | ⏳ Tasks: Pending Edits`
    `> Next Steps: Run spec_todo list or spec_todo start <id>.`
4.  **Execute:** The AI runs `spec_todo {"action": "complete", "id": "1.1"}` and begins modifying source code.

## Development

```bash
# Install dependencies
npm install

# Run the TypeScript build
npm run build

# Start the MCP server locally
npm run start
```

## License
MIT
