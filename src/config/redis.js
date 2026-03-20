const redis = require('redis');

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  },
  password: process.env.REDIS_PASSWORD || undefined
});

client.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

client.on('connect', () => {
  console.log('Redis Client Connected');
});

// 测试连接
async function testRedis() {
  try {
    if (!client.isOpen) {
      await client.connect();
    }
    await client.ping();
    return true;
  } catch (error) {
    throw new Error(`Redis connection failed: ${error.message}`);
  }
}

// 获取值
async function get(key) {
  if (!client.isOpen) await client.connect();
  return await client.get(key);
}

// 设置值
async function set(key, value, expireSeconds = null) {
  if (!client.isOpen) await client.connect();
  if (expireSeconds) {
    return await client.setEx(key, expireSeconds, JSON.stringify(value));
  }
  return await client.set(key, JSON.stringify(value));
}

// 删除值
async function del(key) {
  if (!client.isOpen) await client.connect();
  return await client.del(key);
}

// 获取或设置缓存
async function getOrSet(key, callback, expireSeconds = 3600) {
  const cached = await get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  
  const result = await callback();
  await set(key, result, expireSeconds);
  return result;
}

// 清空缓存
async function flush() {
  if (!client.isOpen) await client.connect();
  return await client.flushAll();
}

module.exports = {
  client,
  testRedis,
  get,
  set,
  del,
  getOrSet,
  flush
};
