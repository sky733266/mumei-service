const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mumei-service-secret-key-2026';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d'; // Token有效期7天

// 生成JWT Token
function generateToken(user) {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email,
      verified: user.verified 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// 验证JWT Token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// JWT认证中间件
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证Token' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Token无效或已过期' });
  }

  req.user = decoded;
  next();
}

// API Token认证中间件
function apiTokenMiddleware(req, res, next) {
  const apiToken = req.headers['x-api-token'];
  
  if (!apiToken) {
    return res.status(401).json({ error: '未提供API Token' });
  }

  // 将TokenDB传递给路由使用
  req.apiToken = apiToken;
  next();
}

module.exports = {
  generateToken,
  verifyToken,
  authMiddleware,
  apiTokenMiddleware
};
