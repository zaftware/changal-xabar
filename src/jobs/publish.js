import 'dotenv/config';
import db from '../lib/db.js';
import { localizeNews } from '../lib/tldr.js';
import { execFileSync } from 'node:child_process';

const target = process.env.TELEGRAM_TARGET;
if (!target) throw new Error('TELEGRAM_TARGET missing');

const row = db
  .prepare(`SELECT * FROM posts WHERE published_to_tg=0 AND url NOT LIKE 'https://t.me/%' ORDER BY score DESC, id DESC LIMIT 1`)
  .get();
if (!row) {
  console.log('nothing_to_publish');
  process.exit(0);
}

const loc = await localizeNews({ title: row.title, body: row.body });

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
const text = `${process.env.BRAND || 'Changal 24'}: ${title}\n\n${loc.tldr_uz}\n\nManba: ${row.url}`;
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
