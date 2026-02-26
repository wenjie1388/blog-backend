const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const Response = require('../utils/response');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 获取仪表盘统计数据（管理员）
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // 文章统计
    const [articleStats] = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived
      FROM articles
    `);
    
    // 总浏览量
    const [viewStats] = await query(`
      SELECT SUM(viewCount) as totalViews FROM articles
    `);
    
    // 分类统计
    const [categoryStats] = await query(`
      SELECT COUNT(*) as total FROM categories
    `);
    
    // 用户统计
    const [userStats] = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'disabled' THEN 1 ELSE 0 END) as disabled
      FROM users
    `);
    
    // 最近文章
    const recentArticles = await query(`
      SELECT a.id, a.title, a.status, a.viewCount, a.createdAt,
             c.name as categoryName
      FROM articles a
      LEFT JOIN categories c ON a.categoryId = c.id
      ORDER BY a.createdAt DESC
      LIMIT 5
    `);
    
    // 热门文章
    const popularArticles = await query(`
      SELECT a.id, a.title, a.viewCount, a.createdAt,
             c.name as categoryName
      FROM articles a
      LEFT JOIN categories c ON a.categoryId = c.id
      WHERE a.status = 'published'
      ORDER BY a.viewCount DESC
      LIMIT 5
    `);
    
    Response.success(res, {
      articles: {
        total: articleStats.total || 0,
        published: articleStats.published || 0,
        draft: articleStats.draft || 0,
        archived: articleStats.archived || 0
      },
      views: {
        total: viewStats.totalViews || 0
      },
      categories: {
        total: categoryStats.total || 0
      },
      users: {
        total: userStats.total || 0,
        active: userStats.active || 0,
        disabled: userStats.disabled || 0
      },
      recentArticles,
      popularArticles
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    Response.error(res, 'Failed to get dashboard stats', 500);
  }
});

// 获取文章趋势数据（管理员）
router.get('/article-trend', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    
    const trendData = await query(`
      SELECT 
        DATE(createdAt) as date,
        COUNT(*) as count
      FROM articles
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `, [days]);
    
    Response.success(res, trendData);
  } catch (error) {
    console.error('Get article trend error:', error);
    Response.error(res, 'Failed to get article trend', 500);
  }
});

// 获取分类文章分布（管理员）
router.get('/category-distribution', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const distribution = await query(`
      SELECT 
        c.name,
        COUNT(a.id) as count
      FROM categories c
      LEFT JOIN articles a ON c.id = a.categoryId AND a.status = 'published'
      GROUP BY c.id
      ORDER BY count DESC
    `);
    
    Response.success(res, distribution);
  } catch (error) {
    console.error('Get category distribution error:', error);
    Response.error(res, 'Failed to get category distribution', 500);
  }
});

// 获取公开统计信息
router.get('/public', async (req, res) => {
  try {
    // 文章总数
    const [articleCount] = await query(`
      SELECT COUNT(*) as count FROM articles WHERE status = 'published'
    `);
    
    // 分类总数
    const [categoryCount] = await query(`
      SELECT COUNT(*) as count FROM categories
    `);
    
    // 总浏览量
    const [viewCount] = await query(`
      SELECT SUM(viewCount) as count FROM articles WHERE status = 'published'
    `);
    
    // 运行天数（从第一篇文章创建时间算起）
    const [firstArticle] = await query(`
      SELECT MIN(createdAt) as firstDate FROM articles
    `);
    
    let runningDays = 0;
    if (firstArticle.firstDate) {
      const firstDate = new Date(firstArticle.firstDate);
      const now = new Date();
      runningDays = Math.floor((now - firstDate) / (1000 * 60 * 60 * 24));
    }
    
    Response.success(res, {
      articleCount: articleCount.count || 0,
      categoryCount: categoryCount.count || 0,
      viewCount: viewCount.count || 0,
      runningDays
    });
  } catch (error) {
    console.error('Get public stats error:', error);
    Response.error(res, 'Failed to get stats', 500);
  }
});

module.exports = router;
