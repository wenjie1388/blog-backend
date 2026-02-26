const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { del } = require('../config/redis');
const Response = require('../utils/response');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { categoryValidation, idParamValidation } = require('../middleware/validator');

// 获取所有分类
router.get('/', async (req, res) => {
  try {
    const categories = await query(
      `SELECT c.*, COUNT(a.id) as articleCount 
       FROM categories c
       LEFT JOIN articles a ON c.id = a.categoryId AND a.status = 'published'
       GROUP BY c.id
       ORDER BY c.sortOrder ASC, c.createdAt DESC`
    );
    
    Response.success(res, categories);
  } catch (error) {
    console.error('Get categories error:', error);
    Response.error(res, 'Failed to get categories', 500);
  }
});

// 获取单个分类
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const categories = await query(
      `SELECT c.*, COUNT(a.id) as articleCount 
       FROM categories c
       LEFT JOIN articles a ON c.id = a.categoryId AND a.status = 'published'
       WHERE c.id = ?
       GROUP BY c.id`,
      [id]
    );
    
    if (categories.length === 0) {
      return Response.error(res, 'Category not found', 404);
    }
    
    Response.success(res, categories[0]);
  } catch (error) {
    console.error('Get category error:', error);
    Response.error(res, 'Failed to get category', 500);
  }
});

// 根据slug获取分类
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const categories = await query(
      `SELECT c.*, COUNT(a.id) as articleCount 
       FROM categories c
       LEFT JOIN articles a ON c.id = a.categoryId AND a.status = 'published'
       WHERE c.slug = ?
       GROUP BY c.id`,
      [slug]
    );
    
    if (categories.length === 0) {
      return Response.error(res, 'Category not found', 404);
    }
    
    Response.success(res, categories[0]);
  } catch (error) {
    console.error('Get category by slug error:', error);
    Response.error(res, 'Failed to get category', 500);
  }
});

// 创建分类（管理员）
router.post('/', authenticateToken, requireAdmin, categoryValidation, async (req, res) => {
  try {
    const { name, slug, description, icon, sortOrder = 0 } = req.body;
    
    // 生成slug
    const finalSlug = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // 检查slug是否已存在
    const existing = await query('SELECT * FROM categories WHERE slug = ?', [finalSlug]);
    if (existing.length > 0) {
      return Response.error(res, 'Category slug already exists', 409);
    }
    
    const result = await query(
      'INSERT INTO categories (name, slug, description, icon, sortOrder, createdAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [name, finalSlug, description || null, icon || null, sortOrder]
    );
    
    Response.success(res, { id: result.insertId }, 'Category created successfully', 201);
  } catch (error) {
    console.error('Create category error:', error);
    Response.error(res, 'Failed to create category', 500);
  }
});

// 更新分类（管理员）
router.put('/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, icon, sortOrder } = req.body;
    
    // 检查分类是否存在
    const categories = await query('SELECT * FROM categories WHERE id = ?', [id]);
    if (categories.length === 0) {
      return Response.error(res, 'Category not found', 404);
    }
    
    // 如果修改了slug，检查是否已存在
    if (slug && slug !== categories[0].slug) {
      const existing = await query('SELECT * FROM categories WHERE slug = ? AND id != ?', [slug, id]);
      if (existing.length > 0) {
        return Response.error(res, 'Category slug already exists', 409);
      }
    }
    
    await query(
      'UPDATE categories SET name = ?, slug = ?, description = ?, icon = ?, sortOrder = ? WHERE id = ?',
      [
        name || categories[0].name,
        slug || categories[0].slug,
        description !== undefined ? description : categories[0].description,
        icon !== undefined ? icon : categories[0].icon,
        sortOrder !== undefined ? sortOrder : categories[0].sortOrder,
        id
      ]
    );
    
    // 清除相关缓存
    await del(`article:*`);
    
    Response.success(res, null, 'Category updated successfully');
  } catch (error) {
    console.error('Update category error:', error);
    Response.error(res, 'Failed to update category', 500);
  }
});

// 删除分类（管理员）
router.delete('/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查该分类下是否有文章
    const articles = await query('SELECT COUNT(*) as count FROM articles WHERE categoryId = ?', [id]);
    if (articles[0].count > 0) {
      return Response.error(res, 'Cannot delete category with articles', 400);
    }
    
    await query('DELETE FROM categories WHERE id = ?', [id]);
    
    Response.success(res, null, 'Category deleted successfully');
  } catch (error) {
    console.error('Delete category error:', error);
    Response.error(res, 'Failed to delete category', 500);
  }
});

module.exports = router;
