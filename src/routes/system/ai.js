const express = require('express');
const router = express.Router();
const { query, transaction } = require('@/config/database');
const { getOrSet, del } = require('@/config/redis');
const Response = require('@/utils/response');
const { authenticateToken, requireAdmin } = require('@/middleware/auth');
const { aiConfigValidation, idParamValidation, paginationValidation } = require('@/middleware/validator');
const OpenAI = require("openai");

const AI_CONFIG_CACHE_PREFIX = 'ai:config:';
const AI_CONFIG_DEFAULT_CACHE_KEY = 'ai:config:default';

// AI提供商列表
const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI', defaultUrl: 'https://api.openai.com/v1' },
  { value: 'bailian', label: '阿里云百炼', defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { value: 'deepseek', label: 'DeepSeek', defaultUrl: 'https://api.deepseek.com/v1' },
  { value: 'anthropic', label: 'Anthropic (Claude)', defaultUrl: 'https://api.anthropic.com/v1' },
  { value: 'custom', label: '自定义', defaultUrl: '' }
];

// ========== AI配置管理 ==========

// 获取AI提供商列表
router.get('/providers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    Response.success(res, AI_PROVIDERS);
  } catch (error) {
    console.error('Get AI providers error:', error);
    Response.error(res, 'Failed to get AI providers', 500);
  }
});

// 获取AI配置列表（分页）
router.get('/configs', authenticateToken, requireAdmin, paginationValidation, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const keyword = req.query.keyword?.trim();
    const provider = req.query.provider?.trim();

    let whereClause = '';
    let params = [];
    const conditions = [];

    if (keyword) {
      conditions.push('(name LIKE ? OR remark LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (provider) {
      conditions.push('provider = ?');
      params.push(provider);
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    // 获取总数
    const countRows = await query(
      `SELECT COUNT(*) as total FROM sys_ai_config ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    // 获取列表（隐藏API密钥）
    const rows = await query(
      `SELECT id, provider, name, apiUrl, model, temperature, maxTokens, timeout, 
              isDefault, status, remark, createdAt, updatedAt,
              CASE WHEN apiKey IS NOT NULL AND apiKey != '' THEN '********' ELSE '' END as apiKeyMasked
       FROM sys_ai_config
       ${whereClause}
       ORDER BY isDefault DESC, createdAt DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    );

    // 将 temperature 转换为数字
    const formattedRows = rows.map(row => {
      const temp = row.temperature !== null && row.temperature !== undefined
        ? Number(row.temperature)
        : 0.7;
      return {
        ...row,
        temperature: isNaN(temp) ? 0.7 : temp
      };
    });

    Response.paginated(res, formattedRows, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Get AI configs error:', error);
    Response.error(res, 'Failed to get AI configs', 500);
  }
});

// 获取单个AI配置
router.get('/configs/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query(
      `SELECT id, provider, name, apiUrl, model, temperature, maxTokens, timeout,
              isDefault, status, remark, createdAt, updatedAt,
              CASE WHEN apiKey IS NOT NULL AND apiKey != '' THEN '********' ELSE '' END as apiKeyMasked
       FROM sys_ai_config WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return Response.error(res, 'AI config not found', 404);
    }

    // 将 temperature 转换为数字
    const temp = rows[0].temperature !== null && rows[0].temperature !== undefined
      ? Number(rows[0].temperature)
      : 0.7;
    const config = {
      ...rows[0],
      temperature: isNaN(temp) ? 0.7 : temp
    };

    Response.success(res, config);
  } catch (error) {
    console.error('Get AI config error:', error);
    Response.error(res, 'Failed to get AI config', 500);
  }
});

// 创建AI配置
router.post('/configs', authenticateToken, requireAdmin, aiConfigValidation, async (req, res) => {
  try {
    const { provider, name, apiKey, apiUrl, model, temperature, maxTokens, timeout, isDefault, status, remark } = req.body;

    await transaction(async (connection) => {
      // 如果设置为默认，先将其他配置设为非默认
      if (isDefault === '1') {
        await connection.execute(
          'UPDATE sys_ai_config SET isDefault = "0" WHERE isDefault = "1"'
        );
      }

      // 插入新配置
      const [result] = await connection.execute(
        `INSERT INTO sys_ai_config 
         (provider, name, apiKey, apiUrl, model, temperature, maxTokens, timeout, isDefault, status, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [provider, name, apiKey, apiUrl || null, model || null, temperature || 0.7, maxTokens || 2048, timeout || 30, isDefault || '0', status || '1', remark || null]
      );

      // 清除缓存
      await del(AI_CONFIG_DEFAULT_CACHE_KEY);

      Response.success(res, { id: result.insertId, message: 'AI配置创建成功' });
    });
  } catch (error) {
    console.error('Create AI config error:', error);
    Response.error(res, 'Failed to create AI config', 500);
  }
});

// 更新AI配置
router.put('/configs/:id', authenticateToken, requireAdmin, idParamValidation, aiConfigValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { provider, name, apiKey, apiUrl, model, temperature, maxTokens, timeout, isDefault, status, remark } = req.body;

    // 检查配置是否存在
    const existing = await query('SELECT * FROM sys_ai_config WHERE id = ?', [id]);
    if (existing.length === 0) {
      return Response.error(res, 'AI config not found', 404);
    }

    await transaction(async (connection) => {
      // 如果设置为默认，先将其他配置设为非默认
      if (isDefault === '1') {
        await connection.execute(
          'UPDATE sys_ai_config SET isDefault = "0" WHERE isDefault = "1" AND id != ?',
          [id]
        );
      }

      // 构建更新字段
      const updates = [];
      const params = [];

      if (provider !== undefined) { updates.push('provider = ?'); params.push(provider); }
      if (name !== undefined) { updates.push('name = ?'); params.push(name); }
      if (apiKey !== undefined && apiKey !== '********') { updates.push('apiKey = ?'); params.push(apiKey); }
      if (apiUrl !== undefined) { updates.push('apiUrl = ?'); params.push(apiUrl || null); }
      if (model !== undefined) { updates.push('model = ?'); params.push(model || null); }
      if (temperature !== undefined) { updates.push('temperature = ?'); params.push(temperature); }
      if (maxTokens !== undefined) { updates.push('maxTokens = ?'); params.push(maxTokens); }
      if (timeout !== undefined) { updates.push('timeout = ?'); params.push(timeout); }
      if (isDefault !== undefined) { updates.push('isDefault = ?'); params.push(isDefault); }
      if (status !== undefined) { updates.push('status = ?'); params.push(status); }
      if (remark !== undefined) { updates.push('remark = ?'); params.push(remark || null); }

      if (updates.length === 0) {
        return Response.error(res, 'No fields to update', 400);
      }

      params.push(id);

      await connection.execute(
        `UPDATE sys_ai_config SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      // 清除缓存
      await del(AI_CONFIG_DEFAULT_CACHE_KEY);
      await del(`${AI_CONFIG_CACHE_PREFIX}${id}`);

      Response.success(res, { message: 'AI配置更新成功' });
    });
  } catch (error) {
    console.error('Update AI config error:', error);
    Response.error(res, 'Failed to update AI config', 500);
  }
});

// 删除AI配置
router.delete('/configs/:id', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查配置是否存在
    const existing = await query('SELECT * FROM sys_ai_config WHERE id = ?', [id]);
    if (existing.length === 0) {
      return Response.error(res, 'AI config not found', 404);
    }

    await query('DELETE FROM sys_ai_config WHERE id = ?', [id]);

    // 清除缓存
    await del(AI_CONFIG_DEFAULT_CACHE_KEY);
    await del(`${AI_CONFIG_CACHE_PREFIX}${id}`);

    Response.success(res, { message: 'AI配置删除成功' });
  } catch (error) {
    console.error('Delete AI config error:', error);
    Response.error(res, 'Failed to delete AI config', 500);
  }
});

// 批量删除AI配置
router.delete('/configs/batch/:ids', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ids } = req.params;
    const idArray = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));

    if (idArray.length === 0) {
      return Response.error(res, 'Invalid IDs', 400);
    }

    const placeholders = idArray.map(() => '?').join(',');
    await query(`DELETE FROM sys_ai_config WHERE id IN (${placeholders})`, idArray);

    // 清除缓存
    await del(AI_CONFIG_DEFAULT_CACHE_KEY);
    for (const id of idArray) {
      await del(`${AI_CONFIG_CACHE_PREFIX}${id}`);
    }

    Response.success(res, { message: '批量删除成功' });
  } catch (error) {
    console.error('Batch delete AI configs error:', error);
    Response.error(res, 'Failed to delete AI configs', 500);
  }
});

// 获取默认AI配置（内部使用，不暴露API密钥）
router.get('/configs/default/public', async (req, res) => {
  try {
    let config = await getOrSet(AI_CONFIG_DEFAULT_CACHE_KEY, async () => {
      const rows = await query(
        `SELECT id, provider, name, apiUrl, model, temperature, maxTokens, timeout, remark
         FROM sys_ai_config WHERE isDefault = '1' AND status = '1' LIMIT 1`
      );
      return rows[0] || null;
    }, 3600);

    if (!config) {
      return Response.error(res, 'No default AI config found', 404);
    }

    // 将 temperature 转换为数字
    const temp = config.temperature !== null && config.temperature !== undefined
      ? Number(config.temperature)
      : 0.7;
    config = {
      ...config,
      temperature: isNaN(temp) ? 0.7 : temp
    };

    Response.success(res, config);
  } catch (error) {
    console.error('Get default AI config error:', error);
    Response.error(res, 'Failed to get default AI config', 500);
  }
});

// 调用AI API的通用函数
async function callAIAPI(config, prompt) {

  switch (config.provider) {
    case 'openai': {
      const openai = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.apiUrl
      });
      const response = await openai.chat.completions.create({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: config.maxTokens ? parseInt(config.maxTokens) : 2048,
        temperature: config.temperature ? parseFloat(config.temperature) : 0.7
      });
      return response.choices?.[0]?.message?.content || '';
    }

    case 'bailian':
    case 'aliyun': {
      // 阿里云百炼 - 使用 OpenAI 兼容格式，但需要特殊 header
      const openai = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.apiUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      });
      const response = await openai.chat.completions.create({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: config.maxTokens ? parseInt(config.maxTokens) : 2048,
        temperature: config.temperature ? parseFloat(config.temperature) : 0.7
      });
      return response.choices?.[0]?.message?.content || '';
    }

    case 'deepseek': {
      const axios = require('axios');
      const apiUrl = config.apiUrl || 'https://api.deepseek.com/v1/chat/completions';
      const response = await axios.post(apiUrl, {
        model: config.model || 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: config.maxTokens ? parseInt(config.maxTokens) : 2048,
        temperature: config.temperature ? parseFloat(config.temperature) : 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: (config.timeout || 30) * 1000
      });
      return response.data.choices?.[0]?.message?.content || '';
    }

    case 'anthropic': {
      const axios = require('axios');
      const apiUrl = config.apiUrl || 'https://api.anthropic.com/v1/messages';
      const response = await axios.post(apiUrl, {
        model: config.model || 'claude-3-haiku-20240307',
        max_tokens: config.maxTokens ? parseInt(config.maxTokens) : 2048,
        temperature: config.temperature ? parseFloat(config.temperature) : 0.7,
        messages: [{ role: 'user', content: prompt }]
      }, {
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        timeout: (config.timeout || 30) * 1000
      });
      return response.data.content?.[0]?.text || '';
    }

    default:
      throw new Error(`不支持的AI提供商: ${config.provider}，当前支持: openai, bailian/aliyun, deepseek, anthropic`);
  }
}

// 测试AI配置连接
router.post('/configs/:id/test', authenticateToken, requireAdmin, idParamValidation, async (req, res) => {
  try {
    const { id } = req.params;
    // 获取配置
    const rows = await query('SELECT * FROM sys_ai_config WHERE id = ?', [id]);
    if (rows.length === 0) {
      return Response.error(res, 'AI config not found', 404);
    }

    const config = rows[0];

    // 调用AI API进行连接测试
    await callAIAPI(config, '这是条测试消息');

    Response.success(res, { message: '连接测试成功', provider: config.provider });
  } catch (error) {
    console.error('Test AI config error:', error);
    Response.error(res, `连接测试失败: ${error.message}`, 500);
  }
});

// AI内容生成
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { keyword, configId } = req.body;

    if (!keyword || keyword.trim().length === 0) {
      return Response.error(res, '关键词不能为空', 400);
    }

    // 获取AI配置
    let config;
    if (configId) {
      const rows = await query('SELECT * FROM sys_ai_config WHERE id = ? AND status = "1"', [configId]);
      if (rows.length === 0) {
        return Response.error(res, 'AI配置不存在或已停用', 404);
      }
      config = rows[0];
    } else {
      // 使用默认配置
      const rows = await query('SELECT * FROM sys_ai_config WHERE isDefault = "1" AND status = "1" LIMIT 1');
      if (rows.length === 0) {
        return Response.error(res, '未找到默认AI配置，请先配置AI', 404);
      }
      config = rows[0];
    }

    // 构建提示词
    const prompt = `请根据以下关键词或描述生成一段内容：\n\n${keyword.trim()}\n\n请生成高质量、有深度的内容。`;

    // 调用AI API生成内容
    const generatedContent = await callAIAPI(config, prompt);

    Response.success(res, {
      content: generatedContent,
      provider: config.provider,
      model: config.model
    });

  } catch (error) {
    console.error('AI generate error:', error);
    if (error.response) {
      // AI API返回的错误
      const errorMessage = error.response.data?.error?.message || error.response.data?.message || 'AI服务调用失败';
      return Response.error(res, `AI生成失败: ${errorMessage}`, 500);
    }
    Response.error(res, `AI生成失败: ${error.message}`, 500);
  }
});

// AI生成摘要
router.post('/generate-excerpt', authenticateToken, async (req, res) => {
  try {
    const { content, maxLength = 200 } = req.body;

    if (!content || content.trim().length === 0) {
      return Response.error(res, '文章内容不能为空', 400);
    }

    // 获取默认AI配置
    const rows = await query('SELECT * FROM sys_ai_config WHERE isDefault = "1" AND status = "1" LIMIT 1');
    if (rows.length === 0) {
      return Response.error(res, '未找到默认AI配置，请先配置AI', 404);
    }
    const config = rows[0];

    // 构建提示词
    const prompt = `请为以下文章生成一段简洁的摘要，不超过${maxLength}字。直接输出摘要内容，不要包含任何前缀或额外说明：\n\n${content.trim()}`;

    // 调用AI API
    const excerpt = await callAIAPI(config, prompt);

    Response.success(res, {
      excerpt: excerpt.trim(),
      provider: config.provider,
      model: config.model
    });

  } catch (error) {
    console.error('AI generate excerpt error:', error);
    if (error.response) {
      const errorMessage = error.response.data?.error?.message || error.response.data?.message || 'AI服务调用失败';
      return Response.error(res, `AI生成失败: ${errorMessage}`, 500);
    }
    Response.error(res, `AI生成失败: ${error.message}`, 500);
  }
});

module.exports = router;
