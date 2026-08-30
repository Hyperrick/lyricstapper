# Changelog

Notable user-facing changes are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and intends to use
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) after its first tag.

## [Unreleased]

## [0.1.0] - 2026-08-30

### Added

- Manual line tagging and detailed line and word timing
- JSON, SRT, ASS and lyricstapper project import and export
- Local captioned MP4 rendering
- Caption presets, custom positioning and progressive word highlighting
- Docker-based self-hosting with an unprivileged runtime and health check
- Browser, Docker, privacy, security and contribution documentation
- Export and project-file golden tests plus a container smoke test in CI
- A real workflow demo with a CC BY 4.0 vocal excerpt and its timed lyrics

### Fixed

- Kept timing progress and export availability limited to complete time ranges
- Prevented saving project files without a valid media reference
- Preserved legacy media-less projects, end-only project lines and caption JSON
- Kept marked caption and ASS karaoke timing inside their exported duration
- Returned keyboard focus to the global timing controls after starting playback
- Preserved native keyboard activation for buttons and other editor controls

### Security

- Added common validation limits for project, JSON, SRT and ASS imports
- Added strict caption-style, media-metadata and timing validation
- Added CSP, framing, MIME-sniffing, referrer and permissions response headers
- Bound the default Docker port to loopback

[Unreleased]: https://github.com/Hyperrick/lyricstapper/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Hyperrick/lyricstapper/releases/tag/v0.1.0
