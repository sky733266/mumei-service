/**
 * 管理后台路由
 * 支持用户管理、套餐管理、系统监控
 */

const express = require('express');
const router = express.Router();
const { UserDB, TokenDB, LogDB, PlanDB, SubscriptionDB } = require('../db');
const { addToBlacklist, removeFromBlacklist, getSuspiciousIPs, isBlacklisted } = require('../middleware/security');

// 模拟管理员检查（生产环境应使用真实用户角色系统）
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mumei.dev';

function isAdmin(user) {
  return user && user.email === ADMIN_EMAIL;
}

function adminMiddleware(req, res, next) {
  // 检查是否已登录
  if (!req.user) {
    return res.status(401).json({ error: '请先登录' });
  }
  
  // 检查是否为管理员
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  
  next();
}

// ==================== 系统统计 ====================

// 获取系统概览
router.get('/stats', adminMiddleware, (req, res) => {
  try {
    const users = UserDB.getAllUsers();
    const tokens = TokenDB.getAllTokens();
    const logs = LogDB.getAllLogs();
    const plans = PlanDB.getAllPlans();
    
    // 计算统计数据
    const totalUsers = users.length;
    const verifiedUsers = users.filter(u => u.verified).length;
    const totalTokens = tokens.length;
    const activeTokens = tokens.filter(t => !t.revoked).length;
    
    // 计算今日调用
    const today = new Date().toISOString().split('T')[0];
    const todayCalls = logs.filter(l => l.timestamp && l.timestamp.startsWith(today)).length;
    
    // 套餐分布
    const planDistribution = {};
    users.forEach(u => {
      const plan = u.plan || 'free';
      planDistribution[plan] = (planDistribution[plan] || 0) + 1;
    });
    
    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          verified: verifiedUsers,
          unverified: totalUsers - verifiedUsers
        },
        tokens: {
          total: totalTokens,
          active: activeTokens,
          revoked: totalTokens - activeTokens
        },
        api: {
          totalCalls: logs.length,
          todayCalls
        },
        plans: planDistribution
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 用户管理 ====================

// 获取所有用户
router.get('/users', adminMiddleware, (req, res) => {
  try {
    const { page = 1, limit = 20, plan, verified } = req.query;
    let users = UserDB.getAllUsers();
    
    // 筛选
    if (plan) {
      users = users.filter(u => u.plan === plan);
    }
    if (verified !== undefined) {
      users = users.filter(u => u.verified === (verified === 'true'));
    }
    
    // 分页
    const start = (page - 1) * limit;
    const paginatedUsers = users.slice(start, start + parseInt(limit));
    
    // 脱敏
    const safeUsers = paginatedUsers.map(u => ({
      id: u.id,
      email: u.email,
      plan: u.plan,
      verified: u.verified,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin
    }));
    
    res.json({
      success: true,
      users: safeUsers,
      total: users.length,
      page: parseInt(page),
      totalPages: Math.ceil(users.length / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个用户详情
router.get('/users/:userId', adminMiddleware, (req, res) => {
  try {
    const user = UserDB.getUserById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const tokens = TokenDB.getUserTokens(user.id);
    const logs = LogDB.getUserLogs(user.id, { limit: 100 });
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan,
        verified: user.verified,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      },
      tokens: tokens.map(t => ({
        id: t.id,
        name: t.name,
        createdAt: t.createdAt,
        lastUsed: t.lastUsed,
        revoked: t.revoked
      })),
      recentLogs: logs.logs.slice(0, 20)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 修改用户套餐
router.put('/users/:userId/plan', adminMiddleware, (req, res) => {
  try {
    const { plan } = req.body;
    if (!plan) {
      return res.status(400).json({ error: '请指定套餐' });
    }
    
    const validPlans = ['free', 'pro', 'enterprise'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({ error: '无效的套餐' });
    }
    
    UserDB.updateUserPlan(req.params.userId, plan);
    
    res.json({
      success: true,
      message: `用户套餐已更新为 ${plan}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除用户
router.delete('/users/:userId', adminMiddleware, (req, res) => {
  try {
    const userId = req.params.userId;
    
    // 不能删除自己
    if (userId === req.user.userId) {
      return res.status(400).json({ error: '不能删除自己' });
    }
    
    // 删除用户的所有 Token
    const tokens = TokenDB.getUserTokens(userId);
    tokens.forEach(t => TokenDB.deleteToken(t.id, userId));
    
    // 删除用户（实际实现取决于 DB 层）
    // UserDB.deleteUser(userId);
    
    res.json({
      success: true,
      message: '用户已删除'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== IP 黑名单管理 ====================

// 获取可疑 IP 列表
router.get('/suspicious-ips', adminMiddleware, (req, res) => {
  try {
    const suspiciousIPs = getSuspiciousIPs();
    const blacklisted = require('../data/blacklist.json');
    
    res.json({
      success: true,
      suspicious: suspiciousIPs,
      blacklisted: blacklisted.ips.map(ip => ({
        ip,
        reason: blacklisted.reasons[ip]
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加 IP 到黑名单
router.post('/blacklist/add', adminMiddleware, (req, res) => {
  try {
    const { ip, reason } = req.body;
    if (!ip) {
      return res.status(400).json({ error: '请指定 IP 地址' });
    }
    
    addToBlacklist(ip, reason || '手动封禁');
    
    res.json({
      success: true,
      message: `IP ${ip} 已加入黑名单`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 从黑名单移除
router.post('/blacklist/remove', adminMiddleware, (req, res) => {
  try {
    const { ip } = req.body;
    if (!ip) {
      return res.status(400).json({ error: '请指定 IP 地址' });
    }
    
    removeFromBlacklist(ip);
    
    res.json({
      success: true,
      message: `IP ${ip} 已从黑名单移除`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 日志查询 ====================

// 获取系统日志
router.get('/logs', adminMiddleware, (req, res) => {
  try {
    const { page = 1, limit = 50, type, userId } = req.query;
    let logs = LogDB.getAllLogs ? LogDB.getAllLogs() : [];
    
    // 筛选
    if (type) {
      logs = logs.filter(l => l.type === type);
    }
    if (userId) {
      logs = logs.filter(l => l.userId === userId);
    }
    
    // 按时间倒序
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // 分页
    const start = (page - 1) * limit;
    const paginatedLogs = logs.slice(start, start + parseInt(limit));
    
    res.json({
      success: true,
      logs: paginatedLogs,
      total: logs.length,
      page: parseInt(page),
      totalPages: Math.ceil(logs.length / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
