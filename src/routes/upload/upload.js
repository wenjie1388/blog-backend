const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const Response = require('@/utils/response');
const { authenticateToken, requireAdmin } = require('@/middleware/auth');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 根据文件类型存储到不同子目录
    let subDir = 'others';
    if (file.mimetype.startsWith('image/')) {
      subDir = 'images';
    } else if (file.mimetype.startsWith('video/')) {
      subDir = 'videos';
    } else if (file.mimetype.startsWith('audio/')) {
      subDir = 'audios';
    } else if (file.mimetype.includes('pdf') || file.mimetype.includes('document')) {
      subDir = 'documents';
    }
    
    const destPath = path.join(uploadDir, subDir);
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }
    
    cb(null, destPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// 文件过滤
const fileFilter = (req, file, cb) => {
  // 允许的文件类型
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

// 配置multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB
  }
});

// 单文件上传
router.post('/file', authenticateToken, requireAdmin, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return Response.error(res, 'No file uploaded', 400);
    }
    
    const fileUrl = `/uploads/${req.file.destination.split('uploads/')[1]}/${req.file.filename}`;
    
    Response.success(res, {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: fileUrl
    }, 'File uploaded successfully');
  } catch (error) {
    console.error('Upload error:', error);
    Response.error(res, 'Failed to upload file', 500);
  }
});

// 多文件上传
router.post('/files', authenticateToken, requireAdmin, upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return Response.error(res, 'No files uploaded', 400);
    }
    
    const files = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/${file.destination.split('uploads/')[1]}/${file.filename}`
    }));
    
    Response.success(res, files, 'Files uploaded successfully');
  } catch (error) {
    console.error('Upload error:', error);
    Response.error(res, 'Failed to upload files', 500);
  }
});

// 图片专用上传（用于编辑器）
router.post('/image', authenticateToken, requireAdmin, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return Response.error(res, 'No image uploaded', 400);
    }
    
    if (!req.file.mimetype.startsWith('image/')) {
      // 删除非图片文件
      fs.unlinkSync(req.file.path);
      return Response.error(res, 'Only image files are allowed', 400);
    }
    
    const fileUrl = `/uploads/images/${req.file.filename}`;
    
    Response.success(res, {
      filename: req.file.filename,
      originalName: req.file.originalname,
      url: fileUrl,
      size: req.file.size
    }, 'Image uploaded successfully');
  } catch (error) {
    console.error('Upload error:', error);
    Response.error(res, 'Failed to upload image', 500);
  }
});

// 删除文件
router.delete('/file/:filename', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { filename } = req.params;
    const { folder = 'images' } = req.query;
    
    const filePath = path.join(uploadDir, folder, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      Response.success(res, null, 'File deleted successfully');
    } else {
      Response.error(res, 'File not found', 404);
    }
  } catch (error) {
    console.error('Delete file error:', error);
    Response.error(res, 'Failed to delete file', 500);
  }
});

module.exports = router;
