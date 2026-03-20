const { verifyToken, extractTokenFromHeader } = require('@/utils/jwt');
const Response = require('@/utils/response');
const { query } = require('@/config/database');

// 验证JWT token
async function authenticateToken(req, res, next) {
  const token = extractTokenFromHeader(req);
  
  if (!token) {
    return Response.error(res, 'Access token is required', 401);
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return Response.error(res, 'Invalid or expired token', 401);
  }
  
  // 获取用户信息
  try {
    const users = await query(
      'SELECT id, username, email, role, avatar, status FROM users WHERE id = ?',
      [decoded.userId]
    );
    
    if (users.length === 0) {
      return Response.error(res, 'User not found', 401);
    }
    
    const user = users[0];
    if (user.status !== 'active') {
      return Response.error(res, 'Account is disabled', 403);
    }
    
    req.user = user;
    next();
  } catch (error) {
    return Response.error(res, 'Authentication failed', 500);
  }
}

// 验证管理员权限
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return Response.error(res, 'Admin access required', 403);
  }
  next();
}

// 可选认证（不强制要求登录，但如果提供token则解析）
async function optionalAuth(req, res, next) {
  const token = extractTokenFromHeader(req);
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      try {
        const users = await query(
          'SELECT id, username, email, role, avatar, status FROM users WHERE id = ?',
          [decoded.userId]
        );
        if (users.length > 0 && users[0].status === 'active') {
          req.user = users[0];
        }
      } catch (error) {
        // 静默失败，继续作为未认证用户
      }
    }
  }
  
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  optionalAuth
};
