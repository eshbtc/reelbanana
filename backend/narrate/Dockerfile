FROM node:20-slim

# Work inside the service directory to preserve relative imports
WORKDIR /app/backend/narrate

# Install dependencies for this service
COPY backend/narrate/package*.json ./
RUN npm ci --only=production

# Copy service code
COPY backend/narrate/. .

# Copy shared code for centralized imports (../shared/*)
COPY backend/shared /app/backend/shared

CMD ["node", "index.js"]
