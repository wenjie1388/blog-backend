require('module-alias/register');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('@/config/database');
const { testRedis } = require('@/config/redis');

// 路由
const authRoutes = require('@/routes/auth/auth');
const userRoutes = require('@/routes/user/user');
const articleRoutes = require('@/routes/article/article');
const categoryRoutes = require('@/routes/article/category');
const menuRoutes = require('@/routes/system/menu');
const themeRoutes = require('@/routes/system/theme');
const pageRoutes = require('@/routes/system/page');
const uploadRoutes = require('@/routes/upload/upload');
const statsRoutes = require('@/routes/system/stats');
const dictRoutes = require('@/routes/system/dict');
const tagRoutes = require('@/routes/article/tag');
const aiRoutes = require('@/routes/system/ai');
const coverRoutes = require('@/routes/system/cover');

const app = express();

// 中间件
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(compression());
app.use(morgan('dev'));
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件
app.use('/uploads', express.static(path.join(__dirname, '@/uploads')));

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/themes', themeRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/dict', dictRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/covers', coverRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 3000;

// 启动服务器
async function startServer() {
  try {
    // 测试数据库连接
    await testConnection();
    console.log('✅ Database connected');
    
    // 测试Redis连接
    await testRedis();
    console.log('✅ Redis connected');
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
