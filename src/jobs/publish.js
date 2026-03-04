import 'dotenv/config';
import db from '../lib/db.js';
import { localizeNews } from '../lib/tldr.js';
import { execFileSync } from 'node:child_process';

const target = process.env.TELEGRAM_TARGET;
if (!target) throw new Error('TELEGRAM_TARGET missing');

const SOURCE_NAME_MAP = new Map([
  ['reddit.com', 'Reddit'],
  ['news.ycombinator.com', 'Hacker News'],
  ['github.com', 'GitHub'],
  ['lesswrong.com', 'LessWrong'],
  ['x.com', 'X'],
  ['twitter.com', 'X'],
  ['youtube.com', 'YouTube'],
  ['youtu.be', 'YouTube'],
  ['arxiv.org', 'arXiv'],
  ['openai.com', 'OpenAI'],
  ['anthropic.com', 'Anthropic'],
  ['robservatory.com', 'Robservatory'],
  ['windowslatest.com', 'Windows Latest'],
  ['replicate.com', 'Replicate'],
  ['take.surf', 'take.surf'],
  ['ntik.me', 'Nick Tikhonov'],
]);

function toBrandCase(s = '') {
  return s
    .split(/[-._]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function sourceNameFromUrl(rawUrl = '') {
  try {
    const { hostname } = new URL(rawUrl);
    const host = hostname.replace(/^www\./, '');
    if (SOURCE_NAME_MAP.has(host)) return SOURCE_NAME_MAP.get(host);

    const parts = host.split('.');
    const base = parts.length >= 2 ? parts.at(-2) : host;
    return toBrandCase(base || 'Source');
  } catch {
    return 'Source';
  }
}

function isGoodFormat(loc) {
  if (!loc || !loc.tldr_uz) return false;
  const t = String(loc.tldr_uz).trim();
  if (t.length < 120) return false;
  const bullets = (t.match(/^\s*–\s+/gm) || []).length;
  if (bullets < 3) return false;
  if (/Qisqa:\s*manba yangiligini tekshirib ko‘ring\.?/i.test(t)) return false;
  return true;
}


const row = db
  .prepare(`SELECT * FROM posts WHERE published_to_tg=0 AND url NOT LIKE 'https://t.me/%' ORDER BY score DESC, id DESC LIMIT 1`)
  .get();
if (!row) {
  console.log('nothing_to_publish');
  process.exit(0);
}

const loc = await localizeNews({ title: row.title, body: row.body });

if (!isGoodFormat(loc)) {
  db.prepare(`UPDATE posts SET published_to_tg=-2, title_uz=?, body_uz=?, tldr_uz=? WHERE id=?`).run(
    loc?.title_uz || row.title,
    loc?.body_uz || '',
    loc?.tldr_uz || '',
    row.id
  );
  console.log('skip_bad_format', row.id);
  process.exit(0);
}

db.prepare(`
  UPDATE posts SET title_uz=?, body_uz=?, tldr_uz=?, is_political=?, published_to_tg=? WHERE id=?
`).run(loc.title_uz, loc.body_uz, loc.tldr_uz, loc.is_political ? 1 : 0, 0, row.id);

if (loc.is_political) {
  db.prepare(`UPDATE posts SET is_political=1, published_to_tg=-1, title_uz=?, body_uz=?, tldr_uz=? WHERE id=?`).run(
    loc.title_uz,
    loc.body_uz,
    loc.tldr_uz,
    row.id
  );
  console.log('skip_political', row.id);
  process.exit(0);
}

const title = loc.title_uz || row.title;
const sourceName = sourceNameFromUrl(row.url || row.source_url || '');
const footerUrl = 'https://t.me/changal_24';
const text = `[${sourceName}](${row.url}): ${title}\n\n${loc.tldr_uz}\n\n[Changal24](${footerUrl})`;
execFileSync('openclaw', ['message', 'send', '--channel', 'telegram', '--target', target, '--message', text], {
  stdio: 'inherit',
});

db.prepare(`UPDATE posts SET published_to_tg=1, title_uz=?, body_uz=?, tldr_uz=?, is_political=? WHERE id=?`).run(
  title,
  loc.body_uz,
  loc.tldr_uz,
  loc.is_political ? 1 : 0,
  row.id
);

console.log('published', row.id);
