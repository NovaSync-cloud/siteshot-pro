FROM node:20-slim

# Install ONLY FFmpeg (needed for video)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install only the light dependencies
COPY package*.json ./
RUN npm install --production

# Copy your code
COPY . .

# Create temp folder
RUN mkdir -p temp && chmod 777 temp

EXPOSE 3000

CMD ["node", "server.js"]
