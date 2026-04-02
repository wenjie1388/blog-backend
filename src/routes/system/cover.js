const express = require('express');
const router = express.Router();
const { query } = require('@/config/database');
const Response = require('@/utils/response');
const { authenticateToken, requireAdmin } = require('@/middleware/auth');
const { idParamValidation, paginationValidation } = require('@/middleware/validator');

// 获取封面列表
router.get('/', paginationValidation, async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status || 'all';
    const search = req.query.search || '';

    let whereConditions = [];
    let params = [];

    if (status !== 'all') {
      whereConditions.push('status = ?');
      params.push(status);
    }

    if (search) {
      whereConditions.push('(name LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // 获取总数
    const countRows = await query(
      `SELECT COUNT(*) as total FROM covers ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    // 获取封面列表
    const covers = await query(
      `SELECT id, name, url, description, sortOrder, status, createdAt, updatedAt
       FROM covers
       ${whereClause}
       ORDER BY sortOrder ASC, createdAt DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    );

    Response.paginated(res, covers, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get covers error:', error);
    Response.error(res, 'Failed to get covers', 500);
  }
});

// 获取所有启用的封面（用于前端选择）
router.get('/active', async (req, res) => {
  try {
    const covers = await query(
      `SELECT id, name, url, description
       FROM covers
       WHERE status = 'active'
       ORDER BY sortOrder ASC, createdAt DESC`
    );

    Response.success(res, covers);
  } catch (error) {
    console.error('Get active covers error:', error);
    Response.error(res, 'Failed to get active covers', 500);
  }
});

// 获取随机封面
router.get('/random', async (req, res) => {
  try {
    const covers = await query(
      `SELECT id, name, url
       FROM covers
       WHERE status = 'active'
       ORDER BY RAND()
       LIMIT 1`
    );

    if (covers.length === 0) {
      return Response.error(res, 'No active covers found', 404);
    }

    Response.success(res, covers[0]);
  } catch (error) {
    console.error('Get random cover error:', error);
    Response.error(res, 'Failed to get random cover', 500);
  }
});

// 获取封面详情
router.get('/:id', idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;

    const covers = await query(
      `SELECT id, name, url, description, sortOrder, status, createdAt, updatedAt
       FROM covers
       WHERE id = ?`,
      [id]
    );

    if (covers.length === 0) {
      return Response.error(res, 'Cover not found', 404);
    }

    Response.success(res, covers[0]);
  } catch (error) {
    console.error('Get cover error:', error);
    Response.error(res, 'Failed to get cover', 500);
  }
});

// 创建封面（管理员）
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, url, description, sortOrder = 0, status = 'active' } = req.body;

    if (!name || !url) {
      return Response.error(res, 'Name and URL are required', 400);
    }

    const result = await query(
      `INSERT INTO covers (name, url, description, sortOrder, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [name, url, description || null, sortOrder, status]
    );

    Response.success(res, { id: result.insertId }, 'Cover created successfully', 201);
  } catch (error) {
    console.error('Create cover error:', error);
    Response.error(res, 'Failed to create cover', 500);
  }
});

// 更新封面（管理员）
router.put('/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, description, sortOrder, status } = req.body;

    // 检查封面是否存在
    const covers = await query('SELECT * FROM covers WHERE id = ?', [id]);
    if (covers.length === 0) {
      return Response.error(res, 'Cover not found', 404);
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (url !== undefined) {
      updates.push('url = ?');
      params.push(url);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (sortOrder !== undefined) {
      updates.push('sortOrder = ?');
      params.push(sortOrder);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return Response.error(res, 'No fields to update', 400);
    }

    params.push(id);

    await query(
      `UPDATE covers SET ${updates.join(', ')}, updatedAt = NOW() WHERE id = ?`,
      params
    );

    Response.success(res, null, 'Cover updated successfully');
  } catch (error) {
    console.error('Update cover error:', error);
    Response.error(res, 'Failed to update cover', 500);
  }
});

// 删除封面（管理员）
router.delete('/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;

    await query('DELETE FROM covers WHERE id = ?', [id]);

    Response.success(res, null, 'Cover deleted successfully');
  } catch (error) {
    console.error('Delete cover error:', error);
    Response.error(res, 'Failed to delete cover', 500);
  }
});

// 批量删除封面（管理员）
router.post('/batch-delete', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.error(res, 'Invalid ids array', 400);
    }

    const placeholders = ids.map(() => '?').join(',');
    await query(`DELETE FROM covers WHERE id IN (${placeholders})`, ids);

    Response.success(res, null, 'Covers deleted successfully');
  } catch (error) {
    console.error('Batch delete covers error:', error);
    Response.error(res, 'Failed to delete covers', 500);
  }
});

module.exports = router;
