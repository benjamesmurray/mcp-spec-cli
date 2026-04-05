# Spec CLI (MCP)

[![npm version](https://img.shields.io/npm/v/spec-cli.svg)](https://www.npmjs.com/package/spec-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.com)

[English](README.md) | [简体中文](README-zh.md)

**Spec CLI** 是一个具备“状态感知”能力的 Model Context Protocol (MCP) 服务器。它能将您的 AI 助手转化为资深产品工程师，通过提供一个稳健的、"开箱即用"的工作流，引导 AI 按照 **需求 → 设计 → 任务** 的标准流程系统性地完成软件开发，在此过程中最大程度减少 Token 消耗并赋予 AI 最高自治权。

## 为什么选择 Spec CLI？

传统的 AI 编程通常会导致上下文丢失、实现偏离目标以及需求被遗忘。`spec-cli` 通过以下方式解决了这些问题：

*   **状态感知与自动驾驶：** 工具确切知道项目当前所处的阶段。AI 不需要自行跟踪目前是在进行“需求分析”还是“架构设计”——只需调用 `spec_plan`，工具会自动处理状态切换。
*   **模糊路径解析：** AI 不需要费力寻找项目文件夹位置。只需输入 `spec_plan`，工具就会通过最近活动的功能记录 (`.spec_last_used`) 即时定位上下文。
*   **"GPS" 导航系统：** 在每次工具调用结束时，`spec-cli` 会输出明确的“下一步”指令。例如，如果需求分析已完成，工具会输出：*"Success: Specifications created. Next Step: Run `spec_plan` to create an implementation plan (design)."* 这种机制让工具变成了自动导航的 GPS，极大地减少了对冗长系统提示词的依赖。
*   **高密度 Markdown 上下文 (TOON)：** `spec-cli` 不再返回庞大的 JSON 对象，而是返回紧凑、具备操作指导意义的 Markdown 摘要，直接告诉 AI 下一步该做什么。

## 4 个语义化核心工具

| 工具名称 | 作用 | 参数示例 |
| :--- | :--- | :--- |
| `spec_init` | 初始化新功能/项目脚手架。 | `{"name": "auth-system", "description": "添加 JWT 认证"}` |
| `spec_plan` | 推进工作流状态并注入指导信息。 | `{"instruction": "使用 PostgreSQL"}` |
| `spec_todo` | 管理任务列表及进度。 | `{"action": "start", "id": "1.1"}` |
| `spec_status` | 返回健康检查状态及后续步骤建议。 | `{}` |

## 安装与配置指南

### Gemini CLI
在全局 `~/.gemini/settings.json` 或项目本地 `.gemini/settings.json` 中配置 `spec-cli`：

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

**上下文引导指令 (`GEMINI.md`)：**
为了确保上下文效率，请将以下内容添加到您项目的 `GEMINI.md` 中：
> "You have access to the `spec-cli` MCP server. Always use `spec_status` to orient yourself before beginning work on a feature. Rely on the `> Next Steps:` output from the tool to guide your workflow transitions autonomously. Keep manual tool usage queries to a minimum."

### Continue.dev
将服务器添加到您的 `~/.continue/config.json` (或 `.continue/mcpServers/tools.json`)：

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

**规则配置 (`.continue/rules/spec-workflow.prompt`)：**
为了将其无缝集成到您的 Continue.dev 工作流中，请创建一个规则文件：
```markdown
---
name: Spec Workflow
description: Always use spec-cli to scaffold and plan new features
---
When asked to build a new feature, do not guess the architecture immediately. Instead, use the `spec_init` tool to scaffold the feature. Read the "Next Steps" provided by the tool's output to navigate the Requirements -> Design -> Implementation workflow autonomously.
```

### Cursor / VS Code (Claude Desktop)
将以下配置添加到您的 `claude_desktop_config.json` 或 Cursor Settings 中：

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

## AI 视角下的工作流示例

1.  **初始化 (Initialize):** AI 执行 `spec_init {"name": "payment-gateway"}`。工具生成项目目录并写入 `requirements.md`。
2.  **计划 (Plan):** AI 执行 `spec_plan {"instruction": "确保支持 Stripe"}`。工具检测到 `requirements.md` 已完善，于是自动确认该阶段并生成 `design.md`，同时将关于 Stripe 的指令直接嵌入到设计文档中。
3.  **实施 (Implement):** AI 执行 `spec_status` 后看到如下状态：
    `✅ Requirements: Approved | ✅ Design: Approved | ⏳ Tasks: Pending Edits`
    `> Success: Implementation plan created. Next Step: Run spec_plan to scaffold tasks.`
4.  **执行 (Execute):** AI 完成计划后执行 `spec_todo {"action": "complete", "id": "1.1"}`，并开始修改实际源代码。

## 开发

```bash
# 安装依赖
npm install

# 运行 TypeScript 构建
npm run build

# 本地启动 MCP 服务器
npm run start

# 运行测试
npm run test
```

## 许可证
MIT