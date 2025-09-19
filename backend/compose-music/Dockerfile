FROM node:20-slim

# Work inside the service directory to preserve relative imports
WORKDIR /app/backend/compose-music

# Install dependencies for this service
COPY backend/compose-music/package*.json ./
RUN npm install --only=production

# Copy service code
COPY backend/compose-music/. .

# Copy shared code for centralized imports (../shared/*)
COPY backend/shared /app/backend/shared

# Unify shared modules: use central shared for both ../shared and ./shared imports
RUN rm -rf ./shared && ln -s /app/backend/shared ./shared

CMD ["node", "index.js"]
