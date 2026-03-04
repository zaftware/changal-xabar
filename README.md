# Changal 24

Uz-latin AI/tech news aggregator: title + TL;DR + link.

## Run
```bash
cp .env.example .env
npm install
npm run fetch
npm run publish
npm run start
```

`publish` uses the local `claude` CLI with your Claude Code subscription login for TL;DR generation.

## Deploy target
- `news.zaff.me` (public) for web dashboard
- Telegram channel posting via bot token
