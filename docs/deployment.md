# 生产部署与运维

## 单机 Docker Compose

生产 Compose 构建 API、Worker、Next.js Web 和 Nginx Admin 镜像，并运行 PostgreSQL/pgvector、Redis 与 MinIO。

```sh
cp .env.production.example .env.production
```

至少替换以下值：

- `POSTGRES_PASSWORD`、`REDIS_PASSWORD`、`MINIO_ROOT_PASSWORD`；
- `JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET`；
- `APP_ENCRYPTION_KEY`；
- `ADMIN_EMAIL`、`ADMIN_PASSWORD`；
- `PUBLIC_API_URL`、`PUBLIC_WEB_URL`、`PUBLIC_ADMIN_URL`；
- 真实模型与 Embedding 配置（如需要）。

安全随机值可以这样生成：

```sh
openssl rand -hex 48       # JWT secret
openssl rand -base64 32    # APP_ENCRYPTION_KEY
```

先验证解析结果，再构建启动：

```sh
pnpm prod:config
pnpm prod:build
pnpm prod:up
pnpm prod:bootstrap
```

`prod:bootstrap` 是显式的一次性操作，用于创建管理员和 `demo` 应用；数据库种子采用 upsert，可安全重跑，但不会覆盖已有管理员密码。数据库迁移会在 API 启动前自动执行。

查看状态与日志：

```sh
docker compose --env-file .env.production \
  -f infra/docker-compose.prod.yml ps
pnpm prod:logs
```

## 域名与 TLS

建议在 Compose 前使用 Caddy、Traefik、Nginx 或云负载均衡器终止 TLS：

- `feedback.example.com` → Web `:3000`；
- `feedback-api.example.com` → API `:4100`；
- `feedback-admin.example.com` → Admin `:8848`。

`PUBLIC_API_URL` 会在 Next.js 镜像构建时写入浏览器包，改变 API 域名后必须重新构建 Web 镜像。`PUBLIC_WEB_URL`、`PUBLIC_ADMIN_URL` 和逗号分隔的 `CORS_ORIGINS` 是 API 允许的精确 Origin；不要在生产使用通配符。

MinIO Console 默认映射到 `MINIO_CONSOLE_PORT`。公网部署应通过防火墙/VPN 限制访问，或删除该端口映射。

## 数据持久化与备份

Compose 使用三个具名卷：

- `postgres_data`：业务数据、LangGraph checkpoint 和向量；
- `redis_data`：BullMQ 队列与重试状态；
- `minio_data`：上传的 PDF 等原始对象。

最低备份策略：

1. 每日 `pg_dump`，并定期验证恢复；
2. 对象存储启用版本化或增量备份；
3. 在模型、Embedding 维度或迁移升级前创建快照；
4. 将 `.env.production` 和密钥放入 Secret Manager，不进入 Git 或镜像。

Redis 不是业务事实来源，但丢失会影响排队和重试任务；生产环境仍应保留 AOF，并监控失败队列。

## 扩容

- API 无本地会话状态，可横向扩展；所有实例连接同一 PostgreSQL、Redis 和对象存储。
- Worker 可增加副本，BullMQ 负责竞争消费；需要根据模型配额控制并发。
- Web 和 Admin 可放入 CDN/边缘缓存，动态聊天请求仍访问 API。
- 迁移任务必须保持单实例，并在新 API 实例接流量前完成。

## 上线检查

- `CHAT_API_KEY` 与应用级模型配置没有泄露到任何前端构建产物；
- 所有公开入口使用 HTTPS，CORS 只包含实际域名；
- 已修改种子管理员密码并验证刷新令牌轮换；
- 数据库与对象存储备份已执行过恢复演练；
- API `/health`、Worker 日志、BullMQ 失败任务和磁盘使用量有监控；
- 未解决队列有明确负责人和处理时限；
- AI 需求草稿仍需要人工确认，没有自动进入开发计划。
