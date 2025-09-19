FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Work inside the service directory
WORKDIR /app/backend/api-key-service

# Copy package files and install deps
COPY backend/api-key-service/package*.json ./
RUN npm ci --only=production

# Copy application code
COPY backend/api-key-service/. .

# Copy central shared modules and unify as ./shared
COPY backend/shared /app/backend/shared
RUN rm -rf ./shared && ln -s /app/backend/shared ./shared

# Expose port
EXPOSE 8085

# Start the application
CMD ["node", "index.js"]
