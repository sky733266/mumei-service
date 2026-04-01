# 沐美服务 - 上线部署指南

## 📋 目录
1. [当前系统状态](#当前系统状态)
2. [上线前检查清单](#上线前检查清单)
3. [多人会员服务方案](#多人会员服务方案)
4. [部署架构建议](#部署架构建议)
5. [性能优化](#性能优化)
6. [安全加固](#安全加固)

---

## 当前系统状态

### ✅ 已完成功能
- **10个页面** - 首页、用户面板、工具箱、统计面板、API文档、用户反馈、图片压缩、二维码、个人中心、管理后台
- **37个工具** - AI工具、文件处理、数据分析、网络工具、安全工具、开发工具
- **认证系统** - 邮箱验证、JWT Token、用户登录
- **邮件服务** - 163邮箱SMTP已配置
- **管理后台** - 用户管理、IP黑名单、日志查询
- **API版本控制** - `/api/v1` 路由隔离

### ⚠️ 需要改进的地方
1. **数据库** - 当前使用JSON文件存储，不适合大规模并发
2. **支付系统** - Stripe集成未完全配置
3. **缓存** - 无缓存层，高并发时性能下降
4. **监控** - 缺少实时监控和告警
5. **CDN** - 静态资源未使用CDN加速

---

## 上线前检查清单

### 🔒 安全检查
- [ ] 更新 JWT_SECRET 为强密码（至少32字符）
- [ ] 配置 CORS 白名单（ALLOWED_ORIGINS）
- [ ] 启用 HTTPS/SSL 证书
- [ ] 配置防火墙规则
- [ ] 启用 IP 黑名单功能
- [ ] 定期备份数据库
- [ ] 设置日志审计
- [ ] 配置 DDoS 防护

### 📊 性能检查
- [ ] 配置 Redis 缓存
- [ ] 启用 Gzip 压缩
- [ ] 配置 CDN 加速
- [ ] 设置数据库连接池
- [ ] 配置负载均衡
- [ ] 监控内存使用
- [ ] 设置自动扩容

### 📧 邮件检查
- [ ] 验证 SMTP 配置
- [ ] 测试邮件发送
- [ ] 配置邮件模板
- [ ] 设置邮件重试机制
- [ ] 配置邮件日志

### 💳 支付检查
- [ ] 配置 Stripe API Key
- [ ] 测试支付流程
- [ ] 配置 Webhook
- [ ] 设置退款流程
- [ ] 配置发票系统

---

## 多人会员服务方案

### 方案 1: 基础多人管理（推荐用于初期）

#### 特点
- 每个用户独立账户
- 支持团队邀请
- 共享配额管理
- 简单的权限控制

#### 实现步骤

**1. 扩展用户模型**
```javascript
// 在 db.js 中添加
const UserDB = {
  // ... 现有方法
  
  // 添加团队功能
  createTeam(userId, teamName) {
    const team = {
      id: uuidv4(),
      name: teamName,
      owner: userId,
      members: [userId],
      createdAt: new Date().toISOString(),
      plan: 'free',
      quotas: { /* 团队配额 */ }
    };
    // 保存到 teams.json
  },
  
  inviteMember(teamId, email) {
    // 发送邀请邮件
    // 创建邀请记录
  },
  
  acceptInvite(inviteId, userId) {
    // 将用户加入团队
  }
};
```

**2. 添加团队管理页面**
```html
<!-- /team-management -->
- 创建团队
- 邀请成员
- 管理权限
- 查看使用统计
- 管理订阅
```

**3. 配额共享逻辑**
```javascript
// 检查配额时，查询用户所在团队的配额
async function checkQuota(userId, tool) {
  const user = UserDB.getUserById(userId);
  const team = TeamDB.getTeamByMember(userId);
  
  // 使用团队配额而非个人配额
  const quota = team.quotas[tool];
  const usage = LogDB.getTeamUsage(team.id, tool);
  
  return usage < quota;
}
```

### 方案 2: 企业级多人管理（推荐用于规模化）

#### 特点
- 组织/部门结构
- 细粒度权限控制
- 成本中心管理
- 审计日志
- SSO 集成

#### 核心模块

**1. 组织结构**
```
Organization (企业)
├── Department (部门)
│   ├── Team (团队)
│   │   └── Member (成员)
└── Role (角色)
    ├── Admin (管理员)
    ├── Manager (经理)
    └── User (普通用户)
```

**2. 权限矩阵**
```javascript
const permissions = {
  admin: ['manage_team', 'manage_billing', 'view_logs', 'manage_users'],
  manager: ['manage_team', 'view_logs', 'manage_users'],
  user: ['use_api', 'view_own_logs']
};
```

**3. 成本分配**
```javascript
// 按部门/团队分配成本
const costAllocation = {
  teamId: 'team-123',
  month: '2026-03',
  totalCost: 299,
  allocation: {
    'dept-1': 150,  // 50%
    'dept-2': 149   // 50%
  }
};
```

### 方案 3: 混合模式（推荐用于中期）

结合方案 1 和方案 2 的优点：
- 小团队使用方案 1（简单快速）
- 大企业使用方案 2（功能完整）
- 自动升级路径

---

## 部署架构建议

### 推荐架构

```
┌─────────────────────────────────────────────────────────┐
│                    CDN (静态资源)                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              负载均衡器 (Nginx/HAProxy)                   │
└─────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
    ┌────────┐          ┌────────┐          ┌────────┐
    │ Node 1 │          │ Node 2 │          │ Node 3 │
    │ :3000  │          │ :3001  │          │ :3002  │
    └────────┘          └────────┘          └────────┘
         ↓                    ↓                    ↓
┌─────────────────────────────────────────────────────────┐
│                  Redis 缓存集群                          │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│              PostgreSQL 数据库集群                       │
│         (主从复制 + 自动故障转移)                        │
└─────────────────────────────────────────────────────────┘
```

### 部署步骤

**1. 数据库迁移**
```bash
# 从 JSON 迁移到 PostgreSQL
npm run migrate:db

# 创建备份
npm run backup:db
```

**2. 配置负载均衡**
```nginx
upstream mumei_service {
  server localhost:3000;
  server localhost:3001;
  server localhost:3002;
}

server {
  listen 80;
  server_name api.mumei.dev;
  
  location / {
    proxy_pass http://mumei_service;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

**3. 配置 Redis**
```javascript
// 在 server.js 中
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD
});

// 缓存用户信息
app.use((req, res, next) => {
  if (req.user) {
    client.setex(`user:${req.user.id}`, 3600, JSON.stringify(req.user));
  }
  next();
});
```

---

## 性能优化

### 1. 缓存策略

```javascript
// 缓存热点数据
const cacheConfig = {
  'plans': 86400,           // 24小时
  'user:*': 3600,           // 1小时
  'tool:pricing': 86400,    // 24小时
  'api:health': 60          // 1分钟
};
```

### 2. 数据库优化

```sql
-- 创建索引
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_subscription_user ON subscriptions(user_id);
CREATE INDEX idx_log_user_date ON logs(user_id, created_at);
CREATE INDEX idx_token_user ON tokens(user_id);

-- 分区日志表（按月）
CREATE TABLE logs_2026_03 PARTITION OF logs
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

### 3. API 优化

```javascript
// 分页查询
app.get('/api/users', (req, res) => {
  const page = req.query.page || 1;
  const limit = Math.min(req.query.limit || 20, 100);
  const offset = (page - 1) * limit;
  
  // 使用 LIMIT + OFFSET
  const users = UserDB.getUsers(limit, offset);
  res.json({ users, total, page, pages: Math.ceil(total / limit) });
});

// 批量操作
app.post('/api/batch', (req, res) => {
  const operations = req.body.operations; // 最多100个
  const results = operations.map(op => executeOperation(op));
  res.json({ results });
});
```

### 4. 前端优化

```javascript
// 代码分割
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tools = lazy(() => import('./pages/Tools'));

// 预加载关键资源
<link rel="preload" href="/api/tools" as="fetch">
<link rel="preload" href="/styles.css" as="style">

// 使用 Service Worker 缓存
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

---

## 安全加固

### 1. 认证加强

```javascript
// 启用 2FA
app.post('/api/auth/2fa/enable', (req, res) => {
  const secret = speakeasy.generateSecret();
  // 保存到数据库
  res.json({ qrCode: secret.qr_code });
});

// 验证 2FA
app.post('/api/auth/2fa/verify', (req, res) => {
  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token: req.body.token
  });
  if (verified) {
    // 签发 JWT
  }
});
```

### 2. 速率限制

```javascript
// 按用户限制
const userLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rate-limit:'
  }),
  keyGenerator: (req) => req.user?.id || req.ip,
  max: 1000,  // 每小时1000个请求
  windowMs: 60 * 60 * 1000
});

app.use('/api/', userLimiter);
```

### 3. 数据加密

```javascript
// 加密敏感数据
const crypto = require('crypto');

function encryptToken(token) {
  const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decryptToken(encrypted) {
  const decipher = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### 4. 审计日志

```javascript
// 记录所有关键操作
const auditLog = {
  timestamp: new Date(),
  userId: req.user.id,
  action: 'upgrade_plan',
  resource: 'subscription',
  resourceId: subscription.id,
  changes: {
    from: 'free',
    to: 'pro'
  },
  ipAddress: req.ip,
  userAgent: req.get('user-agent')
};

AuditDB.log(auditLog);
```

---

## 上线时间表

### 第1周：准备阶段
- [ ] 完成安全审计
- [ ] 配置生产环境
- [ ] 准备数据库迁移
- [ ] 测试备份恢复

### 第2周：灰度发布
- [ ] 10% 流量切换到新系统
- [ ] 监控性能指标
- [ ] 收集用户反馈
- [ ] 修复发现的问题

### 第3周：全量发布
- [ ] 100% 流量切换
- [ ] 启用监控告警
- [ ] 准备应急预案
- [ ] 24/7 值班

### 第4周：稳定运维
- [ ] 性能优化
- [ ] 用户支持
- [ ] 数据分析
- [ ] 规划下一版本

---

## 关键指标监控

```javascript
// 需要监控的指标
const metrics = {
  // 性能
  'api.response_time': 'ms',
  'api.error_rate': '%',
  'db.query_time': 'ms',
  'cache.hit_rate': '%',
  
  // 业务
  'users.total': 'count',
  'users.active_daily': 'count',
  'subscriptions.active': 'count',
  'revenue.monthly': 'USD',
  
  // 系统
  'server.cpu': '%',
  'server.memory': '%',
  'server.disk': '%',
  'requests.per_second': 'count'
};
```

---

## 成本估算

| 项目 | 月成本 | 说明 |
|------|--------|------|
| 服务器 (3台) | $300 | AWS t3.medium |
| 数据库 | $100 | PostgreSQL RDS |
| Redis | $50 | ElastiCache |
| CDN | $50 | CloudFront |
| 邮件服务 | $20 | SendGrid |
| 监控告警 | $30 | DataDog |
| **总计** | **$550** | **基础配置** |

---

## 联系方式

- 技术支持: support@mumei.dev
- 紧急热线: +86-xxx-xxxx-xxxx
- 文档: https://docs.mumei.dev
- 状态页: https://status.mumei.dev
