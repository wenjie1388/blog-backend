-- 封面管理表
CREATE TABLE IF NOT EXISTS `covers` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '封面ID',
  `name` VARCHAR(100) NOT NULL COMMENT '封面名称',
  `url` VARCHAR(500) NOT NULL COMMENT '封面图片URL',
  `description` VARCHAR(500) DEFAULT NULL COMMENT '封面描述',
  `sortOrder` INT DEFAULT 0 COMMENT '排序',
  `status` ENUM('active', 'disabled') DEFAULT 'active' COMMENT '状态',
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_status` (`status`),
  INDEX `idx_sortOrder` (`sortOrder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='封面管理表';

-- 插入默认封面数据
INSERT INTO `covers` (`name`, `url`, `description`, `sortOrder`, `status`) VALUES
('默认封面1', 'https://picsum.photos/seed/blog1/800/400', '随机风景图片', 1, 'active'),
('默认封面2', 'https://picsum.photos/seed/blog2/800/400', '随机风景图片', 2, 'active'),
('默认封面3', 'https://picsum.photos/seed/blog3/800/400', '随机风景图片', 3, 'active'),
('默认封面4', 'https://picsum.photos/seed/blog4/800/400', '随机风景图片', 4, 'active'),
('默认封面5', 'https://picsum.photos/seed/blog5/800/400', '随机风景图片', 5, 'active'),
('默认封面6', 'https://picsum.photos/seed/blog6/800/400', '随机风景图片', 6, 'active'),
('默认封面7', 'https://picsum.photos/seed/blog7/800/400', '随机风景图片', 7, 'active'),
('默认封面8', 'https://picsum.photos/seed/blog8/800/400', '随机风景图片', 8, 'active');
