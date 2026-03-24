-- AI配置表
CREATE TABLE IF NOT EXISTS `sys_ai_config` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `provider` varchar(50) NOT NULL COMMENT 'AI提供商 (openai/anthropic/deepseek/etc)',
  `name` varchar(100) NOT NULL COMMENT '配置名称',
  `apiKey` varchar(500) NOT NULL COMMENT 'API密钥',
  `apiUrl` varchar(500) DEFAULT NULL COMMENT 'API地址',
  `model` varchar(100) DEFAULT NULL COMMENT '默认模型',
  `temperature` decimal(3,2) DEFAULT '0.7' COMMENT '温度参数 (0-2)',
  `maxTokens` int DEFAULT '2048' COMMENT '最大token数',
  `timeout` int DEFAULT '30' COMMENT '超时时间(秒)',
  `isDefault` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '0' COMMENT '是否默认 (1是 0否)',
  `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '1' COMMENT '状态 (1启用 0停用)',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_provider` (`provider`),
  KEY `idx_status` (`status`),
  KEY `idx_is_default` (`isDefault`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI配置表';

-- 插入示例数据
INSERT INTO `sys_ai_config` (`provider`, `name`, `apiKey`, `apiUrl`, `model`, `temperature`, `maxTokens`, `isDefault`, `status`, `remark`) VALUES
('openai', 'OpenAI GPT-4', 'sk-your-api-key-here', 'https://api.openai.com/v1', 'gpt-4', 0.70, 2048, '1', '1', 'OpenAI GPT-4 配置'),
('deepseek', 'DeepSeek', 'sk-your-api-key-here', 'https://api.deepseek.com/v1', 'deepseek-chat', 0.70, 2048, '0', '1', 'DeepSeek 配置');
