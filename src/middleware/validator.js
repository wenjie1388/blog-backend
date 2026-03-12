const { body, param, query, validationResult } = require('express-validator');
const Response = require('../utils/response');

// 处理验证错误
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return Response.error(res, 'Validation failed', 400, errors.array());
  }
  next();
};

// 登录验证
const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

// 注册验证
const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be 3-20 characters'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  handleValidationErrors
];

// 文章创建/更新验证
const articleValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title must be less than 200 characters'),
  body('content')
    .notEmpty()
    .withMessage('Content is required'),
  body('categoryId')
    .optional()
    .isInt()
    .withMessage('Category ID must be a number'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be draft, published, or archived'),
  handleValidationErrors
];

// 分类验证
const categoryValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ max: 50 })
    .withMessage('Category name must be less than 50 characters'),
  body('slug')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Slug must be less than 50 characters'),
  handleValidationErrors
];

// 菜单验证
const menuValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Menu name is required'),
  body('path')
    .trim()
    .notEmpty()
    .withMessage('Menu path is required'),
  body('sortOrder')
    .optional()
    .isInt()
    .withMessage('Sort order must be a number'),
  handleValidationErrors
];

// 主题验证
const themeValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Theme name is required'),
  body('key')
    .trim()
    .notEmpty()
    .withMessage('Theme key is required'),
  handleValidationErrors
];

// 页面验证
const pageValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Page title is required')
    .isLength({ max: 200 })
    .withMessage('Title must be less than 200 characters'),
  body('content')
    .notEmpty()
    .withMessage('Page content is required'),
  body('slug')
    .trim()
    .notEmpty()
    .withMessage('Page slug is required')
    .isLength({ max: 100 })
    .withMessage('Slug must be less than 100 characters')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug can only contain lowercase letters, numbers and hyphens'),
  body('componentPath')
    .trim()
    .notEmpty()
    .withMessage('Component path is required')
    .matches(/^[a-zA-Z0-9-_/\\]+\.html$/)
    .withMessage('Component path must be a valid HTML file path (e.g., about.html or pages/about.html)'),
  body('template')
    .optional()
    .isIn(['default', 'full-width', 'blank'])
    .withMessage('Template must be default, full-width, or blank'),
  body('status')
    .optional()
    .isIn(['draft', 'published'])
    .withMessage('Status must be draft or published'),
  handleValidationErrors
];

// ID参数验证
const idParamValidation = [
  param('id').isInt().withMessage('ID must be a number'),
  handleValidationErrors
];

// 分页查询验证
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  handleValidationErrors
];

// 字典类型验证
const dictTypeValidation = [
  body('dictName')
    .trim()
    .notEmpty()
    .withMessage('Dict name is required')
    .isLength({ max: 100 })
    .withMessage('Dict name must be less than 100 characters'),
  body('dictType')
    .trim()
    .notEmpty()
    .withMessage('Dict type is required')
    .matches(/^[a-z][a-z0-9_]*$/)
    .withMessage('Dict type must start with lowercase letter and contain only lowercase letters, numbers and underscores')
    .isLength({ max: 100 })
    .withMessage('Dict type must be less than 100 characters'),
  body('status')
    .optional()
    .isIn(['0', '1'])
    .withMessage('Status must be 0 (disabled) or 1 (enabled)'),
  body('remark')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Remark must be less than 500 characters'),
  handleValidationErrors
];

// 字典数据验证
const dictDataValidation = [
  body('dictType')
    .trim()
    .notEmpty()
    .withMessage('Dict type is required'),
  body('dictLabel')
    .trim()
    .notEmpty()
    .withMessage('Dict label is required')
    .isLength({ max: 100 })
    .withMessage('Dict label must be less than 100 characters'),
  body('dictValue')
    .trim()
    .notEmpty()
    .withMessage('Dict value is required')
    .isLength({ max: 100 })
    .withMessage('Dict value must be less than 100 characters'),
  body('dictSort')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
  body('isDefault')
    .optional()
    .isIn(['0', '1'])
    .withMessage('IsDefault must be 0 or 1'),
  body('status')
    .optional()
    .isIn(['0', '1'])
    .withMessage('Status must be 0 (disabled) or 1 (enabled)'),
  body('cssClass')
    .optional()
    .isLength({ max: 100 })
    .withMessage('CSS class must be less than 100 characters'),
  body('listClass')
    .optional()
    .isLength({ max: 100 })
    .withMessage('List class must be less than 100 characters'),
  body('remark')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Remark must be less than 500 characters'),
  handleValidationErrors
];

module.exports = {
  loginValidation,
  registerValidation,
  articleValidation,
  categoryValidation,
  menuValidation,
  themeValidation,
  pageValidation,
  idParamValidation,
  paginationValidation,
  dictTypeValidation,
  dictDataValidation,
  handleValidationErrors
};
