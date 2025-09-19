FROM node:20-slim

# Install system deps first (for caching)
RUN apt-get update && apt-get install -y ffmpeg libass-dev && rm -rf /var/lib/apt/lists/*

# Work inside the service directory to preserve relative imports
WORKDIR /app/backend/render

# Install dependencies for this service
COPY backend/render/package*.json ./
RUN npm install --only=production

# Copy service code
COPY backend/render/. .

# Copy shared code for centralized imports (../shared/*)
COPY backend/shared /app/backend/shared

# Unify shared modules: use central shared for both ../shared and ./shared imports
RUN rm -rf ./shared && ln -s /app/backend/shared ./shared

CMD ["node", "index.js"]
