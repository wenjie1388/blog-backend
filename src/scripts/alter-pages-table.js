const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'personal_blog'
};

async function alterTable() {
  let connection;
  
  try {
    console.log('🚀 Altering pages table...');
    
    connection = await mysql.createConnection(dbConfig);
    
    // 检查 componentPath 字段是否已存在
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'pages' AND COLUMN_NAME = 'componentPath'
    `);
    
    if (columns.length === 0) {
      // 添加 componentPath 字段
      await connection.execute(`
        ALTER TABLE pages 
        ADD COLUMN componentPath VARCHAR(255) NULL COMMENT '页面组件文件路径' AFTER slug,
        ADD INDEX idx_componentPath (componentPath)
      `);
      console.log('✅ Added componentPath column');
    } else {
      console.log('ℹ️ componentPath column already exists');
    }
    
    // 检查 excerpt 字段是否已存在
    const [excerptColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'pages' AND COLUMN_NAME = 'excerpt'
    `);
    
    if (excerptColumns.length === 0) {
      // 添加 excerpt 字段
      await connection.execute(`
        ALTER TABLE pages 
        ADD COLUMN excerpt TEXT NULL COMMENT '页面摘要' AFTER content
      `);
      console.log('✅ Added excerpt column');
    } else {
      console.log('ℹ️ excerpt column already exists');
    }
    
    console.log('');
    console.log('🎉 Table alteration completed!');
    
  } catch (error) {
    console.error('❌ Failed to alter table:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

alterTable();
