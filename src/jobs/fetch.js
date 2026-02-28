import 'dotenv/config';
import db from '../lib/db.js';
import { enrichFeedItem } from '../lib/article.js';
import { fetchTelegramS } from '../lib/sources.js';
import { hashOf } from '../lib/util.js';
import { buildDuplicateKey, loadScoringConfig, scoreCandidate } from '../lib/scoring.js';

const src = process.env.SOURCE_TELEGRAM_S;
if (!src) throw new Error('SOURCE_TELEGRAM_S missing');

const items = await fetchTelegramS(src);
const scoringConfig = loadScoringConfig();
const ins = db.prepare(`
  INSERT OR IGNORE INTO posts(
    source,intake_type,title,url,source_url,duplicate_key,body,published_at,hash,score,score_details,workflow_status,priority
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

let n = 0;
for (const rawItem of items) {
  const it = await enrichFeedItem(rawItem);
  const duplicateKey = buildDuplicateKey(it);
  const h = hashOf(duplicateKey);
  const ranked = scoreCandidate(
    {
      source: it.source,
      title: it.title,
      body: it.body,
      publishedAt: it.publishedAt,
    },
    scoringConfig
  );
  const info = ins.run(
    it.source,
    'feed',
    it.title,
    it.url,
    it.sourceUrl,
    duplicateKey,
    it.body,
    it.publishedAt,
    h,
    ranked.score,
    JSON.stringify(ranked.details),
    ranked.isPolitical ? 'rejected' : 'candidate',
    0
  );
  n += info.changes;
}
console.log(`fetched=${items.length} inserted=${n}`);
