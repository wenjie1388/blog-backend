const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { getOrSet, del } = require('../config/redis');
const Response = require('../utils/response');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const TAG_CACHE_PREFIX = 'tag:';
const TAG_LIST_CACHE_KEY = 'tag:list';
const TAG_CLOUD_CACHE_KEY = 'tag:cloud';

// 生成slug
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

// ========== 标签管理（管理员） ==========

// 获取标签列表（分页）
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const keyword = req.query.keyword?.trim();
    const status = req.query.status;

    let whereConditions = [];
    let params = [];

    if (keyword) {
      whereConditions.push('(name LIKE ? OR slug LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // 获取总数
    const countRows = await query(
      `SELECT COUNT(*) as total FROM tags ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    // 获取列表
    const rows = await query(
      `SELECT id, name, slug, color, description, articleCount, status, createdAt, updatedAt
       FROM tags
       ${whereClause}
       ORDER BY articleCount DESC, createdAt DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    );

    Response.paginated(res, rows, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Get tags error:', error);
    Response.error(res, 'Failed to get tags', 500);
  }
});

// 获取所有标签（下拉选择用）
router.get('/all', async (req, res) => {
  try {
    const data = await getOrSet(TAG_LIST_CACHE_KEY, async () => {
      return await query(
        `SELECT id, name, slug, color, articleCount
         FROM tags
         WHERE status = 'active'
         ORDER BY articleCount DESC, name ASC`
      );
    }, 3600);

    Response.success(res, data);
  } catch (error) {
    console.error('Get all tags error:', error);
    Response.error(res, 'Failed to get tags', 500);
  }
});

// 获取标签云（公开接口）
router.get('/cloud', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const data = await getOrSet(`${TAG_CLOUD_CACHE_KEY}:${limit}`, async () => {
      return await query(
        `SELECT id, name, slug, color, articleCount
         FROM tags
         WHERE status = 'active' AND articleCount > 0
         ORDER BY articleCount DESC
         LIMIT ?`,
        [limit]
      );
    }, 1800);

    Response.success(res, data);
  } catch (error) {
    console.error('Get tag cloud error:', error);
    Response.error(res, 'Failed to get tag cloud', 500);
  }
});

// 获取单个标签详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const rows = await query(
      'SELECT id, name, slug, color, description, articleCount, status, createdAt, updatedAt FROM tags WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return Response.error(res, 'Tag not found', 404);
    }

    Response.success(res, rows[0]);
  } catch (error) {
    console.error('Get tag error:', error);
    Response.error(res, 'Failed to get tag', 500);
  }
});

// 根据slug获取标签
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const rows = await query(
      'SELECT id, name, slug, color, description, articleCount, status, createdAt, updatedAt FROM tags WHERE slug = ?',
      [slug]
    );

    if (rows.length === 0) {
      return Response.error(res, 'Tag not found', 404);
    }

    Response.success(res, rows[0]);
  } catch (error) {
    console.error('Get tag by slug error:', error);
    Response.error(res, 'Failed to get tag', 500);
  }
});

// 创建标签（管理员）
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, color = '#3b82f6', description, status = 'active' } = req.body;

    if (!name || name.trim().length === 0) {
      return Response.error(res, 'Tag name is required', 400);
    }

    const slug = generateSlug(name);

    // 检查名称是否已存在
    const existingName = await query('SELECT * FROM tags WHERE name = ?', [name.trim()]);
    if (existingName.length > 0) {
      return Response.error(res, 'Tag name already exists', 409);
    }

    // 检查slug是否已存在
    const existingSlug = await query('SELECT * FROM tags WHERE slug = ?', [slug]);
    if (existingSlug.length > 0) {
      return Response.error(res, 'Tag slug already exists', 409);
    }

    const result = await query(
      'INSERT INTO tags (name, slug, color, description, status, articleCount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())',
      [name.trim(), slug, color, description || null, status]
    );

    // 清除缓存
    await del(TAG_LIST_CACHE_KEY);
    await del(TAG_CLOUD_CACHE_KEY);

    // 同步到字典表
    await syncTagToDict(name.trim(), slug);

    Response.success(res, { id: result.insertId }, 'Tag created successfully', 201);
  } catch (error) {
    console.error('Create tag error:', error);
    Response.error(res, 'Failed to create tag', 500);
  }
});

// 更新标签（管理员）
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, description, status } = req.body;

    // 检查标签是否存在
    const rows = await query('SELECT * FROM tags WHERE id = ?', [id]);
    if (rows.length === 0) {
      return Response.error(res, 'Tag not found', 404);
    }

    const oldTag = rows[0];
    let newSlug = oldTag.slug;

    // 如果修改了名称，检查是否重复
    if (name && name.trim() !== oldTag.name) {
      const existingName = await query('SELECT * FROM tags WHERE name = ? AND id != ?', [name.trim(), id]);
      if (existingName.length > 0) {
        return Response.error(res, 'Tag name already exists', 409);
      }
      newSlug = generateSlug(name);

      // 检查新slug是否重复
      const existingSlug = await query('SELECT * FROM tags WHERE slug = ? AND id != ?', [newSlug, id]);
      if (existingSlug.length > 0) {
        return Response.error(res, 'Tag slug already exists', 409);
      }
    }

    await query(
      'UPDATE tags SET name = ?, slug = ?, color = ?, description = ?, status = ?, updatedAt = NOW() WHERE id = ?',
      [
        name ? name.trim() : oldTag.name,
        newSlug,
        color || oldTag.color,
        description !== undefined ? description : oldTag.description,
        status || oldTag.status,
        id
      ]
    );

    // 清除缓存
    await del(TAG_LIST_CACHE_KEY);
    await del(TAG_CLOUD_CACHE_KEY);
    await del(`${TAG_CACHE_PREFIX}${id}`);
    await del(`${TAG_CACHE_PREFIX}slug:${oldTag.slug}`);

    // 同步更新字典表
    if (name && name.trim() !== oldTag.name) {
      await updateTagInDict(oldTag.name, name.trim(), newSlug);
    }

    Response.success(res, null, 'Tag updated successfully');
  } catch (error) {
    console.error('Update tag error:', error);
    Response.error(res, 'Failed to update tag', 500);
  }
});

// 删除标签（管理员）
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查标签是否存在
    const rows = await query('SELECT * FROM tags WHERE id = ?', [id]);
    if (rows.length === 0) {
      return Response.error(res, 'Tag not found', 404);
    }

    const tag = rows[0];

    // 删除文章标签关联
    await query('DELETE FROM article_tags WHERE tagId = ?', [id]);

    // 删除标签
    await query('DELETE FROM tags WHERE id = ?', [id]);

    // 清除缓存
    await del(TAG_LIST_CACHE_KEY);
    await del(TAG_CLOUD_CACHE_KEY);
    await del(`${TAG_CACHE_PREFIX}${id}`);
    await del(`${TAG_CACHE_PREFIX}slug:${tag.slug}`);

    // 从字典表中删除
    await removeTagFromDict(tag.name);

    Response.success(res, null, 'Tag deleted successfully');
  } catch (error) {
    console.error('Delete tag error:', error);
    Response.error(res, 'Failed to delete tag', 500);
  }
});

// ========== 标签与文章关联 ==========

// 获取标签下的文章列表
router.get('/:id/articles', async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 检查标签是否存在
    const tagRows = await query('SELECT * FROM tags WHERE id = ? AND status = ?', [id, 'active']);
    if (tagRows.length === 0) {
      return Response.error(res, 'Tag not found', 404);
    }

    // 获取总数
    const countRows = await query(
      `SELECT COUNT(*) as total FROM article_tags at
       JOIN articles a ON at.articleId = a.id
       WHERE at.tagId = ? AND a.status = 'published'`,
      [id]
    );
    const total = countRows[0].total;

    // 获取文章列表
    const rows = await query(
      `SELECT a.id, a.title, a.excerpt, a.coverImage, a.viewCount, a.createdAt,
              c.name as categoryName, c.slug as categorySlug,
              u.nickname as authorName
       FROM article_tags at
       JOIN articles a ON at.articleId = a.id
       LEFT JOIN categories c ON a.categoryId = c.id
       LEFT JOIN users u ON a.authorId = u.id
       WHERE at.tagId = ? AND a.status = 'published'
       ORDER BY a.createdAt DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      [id]
    );

    Response.paginated(res, rows, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Get tag articles error:', error);
    Response.error(res, 'Failed to get tag articles', 500);
  }
});

// ========== 字典同步辅助函数 ==========

// 同步标签到字典表
async function syncTagToDict(name, slug) {
  try {
    // 检查字典类型是否存在
    const typeExists = await query('SELECT * FROM sys_dict_type WHERE dictType = ?', ['article_tag']);
    if (typeExists.length === 0) {
      await query(
        'INSERT INTO sys_dict_type (dictName, dictType, status, remark) VALUES (?, ?, ?, ?)',
        ['文章标签', 'article_tag', '1', '博客文章标签管理']
      );
    }

    // 获取当前最大排序
    const maxSort = await query('SELECT MAX(dictSort) as maxSort FROM sys_dict_data WHERE dictType = ?', ['article_tag']);
    const sort = (maxSort[0].maxSort || 0) + 1;

    // 插入字典数据
    await query(
      'INSERT INTO sys_dict_data (dictType, dictLabel, dictValue, dictSort, isDefault, status, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['article_tag', name, slug, sort, '0', '1', '']
    );
  } catch (error) {
    console.error('Sync tag to dict error:', error);
  }
}

// 更新字典表中的标签
async function updateTagInDict(oldName, newName, newSlug) {
  try {
    await query(
      'UPDATE sys_dict_data SET dictLabel = ?, dictValue = ? WHERE dictType = ? AND dictLabel = ?',
      [newName, newSlug, 'article_tag', oldName]
    );
  } catch (error) {
    console.error('Update tag in dict error:', error);
  }
}

// 从字典表中删除标签
async function removeTagFromDict(name) {
  try {
    await query(
      'DELETE FROM sys_dict_data WHERE dictType = ? AND dictLabel = ?',
      ['article_tag', name]
    );
  } catch (error) {
    console.error('Remove tag from dict error:', error);
  }
}

module.exports = router;
