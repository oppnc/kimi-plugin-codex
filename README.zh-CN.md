# kimi-plugin-codex

**Language / 语言:** [English](README.md) | [中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-green.svg)](./CHANGELOG.zh-CN.md)

这个插件只做一件事：在 **OpenAI Codex / ChatGPT** 里把 [Kimi Code](https://github.com/MoonshotAI/kimi-code) 作为 subagent 调用。

Kimi k3 的前端、多模态能力很强；放在熟悉的环境 Kimi Code 里会更强。如果你不想直接用 kimi code，想给主 Agent 补强前端，或把有限的 kimi tokens 花在刀刃上——你来对了。

用过 Codex / ChatGPT 都知道，GPT 的前端能力堪比 15 年前的新手大学生，可也不得不承认，Codex / ChatGPT 的产品做得确实好，GPT 的工程能力确实强。现在通过 kimi-plugin-codex 来提升你的前端能力。

只做薄 ACP 桥接，不重写 Kimi 的 system prompt。工具、swarm、skills、模型仍由 Kimi Code 自己负责，给 Kimi k3 最熟悉的环境。

| | |
| --- | --- |
| **版本** | **0.1.0** |
| **宿主** | OpenAI Codex / ChatGPT（本地） |
| **Node** | ≥ 18.18 |
| **仓库** | [github.com/oppnc/kimi-plugin-codex](https://github.com/oppnc/kimi-plugin-codex) |

> 变更日志：[中文](CHANGELOG.zh-CN.md) · [English](CHANGELOG.md)  
> 安全：[SECURITY.md](SECURITY.md) · 维护者：[AGENTS.md](AGENTS.md)

这不是 Claude Code 包。CC / Grok 请用 **[kimi-plugin-cc](https://github.com/oppnc/kimi-plugin-cc)**。

## 功能

| 功能 | 方式 |
| --- | --- |
| 完整 Kimi agent | `kimi acp` → `session/prompt` |
| 模式 | `default` \| `plan` \| `auto` \| `yolo` |
| 多模态 | 图片 / 视频 / 媒体路径 |
| Goals | Goal 交接 |
| 续聊 | 同一 Kimi session 续跑 |
| 任务记录 | 状态 / 结果 / 取消 |
| 宿主 UX | Skill 一次交接 → MCP `kimi_rescue` |

## 环境要求

- Node.js ≥ 18.18
- 已安装并登录 [Kimi Code CLI](https://github.com/MoonshotAI/kimi-code)（`kimi login`）
- 本地 Codex（CLI 或 IDE）。**不支持 Codex Cloud**（云端无本机 `kimi`）

## 安装

在仓库根目录（marketplace 文件在 `.agents/plugins/marketplace.json`）：

```bash
codex plugin marketplace add /absolute/path/to/kimi-plugin-codex
codex plugin add kimi@kimi-plugin-codex
```

在 Codex 中启用 **kimi**，必要时重启。首次使用可让 Codex 跑一次 setup / 诊断（skill **`kimi-setup`**）。

已安装用户要拿到新版本：更新 marketplace 后重装 **kimi**（声明的 `version` 变化才会刷新）。

若安装后 MCP 工具未出现，见 [AGENTS.md](AGENTS.md) 中的回退注册方式。

## 怎么用

在 Codex 里把需要 Kimi 做的事交给它即可，例如：

- 前端 / UI / 看图找布局问题  
- 多文件实现、主 Agent 卡住时的补强  
- 带明确完成标准的长目标  

主路径是 **一次交接**（`kimi_rescue`）：把任务交给 Kimi，等结果，**原文回传**。  
不需要自己拼 system prompt，也不要在委派期间并行抢同一任务。

## 相关仓库

| 包 | 宿主 |
| --- | --- |
| [kimi-plugin-cc](https://github.com/oppnc/kimi-plugin-cc) | Claude Code / Grok |
| **kimi-plugin-codex**（本仓库） | OpenAI Codex |

## 许可证

MIT — 见 [LICENSE](./LICENSE)。  
Kimi Code 为独立项目，许可证以官方仓库为准。

---

**English:** [README.md](README.md)
