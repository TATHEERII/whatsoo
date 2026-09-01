# whatsapp-engine

Standalone service that hosts a `whatsapp-web.js` client and exposes a small
HTTP API. The Next.js app on Vercel calls this service instead of running the
WhatsApp engine inline (which is impossible on Vercel serverless).

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | HTTP port the server listens on. |
| `ENGINE_TOKEN` | _(none)_ | Bearer token required by all routes except `/health`. If unset, auth is skipped (dev mode). |
| `SESSION_DIR` | `.wwebjs_auth` in cwd | Directory where the WhatsApp session is stored. Mount a volume here for persistence. |
| `PUPPETEER_EXECUTABLE_PATH` | _(bundled)_ | Path to a Chromium/Chrome binary. If unset, Puppeteer's bundled Chromium is used. |
| `NODE_ENV` | _(none)_ | Set to `production` in the Docker image. |

## Running locally

```sh
npm install
npm run build
npm start
```

The server needs a working Chromium. On Linux, install Chromium via your package
manager and optionally point `PUPPETEER_EXECUTABLE_PATH` at it. The Dockerfile
installs system Chromium automatically.

## API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | no | Liveness probe. |
| GET | `/status` | yes | Returns `{ state, ready, qr, phoneNumber }`. |
| POST | `/connect` | yes | Starts initialization (QR emitted over SSE). |
| POST | `/disconnect` | yes | Body `{ clearSession?: boolean }`. |
| POST | `/send` | yes | Body `{ to, text?, filePath?, mediaType? }`. |
| GET | `/events` | yes | Server-Sent Events stream. |
