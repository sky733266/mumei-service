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
const crypto = require('crypto');

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

  // 迁移：为已有数据库添加新字段（如果不存在）
  try {
    db.run("ALTER TABLE users ADD COLUMN display_name TEXT DEFAULT ''");
  } catch(e) { /* 字段已存在 */ }
  try {
    db.run("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''");
  } catch(e) { /* 字段已存在 */ }
}

// 创建表
function createTables() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      bio TEXT DEFAULT '',
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
    )`,

    `CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      lang TEXT DEFAULT 'zh',
      active INTEGER DEFAULT 1,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
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
    const hashedPassword = await bcrypt.hash(password, 8);
    
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
  },

  updateProfile(userId, fields) {
    const allowed = ['display_name', 'bio'];
    const updates = [];
    const values = [];
    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (updates.length === 0) return this.getUserById(userId);
    values.push(userId);
    db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    saveDatabase();
    return this.getUserById(userId);
  },

  deleteUser(userId) {
    db.run('DELETE FROM users WHERE id = ?', [userId]);
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

  getAllTokens() {
    const result = db.exec('SELECT * FROM tokens ORDER BY created_at DESC');
    if (result.length === 0) return [];
    const columns = result[0].columns;
    return result[0].values.map(values => {
      const t = {};
      columns.forEach((col, i) => { t[col] = values[i]; });
      return t;
    });
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
  },

  deleteToken(tokenId) {
    db.run('DELETE FROM tokens WHERE id = ?', [tokenId]);
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

  getAllLogs() {
    const result = db.exec('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 10000');
    if (result.length === 0) return [];
    const columns = result[0].columns;
    return result[0].values.map(values => {
      const log = {};
      columns.forEach((col, i) => { log[col] = values[i]; });
      return log;
    });
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
  },

  deleteLog(logId) {
    db.run('DELETE FROM logs WHERE id = ?', [logId]);
    saveDatabase();
  },

  deleteUserLogs(userId) {
    db.run('DELETE FROM logs WHERE user_id = ?', [userId]);
    saveDatabase();
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
  },

  cancelSubscription(userId) {
    // 取消活跃订阅并降级为免费版
    db.run(
      "UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'",
      [userId]
    );
    // 用户降级为免费版
    UserDB.updateUserPlan(userId, 'free');
    saveDatabase();
    return true;
  },

  getSubscriptionHistory(userId) {
    const result = db.exec(
      `SELECT * FROM subscriptions WHERE user_id = '${userId}' ORDER BY started_at DESC LIMIT 20`
    );
    if (result.length === 0) return [];
    const cols = result[0].columns;
    return result[0].values.map(row => {
      const obj = {};
      cols.forEach((c, i) => { obj[c] = row[i]; });
      return obj;
    });
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
        id: 'starter',
        name: '入门版',
        price: 9,
        quotas: { dailyLimit: 500, monthlyLimit: 5000, maxTokens: 5 }
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
        price: 49,
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

// ============ 公告数据库 ============
const AnnouncementDB = {
  // 创建公告
  create(data) {
    const id = uuidv4();
    try {
      db.run(
        'INSERT INTO announcements (id, title, content, lang, active, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, data.title, data.content, data.lang || 'zh', data.active !== undefined ? data.active : 1, data.start_date || null, data.end_date || null]
      );
      saveDatabase();
      return { success: true, id };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // 获取当前生效公告
  getActive(lang = 'zh') {
    const now = new Date().toISOString();
    const result = db.exec(
      `SELECT * FROM announcements WHERE active = 1 AND lang = ? AND (start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?) ORDER BY created_at DESC LIMIT 1`,
      [lang, now, now]
    );
    if (!result.length || !result[0].values.length) return null;
    const cols = result[0].columns;
    return Object.fromEntries(cols.map((c, i) => [c, result[0].values[0][i]]));
  },

  // 获取所有公告（管理员）
  getAll(lang = 'zh', limit = 20) {
    const result = db.exec(
      'SELECT * FROM announcements WHERE lang = ? ORDER BY created_at DESC LIMIT ?',
      [lang, limit]
    );
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map(vals => Object.fromEntries(cols.map((c, i) => [c, vals[i]])));
  },

  // 更新公告
  update(id, data) {
    const fields = [];
    const values = [];
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content); }
    if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active); }
    if (data.start_date !== undefined) { fields.push('start_date = ?'); values.push(data.start_date); }
    if (data.end_date !== undefined) { fields.push('end_date = ?'); values.push(data.end_date); }
    if (fields.length === 0) return { success: false, error: 'No fields to update' };
    values.push(id);
    db.run(`UPDATE announcements SET ${fields.join(', ')} WHERE id = ?`, values);
    saveDatabase();
    return { success: true };
  },

  // 删除公告
  delete(id) {
    db.run('DELETE FROM announcements WHERE id = ?', [id]);
    saveDatabase();
    return { success: true };
  }
};

// ============ Webhook 数据库 ============
const WebhookDB = {
  // 创建 webhook
  create(data) {
    const id = uuidv4();
    const secret = data.secret || crypto.randomBytes(16).toString('hex');
    try {
      db.run(
        'INSERT INTO webhooks (id, user_id, url, secret, events, active) VALUES (?, ?, ?, ?, ?, ?)',
        [id, data.user_id, data.url, secret, JSON.stringify(data.events || []), data.active !== undefined ? data.active : 1]
      );
      saveDatabase();
      return { success: true, id, secret };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // 获取用户的 webhooks
  getByUser(userId) {
    const result = db.exec('SELECT * FROM webhooks WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map(vals => {
      const row = Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
      row.events = row.events ? JSON.parse(row.events) : [];
      return row;
    });
  },

  // 获取单个 webhook
  getById(id, userId) {
    const result = db.exec('SELECT * FROM webhooks WHERE id = ? AND user_id = ?', [id, userId]);
    if (!result.length || !result[0].values.length) return null;
    const cols = result[0].columns;
    const row = Object.fromEntries(cols.map((c, i) => [c, result[0].values[0][i]]));
    row.events = row.events ? JSON.parse(row.events) : [];
    return row;
  },

  // 更新 webhook
  update(id, userId, data) {
    const fields = [];
    const values = [];
    if (data.url !== undefined) { fields.push('url = ?'); values.push(data.url); }
    if (data.events !== undefined) { fields.push('events = ?'); values.push(JSON.stringify(data.events)); }
    if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active); }
    if (data.secret !== undefined) { fields.push('secret = ?'); values.push(data.secret); }
    if (fields.length === 0) return { success: false, error: 'No fields to update' };
    values.push(id, userId);
    db.run(`UPDATE webhooks SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
    saveDatabase();
    return { success: true };
  },

  // 删除 webhook
  delete(id, userId) {
    db.run('DELETE FROM webhooks WHERE id = ? AND user_id = ?', [id, userId]);
    saveDatabase();
    return { success: true };
  },

  // 触发 webhook（通用方法，工具调用后调用）
  async trigger(event, data) {
    // 查询所有订阅该事件的 active webhooks
    const result = db.exec('SELECT * FROM webhooks WHERE active = 1');
    if (!result.length) return;
    const cols = result[0].columns;
    const allWebhooks = result[0].values.map(vals => {
      const row = Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
      row.events = row.events ? JSON.parse(row.events) : [];
      return row;
    });
    const matched = allWebhooks.filter(w => w.events.includes(event) || w.events.includes('*'));
    // 并发发送
    await Promise.all(matched.map(async w => {
      try {
        const payload = { event, data, timestamp: new Date().toISOString() };
        const sig = crypto.createHmac('sha256', w.secret).update(JSON.stringify(payload)).digest('hex');
        await fetch(w.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': sig },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000)
        });
      } catch (e) { console.log(`Webhook ${w.id} 触发失败:`, e.message); }
    }));
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
  AnnouncementDB,
  WebhookDB,
  backupDatabase
};
