# Security policy

## Supported versions

Security fixes land on `main`. Only the latest published release line receives
security updates.

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private
security-advisory form:

<https://github.com/Hyperrick/lyricstapper/security/advisories/new>

Include the affected version or commit, impact, reproduction steps and a minimal
proof of concept. Do not attach private music, lyrics, project files, API keys or
other personal data. A synthetic project file is preferred.

## Security boundary

lyricstapper is a local-first browser application:

- It has no account system, upload API, application database or telemetry.
- Media is opened as a local browser file and is not sent to the server.
- Remembered file and directory handles remain protected by browser permissions.
- Project, JSON, SRT and ASS imports are untrusted input and are validated before
  entering editor state.
- MP4 rendering happens locally through browser media APIs.

Deployment and reverse-proxy configuration remain the operator's responsibility.
Internet-facing deployments should use HTTPS, current container dependencies and
HSTS at the TLS-terminating proxy.
