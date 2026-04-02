const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'personal_blog'
};

async function fixCoversUrl() {
  let connection;
  
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    // 修复包含反引号的URL
    console.log('Fixing covers URL...');
    await connection.query(`
      UPDATE covers 
      SET url = REPLACE(REPLACE(url, '` + '`' + `', ''), '` + '`' + `', '')
      WHERE url LIKE '%` + '`' + `%'
    `);
    
    // 检查修复结果
    const [rows] = await connection.query('SELECT id, name, url FROM covers');
    console.log('Covers after fix:');
    rows.forEach(row => {
      console.log(`  ${row.id}: ${row.name} -> ${row.url}`);
    });
    
    console.log('✅ Covers URL fixed successfully');
  } catch (error) {
    console.error('❌ Fix covers URL failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixCoversUrl();
