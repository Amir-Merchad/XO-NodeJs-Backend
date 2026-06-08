# XO-NodeJs-Backend

## Railway setup

Attach a PostgreSQL database to the Railway backend service. Railway should expose
`DATABASE_URL` to this service automatically.

The backend stores players, friends, direct messages, and party history in
PostgreSQL when `DATABASE_URL` exists. Without `DATABASE_URL`, it falls back to a
local `.data/social-store.json` file for development.

After deploy, open this URL to confirm Railway is using PostgreSQL:

```text
https://your-railway-backend-url/social-store-status
```

You should see `"mode":"postgres"` and `"databaseReachable":true`. The endpoint
only returns counts and storage status, not player names, friend lists, or chat
messages.

## Voice and video chat setup

Voice and video chat need TURN servers to work reliably across different
networks. STUN alone may work on the same Wi-Fi, but it will fail for some
home/mobile NATs.

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
and video traffic through TURN.

## Push notifications setup

Push notifications use Firebase Cloud Messaging. The backend stays runnable
without Firebase credentials, but push notifications only send after you set one
of these Railway variables:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

or:

```bash
FIREBASE_SERVICE_ACCOUNT_BASE64=base64-encoded-service-account-json
```

The JSON comes from Firebase Console -> Project settings -> Service accounts ->
Generate new private key. Keep it private and never put it in the Flutter app.

Install dependencies before pushing if you are working locally:

```bash
npm install
```
