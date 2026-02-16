import express from 'express';
import { chromium } from 'playwright';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { promisify } from 'util';
import { pipeline } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(join(__dirname, 'public')));

// CRITICAL: Lightweight Playwright config for 512MB RAM
const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--window-size=1920,1080',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-blink-features=AutomationControlled'
];

// Utility: Extract dominant colors from image
async function extractDominantColors(imageBuffer) {
  try {
    const { dominant } = await sharp(imageBuffer)
      .resize(50, 50)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Simple dominant color extraction
    const pixels = dominant;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < pixels.length; i += 3) {
      r += pixels[i];
      g += pixels[i + 1];
      b += pixels[i + 2];
    }
    const count = pixels.length / 3;
    r = Math.floor(r / count);
    g = Math.floor(g / count);
    b = Math.floor(b / count);
    
    return { r, g, b };
  } catch (error) {
    return { r: 99, g: 102, b: 241 }; // Default blue
  }
}

// API: Full Page Screenshot
app.post('/api/screenshot/full', async (req, res) => {
  let browser = null;
  const tempFile = join(__dirname, `temp-full-${Date.now()}.png`);
  
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`[FULL] Starting screenshot for: ${url}`);
    
    // Launch browser with minimal config
    browser = await chromium.launch({
      headless: true,
      args: BROWSER_ARGS
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();
    
    // Navigate with timeout
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Wait a bit for dynamic content
    await page.waitForTimeout(2000);

    // Take full page screenshot
    const screenshot = await page.screenshot({ 
      fullPage: true,
      type: 'png'
    });

    // CRITICAL: Close browser immediately to free RAM
    await browser.close();
    browser = null;
    
    console.log('[FULL] Screenshot captured, browser closed');

    // Optimize image size with sharp
    const optimized = await sharp(screenshot)
      .png({ quality: 85, compressionLevel: 8 })
      .toBuffer();

    // Send as response
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `attachment; filename="screenshot-full.png"`);
    res.send(optimized);
    
    console.log('[FULL] Complete');

  } catch (error) {
    console.error('[FULL] Error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    // Cleanup
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error('Browser close error:', e);
      }
    }
    
    // Force garbage collection hint
    if (global.gc) global.gc();
  }
});

// API: Aesthetic Collage
app.post('/api/screenshot/collage', async (req, res) => {
  let browser = null;
  
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`[COLLAGE] Starting for: ${url}`);
    
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: BROWSER_ARGS
    });

    const context = await browser.newContext({
      viewport: { width: 375, height: 667 } // Mobile size
    });

    const page = await context.newPage();
    
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    await page.waitForTimeout(2000);

    // Take mobile screenshot
    const screenshot = await page.screenshot({ 
      fullPage: false,
      type: 'png'
    });

    // CRITICAL: Close browser immediately
    await browser.close();
    browser = null;
    
    console.log('[COLLAGE] Screenshot captured, browser closed');

    // Extract dominant color
    const dominantColor = await extractDominantColors(screenshot);
    
    // Create gradient background
    const canvasWidth = 1080;
    const canvasHeight = 1920;
    
    // Create SVG gradient
    const gradientSVG = `
      <svg width="${canvasWidth}" height="${canvasHeight}">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:rgb(${dominantColor.r},${dominantColor.g},${dominantColor.b});stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgb(${Math.max(0, dominantColor.r - 40)},${Math.max(0, dominantColor.g - 40)},${Math.max(0, dominantColor.b - 40)});stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${canvasWidth}" height="${canvasHeight}" fill="url(#grad1)" />
      </svg>
    `;

    const gradient = await sharp(Buffer.from(gradientSVG))
      .png()
      .toBuffer();

    // Resize and style the screenshot
    const screenshotResized = await sharp(screenshot)
      .resize(900, null, { fit: 'inside' })
      .png()
      .toBuffer();

    // Add rounded corners and shadow effect
    const { width: imgWidth, height: imgHeight } = await sharp(screenshotResized).metadata();
    
    const roundedCornerSVG = `
      <svg width="${imgWidth}" height="${imgHeight}">
        <defs>
          <clipPath id="rounded">
            <rect x="0" y="0" width="${imgWidth}" height="${imgHeight}" rx="30" ry="30"/>
          </clipPath>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="20"/>
            <feOffset dx="0" dy="20" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
      </svg>
    `;

    const styledScreenshot = await sharp(screenshotResized)
      .extend({
        top: 40,
        bottom: 40,
        left: 40,
        right: 40,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();

    // Composite: gradient + styled screenshot
    const final = await sharp(gradient)
      .composite([{
        input: styledScreenshot,
        gravity: 'center'
      }])
      .png({ quality: 90 })
      .toBuffer();

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `attachment; filename="screenshot-collage.png"`);
    res.send(final);
    
    console.log('[COLLAGE] Complete');

  } catch (error) {
    console.error('[COLLAGE] Error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error('Browser close error:', e);
      }
    }
    
    if (global.gc) global.gc();
  }
});

// API: Scrolling Video
app.post('/api/video/scroll', async (req, res) => {
  let browser = null;
  const tempDir = join(__dirname, 'temp');
  const frameDir = join(tempDir, `frames-${Date.now()}`);
  const outputVideo = join(tempDir, `video-${Date.now()}.mp4`);
  
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`[VIDEO] Starting for: ${url}`);
    
    // Create temp directories
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(frameDir, { recursive: true });

    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: BROWSER_ARGS
    });

    const context = await browser.newContext({
      viewport: { width: 1080, height: 1920 } // Vertical video
    });

    const page = await context.newPage();
    
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    await page.waitForTimeout(2000);

    // Get page height
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = 1920;
    
    console.log(`[VIDEO] Page height: ${pageHeight}px`);

    // Calculate scroll steps (30 fps for 10 seconds = 300 frames)
    const totalFrames = 300;
    const scrollStep = Math.max(1, (pageHeight - viewportHeight) / totalFrames);

    // Capture frames
    for (let i = 0; i < totalFrames; i++) {
      const scrollY = Math.min(i * scrollStep, pageHeight - viewportHeight);
      
      await page.evaluate((y) => {
        window.scrollTo(0, y);
      }, scrollY);

      await page.waitForTimeout(33); // ~30fps

      const screenshot = await page.screenshot({ type: 'png' });
      await fs.writeFile(join(frameDir, `frame-${String(i).padStart(5, '0')}.png`), screenshot);
      
      // Log progress every 50 frames
      if (i % 50 === 0) {
        console.log(`[VIDEO] Progress: ${i}/${totalFrames} frames`);
      }
    }

    console.log(`[VIDEO] All frames captured`);

    // CRITICAL: Close browser before FFmpeg
    await browser.close();
    browser = null;
    
    // Force garbage collection
    if (global.gc) global.gc();
    
    console.log('[VIDEO] Browser closed, starting FFmpeg');

    // Create video with FFmpeg
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(join(frameDir, 'frame-%05d.png'))
        .inputFPS(30)
        .videoCodec('libx264')
        .outputOptions([
          '-pix_fmt yuv420p',
          '-preset ultrafast', // Fast encoding for low RAM
          '-crf 23'
        ])
        .output(outputVideo)
        .on('start', (cmd) => {
          console.log('[VIDEO] FFmpeg started:', cmd);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`[VIDEO] Encoding: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log('[VIDEO] FFmpeg complete');
          resolve();
        })
        .on('error', (err) => {
          console.error('[VIDEO] FFmpeg error:', err);
          reject(err);
        })
        .run();
    });

    // Stream video to response
    res.set('Content-Type', 'video/mp4');
    res.set('Content-Disposition', `attachment; filename="scroll-video.mp4"`);
    
    const videoStream = (await fs.readFile(outputVideo));
    res.send(videoStream);

    console.log('[VIDEO] Complete');

  } catch (error) {
    console.error('[VIDEO] Error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    // Cleanup
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error('Browser close error:', e);
      }
    }

    // Delete temp files
    try {
      if (frameDir) await fs.rm(frameDir, { recursive: true, force: true });
      if (outputVideo) await fs.unlink(outputVideo).catch(() => {});
    } catch (e) {
      console.error('Cleanup error:', e);
    }
    
    if (global.gc) global.gc();
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', memory: process.memoryUsage() });
});

app.listen(PORT, () => {
  console.log(`🚀 SiteShot Pro running on port ${PORT}`);
  console.log(`💾 Memory limit optimized for 512MB`);
});
