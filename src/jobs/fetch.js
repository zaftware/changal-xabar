import 'dotenv/config';
import db from '../lib/db.js';
import { fetchTelegramS } from '../lib/sources.js';
import { hashOf } from '../lib/util.js';

const src = process.env.SOURCE_TELEGRAM_S;
if (!src) throw new Error('SOURCE_TELEGRAM_S missing');

const items = await fetchTelegramS(src);
const ins = db.prepare(`
  INSERT OR IGNORE INTO posts(
    source,title,url,source_url,body,published_at,hash,score
  ) VALUES (?,?,?,?,?,?,?,?)
`);

let n = 0;
for (const it of items) {
  const h = hashOf((it.url || '') + '|' + (it.title || ''));
  const score = Math.min(100, (it.body?.length || 0) / 30);
  const info = ins.run(it.source, it.title, it.url, it.sourceUrl, it.body, it.publishedAt, h, score);
  n += info.changes;
}
console.log(`fetched=${items.length} inserted=${n}`);
