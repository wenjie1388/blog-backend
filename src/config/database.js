const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'personal_blog',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// 测试连接
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

// 执行查询
async function query(sql, params) {
  // 确保 LIMIT/OFFSET 参数是整数（MySQL 严格要求）
  const processedParams = params ? params.map(p => {
    if (typeof p === 'number') return p;
    if (typeof p === 'string' && /^-?\d+$/.test(p)) return parseInt(p, 10);
    return p;
  }) : params;
  const [rows] = await pool.execute(sql, processedParams);
  return rows;
}

// 事务执行
async function transaction(callback) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  testConnection,
  query,
  transaction
};
