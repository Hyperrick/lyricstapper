# lyricstapper

Manual lyric timing for music. Paste known lyrics, hold a key while each line
is sung, refine line and word timing visually, then export subtitle files or a
captioned MP4.

> Tap your lyrics into time.

## Why

Most subtitle editors are built around spoken dialogue or automatic
transcription. lyricstapper is intentionally narrower: the lyrics already
exist, the music provides the timing, and the creator stays in control.

## Features

- Hold `Space` to mark the visible duration of each lyric line
- Separate Tag and Edit modes to prevent accidental timing changes
- Drag, trim and multi-select line or word blocks on a zoomable timeline
- Keep instrumental gaps free of captions
- Preview vertical and horizontal video without altering the source
- Style captions and active-word highlighting with presets
- Import JSON, SRT, ASS and lyricstapper project files
- Export SRT, styled karaoke ASS, word-timing JSON and project files
- Burn styled captions into an MP4 locally in the browser
- Keep source media on the device; no upload or transcription service

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
```

## Docker

```bash
docker compose up --build
```

The app is then available at <http://localhost:3000>. Media and projects remain
client-side; the container does not need a database or persistent volume.

## Project files

Project files use the suffix `.lyricstapper.json` and store lyrics, line and
word timing, caption styling and a reference to the original media file. They
do not embed the media itself. Browsers that support the File System Access API
can remember the selected local file handle after permission is granted.

Legacy `.beatmark.json` project files from the prototype remain importable.

## Scope

lyricstapper is a subtitle timing tool, not a video editor. It intentionally
does not cut media, add transitions, transcribe audio, translate lyrics or
upload files to a server.

## Technology

- React 19 and TypeScript
- vinext/Vite for the application build
- Mediabunny for local MP4 decoding and encoding
- Canvas rendering for caption-safe layout and word highlighting
- IndexedDB for optional local media-handle persistence

## License

[MIT](LICENSE)
