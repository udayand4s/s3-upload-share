# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create uploads directory for temporary files
RUN mkdir -p uploads

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S fileservice -u 1001

# Change ownership of the app directory to nodejs user
RUN chown -R fileservice:nodejs /app
USER fileservice

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# Start the application
CMD ["npm", "start"]