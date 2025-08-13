const AWS = require('aws-sdk');
const fs = require('fs');
const sharp = require('sharp');
const FileType = require('file-type');
const logger = require('../utils/logger');
const { AppError } = require('../utils/AppError');

class S3Service {
  constructor() {
    this.s3 = new AWS.S3({
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      signatureVersion: 'v4'
    });
    
    this.bucket = process.env.S3_BUCKET;
    
    if (!this.bucket) {
      throw new Error('S3_BUCKET environment variable is required');
    }
  }

  async uploadFile({ file, fileId, userId }) {
    try {
      // Verify file type for security
      const fileTypeResult = await FileType.fromFile(file.path);
      if (fileTypeResult && fileTypeResult.mime !== file.mimetype) {
        logger.warn(`File type mismatch: declared ${file.mimetype}, actual ${fileTypeResult.mime}`);
        throw new AppError('File type validation failed', 400);
      }

      const key = `uploads/${userId}/${fileId}-${file.originalname}`;
      let fileStream = fs.createReadStream(file.path);
      let contentType = file.mimetype;

      // Optimize images
      if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/gif') {
        try {
          const optimizedBuffer = await sharp(file.path)
            .resize(2048, 2048, { 
              fit: 'inside', 
              withoutEnlargement: true 
            })
            .jpeg({ quality: 85, progressive: true })
            .png({ compressionLevel: 8 })
            .webp({ quality: 85 })
            .toBuffer();
          
          fileStream = optimizedBuffer;
          contentType = file.mimetype;
        } catch (optimizeError) {
          logger.warn(`Image optimization failed: ${optimizeError.message}`);
          // Continue with original file
        }
      }

      const uploadParams = {
        Bucket: this.bucket,
        Key: key,
        Body: fileStream,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
        Metadata: {
          'user-id': userId,
          'file-id': fileId,
          'original-name': file.originalname,
          'upload-timestamp': new Date().toISOString()
        },
        Tagging: `Environment=${process.env.NODE_ENV || 'development'}&UserId=${userId}&FileId=${fileId}`
      };

      const result = await this.s3.upload(uploadParams).promise();
      
      logger.info(`File uploaded to S3: ${key}`);
      
      return {
        key: result.Key,
        location: result.Location,
        etag: result.ETag,
        bucket: this.bucket
      };

    } catch (error) {
      logger.error(`S3 upload failed: ${error.message}`);
      throw new AppError(`File upload failed: ${error.message}`, 500);
    }
  }

  async getPresignedUrl(key, expiresIn = 3600, forceDownload = false) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key,
        Expires: expiresIn
      };

      if (forceDownload) {
        params.ResponseContentDisposition = 'attachment';
      }

      const url = await this.s3.getSignedUrlPromise('getObject', params);
      
      logger.debug(`Presigned URL generated for key: ${key}`);
      
      return url;

    } catch (error) {
      logger.error(`Failed to generate presigned URL: ${error.message}`);
      throw new AppError(`Failed to generate access URL: ${error.message}`, 500);
    }
  }

  async getPresignedUploadUrl({ key, contentType, expiresIn = 3600 }) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        Expires: expiresIn,
        ServerSideEncryption: 'AES256'
      };

      const url = await this.s3.getSignedUrlPromise('putObject', params);
      
      logger.debug(`Presigned upload URL generated for key: ${key}`);
      
      return url;

    } catch (error) {
      logger.error(`Failed to generate presigned upload URL: ${error.message}`);
      throw new AppError(`Failed to generate upload URL: ${error.message}`, 500);
    }
  }

  async deleteFile(key) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key
      };

      await this.s3.deleteObject(params).promise();
      
      logger.info(`File deleted from S3: ${key}`);
      
      return true;

    } catch (error) {
      logger.error(`S3 delete failed: ${error.message}`);
      throw new AppError(`File deletion failed: ${error.message}`, 500);
    }
  }

  async checkFileExists(key) {
    try {
      await this.s3.headObject({
        Bucket: this.bucket,
        Key: key
      }).promise();
      
      return true;

    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getFileMetadata(key) {
    try {
      const result = await this.s3.headObject({
        Bucket: this.bucket,
        Key: key
      }).promise();

      return {
        size: result.ContentLength,
        lastModified: result.LastModified,
        contentType: result.ContentType,
        etag: result.ETag,
        metadata: result.Metadata
      };

    } catch (error) {
      if (error.code === 'NotFound') {
        return null;
      }
      logger.error(`Failed to get S3 file metadata: ${error.message}`);
      throw new AppError(`Failed to get file metadata: ${error.message}`, 500);
    }
  }

  async listFiles({ prefix = 'uploads/', maxKeys = 1000, continuationToken }) {
    try {
      const params = {
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys
      };

      if (continuationToken) {
        params.ContinuationToken = continuationToken;
      }

      const result = await this.s3.listObjectsV2(params).promise();
      
      return {
        files: result.Contents || [],
        isTruncated: result.IsTruncated,
        nextContinuationToken: result.NextContinuationToken
      };

    } catch (error) {
      logger.error(`Failed to list S3 files: ${error.message}`);
      throw new AppError(`Failed to list files: ${error.message}`, 500);
    }
  }
}

module.exports = new S3Service();