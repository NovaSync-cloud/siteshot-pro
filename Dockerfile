FROM node:20-slim
RUN apt-get update && apt-get install -y ffmpeg libgbm-dev libnss3 libasound2 libxshmfence1 libatk1.0-0 libgtk-3-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --production
RUN npx playwright install chromium
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
