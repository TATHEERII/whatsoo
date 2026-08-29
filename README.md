# MultiSaaS WhatsApp Campaigner

A multi-tenant SaaS platform for managing WhatsApp bulk messaging campaigns with advanced anti-detection obfuscation, a custom SQLite-backed job queue, and Google OAuth authentication.

## Features

- **Google OAuth Authentication** — Secure sign-in via NextAuth v5 and Google provider
- **Contact Management** — Organize contacts into lists with CSV import support
- **Campaign Builder** — Create, schedule, and run WhatsApp messaging campaigns
- **Job Queue System** — Reliable delivery with retries, backoff, and progress tracking
- **Anti-Detection Obfuscation** — Invisible characters, bullet substitution, and whitespace padding to reduce spam flags
- **Real-time Status** — Connect/disconnect WhatsApp sessions and monitor campaign progress
- **Campaign Analytics** — Detailed logs and delivery statistics per campaign
- **Multi-tenant Architecture** — Isolated user data with role-based access

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| UI | React 18, Tailwind CSS 3.4, Lucide Icons |
| Auth | NextAuth v5 (beta) with Google Provider |
| ORM | Prisma 7 |
| Database | SQLite via @prisma/adapter-libsql (Turso-compatible) |
| WhatsApp | whatsapp-web.js (Puppeteer-based) |
| Queue | Custom SQLite-backed job queue with polling scheduler |
| Forms | React Hook Form + Zod validation |
| Utilities | date-fns, uuid, csv-parse/csv-writer, qrcode-terminal |

## Quick Start

### Prerequisites

- Node.js >= 18
- npm or pnpm
- A Google Cloud project with OAuth 2.0 credentials
- (Optional) Turso account for remote database

### Installation

```bash
git clone <repository-url>
cd multisaas-whatsapp-campaigner
npm install
```

### Environment Setup

Copy `.env.local` or edit `.env` with your configuration:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### Database

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 and sign in with Google.

## Usage Flow

1. **Sign In** — Authenticate via Google OAuth at `/auth/login`
2. **Connect WhatsApp** — Navigate to WhatsApp settings and scan the QR code with your phone
3. **Import Contacts** — Create contact lists and upload contacts via CSV
4. **Create Campaign** — Select a contact list, set a message template, and choose a delay strategy
5. **Start Campaign** — The scheduler enqueues jobs and begins processing messages with configurable delays
6. **Monitor** — View real-time logs, delivery stats, and queue status from the campaign detail page
7. **Manage** — Stop, retry, or delete campaigns as needed

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── campaigns/
│   │   │   ├── [id]/
│   │   │   │   ├── control/route.ts
│   │   │   │   ├── logs/route.ts
│   │   │   │   ├── start/route.ts
│   │   │   │   └── stats/route.ts
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── contact-lists/
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts
│   │   │   │   └── upload/route.ts
│   │   │   └── route.ts
│   │   ├── contacts/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── scheduler/route.ts
│   │   └── whatsapp/
│   │       ├── connect/route.ts
│   │       └── status/route.ts
│   ├── auth/login/page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── campaigns/
│   │   │   ├── new/page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   └── page.tsx
│   │   └── contacts/page.tsx
│   ├── layout.tsx
│   ├── page.tsx
│   └── providers.tsx
├── auth.ts
├── lib/
│   ├── prisma.ts
│   ├── sqliteQueue/index.ts
│   └── whatsapp/engine.ts
└── middleware.ts
prisma/
└── schema.prisma
```

## Database Models

### User
Core authentication entity. Stores profile info, password (optional), phone number, and role.

### Account / Session / VerificationToken
NextAuth-managed tables for OAuth sessions and email verification.

### ContactList
Named grouping of contacts owned by a user. Supports description and bulk contact management.

### Contact
Individual contact with name, phone number, and optional email. Belongs to a ContactList and a User.

### Campaign
Defines a messaging campaign with name, description, template reference, scheduled time, and status (draft, running, stopped, completed).

### CampaignLog
Immutable delivery record per recipient. Tracks status (sent, failed), message ID, error details, and timestamp.

### JobQueue
The core scheduling model. Each row represents a single message job with:
- `status`: pending, processing, completed, failed
- `attempts` / `maxAttempts`: Retry counters
- `scheduledAt`: Delivery deadline
- `processedAt` / `completedAt`: Lifecycle timestamps
- Indexed by (campaignId, status, scheduledAt) for efficient polling

## Queue System

The platform uses a **custom SQLite-backed job queue** (src/lib/sqliteQueue/index.ts) instead of an external broker.

### How It Works

1. **Enqueue** — When a campaign starts, all contacts from the selected list are transformed into JobQueue rows with calculated scheduledAt timestamps based on the chosen delay strategy.
2. **Scheduler** — A setInterval loop polls every 30 seconds for pending jobs whose scheduledAt <= now.
3. **Locking** — Jobs are atomically transitioned from pending -> processing using updateMany to prevent double-processing.
4. **Execution** — The WhatsAppEngine.sendText() method dispatches the (obfuscated) message.
5. **Completion** — On success, the job is marked completed and a CampaignLog is created.
6. **Retries** — On failure, exponential backoff is applied (2^attempts * 1000ms). After maxAttempts, the job is marked failed.
7. **Completion Check** — After every terminal state change, the queue verifies whether all jobs for the campaign are done and transitions the Campaign to completed.

### Delay Strategies

| Strategy | Behavior |
|----------|----------|
| fixed | Constant interval (ms) between messages |
| random | Random interval between 0 and the configured value |
| progressive | Increasing delay: delayValue * (contactIndex + 1) |

## Anti-Detection Obfuscation

WhatsApp aggressively flags bulk automated messages. The engine (src/lib/whatsapp/engine.ts) applies layered obfuscation to reduce detection risk:

### Invisible Characters
Zero-width Unicode characters (\u200B, \u200C, \u200D, \u2060, \uFEFF) are randomly injected between characters at a configurable density (default 10%). These are invisible in most renderers but alter the message fingerprint.

### Bullet Substitution
A configurable ratio (default 30%) of regular characters are replaced with \u2022 (•). Punctuation and whitespace are preserved to maintain readability.

### Trailing Whitespace
Configurable number of trailing spaces is appended to each line, creating unique message hashes per send.

### Options

```ts
interface ObfuscationOptions {
  enabled?: boolean;
  dotReplaceRatio?: number;
  invisibleCharDensity?: number;
  preserveLineBreaks?: boolean;
  preservePunctuation?: boolean;
  trailingSpacesCount?: number;
}
```

Options are configurable per engine instance and applied automatically to all outgoing text and captions.

## Deployment Notes

### Platform
- **Recommended**: Vercel, Railway, or any Node.js-compatible host
- **Database**: For production, switch DATABASE_URL from local SQLite to a Turso/libSQL remote instance for durability and concurrency

### Environment Variables
Ensure all variables are set in your hosting provider's environment configuration:

| Variable | Purpose |
|----------|---------|
| DATABASE_URL | Prisma datasource (local file or libsql://...) |
| TURSO_AUTH_TOKEN | Auth token for remote Turso databases |
| NEXTAUTH_SECRET | Session signing key (generate with openssl rand -base64 32) |
| NEXTAUTH_URL | Public-facing URL of your deployed app |
| GOOGLE_CLIENT_ID | OAuth 2.0 client ID from Google Cloud Console |
| GOOGLE_CLIENT_SECRET | OAuth 2.0 client secret |

### Headless Browser
whatsapp-web.js requires a headless Chromium instance. In serverless or containerized environments:
- Ensure your host supports Puppeteer/Chromium
- Set appropriate memory limits (WhatsApp Web is memory-intensive)
- Consider using puppeteer-core with a pre-installed Chrome binary for Docker deployments

### Build

```bash
npm run build
npm run start
```

## Google OAuth Setup

1. Go to Google Cloud Console
2. Create a new project or select an existing one
3. Navigate to APIs & Services -> Credentials
4. Click Create Credentials -> OAuth 2.0 Client ID
5. Select Web application
6. Add authorized redirect URIs:
   - http://localhost:3000/api/auth/callback/google (development)
   - https://your-domain.com/api/auth/callback/google (production)
7. Copy the Client ID and Client Secret
8. Paste them into your .env file as GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
9. In the Google Cloud Console, enable the Google People API under APIs & Services -> Library
10. In OAuth consent screen, add the profile and email scopes and submit for verification if deploying publicly

## License

MIT
