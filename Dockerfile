FROM node:20-slim

# Install dependencies for Playwright, FFmpeg, and Sharp
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

# Copy and install dependencies
COPY package*.json ./
RUN npm install --production

# Install Chromium
RUN npx playwright install chromium

# Copy all files
COPY . .

# Ensure temp directory exists
RUN mkdir -p temp && chmod 777 temp

EXPOSE 3000

# Run without memory-intensive flags
CMD ["node", "server.js"]
