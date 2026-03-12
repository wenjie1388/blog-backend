const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { query } = require('../config/database');
const { del } = require('../config/redis');
const Response = require('../utils/response');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const { pageValidation, idParamValidation, paginationValidation } = require('../middleware/validator');

// 页面文件存储目录
const PAGES_DIR = path.join(__dirname, '../../src/views/static');

// 确保目录存在
async function ensureDir(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// 生成页面组件模板
function generatePageComponent(pageData) {
  const { title, content, metaTitle, metaDescription } = pageData;
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${metaTitle || title}</title>
  <meta name="description" content="${metaDescription || ''}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    .page-header {
      border-bottom: 2px solid #eee;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .page-title {
      font-size: 2.5rem;
      font-weight: 700;
      color: #1a1a1a;
    }
    .page-content {
      font-size: 1.1rem;
      line-height: 1.8;
    }
    .page-content p {
      margin-bottom: 1.2em;
    }
    .page-content h2 {
      font-size: 1.8rem;
      margin: 1.5em 0 0.8em;
      color: #2a2a2a;
    }
    .page-content h3 {
      font-size: 1.4rem;
      margin: 1.2em 0 0.6em;
    }
    .page-content img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
    }
    .page-content a {
      color: #0066cc;
      text-decoration: none;
    }
    .page-content a:hover {
      text-decoration: underline;
    }
    .page-content blockquote {
      border-left: 4px solid #ddd;
      padding-left: 20px;
      margin: 1.5em 0;
      color: #666;
    }
    .page-content ul, .page-content ol {
      margin: 1em 0;
      padding-left: 2em;
    }
  </style>
</head>
<body>
  <article class="page-container">
    <header class="page-header">
      <h1 class="page-title">${title}</h1>
    </header>
    <div class="page-content">
      ${content}
    </div>
  </article>
</body>
</html>`;
}

// 保存页面文件
async function savePageFile(componentPath, content) {
  const fullPath = path.join(PAGES_DIR, componentPath);
  const dir = path.dirname(fullPath);
  await ensureDir(dir);
  await fs.writeFile(fullPath, content, 'utf8');
  return fullPath;
}

// 删除页面文件
async function deletePageFile(componentPath) {
  try {
    const fullPath = path.join(PAGES_DIR, componentPath);
    await fs.unlink(fullPath);
  } catch (error) {
    console.error('Delete file error:', error.message);
  }
}

// 读取页面文件
async function readPageFile(componentPath) {
  const fullPath = path.join(PAGES_DIR, componentPath);
  return await fs.readFile(fullPath, 'utf8');
}

// 验证路径安全性
function isValidPath(filePath) {
  // 防止目录遍历攻击
  const normalizedPath = path.normalize(filePath);
  return !normalizedPath.startsWith('..') && !normalizedPath.startsWith('/');
}

// 生成摘要
function generateExcerpt(content, maxLength = 200) {
  const plainText = content.replace(/<[^>]*>/g, '');
  if (plainText.length <= maxLength) return plainText;
  return plainText.substring(0, maxLength) + '...';
}

// ========== API 路由 ==========

// 获取页面列表
router.get('/', paginationValidation, async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status || 'published';
    const search = req.query.search || '';
    
    let whereConditions = [];
    let params = [];
    
    if (status !== 'all') {
      whereConditions.push('status = ?');
      params.push(status);
    }
    
    if (search) {
      whereConditions.push('(title LIKE ? OR content LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // 获取总数
    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM pages ${whereClause}`,
      params
    );
    const total = countResult.total;
    
    // 获取页面列表
    const pages = await query(
      `SELECT id, title, slug, componentPath, template, status, viewCount, 
              metaTitle, metaDescription, createdAt, updatedAt
       FROM pages
       ${whereClause}
       ORDER BY createdAt DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    );
    
    Response.paginated(res, pages, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get pages error:', error.message);
    Response.error(res, 'Failed to get pages', 500);
  }
});

// 获取单个页面（通过ID）
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const pages = await query(
      `SELECT id, title, slug, componentPath, template, status, viewCount, 
              metaTitle, metaDescription, excerpt, createdAt, updatedAt
       FROM pages WHERE id = ?`,
      [id]
    );
    
    if (pages.length === 0) {
      return Response.error(res, 'Page not found', 404);
    }
    
    const page = pages[0];
    
    // 检查页面状态
    if (page.status !== 'published') {
      if (!req.user || req.user.role !== 'admin') {
        return Response.error(res, 'Page not found', 404);
      }
    }
    
    // 增加浏览量
    await query('UPDATE pages SET viewCount = viewCount + 1 WHERE id = ?', [id]);
    
    // 读取文件内容
    try {
      if (page.componentPath) {
        page.fileContent = await readPageFile(page.componentPath);
      }
    } catch (err) {
      console.error('Read file error:', err.message);
      page.fileContent = null;
    }
    
    Response.success(res, page);
  } catch (error) {
    console.error('Get page error:', error);
    Response.error(res, 'Failed to get page', 500);
  }
});

// 根据 slug 获取页面（前台使用）
router.get('/slug/:slug', optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    
    const pages = await query(
      `SELECT * FROM pages WHERE slug = ?`,
      [slug]
    );
    
    if (pages.length === 0) {
      return Response.error(res, 'Page not found', 404);
    }
    
    const page = pages[0];
    
    // 检查页面状态
    if (page.status !== 'published') {
      if (!req.user || req.user.role !== 'admin') {
        return Response.error(res, 'Page not found', 404);
      }
    }
    
    // 增加浏览量
    await query('UPDATE pages SET viewCount = viewCount + 1 WHERE id = ?', [page.id]);
    
    // 读取文件内容
    try {
      if (page.componentPath) {
        page.fileContent = await readPageFile(page.componentPath);
      }
    } catch (err) {
      console.error('Read file error:', err.message);
      page.fileContent = null;
    }
    
    Response.success(res, page);
  } catch (error) {
    console.error('Get page by slug error:', error);
    Response.error(res, 'Failed to get page', 500);
  }
});

// 根据组件路径获取页面内容（前台直接渲染）
router.get('/view/*', async (req, res) => {
  try {
    const componentPath = req.params[0];
    
    if (!isValidPath(componentPath)) {
      return res.status(400).send('Invalid path');
    }
    
    // 查询页面信息
    const pages = await query(
      `SELECT * FROM pages WHERE componentPath = ? AND status = 'published'`,
      [componentPath]
    );
    
    if (pages.length === 0) {
      return res.status(404).send('Page not found');
    }
    
    // 增加浏览量
    await query('UPDATE pages SET viewCount = viewCount + 1 WHERE id = ?', [pages[0].id]);
    
    // 读取并返回HTML文件
    try {
      const content = await readPageFile(componentPath);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(content);
    } catch (err) {
      console.error('Read file error:', err.message);
      res.status(404).send('File not found');
    }
  } catch (error) {
    console.error('View page error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 检查 slug 是否可用
router.get('/check-slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const excludeId = req.query.excludeId;
    
    let sql = 'SELECT id FROM pages WHERE slug = ?';
    let params = [slug];
    
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }
    
    const pages = await query(sql, params);
    
    Response.success(res, {
      available: pages.length === 0,
      slug
    });
  } catch (error) {
    console.error('Check slug error:', error);
    Response.error(res, 'Failed to check slug', 500);
  }
});

// 创建页面（管理员）
router.post('/', authenticateToken, requireAdmin, pageValidation, async (req, res) => {
  try {
    const { 
      title, 
      content, 
      slug, 
      componentPath,
      template = 'default', 
      status = 'draft',
      metaTitle,
      metaDescription 
    } = req.body;
    
    // 验证路径安全性
    if (!componentPath || !isValidPath(componentPath)) {
      return Response.error(res, 'Invalid component path', 400);
    }
    
    // 检查 slug 是否已存在
    const existing = await query('SELECT * FROM pages WHERE slug = ?', [slug]);
    if (existing.length > 0) {
      return Response.error(res, 'Page slug already exists', 409);
    }
    
    // 检查路径是否已存在
    const existingPath = await query('SELECT * FROM pages WHERE componentPath = ?', [componentPath]);
    if (existingPath.length > 0) {
      return Response.error(res, 'Component path already exists', 409);
    }
    
    // 生成摘要
    const excerpt = generateExcerpt(content);
    
    // 生成HTML文件内容
    const htmlContent = generatePageComponent({
      title,
      content,
      metaTitle: metaTitle || title,
      metaDescription: metaDescription || excerpt
    });
    
    // 保存HTML文件
    await savePageFile(componentPath, htmlContent);
    
    // 保存到数据库
    const result = await query(
      `INSERT INTO pages (title, content, excerpt, slug, componentPath, template, status, metaTitle, metaDescription, viewCount, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [
        title, 
        content, 
        excerpt, 
        slug, 
        componentPath,
        template, 
        status,
        metaTitle || title,
        metaDescription || excerpt
      ]
    );
    
    Response.success(res, { 
      id: result.insertId,
      componentPath,
      viewUrl: `/api/pages/view/${componentPath}`
    }, 'Page created successfully', 201);
  } catch (error) {
    console.error('Create page error:', error);
    Response.error(res, 'Failed to create page: ' + error.message, 500);
  }
});

// 更新页面（管理员）
router.put('/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      content, 
      slug, 
      componentPath,
      template, 
      status,
      metaTitle,
      metaDescription 
    } = req.body;
    
    // 检查页面是否存在
    const pages = await query('SELECT * FROM pages WHERE id = ?', [id]);
    if (pages.length === 0) {
      return Response.error(res, 'Page not found', 404);
    }
    
    const page = pages[0];
    const newSlug = slug || page.slug;
    const newComponentPath = componentPath || page.componentPath;
    
    // 验证路径安全性
    if (componentPath && !isValidPath(componentPath)) {
      return Response.error(res, 'Invalid component path', 400);
    }
    
    // 如果修改了slug，检查是否已存在
    if (slug && slug !== page.slug) {
      const existing = await query('SELECT * FROM pages WHERE slug = ? AND id != ?', [slug, id]);
      if (existing.length > 0) {
        return Response.error(res, 'Page slug already exists', 409);
      }
    }
    
    // 如果修改了路径，检查是否已存在
    if (componentPath && componentPath !== page.componentPath) {
      const existing = await query('SELECT * FROM pages WHERE componentPath = ? AND id != ?', [componentPath, id]);
      if (existing.length > 0) {
        return Response.error(res, 'Component path already exists', 409);
      }
    }
    
    // 生成新的摘要
    const excerpt = content !== undefined 
      ? generateExcerpt(content)
      : page.excerpt;
    
    // 如果内容或标题有变化，更新HTML文件
    if (content !== undefined || title !== undefined) {
      const htmlContent = generatePageComponent({
        title: title || page.title,
        content: content !== undefined ? content : page.content,
        metaTitle: metaTitle !== undefined ? metaTitle : (page.metaTitle || title || page.title),
        metaDescription: metaDescription !== undefined ? metaDescription : (page.metaDescription || excerpt)
      });
      
      // 如果路径改变了，删除旧文件
      if (componentPath && componentPath !== page.componentPath) {
        await deletePageFile(page.componentPath);
      }
      
      // 保存新的HTML文件
      await savePageFile(newComponentPath, htmlContent);
    }
    
    // 更新数据库
    await query(
      `UPDATE pages 
       SET title = ?, content = ?, excerpt = ?, slug = ?, componentPath = ?, 
           template = ?, status = ?, metaTitle = ?, metaDescription = ?, updatedAt = NOW() 
       WHERE id = ?`,
      [
        title || page.title,
        content !== undefined ? content : page.content,
        excerpt,
        newSlug,
        newComponentPath,
        template || page.template,
        status || page.status,
        metaTitle !== undefined ? metaTitle : (page.metaTitle || title || page.title),
        metaDescription !== undefined ? metaDescription : (page.metaDescription || excerpt),
        id
      ]
    );
    
    // 清除缓存
    await del(`page:id:${id}`);
    await del(`page:slug:${page.slug}`);
    
    Response.success(res, {
      componentPath: newComponentPath,
      viewUrl: `/api/pages/view/${newComponentPath}`
    }, 'Page updated successfully');
  } catch (error) {
    console.error('Update page error:', error);
    Response.error(res, 'Failed to update page', 500);
  }
});

// 删除页面（管理员）
router.delete('/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取页面信息
    const pages = await query('SELECT slug, componentPath FROM pages WHERE id = ?', [id]);
    if (pages.length === 0) {
      return Response.error(res, 'Page not found', 404);
    }
    
    const { slug, componentPath } = pages[0];
    
    // 删除HTML文件
    if (componentPath) {
      await deletePageFile(componentPath);
    }
    
    // 删除数据库记录
    await query('DELETE FROM pages WHERE id = ?', [id]);
    
    // 清除缓存
    await del(`page:id:${id}`);
    await del(`page:slug:${slug}`);
    
    Response.success(res, null, 'Page deleted successfully');
  } catch (error) {
    console.error('Delete page error:', error);
    Response.error(res, 'Failed to delete page', 500);
  }
});

// 更新页面状态（管理员）
router.patch('/:id/status', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['draft', 'published'].includes(status)) {
      return Response.error(res, 'Status must be draft or published', 400);
    }
    
    // 检查页面是否存在
    const pages = await query('SELECT slug, componentPath FROM pages WHERE id = ?', [id]);
    if (pages.length === 0) {
      return Response.error(res, 'Page not found', 404);
    }
    
    const { slug, componentPath } = pages[0];
    
    await query('UPDATE pages SET status = ?, updatedAt = NOW() WHERE id = ?', [status, id]);
    
    // 清除缓存
    await del(`page:id:${id}`);
    await del(`page:slug:${slug}`);
    
    Response.success(res, {
      componentPath,
      viewUrl: status === 'published' ? `/api/pages/view/${componentPath}` : null
    }, 'Page status updated successfully');
  } catch (error) {
    console.error('Update page status error:', error);
    Response.error(res, 'Failed to update page status', 500);
  }
});

module.exports = router;
