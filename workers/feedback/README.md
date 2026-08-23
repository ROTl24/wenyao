# 问爻反馈服务

该 Worker 只接收反馈、脱敏技术快照以及用户逐次明确选择上传的问答原文。客户端不会发送设备标识、API Key、接口地址、连接名称、导入书名或古籍正文。

## Cloudflare 配置

1. 创建 D1 数据库，将 `wrangler.toml` 的 `database_id` 替换为真实 ID。
2. 对数据库执行 `schema.sql`。
3. 设置 `ALLOWED_ORIGINS`、`DETAIL_RETENTION_DAYS` 和 `ADMIN_EMAILS`。
4. 为 `/admin` 与 `/api/admin/*` 配置 Cloudflare Access；Worker 还会校验 Access 注入的登录邮箱。
5. 将生产域名的 `/api/feedback*` 路由到该 Worker，并让客户端 `config/feedback.json` 指向同一第一方地址；配置保持关闭 `workers.dev` 与预览地址，避免绕过 Access 路由。

定时任务会删除超过保留期的明细。按日聚合表不含问题、回答或设备标识，可在明细到期后继续保留。管理页支持评价、原因、模型、版本和检索模式筛选，并可导出 CSV 或 JSON。
