# Scalable File Upload Service

A production-ready, scalable file upload service built with Node.js, Express, AWS S3, and Docker. This service allows users to upload files securely and retrieve them without quality loss, featuring comprehensive error handling, rate limiting, and monitoring.

## 🚀 Features

- **Secure File Uploads**: Upload files to AWS S3 with validation and sanitization
- **Multiple Upload Methods**: Single file, multiple files, and direct S3 presigned URLs
- **File Management**: List, retrieve, delete, and share files with expiring URLs
- **Security**: Rate limiting, CORS, file type validation, and MIME type verification
- **Scalability**: Docker containerization with nginx load balancing
- **Monitoring**: Health checks, logging, and CloudWatch integration
- **Image Optimization**: Automatic image compression and resizing
- **Production Ready**: Error handling, graceful shutdown, and comprehensive logging

## 🏗️ Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │───▶│   Nginx     │───▶│  Node.js    │───▶│   AWS S3    │
│             │    │ Load Balancer│    │   Express   │    │   Storage   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                           │                   │
                           ▼                   ▼
                   ┌─────────────┐    ┌─────────────┐
                   │ Rate Limiting│    │  CloudWatch │
                   │ & Security  │    │  Monitoring │
                   └─────────────┘    └─────────────┘
```

## 📋 Prerequisites

- Node.js 16+ and npm
- Docker and Docker Compose
- AWS Account with CLI configured
- Basic knowledge of REST APIs and AWS services

## 🛠️ Quick Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd scalable-file-upload-service
npm install
```

### 2. Deploy AWS Infrastructure

```bash
# Make deployment script executable
chmod +x scripts/deploy.sh

# Deploy with default settings (development)
./scripts/deploy.sh

# Or deploy to specific environment
./scripts/deploy.sh --environment production --region us-west-2
```

### 3. Manual Setup (Alternative)

If you prefer manual setup:

```bash
# 1. Deploy CloudFormation stack
aws cloudformation deploy \
  --template-file aws/s3-file-upload.yml \
  --stack-name file-upload-service-stack \
  --capabilities CAPABILITY_NAMED_IAM

# 2. Copy and configure environment
cp .env.example .env
# Edit .env with your AWS credentials and S3 bucket name

# 3. Start services
docker-compose up -d
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | development |
| `PORT` | Server port | 3000 |
| `AWS_REGION` | AWS region | us-east-1 |
| `S3_BUCKET` | S3 bucket name | required |
| `AWS_ACCESS_KEY_ID` | AWS access key | required |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | required |
| `MAX_FILE_SIZE` | Max file size in bytes | 10485760 (10MB) |
| `ALLOWED_FILE_TYPES` | Comma-separated MIME types | image/jpeg,image/png,... |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | 900000 (15 min) |
| `RATE_LIMIT_MAX` | Max requests per window | 100 |
| `CORS_ORIGIN` | Allowed CORS origin | http://localhost:3001 |

## 📡 API Endpoints

### Health Check
```http
GET /health
```

### Upload Single File
```http
POST /api/v1/upload/single
Content-Type: multipart/form-data

file: <binary file data>
```

### Upload Multiple Files
```http
POST /api/v1/upload/multiple
Content-Type: multipart/form-data

files[]: <binary file data>
files[]: <binary file data>
```

### Get Presigned Upload URL
```http
POST /api/v1/upload/direct-s3
Content-Type: application/json

{
  "filename": "example.jpg",
  "contentType": "image/jpeg",
  "expiresIn": 3600
}
```

### Get File
```http
GET /api/v1/files/{fileId}?download=false&expires=3600
```

### Get File Metadata
```http
GET /api/v1/files/{fileId}/metadata
```

### List Files
```http
GET /api/v1/files?page=1&limit=20&type=image&search=example
```

### Delete File
```http
DELETE /api/v1/files/{fileId}
```

### Create Shareable Link
```http
POST /api/v1/files/{fileId}/share?expires=86400
```

### Upload Statistics
```http
GET /api/v1/upload/stats
```

## 🧪 Testing

### Using cURL

```bash
# Health check
curl http://localhost/health

# Upload a file
curl -F "file=@/path/to/your/file.jpg" http://localhost/api/v1/upload/single

# Get file (replace {fileId} with actual ID from upload response)
curl "http://localhost/api/v1/files/{fileId}"

# List files
curl "http://localhost/api/v1/files?page=1&limit=10"
```

### Using Postman

1. **Upload File**:
   - Method: POST
   - URL: `http://localhost/api/v1/upload/single`
   - Body: form-data
   - Key: `file` (type: File)
   - Value: Select your file

2. **Get File**:
   - Method: GET
   - URL: `http://localhost/api/v1/files/{fileId}`
   - Replace `{fileId}` with the ID from upload response

## 📊 Monitoring and Logging

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f file-service

# Nginx logs
docker-compose logs -f nginx
```

### Health Monitoring
```bash
# Check service health
curl http://localhost/health

# Check individual container health
docker-compose ps
```

### AWS CloudWatch
The service automatically sends metrics to CloudWatch:
- S3 bucket size monitoring
- Object count tracking
- Error rate monitoring
- Custom application metrics

## 🔒 Security Features

- **File Validation**: MIME type verification and file signature checking
- **Rate Limiting**: Configurable request limits per IP
- **CORS Protection**: Configurable cross-origin policies
- **Input Sanitization**: Filename sanitization and path traversal protection
- **Secure Headers**: Helmet.js security headers
- **HTTPS Enforcement**: S3 access over HTTPS only
- **Access Control**: Presigned URLs with expiration

## 🚀 Production Deployment

### AWS ECS Deployment

1. **Build and push Docker image**:
```bash
# Build image
docker build -t your-registry/file-upload-service .

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com
docker tag your-registry/file-upload-service:latest your-account.dkr.ecr.us-east-1.amazonaws.com/file-upload-service:latest
docker push your-account.dkr.ecr.us-east-1.amazonaws.com/file-upload-service:latest
```

2. **Deploy to ECS**:
```bash
# Create ECS task definition and service
aws ecs create-task-definition --cli-input-json file://ecs-task-definition.json
aws ecs create-service --cluster your-cluster --service-name file-upload-service --task-definition file-upload-service
```

### Kubernetes Deployment

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: file-upload-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: file-upload-service
  template:
    metadata:
      labels:
        app: file-upload-service
    spec:
      containers:
      - name: file-upload-service
        image: your-registry/file-upload-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        # Add other environment variables
```

## 🔧 Customization

### Adding Authentication

Create an authentication middleware:

```javascript
// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/AppError');

const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    throw new AppError('Access token required', 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.user = decoded;
    next();
  } catch (error) {
    throw new AppError('Invalid token', 401);
  }
};

module.exports = { authenticate };
```

Apply to routes:
```javascript
// src/routes/uploadRoutes.js
const { authenticate } = require('../middleware/auth');

router.post('/single', 
  authenticate,  // Add this line
  upload.single('file'),
  uploadMiddleware,
  uploadController.uploadSingle
);
```

### Adding Database Support

Replace the in-memory file service with a database:

```javascript
// src/services/fileService.js - Database version
const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  fileId: { type: String, required: true, unique: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  s3Key: { type: String, required: true },
  s3Location: { type: String, required: true },
  userId: { type: String, required: true },
  accessCount: { type: Number, default: 0 },
  lastAccessed: { type: Date },
  uploadedAt: { type: Date, default: Date.now },
  tags: [String],
  isPublic: { type: Boolean, default: false }
});

const File = mongoose.model('File', FileSchema);

class FileService {
  async saveFileMetadata(metadata) {
    const file = new File(metadata);
    return await file.save();
  }

  async getFileMetadata(fileId) {
    return await File.findOne({ fileId });
  }

  // ... implement other methods
}
```

### Adding File Processing

Add image processing pipeline:

```javascript
// src/services/imageProcessingService.js
const sharp = require('sharp');

class ImageProcessingService {
  async processImage(inputPath, options = {}) {
    const {
      width = 1920,
      height = 1080,
      quality = 85,
      format = 'jpeg'
    } = options;

    const outputBuffer = await sharp(inputPath)
      .resize(width, height, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ quality, progressive: true })
      .toBuffer();

    return outputBuffer;
  }

  async createThumbnail(inputPath, size = 300) {
    return await sharp(inputPath)
      .resize(size, size, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();
  }
}
```

### Adding File Compression

```javascript
// src/services/compressionService.js
const archiver = require('archiver');
const fs = require('fs');

class CompressionService {
  async createZipArchive(files, outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 }});

      output.on('close', () => resolve(outputPath));
      archive.on('error', reject);

      archive.pipe(output);
      
      files.forEach(file => {
        archive.file(file.path, { name: file.name });
      });

      archive.finalize();
    });
  }
}
```

## 📈 Performance Optimization

### Caching Strategy

```javascript
// src/middleware/cache.js
const redis = require('redis');
const client = redis.createClient(process.env.REDIS_URL);

const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    const key = `cache:${req.originalUrl}`;
    
    try {
      const cached = await client.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
      
      // Store original json method
      const originalJson = res.json;
      res.json = function(data) {
        // Cache the response
        client.setex(key, duration, JSON.stringify(data));
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      next();
    }
  };
};
```

### Connection Pooling

```javascript
// src/config/database.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};
```

## 🐛 Troubleshooting

### Common Issues

**1. "Access Denied" errors from S3**
```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify S3 bucket permissions
aws s3 ls s3://your-bucket-name
```

**2. File upload timeout**
```javascript
// Increase timeout in nginx.conf
client_body_timeout 120s;
proxy_read_timeout 120s;

// Increase timeout in server.js
server.timeout = 120000; // 2 minutes
```

**3. "File too large" errors**
```bash
# Check nginx client_max_body_size
# Check MAX_FILE_SIZE environment variable
# Verify multer limits configuration
```

**4. Container startup issues**
```bash
# Check logs
docker-compose logs file-service

# Check environment variables
docker-compose exec file-service env | grep AWS

# Test AWS connectivity
docker-compose exec file-service aws s3 ls
```

### Debug Mode

Enable debug logging:
```bash
export LOG_LEVEL=debug
docker-compose up -d
```

View detailed logs:
```bash
docker-compose logs -f file-service | grep DEBUG
```

## 📚 API Documentation

### Response Format

All API responses follow this format:
```json
{
  "success": true,
  "data": { ... },
  "message": "Description of the operation",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "details": [ ... ],
    "code": "ERROR_CODE"
  },
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/) for the web framework
- [Multer](https://www.npmjs.com/package/multer) for file upload handling
- [AWS SDK](https://aws.amazon.com/sdk-for-javascript/) for S3 integration
- [Sharp](https://sharp.pixelplumbing.com/) for image processing
- [Winston](https://github.com/winstonjs/winston) for logging

## 🔗 Related Projects

- [Frontend React App](link-to-frontend) - React frontend for this service
- [Mobile App](link-to-mobile) - React Native mobile client
- [Admin Dashboard](link-to-admin) - Administrative interface

---

**Happy Coding!** 🚀

For questions or support, please open an issue or reach out to the maintainers.
