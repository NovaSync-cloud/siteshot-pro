import express from 'express';
import { chromium } from 'playwright';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static('public'));

app.post('/api/generate', async (req, res) => {
    const { url } = req.body;
    const id = Date.now();
    const tempDir = path.join(__dirname, 'temp');
    if (!existsSync(tempDir)) await fs.mkdir(tempDir);

    const shotPath = path.join(tempDir, `shot-${id}.jpg`);
    const collagePath = path.join(tempDir, `collage-${id}.jpg`);
    const videoPath = path.join(tempDir, `video-${id}.mp4`);

    let browser;
    try {
        // 1. CAPTURE (Fast & Small)
        browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        const page = await browser.newPage();
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.screenshot({ path: shotPath, quality: 60 }); // Lower quality to save RAM
        await browser.close();

        // 2. COLLAGE (Resize FIRST to prevent Sharp error)
        const background = await sharp({
            create: { width: 1080, height: 1920, channels: 3, background: { r: 79, g: 70, b: 229 } }
        }).jpeg().toBuffer();

        const resizedShot = await sharp(shotPath)
            .resize(900, 1600, { fit: 'inside' }) // Make it fit in the 1080x1920 box
            .toBuffer();

        await sharp(background)
            .composite([{ input: resizedShot, gravity: 'center' }])
            .toFile(collagePath);

        // 3. VIDEO (Simple Pan)
        await new Promise((resolve, reject) => {
            ffmpeg(shotPath)
                .loop(5)
                .fps(20)
                .videoFilters(['scale=720:1280:force_original_aspect_ratio=increase', 'crop=720:1280:0:0'])
                .videoCodec('libx264')
                .outputOptions(['-preset ultrafast', '-pix_fmt yuv420p'])
                .save(videoPath)
                .on('end', resolve)
                .on('error', reject);
        });

        // Send results as Base64 to avoid storage issues
        res.json({
            screenshot: (await fs.readFile(shotPath)).toString('base64'),
            collage: (await fs.readFile(collagePath)).toString('base64'),
            video: (await fs.readFile(videoPath)).toString('base64')
        });

        // Cleanup 
