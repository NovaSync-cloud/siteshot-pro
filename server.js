import express from 'express';
import axios from 'axios';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/generate', async (req, res) => {
    const { url } = req.body;
    const id = Date.now();
    const tempDir = path.join(__dirname, 'temp');
    if (!existsSync(tempDir)) await fs.mkdir(tempDir);

    const shotPath = path.join(tempDir, `shot-${id}.png`);
    const collagePath = path.join(tempDir, `collage-${id}.jpg`);
    const videoPath = path.join(tempDir, `video-${id}.mp4`);

    try {
        console.log(`[ELITE] Starting Full-Page Capture: ${url}`);

        // 1. FULL-PAGE CAPTURE (HD Mode)
        // We tell Microlink to capture the FULL PAGE and use a large 1920 width
        const micUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&screenshot.full_page=true&screenshot.type=png&screenshot.width=1920&screenshot.device_scale_factor=2`;
        
        const response = await axios({ url: micUrl, responseType: 'arraybuffer' });
        await fs.writeFile(shotPath, response.data);
        console.log("✓ Full-page captured");

        // 2. PRO COLLAGE (Vision Board Style)
        const bg = await sharp({
            create: { width: 1080, height: 1920, channels: 3, background: { r: 10, g: 10, b: 15 } }
        }).jpeg().toBuffer();

        const foreground = await sharp(shotPath)
            .resize(900, null) // Keep it crisp
            .extract({ left: 0, top: 0, width: 900, height: 1400 }) // Take a nice "slice" for the mockup
            .toBuffer();

        await sharp(bg).composite([{ input: foreground, gravity: 'center' }]).toFile(collagePath);
        console.log("✓ Collage created");

        // 3. CINEMATIC 15-SECOND VIDEO (Entire Page Scroll)
        console.log("Rendering 15s HD video...");
        await new Promise((resolve, reject) => {
            const duration = 15; // 15 SECONDS FOR A SMOOTH SHOWCASE
            ffmpeg(shotPath)
                .loop(duration)
                .fps(30)
                .videoFilters([
                    // This creates the professional "smooth scroll" from top to bottom
                    `scale=1080:-1`, 
                    `crop=1080:1920:0:ih*t/${duration}-1920*t/${duration}`
                ])
                .videoCodec('libx264')
                .outputOptions(['-preset ultrafast', '-pix_fmt yuv420p', '-crf 18'])
                .save(videoPath)
                .on('end', resolve)
                .on('error', reject);
        });

        res.json({
            screenshot: (await fs.readFile(shotPath)).toString('base64'),
            collage: (await fs.readFile(collagePath)).toString('base64'),
            video: (await fs.readFile(videoPath)).toString('base64')
        });

        // CLEANUP (Wait a bit to ensure memory is free)
        setTimeout(async () => {
            try {
                await Promise.all([fs.unlink(shotPath), fs.unlink(collagePath), fs.unlink(videoPath)]);
            } catch (e) {}
        }, 5000);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "High-res generation failed. The site might be too heavy." });
    }
});

app.listen(process.env.PORT || 3000);
