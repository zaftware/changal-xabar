import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { strip } from './util.js';

function normalizeUrl(u = '') {
  const x = u.trim().replace(/[),.;!?]+$/, '');
  if (!x) return null;
  if (/^https?:\/\//i.test(x)) return x;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(x)) return `https://${x}`;
  return null;
}

function findOriginalUrl(text = '', links = []) {
  const linkFromAnchors = links
    .map((u) => normalizeUrl(u))
    .find((u) => u && !u.includes('t.me/') && !u.includes('telegram.me/'));
  if (linkFromAnchors) return linkFromAnchors;

  const linkMatch = text.match(/(?:^|\s)Link:\s*([^\s]+)/i);
  const parsedLink = normalizeUrl(linkMatch?.[1] || '');
  if (parsedLink) return parsedLink;

  const urls = [...text.matchAll(/(?:https?:\/\/|[a-z0-9.-]+\.[a-z]{2,}\/?)\S*/gi)]
    .map((m) => normalizeUrl(m[0]))
    .filter(Boolean);
  const preferred = urls.find((u) => !u.includes('t.me/') && !u.includes('telegram.me/'));
  return preferred || urls[0] || null;
}

export async function fetchTelegramS(url) {
  const html = await (await fetch(url)).text();
  const $ = cheerio.load(html);
  const out = [];

  $('.tgme_widget_message').each((_, el) => {
    const body = strip($(el).find('.tgme_widget_message_text').text());
    const links = $(el)
      .find('.tgme_widget_message_text a[href]')
      .map((_, a) => $(a).attr('href'))
      .get();
    const sourceUrl = $(el).find('.tgme_widget_message_date').attr('href') || url;
    const originalUrl = findOriginalUrl(body, links) || sourceUrl;
    const title = body.slice(0, 220);
    const publishedAt = $(el).find('time').attr('datetime') || null;
    if (title && originalUrl) {
      out.push({
        source: 'telegram_s',
        title,
        url: originalUrl,
        sourceUrl,
        body,
        publishedAt,
      });
    }
  });

  return out;
}
