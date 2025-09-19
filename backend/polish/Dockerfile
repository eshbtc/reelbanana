FROM node:20-slim

# Work inside the service directory to preserve relative imports
WORKDIR /app/backend/polish

# Install dependencies for this service
COPY backend/polish/package.json backend/polish/package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev

# Copy service code
COPY backend/polish/. .

# Copy shared code for centralized imports (../shared/*)
COPY backend/shared /app/backend/shared

EXPOSE 8086
CMD ["npm","start"]
