import 'dotenv/config';
import express from 'express';
import db from './lib/db.js';

const app = express();
const port = process.env.PORT || 8787;
app.use(express.static('public'));

app.get('/api/news', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id,title,title_uz,url,source_url,tldr_uz,is_political,published_at,score FROM posts WHERE is_political=0 ORDER BY id DESC LIMIT 100`
    )
    .all();
  res.json(rows);
});

app.get('/api/news/:id', (req, res) => {
  const row = db
    .prepare(
      `SELECT id,title,title_uz,url,source_url,body_uz,tldr_uz,is_political,published_at,score FROM posts WHERE id=? LIMIT 1`
    )
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

app.get('/news/:id', (req, res) => {
  const row = db
    .prepare(
      `SELECT id,title,title_uz,url,body_uz,tldr_uz,is_political,published_at FROM posts WHERE id=? LIMIT 1`
    )
    .get(req.params.id);
  if (!row) return res.status(404).send('Not found');
  const title = row.title_uz || row.title || 'Yangilik';
  const body = (row.body_uz || row.tldr_uz || '').replace(/</g, '&lt;');
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:Inter,system-ui;background:#0b0f14;color:#e9eef5;max-width:860px;margin:20px auto;padding:0 14px}a{color:#7cc4ff}.box{border:1px solid #1d2633;border-radius:12px;padding:14px;background:#111722;white-space:pre-wrap}</style></head><body><p><a href="/">← Orqaga</a></p><h1>${title}</h1><div class="box">${body}</div><p><a target="_blank" href="${row.url}">Asl manba</a></p></body></html>`);
});

app.get('/health', (_req, res) => res.send('ok'));
app.listen(port, () => console.log('up', port));
