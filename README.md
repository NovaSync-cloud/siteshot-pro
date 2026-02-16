# 🎬 SiteShot Pro

Generate stunning marketing assets from any URL - screenshots, aesthetic collages, and scrolling videos.

**Built for Render.com Free Tier (512MB RAM)** with aggressive memory optimization.

## ✨ Features

1. **📸 Full Page Screenshot** - Capture the entire webpage in high quality
2. **🎨 Aesthetic Collage** - Create Instagram-story style vision boards with:
   - Mobile-sized screenshot
   - Gradient background (extracted from site colors)
   - Glassmorphism effect with shadows
   - Rounded corners
3. **🎬 Scrolling Video** - Generate 10-second vertical videos that smoothly scroll down the page (1080x1920, 30fps)

## 🚀 Quick Deploy to Render

### Option 1: One-Click Deploy
1. Fork this repository
2. Go to [Render.com](https://render.com)
3. Click "New +" → "Web Service"
4. Connect your GitHub repo
5. Render will auto-detect the `Dockerfile` and `render.yaml`
6. Click "Create Web Service"
7. Wait 5-10 minutes for the build to complete

### Option 2: Manual Configuration
If auto-detection doesn't work:
- **Environment**: Docker
- **Build Command**: (leave empty, Dockerfile handles it)
- **Start Command**: (leave empty, Dockerfile handles it)
- **Plan**: Free
- **Environment Variables**:
  ```
  NODE_OPTIONS=--max-old-space-size=384
  ```

## 🏗️ Architecture

### Memory-Optimized Design (Critical for 512MB RAM)

The application is carefully designed to avoid memory crashes:

1. **Serial Processing**: Only one operation at a time
   - Screenshots and videos are NEVER generated simultaneously
   - Each request is queued and processed sequentially

2. **Immediate Cleanup**: 
   ```javascript
   // Take screenshot
   const screenshot = await page.screenshot();
   
   // CRITICAL: Close browser IMMEDIATELY
   await browser.close();
   browser = null;
   
   // NOW process the image with Sharp
   const optimized = await sharp(screenshot).png().toBuffer();
   ```

3. **Lightweight Browser Config**:
   ```javascript
   const BROWSER_ARGS = [
     '--no-sandbox',
     '--disable-setuid-sandbox',
     '--disable-dev-shm-usage',  // Use disk instead of RAM
     '--disable-accelerated-2d-canvas',
     '--disable-gpu',
     '--disable-features=IsolateOrigins,site-per-process'
   ];
   ```

4. **Garbage Collection Hints**:
   ```javascript
   if (global.gc) global.gc();  // Force cleanup after each request
   ```

### Tech Stack

- **Backend**: Node.js + Express
- **Screenshots**: Playwright (Chromium headless)
- **Image Processing**: Sharp
- **Video Generation**: FFmpeg
- **Frontend**: React (bundled without build tools for simplicity)
- **Hosting**: Docker on Render.com

## 📁 Project Structure

```
siteshot-pro/
├── server.js           # Express API with memory-optimized endpoints
├── App.jsx             # React frontend dashboard
├── package.json        # Dependencies
├── Dockerfile          # Multi-stage build with Playwright + FFmpeg
├── render.yaml         # Render deployment config
└── README.md           # This file
```

## 🔧 Local Development

### Prerequisites
- Node.js 18+
- FFmpeg installed on your system

### Setup
```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Start the server
npm start
```

Visit `http://localhost:3000`

### Testing Endpoints
```bash
# Full screenshot
curl -X POST http://localhost:3000/api/screenshot/full \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' \
  --output screenshot.png

# Aesthetic collage
curl -X POST http://localhost:3000/api/screenshot/collage \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' \
  --output collage.png

# Scrolling video
curl -X POST http://localhost:3000/api/video/scroll \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' \
  --output video.mp4
```

## ⚙️ API Endpoints

### `POST /api/screenshot/full`
Generate a full-page screenshot.

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Response:** PNG image file

---

### `POST /api/screenshot/collage`
Generate an aesthetic collage (1080x1920).

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Response:** PNG image file

---

### `POST /api/video/scroll`
Generate a 10-second scrolling video.

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Response:** MP4 video file (1080x1920, 30fps)

**Note:** Video generation takes 2-3 minutes on free hosting.

## 🐛 Troubleshooting

### "Out of Memory" Errors
If you see crashes on Render:
1. Check the logs: `Render Dashboard → Logs`
2. Verify `NODE_OPTIONS=--max-old-space-size=384` is set
3. Ensure only one request is being processed at a time
4. Consider upgrading to a paid Render plan with more RAM

### Slow Video Generation
- Normal on free tier (2-3 minutes)
- The app captures 300 frames individually
- This is optimized to avoid memory crashes
- Faster on paid hosting with more CPU/RAM

### Browser Launch Failures
- Ensure Dockerfile properly installs Playwright dependencies
- Check that `npx playwright install chromium` ran during build
- Review Render build logs for any missing system packages

## 🎯 Performance Tips

1. **URL Selection**: Simple websites work better than heavy JavaScript apps
2. **Timing**: Avoid peak hours on free hosting for faster processing
3. **Patience**: Video generation is CPU-intensive and takes time on free tier
4. **Caching**: Consider adding Redis for URL-based caching (not included to save RAM)

## 📊 Resource Usage

| Operation | Estimated RAM | Estimated Time |
|-----------|---------------|----------------|
| Full Screenshot | ~150-200 MB | 5-10 seconds |
| Aesthetic Collage | ~200-250 MB | 8-15 seconds |
| Scrolling Video | ~350-400 MB | 2-3 minutes |

## 🔐 Security Considerations

- Add rate limiting in production (not included to keep it simple)
- Validate URLs to prevent SSRF attacks
- Consider adding authentication for public deployments
- Set timeout limits to prevent abuse

## 📝 License

MIT License - feel free to use this for your projects!

## 🙏 Credits

Built with:
- [Playwright](https://playwright.dev/) - Browser automation
- [Sharp](https://sharp.pixelplumbing.com/) - Image processing
- [FFmpeg](https://ffmpeg.org/) - Video encoding
- [Express](https://expressjs.com/) - Web framework
- [React](https://react.dev/) - Frontend UI

---

**Made with ❤️ for the Render.com Free Tier**

*Remember: This is optimized for 512MB RAM. Every line of code has been written with memory efficiency in mind.*
