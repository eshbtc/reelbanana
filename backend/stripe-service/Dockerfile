FROM node:20-slim

# Work inside the service directory
WORKDIR /app/backend/stripe-service

# Copy package files
COPY backend/stripe-service/package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy application code
COPY backend/stripe-service/. .

# Copy central shared modules and unify as ./shared
COPY backend/shared /app/backend/shared
RUN rm -rf ./shared && ln -s /app/backend/shared ./shared

# Create non-root user
RUN groupadd -g 1001 nodejs && useradd -r -u 1001 -g nodejs nodejs

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 8087

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8087/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]
