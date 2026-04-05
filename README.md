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
*   **The "GPS Breadcrumb" System:** At the end of every tool call, `spec-cli` outputs an explicit "Next Step" directive. For example, if Requirements are finished, the tool outputs: *"Success: Specifications created. Next Step: Run `spec_plan` to create an implementation plan (design)."* This turns the tool into an autonomous GPS, heavily reducing the need for lengthy system prompts.
*   **Dense Markdown Context (TOON):** Instead of dumping massive JSON objects, `spec-cli` returns compact, actionable Markdown summaries that tell the AI exactly what to do next.

## The 4 Semantic Tools

| Tool Name | Purpose | Example Arguments |
| :--- | :--- | :--- |
| `spec_init` | Scaffolds a new feature/project. | `{"name": "auth-system", "description": "Add JWT auth"}` |
| `spec_plan` | Advances state & injects guidance. | `{"instruction": "Use PostgreSQL"}` |
| `spec_todo` | Manages the task list progress. | `{"action": "start", "id": "1.1"}` |
| `spec_status` | Returns a health check and next steps. | `{}` |

## Installation & Setup

### Gemini CLI
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

**Context Instruction (`GEMINI.md`):**
To ensure context efficiency, add the following to your project's `GEMINI.md`:
> "You have access to the `spec-cli` MCP server. Always use `spec_status` to orient yourself before beginning work on a feature. Rely on the `> Next Steps:` output from the tool to guide your workflow transitions autonomously. Keep manual tool usage queries to a minimum."

### Continue.dev
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

**Rule Configuration (`.continue/rules/spec-workflow.prompt`):**
To integrate this seamlessly into your Continue.dev workflow, create a rule file:
```markdown
---
name: Spec Workflow
description: Always use spec-cli to scaffold and plan new features
---
When asked to build a new feature, do not guess the architecture immediately. Instead, use the `spec_init` tool to scaffold the feature. Read the "Next Steps" provided by the tool's output to navigate the Requirements -> Design -> Implementation workflow autonomously.
```

### Cursor / VS Code (Claude Desktop)
Add the following to your `claude_desktop_config.json` or Cursor Settings:

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
    `> Success: Implementation plan created. Next Step: Run spec_plan to scaffold tasks.`
4.  **Execute:** The AI finishes the planning, runs `spec_todo {"action": "complete", "id": "1.1"}`, and begins modifying source code.

## Development

```bash
# Install dependencies
npm install

# Run the TypeScript build
npm run build

# Start the MCP server locally
npm run start

# Run test suite
npm run test
```

## License
MIT
