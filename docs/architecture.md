# Architecture

lyricstapper is a local-first browser application with no application backend.

## Responsibilities

- `app/components/LyricTimestamper.tsx` orchestrates editor state and workflows.
- `app/components/editor/` contains responsibility-focused source, media, caption, style and export tools.
- `app/components/editor/EditorWorkspace.tsx` renders the application shell from
  typed state and action groups without owning editor domain state.
- `app/components/editor/useTimingKeyboardShortcuts.ts` owns global timing and
  playback keyboard bindings and their cleanup.
- `app/components/AppThemeProvider.tsx` owns the persisted system/light/dark preference.
- `app/theme/` contains the Astryx theme source and generated build artifacts.
- `app/lib/captions.ts` owns caption parsing, timing distribution and text exports.
- `app/lib/captionStyle.ts` owns style defaults, presets and normalization.
- `app/lib/importValidation.ts` owns shared size, text, timing and schema limits
  for project, JSON, SRT and ASS imports.
- `app/lib/projectFile.ts` owns the versioned project-file contract.
- `app/lib/mediaLibrary.ts` isolates browser file-handle persistence.
- `app/lib/videoExport.ts` isolates the lazy-loaded MP4 rendering pipeline.
- `worker/` is a thin web delivery adapter and contains no product logic.

The source media never crosses a network boundary. Project persistence is an
explicit file export; optional remembered file handles live in IndexedDB.

Text imports are treated as untrusted before they enter React state. The file is
size-checked before `File.text()` reads it, then every caption, word range,
project metadata field and caption-style value is validated. Format-specific
parsers may decode syntax, but they delegate their final structural checks to
`importValidation.ts`.

## Editor shell

The media stage is the stable workspace. Source, caption timing, styling and
export are task-focused inspector views rather than simultaneous permanent
columns. The inspector is docked on wide screens, becomes an overlay on
tablets and a bottom sheet on phones. Phone and compact-tablet navigation stays
available in a persistent bottom task bar.

The UI is built from Astryx components and a generated custom theme. Application
CSS is limited to the media canvas, timeline and adaptive workspace composition;
colors and controls inherit Astryx tokens so light, dark and system modes remain
consistent.

## Performance

The editor loads independently from the MP4 encoder. Mediabunny is imported
only when a user starts an MP4 export, keeping the primary interaction bundle
small. Video rendering uses an `OffscreenCanvas` and does not mutate the source
file.

## Format evolution

Project files include a `format` discriminator and numeric `version`. Parsers
normalize imported values at the boundary. New fields should remain optional
until a versioned migration path exists.

Version 1 project files may omit caption-style fields that were added later;
missing values receive the current defaults. Present but invalid values are
rejected. This preserves older files without allowing arbitrary style or ASS
metadata through the import boundary.

## Delivery security

`next.config.ts` applies CSP, frame, MIME-sniffing, referrer and permissions
headers to application responses. The CSP permits same-origin assets, local
`blob:` media and workers, inline framework bootstrap/style code and WebAssembly
needed by compatible media tooling. HSTS belongs at the HTTPS reverse proxy so
local HTTP development remains usable.

The default Compose port binds to loopback. Operators must make an explicit
choice before exposing the standalone server on another interface.
