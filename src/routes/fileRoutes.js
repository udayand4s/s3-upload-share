const express = require('express');
const { param, query } = require('express-validator');
const fileController = require('../controllers/fileController');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

// Get file by ID with presigned URL
router.get('/:fileId',
  [
    param('fileId').isUUID().withMessage('Invalid file ID format'),
    query('download').optional().isBoolean().withMessage('Download must be boolean'),
    query('expires').optional().isInt({ min: 300, max: 604800 }).withMessage('Expires must be between 300 and 604800 seconds')
  ],
  validateRequest,
  fileController.getFile
);

// Get file metadata
router.get('/:fileId/metadata',
  [
    param('fileId').isUUID().withMessage('Invalid file ID format')
  ],
  validateRequest,
  fileController.getFileMetadata
);

// Delete file
router.delete('/:fileId',
  [
    param('fileId').isUUID().withMessage('Invalid file ID format')
  ],
  validateRequest,
  fileController.deleteFile
);

// List files with pagination
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('type').optional().isString().withMessage('Type must be a string'),
    query('search').optional().isString().isLength({ max: 100 }).withMessage('Search query too long')
  ],
  validateRequest,
  fileController.listFiles
);

// Generate shareable link
router.post('/:fileId/share',
  [
    param('fileId').isUUID().withMessage('Invalid file ID format'),
    query('expires').optional().isInt({ min: 3600, max: 604800 }).withMessage('Expires must be between 1 hour and 7 days')
  ],
  validateRequest,
  fileController.createShareableLink
);

module.exports = router;