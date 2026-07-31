# API 接入契约

本地默认地址：`http://localhost:4100`，Swagger：`/docs`。公开接口与用户接口不接受管理员的 `X-App-Id` 范围替换，所有跨应用访问都由服务端校验。

Flutter Web 或其他独立前端域名必须加入逗号分隔的 `CORS_ORIGINS`。生产环境使用精确 Origin，不使用 `*`。

## 用户认证

- `POST /v1/auth/guest`：传入 `appId` 与设备持久化的 `guestId`。
- `POST /v1/auth/email/register`、`POST /v1/auth/email/login`：仅当应用开启邮箱认证时可用。
- `POST /v1/auth/exchange`：宿主 App 的服务端签发换票请求，客户端不保存 SDK Secret。
- `POST /v1/auth/refresh`、`POST /v1/auth/logout`：轮换或撤销刷新令牌。

换票签名原文：

```text
{appId}.{externalUserId}.{timestamp}.{nonce}
```

使用应用凭证的 Secret 计算 HMAC-SHA256，输出小写十六进制字符串。`timestamp` 使用 Unix 毫秒；有效窗口 5 分钟；`nonce` 在 10 分钟内不可复用。

## 对话

- `POST /v1/conversations`：创建 Web 或 Flutter 对话。
- `GET /v1/conversations`：读取当前用户的历史对话。
- `GET /v1/conversations/:id`：读取消息历史。
- `POST /v1/conversations/:id/messages:stream`：以 POST + SSE 发送消息。
- `POST /v1/conversations/:id/resolution`：用户确认已解决或未解决。
- `POST /v1/conversations/:id/close`：关闭并触发异步总结。

SSE 事件顺序：

```text
message.start
knowledge.source (0..n)
message.delta (1..n)
conversation.state
message.completed | error
```

客户端应使用 `clientMessageId` 做安全重试。服务端以 `(conversationId, clientMessageId)` 保证用户消息幂等。

Flutter 应优先使用仓库内的 `feedback_agent_flutter` SDK。自定义客户端必须正确处理跨网络分块的 SSE、401 后的 Refresh Token 轮换，以及 `error` 事件。

## 管理端

管理员先调用 `POST /v1/admin/auth/login`，其余管理接口携带 Bearer Token。全局页面省略 `X-App-Id` 表示“全部应用”；应用级页面必须传具体 UUID。

- 应用：`/v1/admin/apps`
- 总览：`/v1/admin/dashboard`
- 对话：`/v1/admin/conversations`
- 反馈：`/v1/admin/feedback`
- 需求草稿：`/v1/admin/requirements`
- 未解决队列：`/v1/admin/unresolved`
- FAQ/PDF/单页 URL：`/v1/admin/knowledge`
- 手动报告：`/v1/admin/reports`

AI 只能创建 `DRAFT` 需求；状态确认、合并、规划和拒绝都由管理员接口完成。

## 知识与模型

聊天模型按应用配置，默认模板为 OpenAI-compatible DeepSeek。未配置密钥时启用本地可测试回退逻辑，不会伪造知识答案。

Embedding 是平台级 OpenAI-compatible 配置。向量维度首次写入后锁定；更换不同维度的模型前必须清空向量并重建索引。没有 Embedding 时仍可使用 `pg_trgm` 文本检索。
