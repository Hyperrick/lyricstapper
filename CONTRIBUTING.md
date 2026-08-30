# Contributing

Contributions should keep lyricstapper focused on manual lyric timing and local
export. Discuss large format, workflow or architecture changes in an issue before
implementation.

## Setup

Use the Node version pinned in `.nvmrc`:

```bash
nvm use
npm ci
npm run dev
```

## Before opening a pull request

Run the complete local gate:

```bash
npm run typecheck
npm run lint
npm test
docker compose build
```

Pull requests should explain the user-visible change, name the checks that ran
and include screenshots or recordings for UI changes. Call out any change to
`.lyricstapper.json` or legacy `.beatmark.json` compatibility.

## Code organization

- Keep editor surfaces in `app/components/editor/`.
- Keep browser, project-file, caption and media logic in `app/lib/`.
- Keep functions small and responsibility-focused.
- Add deterministic tests for parsers, timing, serialization and layout behavior.
- Preserve the current project-format version unless a migration is included.

See [docs/architecture.md](docs/architecture.md) and [AGENTS.md](AGENTS.md) for
the detailed repository conventions.

## Test material

Never commit music, lyrics, cover art, fonts or video unless their redistribution
rights are documented. Use synthetic text and generated tones for tests and bug
reproductions. Remove local file paths and personal metadata from screenshots.

## Security reports

Follow [SECURITY.md](SECURITY.md). Do not disclose a vulnerability or private
project data in a public issue.
