const express = require('express');
const router = express.Router();
const { query } = require('@/config/database');
const { getOrSet, del } = require('@/config/redis');
const Response = require('@/utils/response');
const { authenticateToken, requireAdmin, optionalAuth } = require('@/middleware/auth');
const { articleValidation, idParamValidation, paginationValidation } = require('@/middleware/validator');

// 生成文章摘要
function generateExcerpt(content, maxLength = 200) {
  // 移除HTML标签
  const plainText = content.replace(/<[^>]*>/g, '');
  if (plainText.length <= maxLength) return plainText;
  return plainText.substring(0, maxLength) + '...';
}

// 从文章内容中提取第一张图片
function extractFirstImage(content) {
  if (!content) return null;
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/i;
  const match = content.match(imgRegex);
  return match ? match[1] : null;
}

// 默认封面图库
const DEFAULT_COVERS = [
  'https://picsum.photos/seed/blog1/800/400',
  'https://picsum.photos/seed/blog2/800/400',
  'https://picsum.photos/seed/blog3/800/400',
  'https://picsum.photos/seed/blog4/800/400',
  'https://picsum.photos/seed/blog5/800/400',
  'https://picsum.photos/seed/blog6/800/400',
];

// 获取随机默认封面
function getRandomDefaultCover() {
  return DEFAULT_COVERS[Math.floor(Math.random() * DEFAULT_COVERS.length)];
}

// 自动处理封面：优先用已上传的，其次提取首图，最后用默认封面
function resolveCoverImage(coverImage, content) {
  if (coverImage) return coverImage;
  const firstImage = extractFirstImage(content);
  if (firstImage) return firstImage;
  return getRandomDefaultCover();
}

// 获取文章列表
router.get('/', paginationValidation, async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const offset = (page - 1) * limit;
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const status = req.query.status || 'all';
    const search = req.query.search || '';
    const tag = req.query.tag || '';
    
    // 构建查询条件
    let whereConditions = [];
    let params = [];
    
    if (status !== 'all') {
      whereConditions.push('a.status = ?');
      params.push(status);
    }
    
    if (categoryId) {
      whereConditions.push('a.categoryId = ?');
      params.push(categoryId);
    }
    
    if (search) {
      whereConditions.push('(a.title LIKE ? OR a.content LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (tag) {
      whereConditions.push('a.tags LIKE ?');
      params.push(`%${tag}%`);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // 获取总数
    const countRows = await query(
      `SELECT COUNT(*) as total FROM articles a ${whereClause}`,
      params
    );
    const total = countRows[0].total;
    
    // 获取文章列表
    const articles = await query(
      `SELECT a.id, a.title, a.excerpt, a.coverImage, a.status, a.viewCount, 
              a.createdAt, a.updatedAt, a.tags,
              c.id as categoryId, c.name as categoryName, c.slug as categorySlug,
              u.id as authorId, u.username as authorName, u.avatar as authorAvatar
       FROM articles a
       LEFT JOIN categories c ON a.categoryId = c.id
       LEFT JOIN users u ON a.authorId = u.id
       ${whereClause}
       ORDER BY a.createdAt DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    );
    
    Response.paginated(res, articles, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get articles error:', error);
    Response.error(res, 'Failed to get articles', 500);
  }
});

// 获取文章详情
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // 尝试从缓存获取
    const cacheKey = `article:${id}`;
    let article = await getOrSet(cacheKey, async () => {
      const articles = await query(
        `SELECT a.*,
                c.id as categoryId, c.name as categoryName, c.slug as categorySlug,
                u.id as authorId, u.username as authorName, u.avatar as authorAvatar, u.nickname as authorNickname
         FROM articles a
         LEFT JOIN categories c ON a.categoryId = c.id
         LEFT JOIN users u ON a.authorId = u.id
         WHERE a.id = ?`,
        [id]
      );

      if (articles.length === 0) {
        return null;
      }

      return articles[0];
    }, 3600);

    if (!article) {
      return Response.error(res, 'Article not found', 404);
    }

    // 检查文章状态
    if (article.status !== 'published') {
      // 只有管理员或作者可以查看未发布文章
      if (!req.user || (req.user.role !== 'admin' && req.user.id !== article.authorId)) {
        return Response.error(res, 'Article not found', 404);
      }
    }

    // 获取文章标签
    const tags = await query(
      `SELECT t.id, t.name, t.slug, t.color
       FROM article_tags at
       JOIN tags t ON at.tagId = t.id
       WHERE at.articleId = ? AND t.status = 'active'
       ORDER BY t.articleCount DESC`,
      [id]
    );
    article.tagsList = tags;

    // 增加浏览量
    await query('UPDATE articles SET viewCount = viewCount + 1 WHERE id = ?', [id]);

    Response.success(res, article);
  } catch (error) {
    console.error('Get article error:', error);
    Response.error(res, 'Failed to get article', 500);
  }
});

// 创建文章（管理员）
router.post('/', authenticateToken, requireAdmin, articleValidation, async (req, res) => {
  try {
    const { title, content, categoryId, coverImage, tags, tagIds, status = 'draft' } = req.body;
    const authorId = req.user.id;

    const excerpt = generateExcerpt(content);
    const resolvedCover = resolveCoverImage(coverImage, content);

    const result = await query(
      `INSERT INTO articles (title, content, excerpt, categoryId, authorId, coverImage, tags, status, viewCount, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [title, content, excerpt, categoryId || null, authorId, resolvedCover, tags || null, status]
    );

    const articleId = result.insertId;

    // 处理标签关联
    if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
      await syncArticleTags(articleId, tagIds);
    }

    Response.success(res, { id: articleId }, 'Article created successfully', 201);
  } catch (error) {
    console.error('Create article error:', error);
    Response.error(res, 'Failed to create article', 500);
  }
});

// 更新文章（管理员）
router.put('/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, categoryId, coverImage, tags, tagIds, status } = req.body;

    // 检查文章是否存在
    const articles = await query('SELECT * FROM articles WHERE id = ?', [id]);
    if (articles.length === 0) {
      return Response.error(res, 'Article not found', 404);
    }

    const excerpt = content ? generateExcerpt(content) : articles[0].excerpt;
    const resolvedCover = resolveCoverImage(
      coverImage !== undefined ? coverImage : articles[0].coverImage,
      content || articles[0].content
    );

    await query(
      `UPDATE articles
       SET title = ?, content = ?, excerpt = ?, categoryId = ?, coverImage = ?, tags = ?, status = ?, updatedAt = NOW()
       WHERE id = ?`,
      [
        title || articles[0].title,
        content || articles[0].content,
        excerpt,
        categoryId !== undefined ? categoryId : articles[0].categoryId,
        resolvedCover,
        tags !== undefined ? tags : articles[0].tags,
        status || articles[0].status,
        id
      ]
    );

    // 处理标签关联
    if (tagIds !== undefined) {
      if (Array.isArray(tagIds) && tagIds.length > 0) {
        await syncArticleTags(id, tagIds);
      } else {
        // 清空标签关联
        await query('DELETE FROM article_tags WHERE articleId = ?', [id]);
        // 更新标签文章计数
        await updateTagArticleCount();
      }
    }

    // 清除缓存
    await del(`article:${id}`);

    Response.success(res, null, 'Article updated successfully');
  } catch (error) {
    console.error('Update article error:', error);
    Response.error(res, 'Failed to update article', 500);
  }
});

// 删除文章（管理员）
router.delete('/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    
    await query('DELETE FROM articles WHERE id = ?', [id]);
    
    // 清除缓存
    await del(`article:${id}`);
    
    Response.success(res, null, 'Article deleted successfully');
  } catch (error) {
    console.error('Delete article error:', error);
    Response.error(res, 'Failed to delete article', 500);
  }
});

// 获取相关文章
router.get('/:id/related', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = req.query.limit || 4;
    
    // 获取当前文章的分类和标签
    const articles = await query(
      'SELECT categoryId, tags FROM articles WHERE id = ?',
      [id]
    );
    
    if (articles.length === 0) {
      return Response.error(res, 'Article not found', 404);
    }
    
    const { categoryId, tags } = articles[0];
    
    // 查找相关文章
    let relatedArticles = [];
    
    if (categoryId) {
      relatedArticles = await query(
        `SELECT a.id, a.title, a.coverImage, a.createdAt,
                c.name as categoryName
         FROM articles a
         LEFT JOIN categories c ON a.categoryId = c.id
         WHERE a.id != ? AND a.categoryId = ? AND a.status = 'published'
         ORDER BY a.createdAt DESC
         LIMIT ${parseInt(limit)}`,
        [id, categoryId]
      );
    }
    
    // 如果分类相关文章不足，补充最新文章
    if (relatedArticles.length < limit) {
      const additionalLimit = limit - relatedArticles.length;
      const existingIds = relatedArticles.map(a => a.id).concat([parseInt(id)]);
      
      // Build placeholders for IN clause
      const placeholders = existingIds.map(() => '?').join(',');
      const additionalArticles = await query(
        `SELECT a.id, a.title, a.coverImage, a.createdAt,
                c.name as categoryName
         FROM articles a
         LEFT JOIN categories c ON a.categoryId = c.id
         WHERE a.id NOT IN (${placeholders}) AND a.status = 'published'
         ORDER BY a.createdAt DESC
         LIMIT ${parseInt(additionalLimit)}`,
        [...existingIds]
      );
      
      relatedArticles = relatedArticles.concat(additionalArticles);
    }
    
    Response.success(res, relatedArticles);
  } catch (error) {
    console.error('Get related articles error:', error);
    Response.error(res, 'Failed to get related articles', 500);
  }
});

// ========== 标签关联辅助函数 ==========

// 同步文章标签关联
async function syncArticleTags(articleId, tagIds) {
  try {
    // 删除旧的关联
    await query('DELETE FROM article_tags WHERE articleId = ?', [articleId]);

    // 插入新的关联
    const validTagIds = [];
    for (const tagId of tagIds) {
      // 验证标签是否存在且有效
      const tagExists = await query('SELECT id FROM tags WHERE id = ? AND status = ?', [tagId, 'active']);
      if (tagExists.length > 0) {
        validTagIds.push(tagId);
        await query(
          'INSERT INTO article_tags (articleId, tagId, createdAt) VALUES (?, ?, NOW())',
          [articleId, tagId]
        );
      }
    }

    // 更新标签文章计数
    await updateTagArticleCount(validTagIds);
  } catch (error) {
    console.error('Sync article tags error:', error);
    throw error;
  }
}

// 更新标签文章计数
async function updateTagArticleCount(tagIds = null) {
  try {
    if (tagIds && tagIds.length > 0) {
      // 更新指定标签的计数
      for (const tagId of tagIds) {
        await query(
          `UPDATE tags SET articleCount = (
            SELECT COUNT(*) FROM article_tags WHERE tagId = ?
          ) WHERE id = ?`,
          [tagId, tagId]
        );
      }
    } else {
      // 更新所有标签的计数
      await query(
        `UPDATE tags t SET t.articleCount = (
          SELECT COUNT(*) FROM article_tags at WHERE at.tagId = t.id
        )`
      );
    }
  } catch (error) {
    console.error('Update tag article count error:', error);
  }
}

module.exports = router;
