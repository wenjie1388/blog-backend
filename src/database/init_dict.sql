-- 字典类型表
CREATE TABLE IF NOT EXISTS `sys_dict_type` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '字典主键',
  `dictName` varchar(100) NOT NULL COMMENT '字典名称',
  `dictType` varchar(100) NOT NULL COMMENT '字典类型',
  `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '1' COMMENT '状态（1正常 0停用）',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dict_type` (`dictType`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='字典类型表';

-- 字典数据表
CREATE TABLE IF NOT EXISTS `sys_dict_data` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '字典编码',
  `dictType` varchar(100) NOT NULL COMMENT '字典类型',
  `dictSort` int NOT NULL DEFAULT '0' COMMENT '字典排序',
  `dictLabel` varchar(100) NOT NULL COMMENT '字典标签',
  `dictValue` varchar(100) NOT NULL COMMENT '字典键值',
  `cssClass` varchar(100) DEFAULT NULL COMMENT '样式属性（其他样式扩展）',
  `listClass` varchar(100) DEFAULT NULL COMMENT '表格回显样式',
  `isDefault` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '0' COMMENT '是否默认（1是 0否）',
  `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '1' COMMENT '状态（1正常 0停用）',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_dict_type` (`dictType`),
  KEY `idx_status` (`status`),
  UNIQUE KEY `uk_dict_type_value` (`dictType`, `dictValue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='字典数据表';

-- 插入示例数据：文章状态字典
INSERT INTO `sys_dict_type` (`dictName`, `dictType`, `status`, `remark`) VALUES
('文章状态', 'article_status', '1', '文章发布状态');

INSERT INTO `sys_dict_data` (`dictType`, `dictSort`, `dictLabel`, `dictValue`, `isDefault`, `status`, `listClass`, `remark`) VALUES
('article_status', 1, '草稿', 'draft', '0', '1', 'warning', '草稿状态'),
('article_status', 2, '已发布', 'published', '1', '1', 'success', '已发布状态'),
('article_status', 3, '已归档', 'archived', '0', '1', 'info', '已归档状态');

-- 插入示例数据：系统状态字典
INSERT INTO `sys_dict_type` (`dictName`, `dictType`, `status`, `remark`) VALUES
('系统状态', 'sys_status', '1', '通用状态选项');

INSERT INTO `sys_dict_data` (`dictType`, `dictSort`, `dictLabel`, `dictValue`, `isDefault`, `status`, `listClass`) VALUES
('sys_status', 1, '启用', '1', '1', '1', 'success'),
('sys_status', 2, '停用', '0', '0', '1', 'danger');
