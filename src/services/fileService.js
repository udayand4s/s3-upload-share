const logger = require('../utils/logger');
const { AppError } = require('../utils/AppError');

// In-memory storage for file metadata (replace with database in production)
class FileService {
  constructor() {
    this.files = new Map(); // fileId -> metadata
    this.accessStats = new Map(); // fileId -> access stats
    this.shareActivity = new Map(); // fileId -> share activity
  }

  async saveFileMetadata(metadata) {
    try {
      const fileRecord = {
        ...metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessCount: 0,
        lastAccessed: null
      };

      this.files.set(metadata.fileId, fileRecord);
      
      logger.info(`File metadata saved: ${metadata.fileId}`);
      return fileRecord;

    } catch (error) {
      logger.error(`Failed to save file metadata: ${error.message}`);
      throw new AppError('Failed to save file metadata', 500);
    }
  }

  async getFileMetadata(fileId) {
    try {
      const metadata = this.files.get(fileId);
      
      if (!metadata) {
        logger.debug(`File metadata not found: ${fileId}`);
        return null;
      }

      return metadata;

    } catch (error) {
      logger.error(`Failed to get file metadata: ${error.message}`);
      throw new AppError('Failed to get file metadata', 500);
    }
  }

  async updateAccessStats(fileId) {
    try {
      const metadata = this.files.get(fileId);
      
      if (metadata) {
        metadata.accessCount = (metadata.accessCount || 0) + 1;
        metadata.lastAccessed = new Date();
        metadata.updatedAt = new Date();
        
        this.files.set(fileId, metadata);
        
        logger.debug(`Access stats updated for file: ${fileId}`);
      }

    } catch (error) {
      logger.error(`Failed to update access stats: ${error.message}`);
      // Don't throw error for stats update failure
    }
  }

  async deleteFileMetadata(fileId) {
    try {
      const deleted = this.files.delete(fileId);
      this.accessStats.delete(fileId);
      this.shareActivity.delete(fileId);
      
      if (deleted) {
        logger.info(`File metadata deleted: ${fileId}`);
      }
      
      return deleted;

    } catch (error) {
      logger.error(`Failed to delete file metadata: ${error.message}`);
      throw new AppError('Failed to delete file metadata', 500);
    }
  }

  async listFiles({ page = 1, limit = 20, type, search }) {
    try {
      let files = Array.from(this.files.values());

      // Filter by type
      if (type) {
        files = files.filter(file => file.mimeType.includes(type));
      }

      // Search by filename
      if (search) {
        const searchLower = search.toLowerCase();
        files = files.filter(file => 
          file.originalName.toLowerCase().includes(searchLower)
        );
      }

      // Sort by upload date (newest first)
      files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

      // Pagination
      const total = files.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedFiles = files.slice(startIndex, endIndex);

      const pages = Math.ceil(total / limit);

      return {
        files: paginatedFiles.map(file => ({
          fileId: file.fileId,
          filename: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          uploadedAt: file.uploadedAt,
          accessCount: file.accessCount || 0,
          lastAccessed: file.lastAccessed
        })),
        page,
        limit,
        total,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1
      };

    } catch (error) {
      logger.error(`Failed to list files: ${error.message}`);
      throw new AppError('Failed to list files', 500);
    }
  }

  async logShareActivity(fileId, expiresIn) {
    try {
      const activity = this.shareActivity.get(fileId) || [];
      activity.push({
        sharedAt: new Date(),
        expiresIn,
        expiresAt: new Date(Date.now() + (expiresIn * 1000))
      });
      
      this.shareActivity.set(fileId, activity);
      
      logger.debug(`Share activity logged for file: ${fileId}`);

    } catch (error) {
      logger.error(`Failed to log share activity: ${error.message}`);
      // Don't throw error for logging failure
    }
  }

  async getUploadStats() {
    try {
      const files = Array.from(this.files.values());
      
      const totalFiles = files.length;
      const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
      const totalAccesses = files.reduce((sum, file) => sum + (file.accessCount || 0), 0);
      
      // File type distribution
      const typeDistribution = {};
      files.forEach(file => {
        const category = this.getFileCategory(file.mimeType);
        typeDistribution[category] = (typeDistribution[category] || 0) + 1;
      });

      // Recent uploads (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentUploads = files.filter(file => 
        new Date(file.uploadedAt) > oneDayAgo
      ).length;

      // Storage by category
      const storageByType = {};
      files.forEach(file => {
        const category = this.getFileCategory(file.mimeType);
        storageByType[category] = (storageByType[category] || 0) + file.size;
      });

      return {
        overview: {
          totalFiles,
          totalSize,
          totalAccesses,
          recentUploads
        },
        distribution: {
          byType: typeDistribution,
          storageByType
        },
        averages: {
          fileSize: totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0,
          accessesPerFile: totalFiles > 0 ? Math.round(totalAccesses / totalFiles) : 0
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Failed to get upload stats: ${error.message}`);
      throw new AppError('Failed to get upload statistics', 500);
    }
  }

  getFileCategory(mimeType) {
    if (mimeType.startsWith('image/')) return 'images';
    if (mimeType.startsWith('video/')) return 'videos';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf')) return 'documents';
    if (mimeType.includes('text/')) return 'text';
    if (mimeType.includes('application/')) return 'applications';
    return 'other';
  }

  // Method to export data (useful for database migration)
  exportData() {
    return {
      files: Array.from(this.files.entries()),
      accessStats: Array.from(this.accessStats.entries()),
      shareActivity: Array.from(this.shareActivity.entries()),
      exportedAt: new Date().toISOString()
    };
  }

  // Method to import data (useful for database migration)
  importData(data) {
    if (data.files) {
      this.files = new Map(data.files);
    }
    if (data.accessStats) {
      this.accessStats = new Map(data.accessStats);
    }
    if (data.shareActivity) {
      this.shareActivity = new Map(data.shareActivity);
    }
    
    logger.info('Data imported successfully');
  }
}

module.exports = new FileService();