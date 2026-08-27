# Agent Note: DeepSeek 最小测试关闭默认思考模式

Status: implemented

## Problem

DeepSeek V4 官方接口默认开启思考模式，思考过程通过 `reasoning_content` 返回，最终可展示正文通过 `content` 返回。主模型最小测试只分配 16 个输出 Token；默认思考可能在产生最终正文前耗尽预算，使鉴权、地址和模型均有效的连接被误判为“没有返回可展示的解读内容”。

## Decision

仅当最小生成测试连接到 DeepSeek 官方服务时，请求增加 `thinking: { type: "disabled" }`。测试仍只发送一次请求并保持 16 Token 上限，用最终 `content` 验证模型是否能承担解读能力。正式报告和追问不发送该覆盖参数，继续使用模型的默认思考行为。

桌面端与 PWA 共用 `generationProbeOptions` 生成最小测试参数，避免两套运行时产生不同的费用与验收语义。其他 OpenAI Chat 兼容服务不接收 DeepSeek 专用参数。

## Alternatives considered

- 提高所有主模型最小测试的输出预算：该方案增加每次检测成本，而且仍不能保证 DeepSeek 在预算内从思考阶段进入最终正文。
- 把 `reasoning_content` 视为连接成功：该方案只能证明模型产生了内部思考，不能证明正式解读依赖的最终 `content` 可用。

## Consequences

DeepSeek 官方连接的最小测试稳定验证最终正文，同时保持单次、低预算调用；正式解读行为不受该探测参数影响。该分支依赖服务商继续支持 `thinking.type=disabled`，接口契约变化时需要更新探测适配与模拟测试。

## Verification

- Electron 模拟 DeepSeek 默认思考响应：未关闭思考时只返回 `reasoning_content`，关闭后返回最终正文。
- PWA Worker 使用相同响应模型验证只发起一次请求。
- 所有测试使用模拟响应，不发送真实模型请求。
