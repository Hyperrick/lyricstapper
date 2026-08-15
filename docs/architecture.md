# Architecture

lyricstapper is a local-first browser application with no application backend.

## Responsibilities

- `app/components/` contains the editor surfaces and interaction components.
- `app/lib/captions.ts` owns caption parsing, timing distribution and text exports.
- `app/lib/captionStyle.ts` owns style defaults, presets and normalization.
- `app/lib/projectFile.ts` owns the versioned project-file contract.
- `app/lib/mediaLibrary.ts` isolates browser file-handle persistence.
- `app/lib/videoExport.ts` isolates the lazy-loaded MP4 rendering pipeline.
- `worker/` is a thin web delivery adapter and contains no product logic.

The source media never crosses a network boundary. Project persistence is an
explicit file export; optional remembered file handles live in IndexedDB.

## Performance

The editor loads independently from the MP4 encoder. Mediabunny is imported
only when a user starts an MP4 export, keeping the primary interaction bundle
small. Video rendering uses an `OffscreenCanvas` and does not mutate the source
file.

## Format evolution

Project files include a `format` discriminator and numeric `version`. Parsers
normalize imported values at the boundary. New fields should remain optional
until a versioned migration path exists.
