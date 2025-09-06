FROM node:18-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN apt-get update && apt-get install -y ffmpeg

RUN npm ci --only=production

COPY . .

CMD ["node", "index.js"]