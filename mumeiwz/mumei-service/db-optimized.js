/**
 * 优化的 JSON 数据库
 * 添加内存缓存 + 批量写入，提升性能
 * 无需额外依赖，开箱即用
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============ 缓存层 ============
class DataCache {
  constructor() {
    this.cache = new Map();
    this.dirty = new Set();
    this.flushInterval = null;
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value) {
    this.cache.set(key, value);
    this.dirty.add(key);
  }

  delete(key) {
    this.cache.delete(key);
    this.dirty.delete(key);
  }

  // 定时刷新到磁盘
  startAutoFlush(intervalMs = 5000) {
    this.flushInterval = setInterval(() => this.flush(), intervalMs);
  }

  stopAutoFlush() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  // 刷新脏数据到磁盘
  flush() {
    for (const key of this.dirty) {
      const data = this.cache.get(key);
      if (data) {
        const filePath = path.join(DATA_DIR, `${key}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      }
    }
    this.dirty.clear();
  }
}

const cache = new DataCache();

// ============ 数据文件操作 ============
function loadDataFile(filename, defaultValue) {
  // 先查缓存
  const cached = cache.get(filename);
  if (cached !== undefined) return cached;

  const filePath = path.join(DATA_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    cache.set(filename, defaultValue);
    return defaultValue;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    cache.set(filename, data);
    return data;
  } catch (e) {
    console.error(`数据文件 ${filename} 损坏，已重置`);
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    cache.set(filename, defaultValue);
    return defaultValue;
  }
}

function saveDataFile(filename, data) {
  cache.set(filename, data);
  // 立即写入磁盘（关键数据）
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// 启动自动刷新
cache.startAutoFlush(5000);

// ============ 用户数据库 ============
const UserDB = {
  getAllUsers() {
    return loadDataFile('users.json', []);
  },

  getUserById(id) {
    return this.getAllUsers().find(u => u.id === id);
  },

  getUserByEmail(email) {
    return this.getAllUsers().find(u => u.email === email);
  },

  async createUser(email, password) {
    const users = this.getAllUsers();
    
    if (users.find(u => u.email === email)) {
      throw new Error('邮箱已被注册');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      verified: false,
      plan: 'free',
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    users.push(user);
    saveDataFile('users.json', users);
    return user;
  },

  async validateUser(email, password) {
    const user = this.getUserByEmail(email);
    if (!user) throw new Error('用户不存在');
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error('密码错误');
    
    return user;
  },

  verifyUser(email) {
    const users = this.getAllUsers();
    const user = users.find(u => u.email === email);
    if (user) {
      user.verified = true;
      saveDataFile('users.json', users);
    }
  },

  updateUserPlan(userId, plan) {
    const users = this.getAllUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      user.plan = plan;
      saveDataFile('users.json', users);
    }
  },

  updateLastLogin(userId) {
    const users = this.getAllUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      user.lastLogin = new Date().toISOString();
      saveDataFile('users.json', users);
    }
  }
};

// ============ Token 数据库 ============
const TokenDB = {
  getAllTokens() {
    return loadDataFile('tokens.json', []);
  },

  getUserTokens(userId) {
    return this.getAllTokens().filter(t => t.userId === userId);
  },

  getTokenByToken(token) {
    return this.getAllTokens().find(t => t.token === token && !t.revoked);
  },

  createToken(userId, name = 'Default') {
    const tokens = this.getAllTokens();
    const token = {
      id: uuidv4(),
      userId,
      name,
      token: `mumei_${uuidv4().replace(/-/g, '')}`,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      revoked: false
    };
    tokens.push(token);
    saveDataFile('tokens.json', tokens);
    return token;
  },

  revokeToken(tokenId, userId) {
    const tokens = this.getAllTokens();
    const token = tokens.find(t => t.id === tokenId && t.userId === userId);
    if (token) {
      token.revoked = true;
      saveDataFile('tokens.json', tokens);
    }
  },

  updateLastUsed(tokenStr) {
    const tokens = this.getAllTokens();
    const token = tokens.find(t => t.token === tokenStr);
    if (token) {
      token.lastUsed = new Date().toISOString();
      saveDataFile('tokens.json', tokens);
    }
  }
};

// ============ 验证码数据库 ============
const VerificationDB = {
  getAllCodes() {
    return loadDataFile('codes.json', []);
  },

  createCode(email) {
    const codes = this.getAllCodes();
    const code = Math.random().toString().slice(2, 8);
    
    const record = {
      id: uuidv4(),
      email,
      code,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      used: false
    };

    codes.push(record);
    saveDataFile('codes.json', codes);
    return code;
  },

  verifyCode(email, code) {
    const codes = this.getAllCodes();
    const now = new Date();
    
    const record = codes.find(c => 
      c.email === email && 
      c.code === code && 
      !c.used && 
      new Date(c.expiresAt) > now
    );

    if (!record) return false;

    record.used = true;
    saveDataFile('codes.json', codes);
    return true;
  },

  // 清理过期验证码
  cleanExpired() {
    const codes = this.getAllCodes();
    const now = new Date();
    const valid = codes.filter(c => new Date(c.expiresAt) > now);
    saveDataFile('codes.json', valid);
  }
};

// ============ 日志数据库 ============
const LogDB = {
  getAllLogs() {
    return loadDataFile('logs.json', []);
  },

  addLog(userId, endpoint, method, ip, status, duration) {
    const logs = this.getAllLogs();
    logs.push({
      id: uuidv4(),
      userId,
      endpoint,
      method,
      ip,
      status,
      duration,
      timestamp: new Date().toISOString()
    });
    
    // 只保留最近 10000 条日志
    if (logs.length > 10000) {
      logs.splice(0, logs.length - 10000);
    }
    
    saveDataFile('logs.json', logs);
  },

  getUserLogs(userId, options = {}) {
    const logs = this.getAllLogs();
    const userLogs = logs.filter(l => l.userId === userId);
    const limit = options.limit || 50;
    return {
      logs: userLogs.slice(0, limit),
      total: userLogs.length
    };
  },

  getTodayCallCount(userId) {
    const logs = this.getAllLogs();
    const today = new Date().toISOString().split('T')[0];
    return logs.filter(l => 
      l.userId === userId && 
      l.timestamp && 
      l.timestamp.startsWith(today)
    ).length;
  },

  getMonthlyCallCount(userId) {
    const logs = this.getAllLogs();
    const month = new Date().toISOString().slice(0, 7); // 2026-03
    return logs.filter(l => 
      l.userId === userId && 
      l.timestamp && 
      l.timestamp.startsWith(month)
    ).length;
  }
};

// ============ 套餐配置 ============
const PlanDB = {
  getAllPlans() {
    return loadDataFile('plans.json', [
      {
        id: 'free',
        name: '免费版',
        nameEn: 'Free',
        price: 0,
        period: 'unlimited',
        quotas: {
          dailyLimit: 100,
          monthlyLimit: 1000,
          maxTokens: 3,
          maxFileSize: 5 * 1024 * 1024,
          maxWebhooks: 1
        },
        features: ['基础API调用', '3个API Token', '社区支持']
      },
      {
        id: 'pro',
        name: '专业版',
        nameEn: 'Pro',
        price: 29,
        period: 'monthly',
        quotas: {
          dailyLimit: 10000,
          monthlyLimit: 100000,
          maxTokens: 20,
          maxFileSize: 50 * 1024 * 1024,
          maxWebhooks: 10
        },
        features: ['全部基础功能', '20个API Token', '优先邮件支持', '高级分析报表']
      },
      {
        id: 'enterprise',
        name: '企业版',
        nameEn: 'Enterprise',
        price: 99,
        period: 'monthly',
        quotas: {
          dailyLimit: 100000,
          monthlyLimit: 1000000,
          maxTokens: 100,
          maxFileSize: 200 * 1024 * 1024,
          maxWebhooks: -1
        },
        features: ['全部专业版功能', '100个API Token', '专属客户经理', 'SLA保障', '自定义集成']
      }
    ]);
  },

  getPlan(planId) {
    return this.getAllPlans().find(p => p.id === planId);
  }
};

// ============ 订阅数据库 ============
const SubscriptionDB = {
  getAllSubscriptions() {
    return loadDataFile('subscriptions.json', []);
  },

  createSubscription(userId, planId, expiresAt) {
    const subscriptions = this.getAllSubscriptions();
    
    // 取消现有订阅
    subscriptions.forEach(s => {
      if (s.userId === userId && s.status === 'active') {
        s.status = 'cancelled';
      }
    });

    const subscription = {
      id: uuidv4(),
      userId,
      planId,
      status: 'active',
      startedAt: new Date().toISOString(),
      expiresAt
    };

    subscriptions.push(subscription);
    saveDataFile('subscriptions.json', subscriptions);
    return subscription;
  },

  getActiveSubscription(userId) {
    const subscriptions = this.getAllSubscriptions();
    const now = new Date();
    
    return subscriptions.find(s => 
      s.userId === userId && 
      s.status === 'active' && 
      (!s.expiresAt || new Date(s.expiresAt) > now)
    );
  }
};

// ============ Webhook 数据库 ============
const WebhookDB = {
  getAllWebhooks() {
    return loadDataFile('webhooks.json', []);
  },

  getUserWebhooks(userId) {
    return this.getAllWebhooks().filter(w => w.userId === userId && w.active);
  },

  createWebhook(userId, url, secret, events) {
    const webhooks = this.getAllWebhooks();
    const webhook = {
      id: uuidv4(),
      userId,
      url,
      secret,
      events,
      active: true,
      createdAt: new Date().toISOString()
    };
    webhooks.push(webhook);
    saveDataFile('webhooks.json', webhooks);
    return webhook;
  },

  deleteWebhook(webhookId, userId) {
    const webhooks = this.getAllWebhooks();
    const webhook = webhooks.find(w => w.id === webhookId && w.userId === userId);
    if (webhook) {
      webhook.active = false;
      saveDataFile('webhooks.json', webhooks);
    }
  }
};

// ============ 备份功能 ============
function backupData() {
  const backupDir = path.join(DATA_DIR, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `backup-${timestamp}`);
  fs.mkdirSync(backupPath);

  const files = ['users.json', 'tokens.json', 'logs.json', 'subscriptions.json', 'webhooks.json'];
  files.forEach(file => {
    const src = path.join(DATA_DIR, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(backupPath, file));
    }
  });

  console.log(`✅ 数据已备份到: ${backupPath}`);
  return backupPath;
}

// 清理函数
process.on('SIGINT', () => {
  cache.flush();
  cache.stopAutoFlush();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cache.flush();
  cache.stopAutoFlush();
  process.exit(0);
});

module.exports = {
  UserDB,
  TokenDB,
  VerificationDB,
  LogDB,
  PlanDB,
  SubscriptionDB,
  WebhookDB,
  backupData
};
