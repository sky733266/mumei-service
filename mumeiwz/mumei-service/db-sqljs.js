/**
 * SQLite 数据库 (sql.js 版本)
 * 纯 JavaScript 实现，无需编译，开箱即用
 * 支持持久化到文件系统
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'mumei.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = null;
let SQL = null;

// 初始化数据库
async function initDatabase() {
  SQL = await initSqlJs();
  
  // 加载或创建数据库
  if (fs.existsSync(DB_FILE)) {
    const buffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(buffer);
    console.log('✅ SQLite 数据库已加载');
  } else {
    db = new SQL.Database();
    console.log('✅ SQLite 数据库已创建');
  }

  // 创建表
  createTables();
}

// 创建表
function createTables() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      verified INTEGER DEFAULT 0,
      plan TEXT DEFAULT 'free',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      token TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_used TEXT,
      revoked INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS verification_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0
    )`,

    `CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      endpoint TEXT,
      method TEXT,
      ip TEXT,
      status INTEGER,
      duration INTEGER,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      referred_id TEXT NOT NULL,
      reward_type TEXT DEFAULT 'bonus',
      reward_amount INTEGER DEFAULT 20,
      rewarded INTEGER DEFAULT 0,
      paid_reward INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (referrer_id) REFERENCES users(id),
      FOREIGN KEY (referred_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      url TEXT NOT NULL,
      secret TEXT,
      events TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`
  ];

  statements.forEach(stmt => {
    try {
      db.run(stmt);
    } catch (e) {
      // 表已存在
    }
  });

  saveDatabase();
}

// 保存数据库到文件
function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

// ============ 用户数据库 ============
const UserDB = {
  async createUser(email, password) {
    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    try {
      db.run(
        'INSERT INTO users (id, email, password) VALUES (?, ?, ?)',
        [id, email, hashedPassword]
      );
      saveDatabase();
      return this.getUserById(id);
    } catch (e) {
      throw new Error('邮箱已被注册');
    }
  },

  getUserById(id) {
    const result = db.exec('SELECT * FROM users WHERE id = ?', [id]);
    if (result.length === 0) return null;
    
    const columns = result[0].columns;
    const values = result[0].values[0];
    const user = {};
    columns.forEach((col, i) => {
      user[col] = values[i];
    });
    return user;
  },

  getUserByEmail(email) {
    const result = db.exec('SELECT * FROM users WHERE email = ?', [email]);
    if (result.length === 0) return null;
    
    const columns = result[0].columns;
    const values = result[0].values[0];
    const user = {};
    columns.forEach((col, i) => {
      user[col] = values[i];
    });
    return user;
  },

  getAllUsers() {
    const result = db.exec('SELECT * FROM users ORDER BY created_at DESC');
    if (result.length === 0) return [];
    
    const columns = result[0].columns;
    return result[0].values.map(values => {
      const user = {};
      columns.forEach((col, i) => {
        user[col] = values[i];
      });
      return user;
    });
  },

  async validateUser(email, password) {
    const user = this.getUserByEmail(email);
    if (!user) throw new Error('用户不存在');
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error('密码错误');
    
    // 更新最后登录时间
    db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    saveDatabase();
    
    return user;
  },

  verifyUser(email) {
    db.run('UPDATE users SET verified = 1 WHERE email = ?', [email]);
    saveDatabase();
  },

  updateUserPlan(userId, plan) {
    db.run('UPDATE users SET plan = ? WHERE id = ?', [plan, userId]);
    saveDatabase();
  },

  async updatePassword(userId, newPassword) {
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(newPassword, 10);
    db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
    saveDatabase();
  }
};

// ============ Token 数据库 ============
const TokenDB = {
  createToken(userId, name = 'Default') {
    const id = uuidv4();
    const token = `mumei_${uuidv4().replace(/-/g, '')}`;
    
    db.run(
      'INSERT INTO tokens (id, user_id, name, token) VALUES (?, ?, ?, ?)',
      [id, userId, name, token]
    );
    saveDatabase();
    
    return { id, name, token, createdAt: new Date().toISOString() };
  },

  getTokenByToken(token) {
    const result = db.exec('SELECT * FROM tokens WHERE token = ? AND revoked = 0', [token]);
    if (result.length === 0) return null;
    
    const columns = result[0].columns;
    const values = result[0].values[0];
    const t = {};
    columns.forEach((col, i) => {
      t[col] = values[i];
    });
    return t;
  },

  // validateToken：验证 API Token 并返回关联用户信息
  validateToken(apiToken) {
    const tokenRow = this.getTokenByToken(apiToken);
    if (!tokenRow) return null;
    // 更新最后使用时间
    this.updateLastUsed(apiToken);
    // 返回用户信息
    const user = UserDB.getUserById(tokenRow.user_id);
    if (!user) return null;
    return { id: user.id, email: user.email, plan: user.plan, tokenId: tokenRow.id };
  },

  getUserTokens(userId) {
    const result = db.exec(
      'SELECT id, name, created_at, last_used, revoked FROM tokens WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    if (result.length === 0) return [];
    
    const columns = result[0].columns;
    return result[0].values.map(values => {
      const t = {};
      columns.forEach((col, i) => {
        t[col] = values[i];
      });
      return t;
    });
  },

  revokeToken(tokenId, userId) {
    db.run('UPDATE tokens SET revoked = 1 WHERE id = ? AND user_id = ?', [tokenId, userId]);
    saveDatabase();
  },

  toggleToken(tokenId, userId) {
    // 查当前状态
    const result = db.exec('SELECT revoked FROM tokens WHERE id = ? AND user_id = ?', [tokenId, userId]);
    if (!result.length || !result[0].values.length) return null;
    const currentRevoked = result[0].values[0][0];
    const newRevoked = currentRevoked ? 0 : 1;
    db.run('UPDATE tokens SET revoked = ? WHERE id = ? AND user_id = ?', [newRevoked, tokenId, userId]);
    saveDatabase();
    return { active: newRevoked === 0 };
  },

  updateLastUsed(token) {
    db.run('UPDATE tokens SET last_used = CURRENT_TIMESTAMP WHERE token = ?', [token]);
    saveDatabase();
  }
};

// ============ 验证码数据库 ============
const VerificationDB = {
  createCode(email) {
    const code = Math.random().toString().slice(2, 8);
    const id = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    db.run(
      'INSERT INTO verification_codes (id, email, code, expires_at) VALUES (?, ?, ?, ?)',
      [id, email, code, expiresAt]
    );
    saveDatabase();
    
    return code;
  },

  verifyCode(email, code) {
    const result = db.exec(
      `SELECT * FROM verification_codes 
       WHERE email = ? AND code = ? AND used = 0 AND expires_at > datetime('now')`,
      [email, code]
    );
    
    if (result.length === 0) return false;
    
    const columns = result[0].columns;
    const values = result[0].values[0];
    const record = {};
    columns.forEach((col, i) => {
      record[col] = values[i];
    });
    
    db.run('UPDATE verification_codes SET used = 1 WHERE id = ?', [record.id]);
    saveDatabase();
    
    return true;
  }
};

// ============ 日志数据库 ============
const LogDB = {
  addLog(userId, endpoint, method, ip, status, duration) {
    db.run(
      'INSERT INTO logs (user_id, endpoint, method, ip, status, duration) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, endpoint, method, ip, status, duration]
    );
    saveDatabase();
  },

  getUserLogs(userId, options = {}) {
    const limit = options.limit || 50;
    const result = db.exec(
      'SELECT * FROM logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
      [userId, limit]
    );
    
    if (result.length === 0) return { logs: [], total: 0 };
    
    const columns = result[0].columns;
    const logs = result[0].values.map(values => {
      const log = {};
      columns.forEach((col, i) => {
        log[col] = values[i];
      });
      return log;
    });
    
    return { logs, total: logs.length };
  },

  getTodayCallCount(userId) {
    const result = db.exec(
      `SELECT COUNT(*) as count FROM logs 
       WHERE user_id = ? AND date(timestamp) = date('now')`,
      [userId]
    );
    
    if (result.length === 0) return 0;
    return result[0].values[0][0] || 0;
  },

  getMonthlyCallCount(userId) {
    const result = db.exec(
      `SELECT COUNT(*) as count FROM logs 
       WHERE user_id = ? AND strftime('%Y-%m', timestamp) = strftime('%Y-%m', 'now')`,
      [userId]
    );
    
    if (result.length === 0) return 0;
    return result[0].values[0][0] || 0;
  }
};

// ============ 订阅数据库 ============
const SubscriptionDB = {
  createSubscription(userId, planId, expiresAt) {
    const id = uuidv4();
    
    db.run(
      "UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'",
      [userId]
    );
    
    db.run(
      'INSERT INTO subscriptions (id, user_id, plan_id, expires_at) VALUES (?, ?, ?, ?)',
      [id, userId, planId, expiresAt]
    );
    saveDatabase();
    
    return id;
  },

  getActiveSubscription(userId) {
    const result = db.exec(
      `SELECT * FROM subscriptions 
       WHERE user_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > datetime('now'))`,
      [userId]
    );
    
    if (result.length === 0) return null;
    
    const columns = result[0].columns;
    const values = result[0].values[0];
    const sub = {};
    columns.forEach((col, i) => {
      sub[col] = values[i];
    });
    return sub;
  }
};

// ============ 套餐配置 ============
const PlanDB = {
  getAllPlans() {
    return [
      {
        id: 'free',
        name: '免费版',
        price: 0,
        quotas: { dailyLimit: 100, monthlyLimit: 1000, maxTokens: 3 }
      },
      {
        id: 'pro',
        name: '专业版',
        price: 29,
        quotas: { dailyLimit: 10000, monthlyLimit: 100000, maxTokens: 20 }
      },
      {
        id: 'enterprise',
        name: '企业版',
        price: 99,
        quotas: { dailyLimit: 100000, monthlyLimit: 1000000, maxTokens: 100 }
      }
    ];
  },

  getPlan(planId) {
    return this.getAllPlans().find(p => p.id === planId);
  }
};

// ============ 订单数据库 ============
const OrderDB = {
  // 初始化订单表（在 createTables 之后调用）
  initOrderTable() {
    try {
      db.run(`CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        planId TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'CNY',
        method TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        paymentId TEXT,
        outTradeNo TEXT,
        createdAt TEXT,
        completedAt TEXT
      )`);
      saveDatabase();
    } catch (e) {
      // 表已存在
    }
  },

  createOrder(userId, planId, amount, method, outTradeNo) {
    const orderId = `ORD_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      db.run(
        `INSERT INTO orders (id, userId, planId, amount, method, outTradeNo, createdAt, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [orderId, userId, planId, amount, method, outTradeNo, new Date().toISOString()]
      );
      saveDatabase();
      return { success: true, orderId };
    } catch (e) {
      console.error('创建订单失败:', e);
      return { success: false, error: e.message };
    }
  },

  getOrder(orderId) {
    const result = db.exec('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!result.length || !result[0].values.length) return null;
    const cols = result[0].columns;
    const vals = result[0].values[0];
    return Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
  },

  getOrderByOutTradeNo(outTradeNo) {
    const result = db.exec('SELECT * FROM orders WHERE outTradeNo = ?', [outTradeNo]);
    if (!result.length || !result[0].values.length) return null;
    const cols = result[0].columns;
    const vals = result[0].values[0];
    return Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
  },

  getOrderByPaymentId(paymentId) {
    const result = db.exec('SELECT * FROM orders WHERE paymentId = ?', [paymentId]);
    if (!result.length || !result[0].values.length) return null;
    const cols = result[0].columns;
    const vals = result[0].values[0];
    return Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
  },

  completeOrder(orderId, paymentId) {
    try {
      db.run(
        `UPDATE orders SET status = 'completed', paymentId = ?, completedAt = ? WHERE id = ?`,
        [paymentId, new Date().toISOString(), orderId]
      );
      // 升级用户套餐
      const order = this.getOrder(orderId);
      if (order) {
        db.run(`UPDATE users SET plan = ? WHERE id = ?`, [order.planId, order.userId]);
        console.log(`✅ 用户 ${order.userId} 套餐已升级为 ${order.planId}`);
      }
      saveDatabase();
      return { success: true };
    } catch (e) {
      console.error('完成订单失败:', e);
      return { success: false, error: e.message };
    }
  },

  getUserOrders(userId, limit = 10) {
    const result = db.exec(
      'SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC LIMIT ?',
      [userId, limit]
    );
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map(vals => Object.fromEntries(cols.map((c, i) => [c, vals[i]])));
  }
};

// ============ 邀请推荐数据库 ============
const ReferralDB = {
  // 创建邀请记录
  createReferral(referrerId, referredId) {
    const id = uuidv4();
    try {
      db.run(
        'INSERT INTO referrals (id, referrer_id, referred_id) VALUES (?, ?, ?)',
        [id, referrerId, referredId]
      );
      saveDatabase();
      return { success: true, id };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // 奖励邀请人（被邀请人注册成功）
  rewardReferrer(referrerId, referredId) {
    db.run(
      'UPDATE referrals SET rewarded = 1, reward_type = ?, reward_amount = ? WHERE referrer_id = ? AND referred_id = ?',
      ['bonus', 20, referrerId, referredId]
    );
    saveDatabase();
    return { success: true, reward: 20 };
  },

  // 奖励邀请人（被邀请人付费）
  rewardReferrerPaid(referrerId, referredId, amount) {
    db.run(
      'UPDATE referrals SET paid_reward = 1, reward_type = ?, reward_amount = ? WHERE referrer_id = ? AND referred_id = ?',
      ['cashback', Math.min(amount, 5), referrerId, referredId]
    );
    saveDatabase();
    return { success: true, reward: Math.min(amount, 5) };
  },

  // 获取用户的邀请记录
  getReferralStats(userId) {
    const result = db.exec(
      'SELECT * FROM referrals WHERE referrer_id = ? ORDER BY created_at DESC',
      [userId]
    );
    if (!result.length) return { total: 0, registered: 0, paid: 0, totalReward: 0 };

    const rows = result[0].values.map(vals => {
      const cols = result[0].columns;
      return Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
    });

    const registered = rows.filter(r => r.rewarded).length;
    const paid = rows.filter(r => r.paid_reward).length;
    const totalReward = rows.reduce((sum, r) => sum + (r.reward_amount || 0), 0);

    return { total: rows.length, registered, paid, totalReward, referrals: rows.slice(0, 10) };
  }
};

// 备份数据库
function backupDatabase() {
  const backupPath = path.join(DATA_DIR, `backup_${Date.now()}.db`);
  fs.copyFileSync(DB_FILE, backupPath);
  console.log('✅ 数据库已备份:', backupPath);
  return backupPath;
}

module.exports = {
  initDatabase,
  UserDB,
  TokenDB,
  VerificationDB,
  LogDB,
  PlanDB,
  SubscriptionDB,
  OrderDB,
  ReferralDB,
  backupDatabase
};
