const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const uploadController = require('../controllers/uploadController');
const { validateRequest } = require('../middleware/validation');
const { uploadMiddleware } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Configure multer for temporary file storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads');
    try {
      await fs.access(uploadsDir);
    } catch (error) {
      await fs.mkdir(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for security
const fileFilter = (req, file, cb) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 5, // Maximum 5 files at once
    fields: 10
  }
});

// Routes
router.post('/single', 
  upload.single('file'),
  uploadMiddleware,
  uploadController.uploadSingle
);

router.post('/multiple',
  upload.array('files', 5),
  uploadMiddleware,
  uploadController.uploadMultiple
);

router.post('/direct-s3',
  uploadController.getPresignedUrl
);

// Get upload statistics
router.get('/stats', uploadController.getUploadStats);

module.exports = router;