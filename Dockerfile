# Use a standard Node image
FROM node:20-slim

# Install ONLY the essential things for Playwright and FFmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libgbm-dev \
    libnss3 \
    libasound2 \
    libxshmfence1 \
    libatk1.0-0 \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Install only Chromium (save space/memory)
RUN npx playwright install chromium

COPY . .

# Start simply without any "extra" flags
CMD ["node", "server.js"]
