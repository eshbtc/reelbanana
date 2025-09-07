FROM node:20-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN apt-get update && apt-get install -y ffmpeg libass-dev

RUN npm install --only=production

COPY . .

CMD ["node", "index.js"]