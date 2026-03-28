# 🔒 沐美服务 - 安全配置清单

## 生产环境部署前必检

### ⚠️ 高优先级（必须完成）

- [ ] **修改 JWT_SECRET**
  ```bash
  cd mumei-service
  node scripts/generate-secrets.js
  # 将生成的密钥复制到 .env 文件
  ```

- [ ] **设置 NODE_ENV**
  ```bash
  NODE_ENV=production
  ```

- [ ] **配置 CORS 白名单**
  ```
  ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
  ```

- [ ] **配置邮件服务**
  - 使用真实 SMTP 服务（如 SendGrid、Mailgun）
  - 不要使用 Gmail（有限制）
  - 设置正确的发件人地址

- [ ] **配置 Stripe**
  - 使用生产密钥（sk_live_xxx）
  - 配置 Webhook 地址
  - 设置 Webhook 签名验证

### 🟡 中优先级

- [ ] **启用 HTTPS**
  - 使用 Nginx + SSL 证书
  - 或使用 Cloudflare 等 CDN
  - 参考 `deploy/nginx.conf.example`

- [ ] **配置日志轮转**
  - 防止日志文件过大
  - 设置日志保留期限

- [ ] **设置备份策略**
  - 定期备份 `data/` 目录
  - 测试备份恢复流程

- [ ] **配置监控告警**
  - 服务器资源监控
  - API 错误率告警
  - 异常流量检测

### 🟢 建议项

- [ ] **使用真实数据库**
  - 当前使用 JSON 文件存储
  - 建议迁移到 MongoDB/PostgreSQL
  - 支持事务和数据完整性

- [ ] **添加速率限制增强**
  - 考虑使用 Redis 存储限流状态
  - 支持分布式部署

- [ ] **代码签名**
  - 使用 Git Hooks
  - 提交前运行 lint

## 环境变量说明

| 变量名 | 必需 | 说明 |
|--------|------|------|
| JWT_SECRET | ✅ 生产必填 | JWT签名密钥，建议64字符 |
| NODE_ENV | ✅ 生产必填 | 设置为 production |
| ALLOWED_ORIGINS | ✅ 生产必填 | 允许的域名，逗号分隔 |
| SMTP_HOST | 推荐 | 邮件服务器 |
| SMTP_USER | 推荐 | 邮件用户名 |
| SMTP_PASS | 推荐 | 邮件密码 |
| STRIPE_SECRET_KEY | Stripe必填 | Stripe生产密钥 |

## 安全日志

系统会记录以下安全事件：

1. **IP 黑名单操作**
   - 触发条件：1小时内50+次可疑请求
   - 手动添加：`/api/admin/blacklist/add`
   - 移除：`/api/admin/blacklist/remove`

2. **异常登录尝试**
   - 记录失败的登录尝试
   - 包含 IP、时间戳、邮箱

3. **文件上传拦截**
   - 拦截危险文件类型
   - 记录上传者和IP

## 漏洞报告

发现安全漏洞？请联系：security@mumei.dev
