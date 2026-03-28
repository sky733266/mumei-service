/**
 * 安全中间件 - IP 黑名单和请求限制追踪
 */

const fs = require('fs');
const path = require('path');

// 黑名单文件
const BLACKLIST_FILE = path.join(__dirname, '..', 'data', 'blacklist.json');

// 确保目录存在
const dataDir = path.dirname(BLACKLIST_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 初始化黑名单文件
function initBlacklist() {
  if (!fs.existsSync(BLACKLIST_FILE)) {
    fs.writeFileSync(BLACKLIST_FILE, JSON.stringify({ ips: [], reasons: {} }, null, 2));
  }
}
initBlacklist();

// 读取黑名单
function getBlacklist() {
  try {
    return JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8'));
  } catch (e) {
    return { ips: [], reasons: {} };
  }
}

// 保存黑名单
function saveBlacklist(data) {
  fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(data, null, 2));
}

// 检查IP是否在黑名单中
function isBlacklisted(ip) {
  const blacklist = getBlacklist();
  return blacklist.ips.includes(ip);
}

// 添加IP到黑名单
function addToBlacklist(ip, reason = 'manual') {
  const blacklist = getBlacklist();
  if (!blacklist.ips.includes(ip)) {
    blacklist.ips.push(ip);
    blacklist.reasons[ip] = {
      reason,
      addedAt: new Date().toISOString()
    };
    saveBlacklist(blacklist);
    console.log(`🚫 IP已加入黑名单: ${ip} (${reason})`);
  }
}

// 从黑名单移除
function removeFromBlacklist(ip) {
  const blacklist = getBlacklist();
  const index = blacklist.ips.indexOf(ip);
  if (index > -1) {
    blacklist.ips.splice(index, 1);
    delete blacklist.reasons[ip];
    saveBlacklist(blacklist);
    console.log(`✅ IP已从黑名单移除: ${ip}`);
  }
}

// 记录异常请求
const suspiciousActivity = new Map(); // ip -> { count, timestamps: [] }

function recordSuspiciousRequest(ip, type = 'failed_auth') {
  if (!suspiciousActivity.has(ip)) {
    suspiciousActivity.set(ip, { count: 0, timestamps: [] });
  }
  
  const activity = suspiciousActivity.get(ip);
  activity.count++;
  activity.timestamps.push(Date.now());
  
  // 清理1小时前的记录
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  activity.timestamps = activity.timestamps.filter(t => t > oneHourAgo);
  
  // 1小时内超过50次可疑请求，自动加入黑名单
  if (activity.timestamps.length > 50) {
    addToBlacklist(ip, `自动封禁: 检测到大量可疑请求 (${activity.timestamps.length}次/小时)`);
    return true;
  }
  
  return false;
}

// 获取可疑IP列表（用于管理面板）
function getSuspiciousIPs() {
  const result = [];
  suspiciousActivity.forEach((activity, ip) => {
    if (activity.count > 10) {
      result.push({
        ip,
        count: activity.count,
        lastSeen: new Date(activity.timestamps[activity.timestamps.length - 1]).toISOString()
      });
    }
  });
  return result.sort((a, b) => b.count - a.count);
}

// Express 中间件 - IP检查
function ipCheckMiddleware(req, res, next) {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  if (isBlacklisted(clientIp)) {
    console.warn(`🚫 拒绝来自黑名单IP的请求: ${clientIp}`);
    return res.status(403).json({ 
      error: '访问被拒绝',
      code: 'IP_BLOCKED'
    });
  }
  
  next();
}

// Express 中间件 - 敏感路径保护
function suspiciousPathMiddleware(req, res, next) {
  const path = req.path.toLowerCase();
  const sensitivePaths = ['/admin', '/dashboard', '/wp-admin', '/.env', '/config', '/backup'];
  
  if (sensitivePaths.some(p => path.includes(p))) {
    console.log(`🔍 检测到敏感路径访问: ${req.method} ${path} from ${req.ip}`);
  }
  
  next();
}

module.exports = {
  isBlacklisted,
  addToBlacklist,
  removeFromBlacklist,
  recordSuspiciousRequest,
  getSuspiciousIPs,
  ipCheckMiddleware,
  suspiciousPathMiddleware
};
