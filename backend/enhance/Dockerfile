FROM node:20-alpine

# Work inside the service directory to preserve relative imports
WORKDIR /app/backend/enhance

# Install dependencies for this service only
COPY backend/enhance/package*.json ./
RUN npm ci --only=production

# Copy service code
COPY backend/enhance/. .

# Copy shared code for centralized imports (../shared/*)
COPY backend/shared /app/backend/shared

# Unify shared modules: use central shared for both ../shared and ./shared imports
RUN rm -rf ./shared && ln -s /app/backend/shared ./shared

EXPOSE 8088

CMD ["node", "index.js"]
