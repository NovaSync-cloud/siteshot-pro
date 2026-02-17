import express from 'express';
import axios from 'axios';
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

    try {
        // 1. CAPTURE via Microlink API (Free, no RAM used!)
        const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;
        const response = await axios({ url: screenshotUrl, responseType: 'arraybuffer' });
        await fs.writeFile(shotPath, response.data);

        // 2. COLLAGE (Resize to fit 1080x1920)
        const background = await sharp({
            create: { width: 1080, height: 1920, channels: 3, background: { r: 79, g: 70, b: 229 } }
        }).jpeg().toBuffer();

        const resizedShot = await sharp(shotPath)
            .resize(900, 1600, { fit: 'inside' })
            .toBuffer();

        await sharp(background)
            .composite([{ input: resizedShot, gravity: 'center' }])
            .toFile(collagePath);

        // 3. VIDEO (5-sec Pan)
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

        res.json({
            screenshot: (await fs.readFile(shotPath)).toString('base64'),
            collage: (await fs.readFile(collagePath)).toString('base64'),
            video: (await fs.readFile(videoPath)).toString('base64')
        });

        // Cleanup
        await Promise.all([fs.unlink(shotPath), fs.unlink(collagePath), fs.unlink(videoPath)]);

    } catch (err) {
        res.status(500).json({ error: "Failed to process: " + err.message });
    }
});

app.listen(process.env.PORT || 3000);
