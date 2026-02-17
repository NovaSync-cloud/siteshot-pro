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
        // 1. FULL PAGE CAPTURE
        const micUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&screenshot.full_page=true&screenshot.type=png&screenshot.width=1280`;
        const response = await axios({ url: micUrl, responseType: 'arraybuffer' });
        await fs.writeFile(shotPath, response.data);

        // 2. PRO COLLAGE
        const background = await sharp({
            create: { width: 1080, height: 1920, channels: 3, background: { r: 15, g: 23, b: 42 } }
        }).jpeg().toBuffer();

        const foreground = await sharp(shotPath)
            .resize(900, null)
            .extract({ left: 0, top: 0, width: 900, height: 1400 })
            .toBuffer();

        await sharp(background).composite([{ input: foreground, gravity: 'center' }]).toFile(collagePath);

        // 3. 10-SECOND CINEMATIC VIDEO
        await new Promise((resolve, reject) => {
            const duration = 10; 
            ffmpeg(shotPath)
                .loop(duration)
                .fps(25)
                .videoFilters([
                    `scale=720:-1`, 
                    `crop=720:1280:0:ih*t/${duration}-1280*t/${duration}`
                ])
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
        res.status(500).json({ error: "Generation failed. The page might be too long." });
    }
});

app.listen(process.env.PORT || 3000);
