# XO-NodeJs-Backend

## Railway setup

Attach a PostgreSQL database to the Railway backend service. Railway should expose
`DATABASE_URL` to this service automatically.

The backend stores players, friends, direct messages, and party history in
PostgreSQL when `DATABASE_URL` exists. Without `DATABASE_URL`, it falls back to a
local `.data/social-store.json` file for development.

Install dependencies before pushing if you are working locally:

```bash
npm install
```
