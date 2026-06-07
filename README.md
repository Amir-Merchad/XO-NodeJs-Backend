# XO-NodeJs-Backend

## Railway setup

Attach a PostgreSQL database to the Railway backend service. Railway should expose
`DATABASE_URL` to this service automatically.

The backend stores players, friends, direct messages, and party history in
PostgreSQL when `DATABASE_URL` exists. Without `DATABASE_URL`, it falls back to a
local `.data/social-store.json` file for development.

## Voice chat setup

Voice chat needs TURN servers to work reliably across different networks. STUN
alone may work on the same Wi-Fi, but it will fail for some home/mobile NATs.

Set these Railway variables with credentials from a TURN provider:

```bash
TURN_URLS=turn:your-turn-host:3478,turns:your-turn-host:5349
TURN_USERNAME=your-username
TURN_CREDENTIAL=your-password
```

Optional:

```bash
STUN_URLS=stun:stun.l.google.com:19302
VOICE_FORCE_RELAY=true
```

Use `VOICE_FORCE_RELAY=true` only when testing TURN, because it forces all voice
traffic through TURN.

Install dependencies before pushing if you are working locally:

```bash
npm install
```
