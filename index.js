const express = require('express');
const ytdl = require('ytdl-core');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');
const path = require('path');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());  // Enable CORS

// Function to sanitize filenames
const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
};

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/convert', async (req, res) => {
    const videoUrl = req.body.url;
    console.log('Received request to convert URL:', videoUrl);

    if (!videoUrl || typeof videoUrl !== 'string') {
        console.error('Invalid request: No URL provided');
        return res.status(400).json({ success: false, message: 'Invalid request: No URL provided' });
    }

    try {
        console.log('Fetching video info...');
        const info = await ytdl.getInfo(videoUrl);
        console.log('Video info fetched:', info);

        const videoTitle = sanitizeFilename(info.videoDetails.title);
        console.log('Sanitized video title:', videoTitle);

        console.log('Starting audio stream...');
        const stream = ytdl(videoUrl, { quality: 'highestaudio', filter: 'audioonly' });
        const passthrough = new PassThrough();

        res.setHeader('Content-Disposition', `attachment; filename="${videoTitle}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');

        ffmpeg(stream)
            .setFfmpegPath(ffmpegPath)
            .audioBitrate(128)
            .format('mp3')
            .on('start', () => {
                console.log('Starting conversion');
            })
            .on('end', () => {
                console.log('Conversion finished');
            })
            .on('error', (err) => {
                console.error('Error during conversion:', err.message);
                passthrough.destroy(err);  // Stop streaming on error
                res.status(500).json({ success: false, message: `An error occurred during the conversion process: ${err.message}` });
            })
            .pipe(passthrough);

        passthrough.pipe(res);

    } catch (error) {
        console.error('Error processing video URL:', videoUrl, error.message);
        res.status(500).json({ success: false, message: `An error occurred while processing the video: ${error.message}` });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

module.exports = app;
