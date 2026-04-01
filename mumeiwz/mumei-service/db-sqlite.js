/**
 * SQLite 数据库适配器
 * 替代 JSON 文件存储，提升并发性能
 * 零配置、单文件、易于备份
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'mumei.db');

// 初始化数据库
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('✅ SQLite 数据库已连接:', DB_PATH);
    initTables();
  }
});

// 创建表
function initTables() {
  db.serialize(() => {
    // 用户表
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        verified INTEGER DEFAULT 0,
        plan TEXT DEFAULT 'free',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_login TEXT
      )
    `);

    // Token表
    db.run(`
      CREATE TABLE IF NOT EXISTS tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT,
        token TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_used TEXT,
        revoked INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // 验证码表
    db.run(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0
      )
    `);

    // 日志表
    db.run(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        endpoint TEXT,
        method TEXT,
        ip TEXT,
        status INTEGER,
        duration INTEGER,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 订阅表
    db.run(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        started_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Webhook表
    db.run(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        url TEXT NOT NULL,
        secret TEXT,
        events TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // 创建索引
    db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    db.run('CREATE INDEX IF NOT EXISTS idx_tokens_user ON tokens(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens(token)');
    db.run('CREATE INDEX IF NOT EXISTS idx_logs_user ON logs(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)');

    console.log('✅ 数据库表已初始化');
  });
}

// Promisify db 方法
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// ============ 用户数据库 ============
const UserDB = {
  async createUser(email, password) {
    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    await dbRun(
      'INSERT INTO users (id, email, password) VALUES (?, ?, ?)',
      [id, email, hashedPassword]
    );
    return this.getUserById(id);
  },

  async getUserById(id) {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [id]);
    return user ? { ...user, verified: !!user.verified } : null;
  },

  async getUserByEmail(email) {
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    return user ? { ...user, verified: !!user.verified } : null;
  },

  async getAllUsers() {
    const users = await dbAll('SELECT * FROM users ORDER BY created_at DESC');
    return users.map(u => ({ ...u, verified: !!u.verified }));
  },

  async validateUser(email, password) {
    const user = await this.getUserByEmail(email);
    if (!user) throw new Error('用户不存在');
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error('密码错误');
    
    // 更新最后登录时间
    await dbRun(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );
    
    return user;
  },

  async verifyUser(email) {
    await dbRun(
      'UPDATE users SET verified = 1 WHERE email = ?',
      [email]
    );
  },

  async updateUserPlan(userId, plan) {
    await dbRun(
      'UPDATE users SET plan = ? WHERE id = ?',
      [plan, userId]
    );
  },

  async updateLastLogin(userId) {
    await dbRun(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [userId]
    );
  }
};

// ============ Token数据库 ============
const TokenDB = {
  async createToken(userId, name = 'Default') {
    const id = uuidv4();
    const token = `mumei_${uuidv4().replace(/-/g, '')}`;
    
    await dbRun(
      'INSERT INTO tokens (id, user_id, name, token) VALUES (?, ?, ?, ?)',
      [id, userId, name, token]
    );
    
    return { id, name, token, createdAt: new Date().toISOString() };
  },

  async getTokenByToken(token) {
    return await dbGet('SELECT * FROM tokens WHERE token = ? AND revoked = 0', [token]);
  },

  async getUserTokens(userId) {
    return await dbAll(
      'SELECT id, name, created_at, last_used, revoked FROM tokens WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
  },

  async revokeToken(tokenId, userId) {
    await dbRun(
      'UPDATE tokens SET revoked = 1 WHERE id = ? AND user_id = ?',
      [tokenId, userId]
    );
  },

  async updateLastUsed(token) {
    await dbRun(
      'UPDATE tokens SET last_used = CURRENT_TIMESTAMP WHERE token = ?',
      [token]
    );
  }
};

// ============ 验证码数据库 ============
const VerificationDB = {
  async createCode(email) {
    const code = Math.random().toString().slice(2, 8);
    const id = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10分钟
    
    await dbRun(
      'INSERT INTO verification_codes (id, email, code, expires_at) VALUES (?, ?, ?, ?)',
      [id, email, code, expiresAt]
    );
    
    return code;
  },

  async verifyCode(email, code) {
    const record = await dbGet(
      `SELECT * FROM verification_codes 
       WHERE email = ? AND code = ? AND used = 0 AND expires_at > CURRENT_TIMESTAMP`,
      [email, code]
    );
    
    if (!record) return false;
    
    await dbRun('UPDATE verification_codes SET used = 1 WHERE id = ?', [record.id]);
    return true;
  }
};

// ============ 日志数据库 ============
const LogDB = {
  async addLog(userId, endpoint, method, ip, status, duration) {
    await dbRun(
      'INSERT INTO logs (user_id, endpoint, method, ip, status, duration) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, endpoint, method, ip, status, duration]
    );
  },

  async getUserLogs(userId, options = {}) {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    return await dbAll(
      'SELECT * FROM logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
  },

  async getTodayCallCount(userId) {
    const result = await dbGet(
      `SELECT COUNT(*) as count FROM logs 
       WHERE user_id = ? AND date(timestamp) = date('now')`,
      [userId]
    );
    return result?.count || 0;
  },

  async getMonthlyCallCount(userId) {
    const result = await dbGet(
      `SELECT COUNT(*) as count FROM logs 
       WHERE user_id = ? AND strftime('%Y-%m', timestamp) = strftime('%Y-%m', 'now')`,
      [userId]
    );
    return result?.count || 0;
  },

  async cleanOldLogs(daysToKeep = 90) {
    await dbRun(
      `DELETE FROM logs WHERE date(timestamp) < date('now', ?)`,
      [`-${daysToKeep} days`]
    );
  }
};

// ============ 订阅数据库 ============
const SubscriptionDB = {
  async createSubscription(userId, planId, expiresAt) {
    const id = uuidv4();
    
    // 先取消现有订阅
    await dbRun(
      "UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'",
      [userId]
    );
    
    await dbRun(
      'INSERT INTO subscriptions (id, user_id, plan_id, expires_at) VALUES (?, ?, ?, ?)',
      [id, userId, planId, expiresAt]
    );
    
    return id;
  },

  async getActiveSubscription(userId) {
    return await dbGet(
      `SELECT * FROM subscriptions 
       WHERE user_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [userId]
    );
  }
};

// ============ Webhook数据库 ============
const WebhookDB = {
  async createWebhook(userId, url, secret, events) {
    const id = uuidv4();
    
    await dbRun(
      'INSERT INTO webhooks (id, user_id, url, secret, events) VALUES (?, ?, ?, ?, ?)',
      [id, userId, url, secret, JSON.stringify(events)]
    );
    
    return id;
  },

  async getUserWebhooks(userId) {
    const webhooks = await dbAll(
      'SELECT * FROM webhooks WHERE user_id = ? AND active = 1',
      [userId]
    );
    return webhooks.map(w => ({ ...w, events: JSON.parse(w.events || '[]') }));
  },

  async deleteWebhook(webhookId, userId) {
    await dbRun(
      'UPDATE webhooks SET active = 0 WHERE id = ? AND user_id = ?',
      [webhookId, userId]
    );
  }
};

// ============ 套餐配置（静态） ============
const PlanDB = {
  getAllPlans() {
    return [
      {
        id: 'free',
        name: '免费版',
        price: 0,
        period: 'unlimited',
        quotas: {
          dailyLimit: 100,
          monthlyLimit: 1000,
          maxTokens: 3,
          maxFileSize: 5 * 1024 * 1024
        }
      },
      {
        id: 'pro',
        name: '专业版',
        price: 29,
        period: 'monthly',
        quotas: {
          dailyLimit: 10000,
          monthlyLimit: 100000,
          maxTokens: 20,
          maxFileSize: 50 * 1024 * 1024
        }
      },
      {
        id: 'enterprise',
        name: '企业版',
        price: 99,
        period: 'monthly',
        quotas: {
          dailyLimit: 100000,
          monthlyLimit: 1000000,
          maxTokens: 100,
          maxFileSize: 200 * 1024 * 1024
        }
      }
    ];
  },

  getPlan(planId) {
    return this.getAllPlans().find(p => p.id === planId);
  }
};

// 备份数据库
function backupDatabase() {
  const backupPath = path.join(DATA_DIR, `backup_${Date.now()}.db`);
  fs.copyFileSync(DB_PATH, backupPath);
  console.log('✅ 数据库已备份:', backupPath);
  return backupPath;
}

// 导出
module.exports = {
  UserDB,
  TokenDB,
  VerificationDB,
  LogDB,
  PlanDB,
  SubscriptionDB,
  WebhookDB,
  backupDatabase,
  close: () => db.close()
};
