# assets

Drop your media here. Files are picked up automatically by `script.js` —
this folder is intentionally empty so the project ships without anyone's photos.

| Put this file | And this happens |
| --- | --- |
| `photo.jpg` | main photo appears (`.jpeg` / `.png` / `.webp` also work) |
| `gallery-1.jpg` … `gallery-4.jpg` | square gallery appears |
| `song.mp3` | set `music.audioFile` in `script.js`, then a play button appears |
| `video.mp4` | set `video.videoFile` in `script.js`, then the video section appears |

Missing files are skipped silently — nothing breaks, nothing shows a broken image.

Tips for fast loading on a phone:

- Photos: keep each under ~500 KB. Roughly 1600 px on the long edge is plenty.
- Video: use H.264 MP4 (`.mp4`); it plays natively in Safari.
- Audio: MP3 or M4A plays natively in Safari.
