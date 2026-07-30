# kimi-plugin-codex

**Language / 语言:** [English](README.md) | [中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.4-green.svg)](./CHANGELOG.zh-CN.md)

在 **OpenAI Codex**（本地 CLI / IDE）里，把 **[Kimi Code](https://github.com/MoonshotAI/kimi-code)** 当作 subagent 调用。

Kimi k3 前端、多模态更强；在 Kimi Code 里更强。本插件是 **薄 ACP 桥**（skills + MCP）。**不支持 Codex Cloud**（云端没有本机 `kimi`）。

| | |
| --- | --- |
| **版本** | **0.1.4** |
| **宿主** | 本地 OpenAI Codex |
| **Node** | ≥ 18.18 |
| **依赖** | Kimi Code CLI + `kimi login` |

Claude Code / Grok 请用 **[kimi-plugin-cc](https://github.com/oppnc/kimi-plugin-cc)**。

## 主路径（含长前端）

| | |
| --- | --- |
| **工具** | MCP **`kimi_rescue`** → `still_running` 时轮询 **`kimi_status` / `kimi_result`** |
| **适用** | 前端/UI、CSS/布局、截图/**视频**、多文件实现 |
| **说法** | 交给 Kimi；**等待切片结束 ≠ 失败**，继续 poll 直到 completed |

`kimi_rescue` 会起 **后台 job**，默认先等约 **120s**；长 UI 常需多轮 poll，或 `resume` + 新截图。

示例：

> 用 kimi_rescue 做这个前端任务。若 still_running，继续 poll 直到完成；结果原文返回。后续截图用 resume:true + image。

详见 [AGENTS.md](AGENTS.md)。

## 安装

Codex 安装偏 **本地 marketplace**（宿主策略限制）。常见流程：

```bash
# 在本仓库 clone 根目录
codex plugin marketplace add /absolute/path/to/kimi-plugin-codex
codex plugin add kimi@kimi-plugin-codex
```

启用 **kimi**，必要时重启。首次：skill **`kimi-setup`** 或 MCP **`kimi_setup`**。

### MCP 工具一直不出现

1. 确认版本 **0.1.4+**（`mcpServers` + NDJSON；长任务用 job + 轮询）。
2. 重装刷新缓存：

```bash
codex plugin remove kimi@kimi-plugin-codex
codex plugin add kimi@kimi-plugin-codex
```

3. 仍没有则用绝对路径全局 MCP：

```bash
codex mcp add kimi -- node /absolute/path/to/kimi-plugin-codex/plugins/kimi/scripts/kimi-mcp.mjs
```

说明：**`kimi_rescue` 是 MCP 工具名**，不是 shell 命令；PATH 上的 `kimi.exe` 是 Kimi Code CLI。

Windows：PATH 不完整时设 `KIMI_CLI_PATH=%USERPROFILE%\.kimi-code\bin\kimi.exe`。

## 首次验证（装完做一次）

### 1) 诊断

```bash
node plugins/kimi/scripts/kimi-companion.mjs setup
# 或在 Codex 里：kimi_setup / kimi-setup
```

期望 `acp probe: ok` 和 **Next (first verify)**。

### 2) 把前端任务交给 Kimi

在 Codex 里：

> 用 kimi_rescue 实现一个小的响应式 settings 区块（用现有 design tokens），改动尽量少，结果原文返回。

CLI 探针：

```bash
node plugins/kimi/scripts/kimi-companion.mjs task --mode yolo -- "Reply with exactly: kimi-bridge-ok"
```

## 排查

| 症状 | 处理 |
| --- | --- |
| `BINARY_NOT_FOUND` | 装 Kimi Code；`kimi login`；`KIMI_CLI_PATH` |
| `ACP_FAILED` / `LOGIN_REQUIRED` | 普通终端 `kimi login` 后重跑 setup |
| MCP 无工具 | 上面的绝对路径 `codex mcp add` |
| 长任务被掐断 | 插件已加长超时；或 start + status（高级） |
| Codex Cloud | 不支持 |
| `MEDIA_NOT_FOUND` | 绝对路径或工作区内相对路径 |

错误以 `[kimi-plugin]` 开头并带 **Fix** 列表。

## 兼容性

| 组件 | 要求 |
| --- | --- |
| 本插件 | 0.1.4 |
| Node | ≥ 18.18 |
| Kimi Code | 支持 `kimi acp` 的 CLI |
| Codex | 仅本地 |

## 相关仓库

| 包 | 宿主 |
| --- | --- |
| [kimi-plugin-cc](https://github.com/oppnc/kimi-plugin-cc) | Claude Code / Grok |
| **kimi-plugin-codex**（本仓库） | OpenAI Codex |

维护者：[AGENTS.md](AGENTS.md) · 变更：[CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md)

## 许可证

MIT — 见 [LICENSE](./LICENSE)。
