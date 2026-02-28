import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { strip } from './util.js';

const SKIP_HOST_PATTERNS = [
  't.me',
  'telegram.me',
  'twitter.com',
  'x.com',
  'reddit.com',
  'news.ycombinator.com',
];

function shouldSkipUrl(url = '') {
  return SKIP_HOST_PATTERNS.some((host) => url.includes(host));
}

function pickTitle($) {
  const candidates = [
    $('meta[property="og:title"]').attr('content'),
    $('meta[name="twitter:title"]').attr('content'),
    $('h1').first().text(),
    $('title').text(),
  ];
  return strip(candidates.find((value) => value && strip(value)) || '');
}

function pickDescription($) {
  const candidates = [
    $('meta[property="og:description"]').attr('content'),
    $('meta[name="description"]').attr('content'),
    $('meta[name="twitter:description"]').attr('content'),
  ];
  return strip(candidates.find((value) => value && strip(value)) || '');
}

function paragraphScore(text) {
  if (!text) return 0;
  let score = text.length;
  if (/\b(ai|model|llm|openai|anthropic|claude|gpt|api|chip|gpu|security|agent)\b/i.test(text)) score += 120;
  if (text.split(' ').length < 8) score -= 300;
  return score;
}

function pickParagraphs($) {
  const selectors = [
    'article p',
    'main p',
    '[role="main"] p',
    '.post-content p',
    '.entry-content p',
    '.article-content p',
    '.content p',
    'p',
  ];

  for (const selector of selectors) {
    const paragraphs = $(selector)
      .map((_, el) => strip($(el).text()))
      .get()
      .filter(Boolean)
      .filter((text) => paragraphScore(text) > 0);

    if (paragraphs.length >= 3) {
      return paragraphs.slice(0, 12).join('\n\n').slice(0, 8000);
    }
  }

  return '';
}

export async function fetchArticleContent(url) {
  if (!url || shouldSkipUrl(url)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; Changal24Bot/0.1; +https://news.zaff.me)',
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('text/html')) return null;

    const html = await response.text();
    const $ = cheerio.load(html);
    const title = pickTitle($);
    const description = pickDescription($);
    const body = pickParagraphs($);
    const descriptionIncluded = description && body && body.toLowerCase().includes(description.toLowerCase().slice(0, 80));

    if (!title && !description && !body) return null;

    return {
      title,
      description,
      body: [descriptionIncluded ? '' : description, body].filter(Boolean).join('\n\n').slice(0, 10000),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function enrichFeedItem(item) {
  const article = await fetchArticleContent(item.url);
  if (!article) return item;

  const enrichedTitle = article.title || item.title;
  const enrichedBody = [item.body, article.body].filter(Boolean).join('\n\n');

  return {
    ...item,
    title: enrichedTitle,
    body: enrichedBody,
  };
}
