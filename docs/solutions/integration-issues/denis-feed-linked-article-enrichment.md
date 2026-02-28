---
title: Enrich Denis feed items with linked article content before drafting
date: 2026-02-28
category: integration-issues
problem_type: feed-enrichment
components:
  - src/jobs/fetch.js
  - src/lib/article.js
  - src/lib/sources.js
  - scripts/inspect-article.js
tags:
  - telegram
  - ingestion
  - scraping
  - openai
  - content-quality
status: solved
verified: true
---

# Enrich Denis feed items with linked article content before drafting

## Problem

The app was ingesting Denis' Telegram channel posts directly and using those short snippets as the only drafting input. In practice, the Telegram post text was usually too thin for good Uzbek editorial summaries:

- drafts came back generic and repetitive
- the model filled missing context with weak filler
- tool, paper, and rumor posts were especially low quality

This showed up during live prompt testing: even after prompt tuning, summaries still sounded like compressed link blurbs instead of real explainers.

## Symptoms

- Generated bullets repeated obvious facts from the title.
- Drafts used vague lines like "this is important" instead of concrete details.
- Denis items with external links had short `body` values in `posts`, often just the Telegram snippet plus a URL.
- Current rows improved only when the source already contained enough text.

## Root Cause

The ingestion pipeline in [src/jobs/fetch.js](/home/zaff/code/changal-24/src/jobs/fetch.js) was storing the Telegram post body as-is. That text often contained:

- a short title fragment
- a one-line summary
- `Link:` and `Comments:` metadata

The LLM was being asked to produce `ftsec`-style posts from source material that lacked enough factual density. Prompt tuning alone could not reliably fix missing context.

## Solution

Add a linked-article enrichment step before scoring and storing feed items.

### Implementation

1. Added [src/lib/article.js](/home/zaff/code/changal-24/src/lib/article.js) to fetch linked HTML pages and extract:
   - article title
   - meta description
   - paragraph text from common article/content selectors
2. Skipped hosts that are poor extraction targets for this use case:
   - `t.me`
   - `twitter.com` / `x.com`
   - `reddit.com`
   - `news.ycombinator.com`
3. Updated [src/jobs/fetch.js](/home/zaff/code/changal-24/src/jobs/fetch.js) to call `enrichFeedItem(rawItem)` before scoring and insertion.
4. Kept ingestion resilient:
   - if extraction fails, the original Telegram item is still stored
   - fetch does not abort on a bad article page
5. Added [scripts/inspect-article.js](/home/zaff/code/changal-24/scripts/inspect-article.js) and the `inspect:article` script in [package.json](/home/zaff/code/changal-24/package.json) for manual inspection of extracted content.

### Key Code Path

```js
for (const rawItem of items) {
  const it = await enrichFeedItem(rawItem);
  const duplicateKey = buildDuplicateKey(it);
  const ranked = scoreCandidate({
    source: it.source,
    title: it.title,
    body: it.body,
    publishedAt: it.publishedAt,
  }, scoringConfig);
}
```

## Verification

The fix was verified in two ways:

### 1. Direct extractor inspection

`npm run inspect:article -- <url>` showed article-backed content being pulled from real Denis-linked pages instead of only the Telegram snippet.

### 2. Real fetch run into `data.db`

Running `npm run fetch` after the change inserted enriched rows with much larger `body` values for extractable links.

Observed examples after the fetch:

- OpenAI help article: `body_len=1877`
- arXiv paper page: `body_len=1715`
- GitHub project page: `body_len=1976`

This confirmed that stored rows now contained article-backed context before scoring and drafting.

## What Changed in Behavior

Before:

- `posts.body` mostly contained Telegram text only
- drafting quality depended heavily on the channel snippet

After:

- `posts.body` contains Telegram snippet plus extracted linked-page content when available
- scoring sees richer text
- drafting has more concrete facts to work from
- source pages that cannot be reliably extracted still fall back cleanly

## Tradeoffs

- Fetch is slower because it now performs per-item article requests.
- Boilerplate-heavy pages can still produce noisy extracted text.
- Social/news-aggregator links remain weak because they are intentionally skipped.

## Prevention / Best Practices

- Do not depend on Telegram snippet text alone when downstream drafting quality matters.
- Keep extraction failure non-fatal; ingestion should degrade gracefully.
- Skip host types that are known to return poor or unstable article bodies.
- Add small inspector scripts for any scraping/enrichment step so intermediate output can be checked directly.

## Suggested Tests

- Feed item with a normal article link should store a body larger than the raw Telegram snippet.
- Feed item with a skipped host should still insert successfully without enrichment.
- Feed item with a broken/unreachable URL should still insert successfully.
- Extracted article title should override a truncated Telegram title when available.

## Follow-up Work

- Improve article cleaning to remove more boilerplate before drafting.
- Add source-type routing so `article`, `tool`, `paper`, and `social` links are drafted differently.
- Add review gating before publishing enriched drafts to Telegram.

## Related References

- Planning doc: [docs/plans/2026-02-28-feat-ai-news-editorial-pipeline-plan.md](/home/zaff/code/changal-24/docs/plans/2026-02-28-feat-ai-news-editorial-pipeline-plan.md)
- Brainstorm doc: [docs/brainstorms/2026-02-28-ai-news-telegram-brainstorm.md](/home/zaff/code/changal-24/docs/brainstorms/2026-02-28-ai-news-telegram-brainstorm.md)
