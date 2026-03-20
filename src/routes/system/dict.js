const express = require('express');
const router = express.Router();
const { query } = require('@/config/database');
const { getOrSet, del } = require('@/config/redis');
const Response = require('@/utils/response');
const { authenticateToken, requireAdmin } = require('@/middleware/auth');
const { dictTypeValidation, dictDataValidation, idParamValidation, paginationValidation } = require('@/middleware/validator');

const DICT_CACHE_PREFIX = 'dict:';
const DICT_TYPE_CACHE_KEY = 'dict:types';

// ========== 字典类型管理 ==========

// 获取字典类型列表（分页）
router.get('/types', authenticateToken, requireAdmin, paginationValidation, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const keyword = req.query.keyword?.trim();

    let whereClause = '';
    let params = [];

    if (keyword) {
      whereClause = 'WHERE dictName LIKE ? OR dictType LIKE ?';
      params = [`%${keyword}%`, `%${keyword}%`];
    }

    // 获取总数
    const countRows = await query(
      `SELECT COUNT(*) as total FROM sys_dict_type ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    // 获取列表
    const rows = await query(
      `SELECT id, dictName, dictType, status, remark, createdAt, updatedAt
       FROM sys_dict_type
       ${whereClause}
       ORDER BY createdAt DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    );

    Response.paginated(res, rows, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Get dict types error:', error);
    Response.error(res, 'Failed to get dict types', 500);
  }
});

// 获取所有字典类型（下拉选择用）
router.get('/types/all', async (req, res) => {
  try {
    const types = await getOrSet(DICT_TYPE_CACHE_KEY, async () => {
      return await query(
        `SELECT id, dictName, dictType, status
         FROM sys_dict_type
         WHERE status = '1'
         ORDER BY createdAt DESC`
      );
    }, 3600);

    Response.success(res, types);
  } catch (error) {
    console.error('Get all dict types error:', error);
    Response.error(res, 'Failed to get dict types', 500);
  }
});

// 获取单个字典类型
router.get('/types/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query(
      'SELECT * FROM sys_dict_type WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return Response.error(res, 'Dict type not found', 404);
    }

    Response.success(res, rows[0]);
  } catch (error) {
    console.error('Get dict type error:', error);
    Response.error(res, 'Failed to get dict type', 500);
  }
});

// 创建字典类型
router.post('/types', authenticateToken, requireAdmin, dictTypeValidation, async (req, res) => {
  try {
    const { dictName, dictType, status = '1', remark } = req.body;

    // 检查字典类型是否已存在
    const existing = await query('SELECT * FROM sys_dict_type WHERE dictType = ?', [dictType]);
    if (existing.length > 0) {
      return Response.error(res, 'Dict type already exists', 409);
    }

    const result = await query(
      'INSERT INTO sys_dict_type (dictName, dictType, status, remark, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [dictName, dictType, status, remark || null]
    );

    // 清除缓存
    await del(DICT_TYPE_CACHE_KEY);

    Response.success(res, { id: result.insertId }, 'Dict type created successfully', 201);
  } catch (error) {
    console.error('Create dict type error:', error);
    Response.error(res, 'Failed to create dict type', 500);
  }
});

// 更新字典类型
router.put('/types/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { dictName, dictType, status, remark } = req.body;

    // 检查是否存在
    const rows = await query('SELECT * FROM sys_dict_type WHERE id = ?', [id]);
    if (rows.length === 0) {
      return Response.error(res, 'Dict type not found', 404);
    }

    // 如果修改了dictType，检查是否重复
    if (dictType && dictType !== rows[0].dictType) {
      const existing = await query('SELECT * FROM sys_dict_type WHERE dictType = ? AND id != ?', [dictType, id]);
      if (existing.length > 0) {
        return Response.error(res, 'Dict type already exists', 409);
      }
    }

    await query(
      'UPDATE sys_dict_type SET dictName = ?, dictType = ?, status = ?, remark = ?, updatedAt = NOW() WHERE id = ?',
      [
        dictName || rows[0].dictName,
        dictType || rows[0].dictType,
        status || rows[0].status,
        remark !== undefined ? remark : rows[0].remark,
        id
      ]
    );

    // 清除缓存
    await del(DICT_TYPE_CACHE_KEY);
    await del(`${DICT_CACHE_PREFIX}type:${rows[0].dictType}`);

    Response.success(res, null, 'Dict type updated successfully');
  } catch (error) {
    console.error('Update dict type error:', error);
    Response.error(res, 'Failed to update dict type', 500);
  }
});

// 删除字典类型
router.delete('/types/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查是否存在
    const rows = await query('SELECT * FROM sys_dict_type WHERE id = ?', [id]);
    if (rows.length === 0) {
      return Response.error(res, 'Dict type not found', 404);
    }

    // 检查是否有关联的字典数据
    const dataCount = await query('SELECT COUNT(*) as count FROM sys_dict_data WHERE dictType = ?', [rows[0].dictType]);
    if (dataCount[0].count > 0) {
      return Response.error(res, 'Cannot delete dict type with associated data', 400);
    }

    await query('DELETE FROM sys_dict_type WHERE id = ?', [id]);

    // 清除缓存
    await del(DICT_TYPE_CACHE_KEY);
    await del(`${DICT_CACHE_PREFIX}type:${rows[0].dictType}`);

    Response.success(res, null, 'Dict type deleted successfully');
  } catch (error) {
    console.error('Delete dict type error:', error);
    Response.error(res, 'Failed to delete dict type', 500);
  }
});

// ========== 字典数据管理 ==========

// 获取字典数据列表（分页）
router.get('/data', authenticateToken, requireAdmin, paginationValidation, async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const offset = (page - 1) * limit;
    const dictType = req.query.dictType;
    const status = req.query.status;

    let whereConditions = [];
    let params = [];

    if (dictType) {
      whereConditions.push('d.dictType = ?');
      params.push(dictType);
    }

    if (status) {
      whereConditions.push('d.status = ?');
      params.push(status);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // 获取总数
    const countRows = await query(
      `SELECT COUNT(*) as total FROM sys_dict_data d ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    // 获取列表
    const rows = await query(
      `SELECT d.*, t.dictName as typeName
       FROM sys_dict_data d
       LEFT JOIN sys_dict_type t ON d.dictType = t.dictType
       ${whereClause}
       ORDER BY d.dictSort ASC, d.createdAt DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    );

    Response.paginated(res, rows, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Get dict data error:', error);
    Response.error(res, 'Failed to get dict data', 500);
  }
});

// 根据字典类型获取字典数据（公开接口，带缓存）
router.get('/data/type/:dictType', async (req, res) => {
  try {
    const { dictType } = req.params;
    const cacheKey = `${DICT_CACHE_PREFIX}type:${dictType}`;

    const data = await getOrSet(cacheKey, async () => {
      return await query(
        `SELECT dictCode, dictLabel, dictValue, dictSort, isDefault, remark, cssClass, listClass
         FROM sys_dict_data
         WHERE dictType = ? AND status = '1'
         ORDER BY dictSort ASC, createdAt ASC`,
        [dictType]
      );
    }, 3600);

    Response.success(res, data);
  } catch (error) {
    console.error('Get dict data by type error:', error);
    Response.error(res, 'Failed to get dict data', 500);
  }
});

// 获取单个字典数据
router.get('/data/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query(
      'SELECT d.*, t.dictName as typeName FROM sys_dict_data d LEFT JOIN sys_dict_type t ON d.dictType = t.dictType WHERE d.id = ?',
      [id]
    );

    if (rows.length === 0) {
      return Response.error(res, 'Dict data not found', 404);
    }

    Response.success(res, rows[0]);
  } catch (error) {
    console.error('Get dict data item error:', error);
    Response.error(res, 'Failed to get dict data', 500);
  }
});

// 创建字典数据
router.post('/data', authenticateToken, requireAdmin, dictDataValidation, async (req, res) => {
  try {
    const { dictType, dictLabel, dictValue, dictSort = 0, isDefault = '0', status = '1', remark, cssClass, listClass } = req.body;

    // 检查字典类型是否存在
    const typeExists = await query('SELECT * FROM sys_dict_type WHERE dictType = ?', [dictType]);
    if (typeExists.length === 0) {
      return Response.error(res, 'Dict type does not exist', 400);
    }

    // 检查字典键值是否已存在
    const existing = await query('SELECT * FROM sys_dict_data WHERE dictType = ? AND dictValue = ?', [dictType, dictValue]);
    if (existing.length > 0) {
      return Response.error(res, 'Dict value already exists in this type', 409);
    }

    // 如果设置为默认，先将同类型的其他数据设为非默认
    if (isDefault === '1') {
      await query('UPDATE sys_dict_data SET isDefault = "0" WHERE dictType = ?', [dictType]);
    }

    const result = await query(
      `INSERT INTO sys_dict_data 
       (dictType, dictLabel, dictValue, dictSort, isDefault, status, remark, cssClass, listClass, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [dictType, dictLabel, dictValue, dictSort, isDefault, status, remark || null, cssClass || null, listClass || null]
    );

    // 清除缓存
    await del(`${DICT_CACHE_PREFIX}type:${dictType}`);

    Response.success(res, { id: result.insertId }, 'Dict data created successfully', 201);
  } catch (error) {
    console.error('Create dict data error:', error);
    Response.error(res, 'Failed to create dict data', 500);
  }
});

// 更新字典数据
router.put('/data/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { dictType, dictLabel, dictValue, dictSort, isDefault, status, remark, cssClass, listClass } = req.body;

    // 检查是否存在
    const rows = await query('SELECT * FROM sys_dict_data WHERE id = ?', [id]);
    if (rows.length === 0) {
      return Response.error(res, 'Dict data not found', 404);
    }

    const oldDictType = rows[0].dictType;

    // 如果修改了dictType，检查新类型是否存在
    if (dictType && dictType !== oldDictType) {
      const typeExists = await query('SELECT * FROM sys_dict_type WHERE dictType = ?', [dictType]);
      if (typeExists.length === 0) {
        return Response.error(res, 'Dict type does not exist', 400);
      }
    }

    // 如果修改了dictValue，检查是否重复
    const finalDictType = dictType || oldDictType;
    const finalDictValue = dictValue || rows[0].dictValue;
    if ((dictValue && dictValue !== rows[0].dictValue) || (dictType && dictType !== oldDictType)) {
      const existing = await query('SELECT * FROM sys_dict_data WHERE dictType = ? AND dictValue = ? AND id != ?', [finalDictType, finalDictValue, id]);
      if (existing.length > 0) {
        return Response.error(res, 'Dict value already exists in this type', 409);
      }
    }

    // 如果设置为默认，先将同类型的其他数据设为非默认
    const finalIsDefault = isDefault !== undefined ? isDefault : rows[0].isDefault;
    if (finalIsDefault === '1' && finalIsDefault !== rows[0].isDefault) {
      await query('UPDATE sys_dict_data SET isDefault = "0" WHERE dictType = ?', [finalDictType]);
    }

    await query(
      `UPDATE sys_dict_data 
       SET dictType = ?, dictLabel = ?, dictValue = ?, dictSort = ?, isDefault = ?, 
           status = ?, remark = ?, cssClass = ?, listClass = ?, updatedAt = NOW()
       WHERE id = ?`,
      [
        finalDictType,
        dictLabel || rows[0].dictLabel,
        finalDictValue,
        dictSort !== undefined ? dictSort : rows[0].dictSort,
        finalIsDefault,
        status || rows[0].status,
        remark !== undefined ? remark : rows[0].remark,
        cssClass !== undefined ? cssClass : rows[0].cssClass,
        listClass !== undefined ? listClass : rows[0].listClass,
        id
      ]
    );

    // 清除缓存（新旧类型都要清）
    await del(`${DICT_CACHE_PREFIX}type:${oldDictType}`);
    if (dictType && dictType !== oldDictType) {
      await del(`${DICT_CACHE_PREFIX}type:${dictType}`);
    }

    Response.success(res, null, 'Dict data updated successfully');
  } catch (error) {
    console.error('Update dict data error:', error);
    Response.error(res, 'Failed to update dict data', 500);
  }
});

// 删除字典数据
router.delete('/data/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查是否存在
    const rows = await query('SELECT * FROM sys_dict_data WHERE id = ?', [id]);
    if (rows.length === 0) {
      return Response.error(res, 'Dict data not found', 404);
    }

    await query('DELETE FROM sys_dict_data WHERE id = ?', [id]);

    // 清除缓存
    await del(`${DICT_CACHE_PREFIX}type:${rows[0].dictType}`);

    Response.success(res, null, 'Dict data deleted successfully');
  } catch (error) {
    console.error('Delete dict data error:', error);
    Response.error(res, 'Failed to delete dict data', 500);
  }
});

// 批量删除字典数据
router.delete('/data/batch/:ids', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ids } = req.params;
    const idArray = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));

    if (idArray.length === 0) {
      return Response.error(res, 'Invalid IDs', 400);
    }

    // 获取所有涉及的dictType以清除缓存
    const dataRows = await query(`SELECT dictType FROM sys_dict_data WHERE id IN (${idArray.map(() => '?').join(',')})`, idArray);
    const dictTypes = [...new Set(dataRows.map(r => r.dictType))];

    await query(`DELETE FROM sys_dict_data WHERE id IN (${idArray.map(() => '?').join(',')})`, idArray);

    // 清除缓存
    for (const dictType of dictTypes) {
      await del(`${DICT_CACHE_PREFIX}type:${dictType}`);
    }

    Response.success(res, null, 'Dict data deleted successfully');
  } catch (error) {
    console.error('Batch delete dict data error:', error);
    Response.error(res, 'Failed to delete dict data', 500);
  }
});

module.exports = router;
