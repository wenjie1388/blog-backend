const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456'
};

const DB_NAME = process.env.DB_NAME || 'personal_blog';

async function initDatabase() {
  let connection;
  
  try {
    console.log('🚀 Initializing database...');
    
    // 第一步：创建数据库
    console.log('Connecting to MySQL...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL');
    
    console.log('Creating database...');
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Database '${DB_NAME}' created or exists`);
    
    await connection.end();
    
    // 第二步：连接指定数据库并创建表
    console.log('Connecting to database...');
    connection = await mysql.createConnection({ ...dbConfig, database: DB_NAME });
    
    // 创建用户表
    console.log('Creating users table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        nickname VARCHAR(50),
        avatar VARCHAR(255),
        bio TEXT,
        role ENUM('admin', 'user') DEFAULT 'user',
        status ENUM('active', 'disabled') DEFAULT 'active',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        lastLogin DATETIME,
        INDEX idx_username (username),
        INDEX idx_email (email),
        INDEX idx_role (role),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 创建分类表
    console.log('Creating categories table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) NOT NULL,
        slug VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        icon VARCHAR(100),
        sortOrder INT DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_slug (slug),
        INDEX idx_sortOrder (sortOrder)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 创建文章表
    console.log('Creating articles table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        content LONGTEXT NOT NULL,
        excerpt TEXT,
        coverImage VARCHAR(255),
        categoryId INT,
        authorId INT NOT NULL,
        tags VARCHAR(255),
        status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
        viewCount INT DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_status (status),
        INDEX idx_categoryId (categoryId),
        INDEX idx_authorId (authorId),
        INDEX idx_createdAt (createdAt),
        FULLTEXT INDEX idx_title_content (title, content)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 创建菜单表（暂时去掉自引用外键）
    console.log('Creating menus table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS menus (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) NOT NULL,
        path VARCHAR(200) NOT NULL,
        icon VARCHAR(100),
        target ENUM('_self', '_blank') DEFAULT '_self',
        parentId INT DEFAULT NULL,
        sortOrder INT DEFAULT 0,
        isVisible TINYINT(1) DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_parentId (parentId),
        INDEX idx_sortOrder (sortOrder),
        INDEX idx_isVisible (isVisible)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 添加外键约束
    console.log('Adding menus foreign key...');
    try {
      await connection.query(`
        ALTER TABLE menus ADD CONSTRAINT fk_menus_parent 
        FOREIGN KEY (parentId) REFERENCES menus(id) ON DELETE CASCADE
      `);
      console.log('✅ Foreign key added');
    } catch (e) {
      // 外键可能已存在
      console.log('Foreign key already exists');
    }
    
    // 创建主题表
    console.log('Creating themes table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS themes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) NOT NULL,
        \`key\` VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        config JSON,
        isDefault TINYINT(1) DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_key (\`key\`),
        INDEX idx_isDefault (isDefault)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 创建页面表
    console.log('Creating pages table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS pages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        content LONGTEXT NOT NULL,
        template VARCHAR(50) DEFAULT 'default',
        status ENUM('draft', 'published') DEFAULT 'draft',
        metaTitle VARCHAR(200),
        metaDescription TEXT,
        viewCount INT DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_slug (slug),
        INDEX idx_status (status),
        INDEX idx_template (template)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ All tables created');
    
    // 检查是否已有数据
    console.log('Checking existing data...');
    const [users] = await connection.query('SELECT COUNT(*) as count FROM users');
    
    if (users[0].count === 0) {
      // 插入默认管理员账号
      console.log('Inserting admin user...');
      await connection.query(
        `INSERT INTO users (username, email, password, nickname, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
        ['admin', 'admin@blog.com', bcrypt.hashSync('admin123', 10), '管理员', 'admin', 'active']
      );
      
      // 插入默认分类
      console.log('Inserting categories...');
      const categories = [
        ['设计', 'design', '设计相关的文章', 'Palette', 1],
        ['工程', 'engineering', '技术相关的文章', 'Code', 2],
        ['生活', 'life', '生活随笔', 'Coffee', 3],
        ['思考', 'thoughts', '深度思考', 'Brain', 4]
      ];
      for (const cat of categories) {
        await connection.query(
          `INSERT INTO categories (name, slug, description, icon, sortOrder) VALUES (?, ?, ?, ?, ?)`,
          cat
        );
      }
      
      // 插入主菜单
      console.log('Inserting menus...');
      await connection.query(
        `INSERT INTO menus (name, path, icon, target, parentId, sortOrder, isVisible) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['首页', '/', 'Home', '_self', null, 1, 1]
      );
      const [articlesMenu] = await connection.query(
        `INSERT INTO menus (name, path, icon, target, parentId, sortOrder, isVisible) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['文章', '/articles', 'FileText', '_self', null, 2, 1]
      );
      const articleMenuId = articlesMenu.insertId;
      await connection.query(
        `INSERT INTO menus (name, path, icon, target, parentId, sortOrder, isVisible) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['关于', '/about', 'User', '_self', null, 3, 1]
      );
      
      // 插入子菜单
      await connection.query(
        `INSERT INTO menus (name, path, icon, target, parentId, sortOrder, isVisible) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['设计', '/category/design', 'Palette', '_self', articleMenuId, 1, 1]
      );
      await connection.query(
        `INSERT INTO menus (name, path, icon, target, parentId, sortOrder, isVisible) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['工程', '/category/engineering', 'Code', '_self', articleMenuId, 2, 1]
      );
      await connection.query(
        `INSERT INTO menus (name, path, icon, target, parentId, sortOrder, isVisible) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['生活', '/category/life', 'Coffee', '_self', articleMenuId, 3, 1]
      );
      
      // 插入默认主题
      console.log('Inserting themes...');
      const themes = [
        ['默认主题', 'default', '简洁的默认主题', '{"primaryColor": "#000000", "backgroundColor": "#fffbef", "accentColor": "#ff0000"}', 1],
        ['深色主题', 'dark', '深色模式主题', '{"primaryColor": "#ffffff", "backgroundColor": "#1a1a1a", "accentColor": "#ff0000"}', 0],
        ['清新主题', 'fresh', '清新绿色主题', '{"primaryColor": "#2d5016", "backgroundColor": "#f0fdf4", "accentColor": "#22c55e"}', 0]
      ];
      for (const theme of themes) {
        await connection.query(
          `INSERT INTO themes (name, \`key\`, description, config, isDefault) VALUES (?, ?, ?, ?, ?)`,
          theme
        );
      }
      
      // 插入默认文章
      console.log('Inserting articles...');
      const articles = [
        ['欢迎来到个人博客', '<p>这是我的个人博客，在这里我会分享关于技术、设计和生活的思考。</p><p>希望我的文章能给你带来一些启发和帮助。</p>', '欢迎来到我的个人博客，这里将分享技术、设计和生活的思考。', 2, 1, '博客,开始', 'published', 0],
        ['如何构建现代化的Web应用', '<p>构建现代化的Web应用需要考虑很多因素...</p>', '探讨现代化Web应用的构建方法和最佳实践。', 2, 1, 'Web,开发,技术', 'published', 0],
        ['设计系统的艺术与实践', '<p>设计系统是现代UI设计的重要组成部分...</p>', '深入了解设计系统的构建和应用。', 1, 1, '设计,UI,系统', 'published', 0]
      ];
      for (const article of articles) {
        await connection.query(
          `INSERT INTO articles (title, content, excerpt, categoryId, authorId, tags, status, viewCount, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          article
        );
      }
      
      console.log('✅ Default data inserted');
      console.log('');
      console.log('🔑 Default admin credentials:');
      console.log('   Username: admin');
      console.log('   Password: admin123');
    } else {
      console.log('✅ Data already exists, skipping default data insertion');
    }
    
    console.log('');
    console.log('🎉 Database initialization completed!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDatabase();
