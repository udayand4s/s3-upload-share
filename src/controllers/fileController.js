const s3Service = require('../services/s3Service');
const fileService = require('../services/fileService');
const logger = require('../utils/logger');
const { AppError } = require('../utils/AppError');

class FileController {
  async getFile(req, res, next) {
    try {
      const { fileId } = req.params;
      const { download = false, expires = 3600 } = req.query;

      // Get file metadata
      const fileMetadata = await fileService.getFileMetadata(fileId);
      if (!fileMetadata) {
        throw new AppError('File not found', 404);
      }

      // Generate presigned URL
      const presignedUrl = await s3Service.getPresignedUrl(
        fileMetadata.s3Key, 
        parseInt(expires),
        download === 'true'
      );

      // Update access stats
      await fileService.updateAccessStats(fileId);

      logger.info(`File access: ${fileId}`);

      res.json({
        success: true,
        data: {
          fileId,
          filename: fileMetadata.originalName,
          mimeType: fileMetadata.mimeType,
          size: fileMetadata.size,
          presignedUrl,
          expiresAt: new Date(Date.now() + (parseInt(expires) * 1000)).toISOString(),
          uploadedAt: fileMetadata.uploadedAt
        },
        message: 'File URL generated successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async getFileMetadata(req, res, next) {
    try {
      const { fileId } = req.params;

      const fileMetadata = await fileService.getFileMetadata(fileId);
      if (!fileMetadata) {
        throw new AppError('File not found', 404);
      }

      res.json({
        success: true,
        data: {
          fileId,
          filename: fileMetadata.originalName,
          mimeType: fileMetadata.mimeType,
          size: fileMetadata.size,
          uploadedAt: fileMetadata.uploadedAt,
          accessCount: fileMetadata.accessCount || 0,
          lastAccessed: fileMetadata.lastAccessed
        },
        message: 'File metadata retrieved successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async deleteFile(req, res, next) {
    try {
      const { fileId } = req.params;

      // Get file metadata
      const fileMetadata = await fileService.getFileMetadata(fileId);
      if (!fileMetadata) {
        throw new AppError('File not found', 404);
      }

      // Delete from S3
      await s3Service.deleteFile(fileMetadata.s3Key);

      // Delete metadata
      await fileService.deleteFileMetadata(fileId);

      logger.info(`File deleted: ${fileId}`);

      res.json({
        success: true,
        data: {
          fileId,
          deletedAt: new Date().toISOString()
        },
        message: 'File deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async listFiles(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        search
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        type,
        search
      };

      const result = await fileService.listFiles(options);

      res.json({
        success: true,
        data: {
          files: result.files,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            pages: result.pages,
            hasNext: result.hasNext,
            hasPrev: result.hasPrev
          }
        },
        message: 'Files retrieved successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async createShareableLink(req, res, next) {
    try {
      const { fileId } = req.params;
      const { expires = 86400 } = req.query; // 24 hours default

      // Get file metadata
      const fileMetadata = await fileService.getFileMetadata(fileId);
      if (!fileMetadata) {
        throw new AppError('File not found', 404);
      }

      // Generate long-lived presigned URL
      const shareableUrl = await s3Service.getPresignedUrl(
        fileMetadata.s3Key, 
        parseInt(expires)
      );

      // Log sharing activity
      await fileService.logShareActivity(fileId, expires);

      logger.info(`Shareable link created for file: ${fileId}`);

      res.json({
        success: true,
        data: {
          fileId,
          filename: fileMetadata.originalName,
          shareableUrl,
          expiresAt: new Date(Date.now() + (parseInt(expires) * 1000)).toISOString(),
          expiresIn: parseInt(expires)
        },
        message: 'Shareable link created successfully'
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FileController();