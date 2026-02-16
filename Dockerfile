# Use Node.js 18 Alpine for smaller image size
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
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Install Playwright browsers (Chromium only for RAM efficiency)
RUN npx playwright install chromium

# Copy application code
COPY . .

# Build the React frontend
RUN mkdir -p public && \
    node -e "const React = require('react'); const ReactDOM = require('react-dom/client'); const fs = require('fs'); \
    const html = \`<!DOCTYPE html> \
<html lang=\"en\"> \
<head> \
  <meta charset=\"UTF-8\"> \
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"> \
  <title>SiteShot Pro - Generate Marketing Assets</title> \
  <style> \
    * { margin: 0; padding: 0; box-sizing: border-box; } \
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; } \
  </style> \
</head> \
<body> \
  <div id=\"root\"></div> \
  <script crossorigin src=\"https://unpkg.com/react@18/umd/react.production.min.js\"></script> \
  <script crossorigin src=\"https://unpkg.com/react-dom@18/umd/react-dom.production.min.js\"></script> \
  <script src=\"/app.js\"></script> \
</body> \
</html>\`; \
    fs.writeFileSync('public/index.html', html);"

# Bundle React app using esbuild-wasm approach (lightweight)
# For production, you'd use a proper bundler, but this keeps it simple
RUN node -e "const fs = require('fs'); \
    const appCode = fs.readFileSync('App.jsx', 'utf8'); \
    const bundled = \`(function() { \
      const React = window.React; \
      const ReactDOM = window.ReactDOM; \
      ${appCode.replace('export default App;', '')} \
      const root = ReactDOM.createRoot(document.getElementById('root')); \
      root.render(React.createElement(App)); \
    })();\`; \
    fs.writeFileSync('public/app.js', bundled);"

# Create temp directory
RUN mkdir -p temp

# Expose port
EXPOSE 3000

# Set NODE_OPTIONS for memory optimization
ENV NODE_OPTIONS="--max-old-space-size=384"

# Start the server
CMD ["node", "server.js"]
