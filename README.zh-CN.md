# kimi-plugin-codex

**Language / 语言:** [English](README.md) | [中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.0-green.svg)](./CHANGELOG.zh-CN.md)

在 **OpenAI Codex**（本地 CLI / IDE）里，把 **[Kimi Code](https://github.com/MoonshotAI/kimi-code)** 当作 subagent 调用。

本插件是 **薄 ACP 桥**，触发方式与 [cc-plugin-codex](https://github.com/sendbird/cc-plugin-codex) 一致：**Skills + companion**。**没有 MCP 工具。** 不支持 Codex Cloud。

| | |
| --- | --- |
| **版本** | **0.2.0** |
| **宿主** | 本地 OpenAI Codex |
| **Node** | ≥ 18.18 |
| **依赖** | Kimi Code CLI + `kimi login` |
| **触发** | **仅 Skills**（`$kimi:rescue` 等） |

Claude Code / Grok 请用 **[kimi-plugin-cc](https://github.com/oppnc/kimi-plugin-cc)**。

## 主路径

```text
主 agent 发现前端/UI 工作（或用户执行 $kimi:rescue）
  → 加载 skill，路由（bg/wait、resume；保守 shaping）
  → Codex 内置 default subagent（纯管道）
  → node <plugin-root>/scripts/kimi-companion.mjs task ...
  → 本机 Kimi Code（ACP）
```

| | |
| --- | --- |
| **主入口** | **`$kimi:rescue`**（前端/UI 匹配时可隐式加载） |
| **生命周期 / 运维** | `$kimi:setup`、`$kimi:status`、`$kimi:result`、`$kimi:cancel`、`$kimi:plan`、`$kimi:goal`、`$kimi:task`、`$kimi:sessions`（仅显式；UI 走 rescue） |
| **规则** | 主 agent 负责委托；Kimi 干活；结果 **原文返回** |
| **后台** | 父线程不等；用 **`$kimi:status` / `$kimi:result`** |

示例：

```text
$kimi:rescue 用现有 design tokens 把 settings 页做成响应式
$kimi:rescue --background 按截图修布局 --image C:/path/shot.png
$kimi:status
$kimi:result
```

详见 [AGENTS.md](AGENTS.md)。

## 安装

```bash
codex plugin marketplace add /absolute/path/to/kimi-plugin-codex
codex plugin add kimi@kimi-plugin-codex
```

启用 **kimi**，必要时重启。首次：**`$kimi:setup`**。

改版本 / skills 后：

```bash
codex plugin remove kimi@kimi-plugin-codex
codex plugin add kimi@kimi-plugin-codex
```

若以前加过全局 MCP（0.3 之前），请删除：

```bash
codex mcp remove kimi
```

Windows：PATH 不完整时设 `KIMI_CLI_PATH=%USERPROFILE%\.kimi-code\bin\kimi.exe`。

## 首次验证

```text
$kimi:setup
$kimi:rescue 实现一个小的响应式 settings 区块（用现有 design tokens）
```

CLI 探针：

```bash
node plugins/kimi/scripts/kimi-companion.mjs task --mode yolo -- "Reply with exactly: kimi-bridge-ok"
```

## 命令

| 命令 | 作用 |
| --- | --- |
| `$kimi:setup` | 检查 Kimi CLI / 登录 / ACP |
| `$kimi:rescue` | 交给 Kimi（内置 subagent + companion） |
| `$kimi:status` | 查看 job |
| `$kimi:result` | 打开已完成 job 输出 |
| `$kimi:cancel` | 取消运行中 job |
| `$kimi:plan` | 仅规划模式 companion（显式；非正常前端） |
| `$kimi:goal` | Goal 成帧（显式；大任务/UI → rescue） |
| `$kimi:task` | 轻量非 UI 一次调用（显式；前端 → rescue） |
| `$kimi:sessions` | 列出 ACP sessions（显式） |

## 排查

| 症状 | 处理 |
| --- | --- |
| `BINARY_NOT_FOUND` | 装 Kimi Code；`kimi login`；`KIMI_CLI_PATH` |
| `ACP_FAILED` / `LOGIN_REQUIRED` | `kimi login`；`$kimi:setup` |
| Skills 找不到 | 重装插件并重启 Codex |
| 仍看到旧的 `kimi_*` MCP 工具 | `codex mcp remove kimi`（0.3.0 已移除 MCP） |
| 长任务还在跑 | `$kimi:status` / `$kimi:result` |
| Codex Cloud | 不支持 |

## 兼容性

| 组件 | 要求 |
| --- | --- |
| 本插件 | 0.2.0 |
| Node | ≥ 18.18 |
| Kimi Code | 可用的 `kimi acp` |
| Codex | 本地；plugin skills + 内置 subagent |

## 相关

| 包 | 宿主 |
| --- | --- |
| [kimi-plugin-cc](https://github.com/oppnc/kimi-plugin-cc) | Claude Code / Grok |
| **kimi-plugin-codex**（本仓库） | OpenAI Codex |
| [cc-plugin-codex](https://github.com/sendbird/cc-plugin-codex) | 宿主形态参考 |

维护者文档：[AGENTS.md](AGENTS.md) · 变更日志：[CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md)

## 许可证

MIT — 见 [LICENSE](./LICENSE)。
