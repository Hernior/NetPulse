# NetPulse

Free, local-first, open-source network monitoring dashboard with zero npm dependencies. UI in Brazilian Portuguese.

## Quick start (Windows)

1. Install Node.js 22+ (https://nodejs.org/).
2. Double-click `INICIAR-WINDOWS.bat`.
3. Open http://127.0.0.1:8787.

The backend must stay running. For optional start at Windows login, run `CONFIGURAR-INICIO-WINDOWS.bat`; use `DESATIVAR-INICIO-WINDOWS.bat` to undo. A packaged standalone .exe is not included.

Linux/macOS (with `ping` and `traceroute` installed): `node server.js`. Optional Linux Docker setup: `docker compose up --build -d` (host networking). Windows Docker is not a supported deployment method yet.

## Monitoring features

- ICMP pings to Cloudflare, Google, Quad9, OpenDNS, and local gateway when detectable
- HTTPS availability and separate DNS name-resolution test
- Configurable custom ICMP, TCP, HTTPS endpoints (up to 12)
- Visual live status, per-target packet loss, latency and sample-to-sample jitter
- JSON incident records (start, recovery and duration) under `dados/quedas.json`
- Persistent newline-delimited JSON samples at `dados/amostras.ndjson`, with configurable retention (daily prune)
- Historical summary for 24 hours / 7 days / 30 days
- Automatic/manual traceroute and a diagnostic overview
- Audible alerts (browser tab must stay open and audio must be enabled)
- Optional Telegram bot alerts for suspected general outages and recovery
- Printer-friendly PDF report page: **Print > Save as PDF**, with ISP and support ticket fields
- CSV session export and incident JSON export
- Local settings at `dados/config.json` (contains the Telegram token if configured; do not publish)

Telegram, custom endpoints, Windows startup, Docker, and traceroute automation are optional. No cloud registration is required. Network monitoring continues with the browser closed as long as the Node process stays running. Telegram alerts naturally require connectivity to Telegram and may not be delivered during an outage.

## Limitations

Ping/HTTPS tests are heuristic signals and cannot certify an ISP outage. A server may block ICMP. Browser PDF export requires a user to select **Save as PDF**. No direct server-rendered PDF, speed test, SMTP, remote dashboard, native Windows Service, embedded SQLite database, signed Windows binary, or macOS packaging is provided in this release. A Windows login-start shortcut is not the same thing as a system service.

The storage format is JSON/NDJSON rather than SQLite: no database installation is required. Monitoring pauses if the machine is off, asleep or the Node process stops. Reported sample availability is not contractual SLA.

## Privacy and security

The dashboard server binds to `127.0.0.1` only and restricts browser origins; do not expose it publicly. All logs stay local except explicitly enabled Telegram messages or outbound connectivity probes. Credentials are stored locally in plaintext in `dados/config.json`, which is Git-ignored. Avoid sharing this file.

## License

MIT. See `LICENSE`.
