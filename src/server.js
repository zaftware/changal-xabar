import 'dotenv/config';
import express from 'express';
import db from './lib/db.js';
import { execFile } from 'node:child_process';

const app = express();
const port = process.env.PORT || 8787;
const adminToken = process.env.CHANGAL_ADMIN_TOKEN || '';
app.use(express.json());
app.use(express.static('public'));

function requireAdmin(req, res, next) {
  if (!adminToken) return res.status(503).json({ error: 'admin_token_not_configured' });
  const token = req.headers['x-admin-token'];
  if (token !== adminToken) return res.status(401).json({ error: 'unauthorized' });
  next();
}

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

app.post('/api/publish-now', requireAdmin, (_req, res) => {
  execFile('/home/zaff/.local/share/mise/installs/node/24.14.0/bin/node', ['src/jobs/publish.js'], {
    cwd: '/home/zaff/.openclaw/workspace/changal-24',
    env: process.env,
  }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ ok: false, error: stderr || err.message });
    res.json({ ok: true, output: stdout?.trim() || 'published' });
  });
});

app.post('/api/post-custom', requireAdmin, (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text_required' });
  const target = process.env.TELEGRAM_TARGET;
  if (!target) return res.status(500).json({ error: 'telegram_target_missing' });

  execFile('openclaw', ['message', 'send', '--channel', 'telegram', '--target', target, '--message', text], {
    cwd: '/home/zaff/.openclaw/workspace/changal-24',
    env: process.env,
  }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ ok: false, error: stderr || err.message });
    res.json({ ok: true, output: stdout?.trim() || 'sent' });
  });
});

app.get('/health', (_req, res) => res.send('ok'));
app.listen(port, () => console.log('up', port));
