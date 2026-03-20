const express = require('express');
const router = express.Router();
const { query } = require('@/config/database');
const { set, get } = require('@/config/redis');
const Response = require('@/utils/response');
const { authenticateToken, requireAdmin } = require('@/middleware/auth');
const { themeValidation, idParamValidation } = require('@/middleware/validator');

// 获取所有主题
router.get('/', async (req, res) => {
  try {
    const themes = await query(
      'SELECT * FROM themes ORDER BY isDefault DESC, createdAt DESC'
    );
    
    Response.success(res, themes);
  } catch (error) {
    console.error('Get themes error:', error);
    Response.error(res, 'Failed to get themes', 500);
  }
});

// 获取当前默认主题
router.get('/default', async (req, res) => {
  try {
    // 尝试从缓存获取
    const cached = await get('theme:default');
    if (cached) {
      return Response.success(res, JSON.parse(cached));
    }
    
    const themes = await query(
      'SELECT * FROM themes WHERE isDefault = 1 LIMIT 1'
    );
    
    if (themes.length === 0) {
      // 如果没有默认主题，返回第一个主题
      const firstTheme = await query('SELECT * FROM themes LIMIT 1');
      if (firstTheme.length === 0) {
        return Response.error(res, 'No theme found', 404);
      }
      
      // 缓存结果
      await set('theme:default', firstTheme[0], 3600);
      return Response.success(res, firstTheme[0]);
    }
    
    // 缓存结果
    await set('theme:default', themes[0], 3600);
    
    Response.success(res, themes[0]);
  } catch (error) {
    console.error('Get default theme error:', error);
    Response.error(res, 'Failed to get default theme', 500);
  }
});

// 获取单个主题
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const themes = await query('SELECT * FROM themes WHERE id = ?', [id]);
    
    if (themes.length === 0) {
      return Response.error(res, 'Theme not found', 404);
    }
    
    Response.success(res, themes[0]);
  } catch (error) {
    console.error('Get theme error:', error);
    Response.error(res, 'Failed to get theme', 500);
  }
});

// 创建主题（管理员）
router.post('/', authenticateToken, requireAdmin, themeValidation, async (req, res) => {
  try {
    const { name, key, description, config, isDefault = false } = req.body;
    
    // 检查key是否已存在
    const existing = await query('SELECT * FROM themes WHERE `key` = ?', [key]);
    if (existing.length > 0) {
      return Response.error(res, 'Theme key already exists', 409);
    }
    
    // 如果设置为默认，先取消其他默认主题
    if (isDefault) {
      await query('UPDATE themes SET isDefault = 0');
      await set('theme:default', null);
    }
    
    const result = await query(
      'INSERT INTO themes (name, `key`, description, config, isDefault, createdAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [name, key, description || null, config ? JSON.stringify(config) : null, isDefault ? 1 : 0]
    );
    
    Response.success(res, { id: result.insertId }, 'Theme created successfully', 201);
  } catch (error) {
    console.error('Create theme error:', error);
    Response.error(res, 'Failed to create theme', 500);
  }
});

// 更新主题（管理员）
router.put('/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, key, description, config, isDefault } = req.body;
    
    // 检查主题是否存在
    const themes = await query('SELECT * FROM themes WHERE id = ?', [id]);
    if (themes.length === 0) {
      return Response.error(res, 'Theme not found', 404);
    }
    
    // 如果修改了key，检查是否已存在
    if (key && key !== themes[0].key) {
      const existing = await query('SELECT * FROM themes WHERE `key` = ? AND id != ?', [key, id]);
      if (existing.length > 0) {
        return Response.error(res, 'Theme key already exists', 409);
      }
    }
    
    // 如果设置为默认，先取消其他默认主题
    if (isDefault) {
      await query('UPDATE themes SET isDefault = 0');
      await set('theme:default', null);
    }
    
    await query(
      'UPDATE themes SET name = ?, `key` = ?, description = ?, config = ?, isDefault = ? WHERE id = ?',
      [
        name || themes[0].name,
        key || themes[0].key,
        description !== undefined ? description : themes[0].description,
        config !== undefined ? JSON.stringify(config) : themes[0].config,
        isDefault !== undefined ? (isDefault ? 1 : 0) : themes[0].isDefault,
        id
      ]
    );
    
    // 清除缓存
    if (isDefault) {
      await set('theme:default', null);
    }
    
    Response.success(res, null, 'Theme updated successfully');
  } catch (error) {
    console.error('Update theme error:', error);
    Response.error(res, 'Failed to update theme', 500);
  }
});

// 删除主题（管理员）
router.delete('/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查是否是默认主题
    const themes = await query('SELECT * FROM themes WHERE id = ?', [id]);
    if (themes.length === 0) {
      return Response.error(res, 'Theme not found', 404);
    }
    
    if (themes[0].isDefault) {
      return Response.error(res, 'Cannot delete default theme', 400);
    }
    
    await query('DELETE FROM themes WHERE id = ?', [id]);
    
    Response.success(res, null, 'Theme deleted successfully');
  } catch (error) {
    console.error('Delete theme error:', error);
    Response.error(res, 'Failed to delete theme', 500);
  }
});

// 设置默认主题（管理员）
router.put('/:id/default', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查主题是否存在
    const themes = await query('SELECT * FROM themes WHERE id = ?', [id]);
    if (themes.length === 0) {
      return Response.error(res, 'Theme not found', 404);
    }
    
    // 取消其他默认主题
    await query('UPDATE themes SET isDefault = 0');
    
    // 设置当前主题为默认
    await query('UPDATE themes SET isDefault = 1 WHERE id = ?', [id]);
    
    // 清除缓存
    await set('theme:default', null);
    
    Response.success(res, null, 'Default theme updated successfully');
  } catch (error) {
    console.error('Set default theme error:', error);
    Response.error(res, 'Failed to set default theme', 500);
  }
});

module.exports = router;
