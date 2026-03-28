const { LogDB } = require('./db');

// 请求日志中间件
function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  // 保存原始的end方法
  const originalEnd = res.end;
  
  // 重写end方法以捕获响应
  res.end = function(chunk, encoding) {
    // 恢复原始方法
    res.end = originalEnd;
    res.end(chunk, encoding);
    
    // 计算请求耗时
    const duration = Date.now() - startTime;
    
    // 获取用户信息（如果有）
    const userId = req.user?.userId || req.apiUser?.userId;
    const tokenId = req.apiUser?.tokenId;
    
    // 只记录API请求
    if (req.path.startsWith('/api/')) {
      LogDB.createLog({
        userId,
        tokenId,
        endpoint: req.path,
        method: req.method,
        status: res.statusCode,
        duration,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        error: res.statusCode >= 400 ? res.statusMessage : null
      });
    }
  };
  
  next();
}

// 获取客户端IP
function getClientIp(req) {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress;
}

module.exports = { requestLogger, getClientIp };
