const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { query } = require('@/config/database');
const { generateToken } = require('@/utils/jwt');
const Response = require('@/utils/response');
const { loginValidation, registerValidation } = require('@/middleware/validator');
const { authenticateToken } = require('@/middleware/auth');

// 登录
router.post('/login', loginValidation, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 查找用户
    const users = await query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );
    
    if (users.length === 0) {
      return Response.error(res, 'Invalid credentials', 401);
    }
    
    const user = users[0];
    
    // 检查用户状态
    if (user.status !== 'active') {
      return Response.error(res, 'Account is disabled', 403);
    }
    
    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return Response.error(res, 'Invalid credentials', 401);
    }
    
    // 生成token
    const token = generateToken({ userId: user.id, role: user.role });
    
    // 更新最后登录时间
    await query(
      'UPDATE users SET lastLogin = NOW() WHERE id = ?',
      [user.id]
    );
    
    Response.success(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        nickname: user.nickname
      }
    }, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    Response.error(res, 'Login failed', 500);
  }
});

// 注册
router.post('/register', registerValidation, async (req, res) => {
  try {
    const { username, email, password, nickname } = req.body;
    
    // 检查用户名是否已存在
    const existingUsers = await query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    
    if (existingUsers.length > 0) {
      return Response.error(res, 'Username or email already exists', 409);
    }
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 创建用户
    const result = await query(
      'INSERT INTO users (username, email, password, nickname, role, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [username, email, hashedPassword, nickname || username, 'user', 'active']
    );
    
    const userId = result.insertId;
    
    // 生成token
    const token = generateToken({ userId, role: 'user' });
    
    Response.success(res, {
      token,
      user: {
        id: userId,
        username,
        email,
        role: 'user',
        nickname: nickname || username
      }
    }, 'Registration successful', 201);
  } catch (error) {
    console.error('Register error:', error);
    Response.error(res, 'Registration failed', 500);
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, async (req, res) => {
  try {
    Response.success(res, { user: req.user });
  } catch (error) {
    Response.error(res, 'Failed to get user info', 500);
  }
});

// 修改密码
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    // 获取用户
    const users = await query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return Response.error(res, 'User not found', 404);
    }
    
    // 验证旧密码
    const isValid = await bcrypt.compare(oldPassword, users[0].password);
    if (!isValid) {
      return Response.error(res, 'Old password is incorrect', 400);
    }
    
    // 更新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
    
    Response.success(res, null, 'Password changed successfully');
  } catch (error) {
    console.error('Change password error:', error);
    Response.error(res, 'Failed to change password', 500);
  }
});

module.exports = router;
