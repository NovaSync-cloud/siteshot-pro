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

    const shotPath = path.join(tempDir, `shot-${id}.jpg`);
    const collagePath = path.join(tempDir, `collage-${id}.jpg`);
    const videoPath = path.join(tempDir, `video-${id}.mp4`);

    try {
        // 1. MICROLINK SCREENSHOT (OFFLOAD RAM)
        const micUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;
        const response = await axios({ url: micUrl, responseType: 'arraybuffer' });
        await fs.writeFile(shotPath, response.data);

        // 2. SHARP COLLAGE
        const bg = await sharp({
            create: { width: 1080, height: 1920, channels: 3, background: { r: 15, g: 23, b: 42 } }
        }).jpeg().toBuffer();

        const fg = await sharp(shotPath).resize(900, 1600, { fit: 'inside' }).toBuffer();

        await sharp(bg).composite([{ input: fg, gravity: 'center' }]).toFile(collagePath);

        // 3. FFMPEG PANNING VIDEO
        await new Promise((resolve, reject) => {
            ffmpeg(shotPath)
                .loop(5).fps(20)
                .videoFilters(['scale=720:2500', 'crop=720:1280:0:0', 'scale=720:1280'])
                .videoCodec('libx264').outputOptions(['-preset ultrafast', '-pix_fmt yuv420p'])
                .save(videoPath).on('end', resolve).on('error', reject);
        });

        // SEND DATA (HANDSHAKE FIX)
        res.json({
            screenshot: (await fs.readFile(shotPath)).toString('base64'),
            collage: (await fs.readFile(collagePath)).toString('base64'),
            video: (await fs.readFile(videoPath)).toString('base64')
        });

        // CLEANUP
        await Promise.all([fs.unlink(shotPath), fs.unlink(collagePath), fs.unlink(videoPath)]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(process.env.PORT || 3000);
