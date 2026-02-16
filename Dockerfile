# Use Node.js 18 Bullseye Slim for smaller image size
FROM node:18-bullseye-slim

# Set working directory
WORKDIR /app

# Install system dependencies for Playwright and FFmpeg
RUN apt-get update && apt-get install -y \
    # Playwright dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    libwayland-client0 \
    # FFmpeg
    ffmpeg \
    # Cleanup to reduce image size
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm install --production

# Install Playwright browsers (Chromium only for RAM efficiency)
RUN npx playwright install chromium

# Copy application files
COPY server.js ./
COPY public ./public

# Create temp directory for video generation
RUN mkdir -p temp

# Expose port
EXPOSE 3000

# Set NODE_OPTIONS for memory optimization on 512MB RAM
ENV NODE_OPTIONS="--max-old-space-size=384"

# Start the server
CMD ["node", "server.js"]
