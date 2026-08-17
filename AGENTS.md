# Repository Guidelines

## Project Structure & Module Organization

- `app/` contains the React app: routes are in `app/page.tsx` and `app/layout.tsx`, and global styling is in `app/globals.css`.
- Put reusable UI in `app/components/`; editor surfaces belong in `app/components/editor/`. Keep browser, media, caption, and project-file logic in `app/lib/`.
- `worker/index.ts` is the Cloudflare worker entry point; `tests/` contains Node test files.
- Consult `docs/architecture.md` before changing project formats, media processing, or caption timing.

## Build, Test, and Development Commands

Requires Node.js 22.13+; install with `npm install`.

```bash
npm run dev        # Starts the local Vinext/Cloudflare development server
npm run build      # Produces the deployable app in dist/
npm run start      # Runs the built application locally
npm run typecheck  # Runs TypeScript without emitting files
npm run lint       # Runs ESLint across the repository
npm test           # Builds, then runs the rendered-HTML test suite
```

Run `npm run typecheck`, `npm run lint`, and `npm test` before opening a pull request. Use `docker compose up --build` to verify the containerized app.

## Coding Style & Naming Conventions

Write TypeScript and React with two-space indentation, semicolons, and double-quoted strings. Use PascalCase for components and filenames (`LyricsTable.tsx`) and camelCase for functions and variables (`exportCaptions`). Organize by responsibility: orchestration, UI, media access, caption calculations, and serialization belong in separate modules. Refactor files as they approach 600 lines; `npm test` enforces a hard maximum of 800 physical lines for source and configuration files. ESLint is the source of truth for quality and accessibility rules.

## Testing Guidelines

Add or update tests in `tests/` for observable behavior. Name them as complete statements, such as `test("server-renders the lyricstapper workspace", ...)`. The suite imports the production build and checks the 800-line limit, so run `npm test` after rendering, routing, or structural changes. Favor deterministic unit tests for timing and file-format logic.

## Commit & Pull Request Guidelines

Use short imperative summaries, such as `Add SRT export validation`, and keep commits narrowly scoped. Pull requests should explain user-visible changes, list checks, link issues, and include screenshots or recordings for UI changes. Call out `.lyricstapper.json` or legacy `.beatmark.json` compatibility changes.

## Security & Local Media

This app is local-first: do not add uploads, transcription services, or telemetry without explicit approval. Keep secrets in ignored `.env*` files. Preserve source media and project-file compatibility when changing import, export, or IndexedDB behavior.
