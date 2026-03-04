import { execFileSync } from 'node:child_process';

const CLAUDE_BIN = '/home/zaff/.local/bin/claude';

function cleanText(s = '') {
  return String(s).replace(/\s+/g, ' ').trim();
}

function bulletCount(s = '') {
  return (String(s).match(/^\s*–\s+/gm) || []).length;
}

function parsePost(text = '') {
  const trimmed = (text || '').trim();
  const lines = trimmed.split('\n');

  // First line must be "Source: Title"
  const firstLine = lines[0] || '';
  const colonIdx = firstLine.indexOf(':');
  if (colonIdx < 0) return null;
  const title_uz = firstLine.slice(colonIdx + 1).trim();

  // Body: everything after first line, stripped of trailing "Changal24"
  const body = lines.slice(1).join('\n').trim().replace(/\n*Changal24\s*$/i, '').trim();

  if (body.length < 60 || bulletCount(body) < 3) return null;

  // Extract one-sentence description (text before first bullet)
  const bulletStart = body.search(/^–\s+/m);
  const body_uz = bulletStart > 0 ? cleanText(body.slice(0, bulletStart)) : '';

  return {
    title_uz: cleanText(title_uz),
    body_uz,
    tldr_uz: body,
    is_political: false,
  };
}

function callClaude(prompt, model) {
  const args = ['--print', '--output-format', 'json', '--permission-mode', 'bypassPermissions', '--model', model];
  const raw = execFileSync(CLAUDE_BIN, args, {
    input: prompt,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
    env: { ...process.env, CLAUDECODE: undefined },
  });
  const envelope = JSON.parse(raw);
  return parsePost((envelope?.result || '').trim());
}

export async function localizeNews({ title = '', body = '', url = '' }) {
  const model = process.env.CLAUDE_MODEL || 'sonnet';

  const prompt = `You write posts for a Telegram technology feed called Changal24.

Your task: convert a technology news item, article, tweet, HackerNews post, GitHub project, or announcement into a very concise Telegram TL;DR post.

Audience: developers, AI enthusiasts, startup founders.

Language: Uzbek (latin).

Goal: the reader must understand the news in 5–10 seconds.
The post must fit roughly one iPhone screen.

--------------------------------

STRICT OUTPUT FORMAT (must always follow):

source: title

One short sentence explaining what the thing/news is.

– fact
– fact
– fact
– fact
– fact

Changal24

--------------------------------

RULES

1. The first line MUST always be exactly:
source: title

Examples of source names:
HN, GitHub, Blog, Paper, X, Reddit, Company, Docs.

Example:
HN: New Rust package manager released

2. The title must summarize the news clearly and neutrally.

3. The second line explains in one short sentence what the project/news is.

4. Then write 4–6 bullet points with key facts.

5. Bullet points must be:
– short
– factual
– easy to scan
– preferably under ~10 words.

6. Focus on concrete information, such as:
– what it is
– what problem it solves
– who built it
– key features
– notable numbers (stars, users, funding, votes)
– release or milestone

7. Remove fluff, hype, and marketing language.

8. Do NOT repeat the same information across bullets.

9. Do NOT write long sentences or paragraphs.

10. No emojis.

11. Maximum 6 bullets.

12. Always end the post with exactly:

Changal24

13. Output ONLY the final Telegram post.

--------------------------------

CONTENT EXTRACTION STRATEGY

When given an article, tweet, or link:

1. Identify the main thing (project, release, research, tool, news).
2. Extract the 5 most important facts.
3. Prefer objective information over opinions.
4. Remove background history unless essential.
5. Compress wording to make it Telegram-scannable.

--------------------------------

EXAMPLE OUTPUT

HN: /e/OS — deGoogled Android

/e/OS — Google servislarisiz ishlaydigan ochiq manbali Android tizimi.

– LineageOS asosida yaratilgan
– Google servislarisiz ishlaydi
– Kuzatuv va telemetry olib tashlangan
– Maxfiylik ilovalari bilan keladi
– e.foundation tomonidan rivojlantiriladi

Changal24

--------------------------------

URL: ${url}
Title: ${title}
Content: ${body.slice(0, 6000)}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = callClaude(prompt, model);
      if (result) return result;
      console.log(`tldr_attempt_${attempt}_bad_format`);
    } catch (err) {
      console.log(`tldr_attempt_${attempt}_error`, err?.message?.slice(0, 80));
    }
  }
  return null;
}
