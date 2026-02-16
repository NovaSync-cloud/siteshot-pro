import express from 'express';
import { chromium } from 'playwright';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(join(__dirname, 'public')));

// Memory Safety Configuration
const MEMORY_THRESHOLD = 400 * 1024 * 1024; // 400MB threshold on 512MB system
let isProcessing = false;

// Check memory usage
function checkMemory() {
  const usage = process.memoryUsage();
  return {
    safe: usage.heapUsed < MEMORY_THRESHOLD,
    usage: {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024)
    }
  };
}

// Lightweight Playwright configuration for 512MB RAM
const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-blink-features=AutomationControlled',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding'
];

// Extract dominant colors from image
async function extractDominantColors(imageBuffer) {
  try {
    const { data, info } = await sharp(imageBuffer)
      .resize(100, 100, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Calculate average color
    let r = 0, g = 0, b = 0;
    const pixelCount = info.width * info.height;
    
    for (let i = 0; i < data.length; i += info.channels) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    
    r = Math.floor(r / pixelCount);
    g = Math.floor(g / pixelCount);
    b = Math.floor(b / pixelCount);
    
    // Create complementary color
    const r2 = Math.min(255, r + 40);
    const g2 = Math.min(255, g + 40);
    const b2 = Math.min(255, b + 60);
    
    return {
      primary: { r, g, b },
      secondary: { r: r2, g: g2, b: b2 }
    };
  } catch (error) {
    console.error('Color extraction error:', error);
    return {
      primary: { r: 99, g: 102, b: 241 },
      secondary: { r: 139, g: 92, b: 246 }
    };
  }
}

// MAIN API: Generate All Assets
app.post('/api/generate', async (req, res) => {
  let browser = null;
  const tempDir = join(__dirname, 'temp');
  const timestamp = Date.now();
  const screenshotPath = join(tempDir, `screenshot-${timestamp}.png`);
  const collagePath = join(tempDir, `collage-${timestamp}.png`);
  const videoPath = join(tempDir, `video-${timestamp}.mp4`);
  
  try {
    // Memory Safety Check
    const memCheck = checkMemory();
    if (!memCheck.safe) {
      return res.status(503).json({
        error: 'Server is currently processing another request. Please try again in a moment.',
        memoryUsage: memCheck.usage
      });
    }

    // Prevent concurrent processing
    if (isProcessing) {
      return res.status(503).json({
        error: 'Server is busy. Please wait...',
      });
    }

    isProcessing = true;
    
    const { url } = req.body;
    
    if (!url) {
      isProcessing = false;
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`[GENERATE] Starting for: ${url}`);
    
    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });

    // ============================================
    // STEP 1: CAPTURE HIGH-RES SCREENSHOT
    // ============================================
    console.log('[STEP 1] Launching browser...');
    
    browser = await chromium.launch({
      headless: true,
      args: BROWSER_ARGS
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2 // High DPI
    });

    const page = await context.newPage();
    
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    await page.waitForTimeout(2000);

    console.log('[STEP 1] Taking full-page screenshot...');
    
    const screenshot = await page.screenshot({ 
      fullPage: true,
      type: 'png'
    });

    // Save to disk immediately
    await fs.writeFile(screenshotPath, screenshot);

    // CRITICAL: Close browser NOW to free 150-200MB of RAM
    await browser.close();
    browser = null;
    
    // Force garbage collection
    if (global.gc) global.gc();
    
    console.log('[STEP 1] ✓ Screenshot captured, browser closed');

    // ============================================
    // STEP 2: CREATE AESTHETIC COLLAGE
    // ============================================
    console.log('[STEP 2] Creating aesthetic collage...');
    
    const screenshotBuffer = await fs.readFile(screenshotPath);
    
    // Extract colors
    const colors = await extractDominantColors(screenshotBuffer);
    
    // Canvas dimensions
    const canvasWidth = 1080;
    const canvasHeight = 1920;
    
    // Create gradient background with blur
    const gradientSVG = `
      <svg width="${canvasWidth}" height="${canvasHeight}">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:rgb(${colors.primary.r},${colors.primary.g},${colors.primary.b});stop-opacity:1" />
            <stop offset="50%" style="stop-color:rgb(${Math.floor((colors.primary.r + colors.secondary.r) / 2)},${Math.floor((colors.primary.g + colors.secondary.g) / 2)},${Math.floor((colors.primary.b + colors.secondary.b) / 2)});stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgb(${colors.secondary.r},${colors.secondary.g},${colors.secondary.b});stop-opacity:1" />
          </linearGradient>
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" />
            <feColorMatrix type="saturate" values="0" />
            <feBlend in="SourceGraphic" mode="multiply" />
          </filter>
        </defs>
        <rect width="${canvasWidth}" height="${canvasHeight}" fill="url(#grad)" filter="url(#noise)" />
      </svg>
    `;

    const gradient = await sharp(Buffer.from(gradientSVG))
      .png()
      .blur(30)
      .toBuffer();

    // Create device mockup
    const deviceWidth = 900;
    const screenshotResized = await sharp(screenshotBuffer)
      .resize(deviceWidth, null, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    const { width: deviceImageWidth, height: deviceImageHeight } = await sharp(screenshotResized).metadata();

    // Add rounded corners and shadow
    const deviceWithFrame = await sharp(screenshotResized)
      .extend({
        top: 60,
        bottom: 60,
        left: 60,
        right: 60,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();

    // Composite everything
    const collage = await sharp(gradient)
      .composite([{
        input: deviceWithFrame,
        gravity: 'center'
      }])
      .png({ quality: 95, compressionLevel: 6 })
      .toBuffer();

    await fs.writeFile(collagePath, collage);
    
    console.log('[STEP 2] ✓ Collage created');
    
    if (global.gc) global.gc();

    // ============================================
    // STEP 3: GENERATE PANNING VIDEO
    // ============================================
    console.log('[STEP 3] Generating panning video...');
    
    const { width: imgWidth, height: imgHeight } = await sharp(screenshotBuffer).metadata();
    
    // Resize to 720p width for efficiency
    const videoWidth = 720;
    const videoHeight = 1280;
    
    const resizedForVideo = await sharp(screenshotBuffer)
      .resize(videoWidth, null, { fit: 'inside' })
      .toBuffer();
    
    const { height: resizedHeight } = await sharp(resizedForVideo).metadata();
    await fs.writeFile(join(tempDir, `temp-${timestamp}.png`), resizedForVideo);
    
    // Calculate pan distance
    const panDistance = Math.max(0, resizedHeight - videoHeight);
    
    console.log(`[STEP 3] Video specs: ${videoWidth}x${videoHeight}, pan distance: ${panDistance}px`);

    await new Promise((resolve, reject) => {
      const videoDuration = 5; // 5 seconds
      
      ffmpeg()
        .input(join(tempDir, `temp-${timestamp}.png`))
        .inputOptions(['-loop 1', '-t', videoDuration])
        .complexFilter([
          // Pan from top to bottom
          `crop=${videoWidth}:${videoHeight}:0:'min(${panDistance},${panDistance}*t/${videoDuration})'`
        ])
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-preset ultrafast',
          '-crf 23',
          '-movflags +faststart'
        ])
        .output(videoPath)
        .on('start', (cmd) => {
          console.log('[STEP 3] FFmpeg started');
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`[STEP 3] Encoding: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log('[STEP 3] ✓ Video complete');
          resolve();
        })
        .on('error', (err) => {
          console.error('[STEP 3] FFmpeg error:', err);
          reject(err);
        })
        .run();
    });
    
    if (global.gc) global.gc();

    // ============================================
    // RETURN ALL ASSETS
    // ============================================
    console.log('[GENERATE] Loading assets...');
    
    const [screenshotFinal, collageFinal, videoFinal] = await Promise.all([
      fs.readFile(screenshotPath),
      fs.readFile(collagePath),
      fs.readFile(videoPath)
    ]);

    res.json({
      success: true,
      assets: {
        screenshot: screenshotFinal.toString('base64'),
        collage: collageFinal.toString('base64'),
        video: videoFinal.toString('base64')
      },
      metadata: {
        url,
        timestamp,
        colors
      }
    });

    console.log('[GENERATE] ✓ Complete - All assets delivered');

  } catch (error) {
    console.error('[GENERATE] Error:', error);
    res.status(500).json({ 
      error: error.message || 'Asset generation failed',
      details: error.stack
    });
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
      if (existsSync(screenshotPath)) await fs.unlink(screenshotPath);
      if (existsSync(collagePath)) await fs.unlink(collagePath);
      if (existsSync(videoPath)) await fs.unlink(videoPath);
      if (existsSync(join(tempDir, `temp-${timestamp}.png`))) {
        await fs.unlink(join(tempDir, `temp-${timestamp}.png`));
      }
    } catch (e) {
      console.error('Cleanup error:', e);
    }

    isProcessing = false;
    
    if (global.gc) global.gc();
  }
});

// Health check
app.get('/api/health', (req, res) => {
  const memCheck = checkMemory();
  res.json({ 
    status: 'ok',
    memory: memCheck.usage,
    safe: memCheck.safe,
    processing: isProcessing
  });
});

app.listen(PORT, () => {
  console.log(`🚀 SiteShot Pro v2.0 - Production Ready`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`💾 Memory optimized for 512MB Render.com free tier`);
  console.log(`🎨 Glassmorphism UI enabled`);
});
