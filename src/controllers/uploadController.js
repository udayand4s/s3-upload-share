const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const s3Service = require('../services/s3Service');
const fileService = require('../services/fileService');
const logger = require('../utils/logger');
const { AppError } = require('../utils/AppError');

class UploadController {
  async uploadSingle(req, res, next) {
    try {
      if (!req.file) {
        throw new AppError('No file provided', 400);
      }

      const file = req.file;
      const fileId = uuidv4();
      
      // Process and upload to S3
      const result = await s3Service.uploadFile({
        file,
        fileId,
        userId: req.userId || 'anonymous' // Will be used when auth is implemented
      });

      // Save file metadata
      const fileMetadata = await fileService.saveFileMetadata({
        fileId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        s3Key: result.key,
        s3Location: result.location,
        userId: req.userId || 'anonymous',
        uploadedAt: new Date()
      });

      // Clean up temporary file
      try {
        await fs.unlink(file.path);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup temp file: ${cleanupError.message}`);
      }

      // Generate presigned URL for immediate access
      const presignedUrl = await s3Service.getPresignedUrl(result.key, 3600);

      logger.info(`File uploaded successfully: ${fileId}`);

      res.status(201).json({
        success: true,
        data: {
          fileId,
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: result.location,
          presignedUrl,
          uploadedAt: fileMetadata.uploadedAt
        },
        message: 'File uploaded successfully'
      });

    } catch (error) {
      // Clean up temp file on error
      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          logger.warn(`Failed to cleanup temp file after error: ${cleanupError.message}`);
        }
      }
      next(error);
    }
  }

  async uploadMultiple(req, res, next) {
    const uploadedFiles = [];
    const failedFiles = [];

    try {
      if (!req.files || req.files.length === 0) {
        throw new AppError('No files provided', 400);
      }

      for (const file of req.files) {
        try {
          const fileId = uuidv4();
          
          // Process and upload to S3
          const result = await s3Service.uploadFile({
            file,
            fileId,
            userId: req.userId || 'anonymous'
          });

          // Save file metadata
          const fileMetadata = await fileService.saveFileMetadata({
            fileId,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            s3Key: result.key,
            s3Location: result.location,
            userId: req.userId || 'anonymous',
            uploadedAt: new Date()
          });

          // Generate presigned URL
          const presignedUrl = await s3Service.getPresignedUrl(result.key, 3600);

          uploadedFiles.push({
            fileId,
            filename: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: result.location,
            presignedUrl,
            uploadedAt: fileMetadata.uploadedAt
          });

          // Clean up temp file
          try {
            await fs.unlink(file.path);
          } catch (cleanupError) {
            logger.warn(`Failed to cleanup temp file: ${cleanupError.message}`);
          }

        } catch (fileError) {
          logger.error(`Failed to upload file ${file.originalname}: ${fileError.message}`);
          failedFiles.push({
            filename: file.originalname,
            error: fileError.message
          });

          // Clean up temp file
          try {
            await fs.unlink(file.path);
          } catch (cleanupError) {
            logger.warn(`Failed to cleanup temp file: ${cleanupError.message}`);
          }
        }
      }

      logger.info(`Batch upload completed: ${uploadedFiles.length} successful, ${failedFiles.length} failed`);

      res.status(201).json({
        success: true,
        data: {
          uploaded: uploadedFiles,
          failed: failedFiles,
          summary: {
            total: req.files.length,
            successful: uploadedFiles.length,
            failed: failedFiles.length
          }
        },
        message: `Upload completed: ${uploadedFiles.length}/${req.files.length} files successful`
      });

    } catch (error) {
      // Clean up any remaining temp files
      if (req.files) {
        for (const file of req.files) {
          try {
            await fs.unlink(file.path);
          } catch (cleanupError) {
            logger.warn(`Failed to cleanup temp file: ${cleanupError.message}`);
          }
        }
      }
      next(error);
    }
  }

  async getPresignedUrl(req, res, next) {
    try {
      const { filename, contentType, expiresIn = 3600 } = req.body;

      if (!filename || !contentType) {
        throw new AppError('Filename and contentType are required', 400);
      }

      const fileId = uuidv4();
      const key = `uploads/${fileId}-${filename}`;

      const presignedUrl = await s3Service.getPresignedUploadUrl({
        key,
        contentType,
        expiresIn: parseInt(expiresIn)
      });

      res.json({
        success: true,
        data: {
          fileId,
          uploadUrl: presignedUrl,
          key,
          expiresIn: parseInt(expiresIn)
        },
        message: 'Presigned URL generated successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async getUploadStats(req, res, next) {
    try {
      const stats = await fileService.getUploadStats();
      
      res.json({
        success: true,
        data: stats,
        message: 'Upload statistics retrieved successfully'
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UploadController();