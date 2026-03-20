const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { query } = require('@/config/database');
const Response = require('@/utils/response');
const { authenticateToken, requireAdmin } = require('@/middleware/auth');
const { paginationValidation } = require('@/middleware/validator');

// 获取用户列表（管理员）
router.get('/', authenticateToken, requireAdmin, paginationValidation, async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    
    let whereClause = '';
    let params = [];
    
    if (search) {
      whereClause = 'WHERE username LIKE ? OR email LIKE ? OR nickname LIKE ?';
      params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }
    
    // 获取总数
    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );
    const total = countResult.total;
    
    // 获取用户列表
    const users = await query(
      `SELECT id, username, email, nickname, avatar, role, status, createdAt, lastLogin 
       FROM users ${whereClause} 
       ORDER BY createdAt DESC 
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    );
    
    Response.paginated(res, users, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get users error:', error);
    Response.error(res, 'Failed to get users', 500);
  }
});

// 获取单个用户
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 普通用户只能查看自己的信息
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      return Response.error(res, 'Permission denied', 403);
    }
    
    const users = await query(
      'SELECT id, username, email, nickname, avatar, role, status, createdAt, lastLogin, bio FROM users WHERE id = ?',
      [id]
    );
    
    if (users.length === 0) {
      return Response.error(res, 'User not found', 404);
    }
    
    Response.success(res, users[0]);
  } catch (error) {
    console.error('Get user error:', error);
    Response.error(res, 'Failed to get user', 500);
  }
});

// 更新用户信息
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, email, avatar, bio } = req.body;
    
    // 普通用户只能更新自己的信息
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      return Response.error(res, 'Permission denied', 403);
    }
    
    // 检查用户是否存在
    const users = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return Response.error(res, 'User not found', 404);
    }
    
    // 更新用户信息
    await query(
      'UPDATE users SET nickname = ?, email = ?, avatar = ?, bio = ? WHERE id = ?',
      [nickname || users[0].nickname, email || users[0].email, avatar || users[0].avatar, bio || users[0].bio, id]
    );
    
    Response.success(res, null, 'User updated successfully');
  } catch (error) {
    console.error('Update user error:', error);
    Response.error(res, 'Failed to update user', 500);
  }
});

// 更新用户状态（管理员）
router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['active', 'disabled'].includes(status)) {
      return Response.error(res, 'Invalid status', 400);
    }
    
    // 不能禁用自己
    if (parseInt(id) === req.user.id) {
      return Response.error(res, 'Cannot disable yourself', 400);
    }
    
    await query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    
    Response.success(res, null, 'User status updated successfully');
  } catch (error) {
    console.error('Update user status error:', error);
    Response.error(res, 'Failed to update user status', 500);
  }
});

// 更新用户角色（管理员）
router.put('/:id/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!['admin', 'user'].includes(role)) {
      return Response.error(res, 'Invalid role', 400);
    }
    
    // 不能修改自己的角色
    if (parseInt(id) === req.user.id) {
      return Response.error(res, 'Cannot change your own role', 400);
    }
    
    await query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    
    Response.success(res, null, 'User role updated successfully');
  } catch (error) {
    console.error('Update user role error:', error);
    Response.error(res, 'Failed to update user role', 500);
  }
});

// 删除用户（管理员）
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 不能删除自己
    if (parseInt(id) === req.user.id) {
      return Response.error(res, 'Cannot delete yourself', 400);
    }
    
    await query('DELETE FROM users WHERE id = ?', [id]);
    
    Response.success(res, null, 'User deleted successfully');
  } catch (error) {
    console.error('Delete user error:', error);
    Response.error(res, 'Failed to delete user', 500);
  }
});

module.exports = router;
