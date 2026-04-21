# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Run bot locally (loads .env automatically)
pnpm start        # Run bot in production mode
pnpm typecheck    # TypeScript type checking
pnpm lint         # Lint TypeScript files
pnpm format       # Format with Prettier
```

No test suite exists yet — `pnpm test` is a no-op placeholder.

## Architecture

AutoWOD is a headless browser bot that automatically books CrossFit sessions on WODBuster-powered gym platforms. It runs on a cron schedule via GitHub Actions.

**Main flow (`src/index.ts`):**
1. Launch Puppeteer (headless in CI, headed locally — detected via `CI` env var)
2. Solve Cloudflare Turnstile CAPTCHA via 2Captcha API (CI only)
3. Authenticate with email/password (optional 2FA device selection)
4. Navigate the reservations page and book sessions for each upcoming day
5. Log a summary of results (booked / waitlisted / already booked / skipped)

**Services (`src/services/`):**
- `auth.ts` — login form submission and 2FA handling
- `captcha.ts` — injects `scripts/captcha-interceptor.js` into the page to intercept Turnstile parameters, sends them to 2Captcha, then injects the token back
- `reservation.ts` — iterates over available days, reads button state labels (Spanish: "Entrenar" = available, "Avisar" = waitlist, "Borrar" = already booked), and performs bookings

**Configuration (`src/config.ts`):**
All config is loaded from environment variables. The `.env.example` file lists every variable. Key ones:

| Variable | Purpose |
|---|---|
| `EMAIL`, `PASSWORD` | Gym account credentials |
| `TWO_CAPTCHA_API_KEY` | 2Captcha API key for CAPTCHA solving |
| `BASE_URL` | Gym's WODBuster URL |
| `MONDAY`–`SUNDAY` | Preferred time slot per day (24h format, e.g. `17:00`) |
| `AVAILABLE_DAYS` | Booking horizon in days (default: 7) |
| `CI` | Set by GitHub Actions; enables headless mode and CAPTCHA solving |

Copy `.env.example` to `.env` for local development.

## GitHub Actions

The workflow in `.github/workflows/` runs the bot on a cron schedule. Secrets map directly to the environment variables above. The `CI=true` flag is what switches the bot from local (headed browser, no CAPTCHA) to cloud (headless, CAPTCHA solving enabled) mode.
