# Production Dockerfile for SiteShot Pro
# Optimized for Render.com Free Tier (512MB RAM)

FROM node:18-bullseye-slim

# Set working directory
WORKDIR /app

# Install system dependencies for Playwright and FFmpeg
RUN apt-get update && apt-get install -y \
    # Core utilities
    wget \
    gnupg \
    ca-certificates \
    # Playwright Chromium dependencies
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
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxext6 \
    libxshmfence1 \
    # Additional libraries for stability
    fonts-liberation \
    libappindicator3-1 \
    libu2f-udev \
    libvulkan1 \
    xdg-utils \
    # FFmpeg and dependencies
    ffmpeg \
    # Cleanup to reduce image size
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
# Use --production to skip dev dependencies
# Use --omit=dev for newer npm versions
RUN npm install --production

# Install Playwright Chromium browser only (not all browsers)
# This saves significant disk space and memory
RUN npx playwright install chromium

# Install Playwright system dependencies
RUN npx playwright install-deps chromium

# Copy application code
COPY server.js ./
COPY public ./public

# Create temp directory for video/image processing
RUN mkdir -p temp

# Set proper permissions
RUN chmod -R 755 /app

# Expose port (Render assigns this dynamically)
EXPOSE 3000

# Environment variables for memory optimization
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=384 --optimize-for-size"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {let data = ''; r.on('data', chunk => data += chunk); r.on('end', () => process.exit(JSON.parse(data).status === 'ok' ? 0 : 1)); }).on('error', () => process.exit(1));"

# Start the application
CMD ["node", "server.js"]
