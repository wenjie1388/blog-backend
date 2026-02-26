const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const Response = require('../utils/response');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { menuValidation, idParamValidation } = require('../middleware/validator');

// 获取所有菜单（树形结构）
router.get('/', async (req, res) => {
  try {
    const menus = await query(
      `SELECT * FROM menus 
       ORDER BY parentId ASC, sortOrder ASC, createdAt ASC`
    );
    
    // 构建树形结构
    const buildTree = (items, parentId = null) => {
      return items
        .filter(item => item.parentId === parentId)
        .map(item => ({
          ...item,
          children: buildTree(items, item.id)
        }));
    };
    
    const tree = buildTree(menus);
    
    Response.success(res, tree);
  } catch (error) {
    console.error('Get menus error:', error);
    Response.error(res, 'Failed to get menus', 500);
  }
});

// 获取前台菜单（仅显示状态为可见的）
router.get('/frontend', async (req, res) => {
  try {
    const menus = await query(
      `SELECT id, name, path, icon, target, parentId, sortOrder 
       FROM menus 
       WHERE isVisible = 1
       ORDER BY parentId ASC, sortOrder ASC`
    );
    
    // 构建树形结构
    const buildTree = (items, parentId = null) => {
      return items
        .filter(item => item.parentId === parentId)
        .map(item => ({
          ...item,
          children: buildTree(items, item.id)
        }));
    };
    
    const tree = buildTree(menus);
    
    Response.success(res, tree);
  } catch (error) {
    console.error('Get frontend menus error:', error);
    Response.error(res, 'Failed to get menus', 500);
  }
});

// 获取单个菜单
router.get('/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    
    const menus = await query('SELECT * FROM menus WHERE id = ?', [id]);
    
    if (menus.length === 0) {
      return Response.error(res, 'Menu not found', 404);
    }
    
    Response.success(res, menus[0]);
  } catch (error) {
    console.error('Get menu error:', error);
    Response.error(res, 'Failed to get menu', 500);
  }
});

// 创建菜单（管理员）
router.post('/', authenticateToken, requireAdmin, menuValidation, async (req, res) => {
  try {
    const { name, path, icon, target = '_self', parentId = null, sortOrder = 0, isVisible = true } = req.body;
    
    // 检查父菜单是否存在
    if (parentId) {
      const parents = await query('SELECT * FROM menus WHERE id = ?', [parentId]);
      if (parents.length === 0) {
        return Response.error(res, 'Parent menu not found', 404);
      }
    }
    
    const result = await query(
      'INSERT INTO menus (name, path, icon, target, parentId, sortOrder, isVisible, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [name, path, icon || null, target, parentId, sortOrder, isVisible ? 1 : 0]
    );
    
    Response.success(res, { id: result.insertId }, 'Menu created successfully', 201);
  } catch (error) {
    console.error('Create menu error:', error);
    Response.error(res, 'Failed to create menu', 500);
  }
});

// 更新菜单（管理员）
router.put('/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, path, icon, target, parentId, sortOrder, isVisible } = req.body;
    
    // 检查菜单是否存在
    const menus = await query('SELECT * FROM menus WHERE id = ?', [id]);
    if (menus.length === 0) {
      return Response.error(res, 'Menu not found', 404);
    }
    
    // 检查父菜单是否存在，且不能将自己设为父菜单
    if (parentId) {
      if (parentId === parseInt(id)) {
        return Response.error(res, 'Cannot set self as parent', 400);
      }
      const parents = await query('SELECT * FROM menus WHERE id = ?', [parentId]);
      if (parents.length === 0) {
        return Response.error(res, 'Parent menu not found', 404);
      }
    }
    
    await query(
      'UPDATE menus SET name = ?, path = ?, icon = ?, target = ?, parentId = ?, sortOrder = ?, isVisible = ? WHERE id = ?',
      [
        name || menus[0].name,
        path || menus[0].path,
        icon !== undefined ? icon : menus[0].icon,
        target || menus[0].target,
        parentId !== undefined ? parentId : menus[0].parentId,
        sortOrder !== undefined ? sortOrder : menus[0].sortOrder,
        isVisible !== undefined ? (isVisible ? 1 : 0) : menus[0].isVisible,
        id
      ]
    );
    
    Response.success(res, null, 'Menu updated successfully');
  } catch (error) {
    console.error('Update menu error:', error);
    Response.error(res, 'Failed to update menu', 500);
  }
});

// 删除菜单（管理员）
router.delete('/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查是否有子菜单
    const children = await query('SELECT * FROM menus WHERE parentId = ?', [id]);
    if (children.length > 0) {
      return Response.error(res, 'Cannot delete menu with children', 400);
    }
    
    await query('DELETE FROM menus WHERE id = ?', [id]);
    
    Response.success(res, null, 'Menu deleted successfully');
  } catch (error) {
    console.error('Delete menu error:', error);
    Response.error(res, 'Failed to delete menu', 500);
  }
});

// 批量更新菜单排序（管理员）
router.put('/sort/batch', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      return Response.error(res, 'Invalid items format', 400);
    }
    
    // 使用事务批量更新
    const { transaction } = require('../config/database');
    await transaction(async (connection) => {
      for (const item of items) {
        await connection.execute(
          'UPDATE menus SET sortOrder = ?, parentId = ? WHERE id = ?',
          [item.sortOrder, item.parentId, item.id]
        );
      }
    });
    
    Response.success(res, null, 'Menu order updated successfully');
  } catch (error) {
    console.error('Update menu sort error:', error);
    Response.error(res, 'Failed to update menu order', 500);
  }
});

module.exports = router;
