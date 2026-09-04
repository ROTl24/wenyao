# Agent Note: OpenAI Chat 探测与响应采用跨运行时共享契约

Status: implemented

## Problem

生成模型的最小测试曾统一限制为 16 个输出 Token。带推理能力的模型可能在产生最终正文前耗尽这部分预算，返回 `finish_reason: "length"`、空 `content` 和非空 `reasoning_content`；鉴权、地址和模型均有效的连接因此被误报为协议不兼容。桌面端与 PWA 又分别读取字符串 `content`，不能一致处理兼容服务返回的文本块数组，也不能区分额度耗尽、只有推理过程、非文本结果和响应结构错误。

## Decision

所有 OpenAI Chat 生成模型的单次最小测试使用 512 Token 输出上限。探测请求未明确指定采样参数时不发送 `temperature`，减少推理模型和兼容网关对可选参数的分歧。最小测试仍只发送一次请求，不因错误或超时自动重试。

桌面端与 PWA 通过 `shared/chat-completion-core.cjs` 解析 Chat 响应。可展示正文允许标准字符串以及 `text`、`output_text` 文本块；空正文按 `finish_reason`、推理输出、工具调用或拒答信号分类。`reasoning_content` 只用于诊断，不能替代正式解读依赖的最终正文。

DeepSeek 官方连接的最小测试继续使用其明确支持的 `thinking: { type: "disabled" }` 协议参数。该适配按服务协议而非模型名称生效，正式报告与追问不发送此覆盖参数。

正式报告和追问不设置应用侧输入 Token 限制，也不传入 `max_tokens` 或 `max_completion_tokens`。Provider 仅在调用方明确给出输出预算时序列化 `max_tokens`，因此最小测试继续使用 512 Token，而正式生成由服务商模型的上下文窗口与输出能力决定。

## Alternatives considered

- 继续使用 16 Token 通用预算：该预算无法覆盖带推理阶段的有效模型，仍会把输出额度耗尽误判为连接失败。
- 把 `reasoning_content` 当作正式正文：内部推理不满足可展示内容契约，也不能替代用户可见的最终回答。
- 失败后自动提高预算并重试：额外请求会扩大真实模型调用的费用和不确定性，不满足单次最小测试边界。
- 为正式报告固定使用 8192 Token：推理模型可能在生成可展示正文前用尽该预算，且这个探测式默认值没有正式输出契约依据。
- 正式报告全局关闭思考：会改变模型行为和解读质量，不能作为修复应用输出上限的替代方案。

## Consequences

新的探测预算能覆盖短推理后再输出“连接成功”的模型，同时保持单次、有限输出的费用边界。仍在 512 Token 内耗尽预算的模型会收到明确的输出额度错误；只返回推理过程、工具调用或非 Chat 结构时分别给出对应操作建议。网页流式响应只记录是否出现推理内容，不保留或展示内部推理文本。

正式请求省略应用 Token 上限后不会再恰好在问爻默认的 8192 Token 处终止。服务商或具体模型仍可施加上下文与输出硬限制，更长的推理和正文也可能增加费用与等待时间；失败仍只报告并等待用户手动操作，不自动重试。

## Verification

- Electron 与 PWA Provider 分别覆盖字符串正文、文本块正文和推理耗尽预算响应。
- Electron Runtime 与 PWA Worker 验证任意服务商共用 512 Token 探测预算，DeepSeek 官方适配仍只发一次请求。
- Electron 正式调用、Electron Provider 与 PWA Provider 分别验证正式请求不含 `max_tokens` 或 `max_completion_tokens`，显式探测预算仍按原协议发送。
- 完整单元测试、Electron 测试、类型检查、PWA 构建与静态产物验证覆盖两条运行路径。
