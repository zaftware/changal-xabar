---
title: feat: AI news editorial pipeline with review queue
type: feat
status: active
date: 2026-02-28
origin: docs/brainstorms/2026-02-28-ai-news-telegram-brainstorm.md
---

# feat: AI news editorial pipeline with review queue

## Overview

Extend the current Changal 24 pipeline from a simple fetch-and-publish flow into a review-first editorial system for Uzbek AI and tech news. The product should ingest stories from Denis' feed on a schedule, rank them using configurable relevance weights, generate longer Uzbek explainers for a general audience, and place the results into a review queue instead of auto-publishing.

The same pipeline should also accept manually submitted links as a second intake path. Manual links should be processed into drafts using the same editorial style, with an option to mark them as priority items during intake. This plan carries forward the brainstorm decisions around audience, scope, manual review, and extensibility (see brainstorm: `docs/brainstorms/2026-02-28-ai-news-telegram-brainstorm.md`).

## Problem Statement / Motivation

The repo already has the basics of a news pipeline, but it is still too primitive for the product direction:

- Source ingestion is single-source and hardcoded via `SOURCE_TELEGRAM_S` in [fetch.js](/home/zaff/code/changal-24/src/jobs/fetch.js).
- Story ranking is currently a body-length proxy rather than an editorial relevance model in [fetch.js](/home/zaff/code/changal-24/src/jobs/fetch.js).
- Draft generation exists, but the current prompt is closer to a short translation/TL;DR than an `ftsec`-style explainer for general readers in [tldr.js](/home/zaff/code/changal-24/src/lib/tldr.js).
- Telegram publishing is immediate for the top candidate and bypasses editorial approval in [publish.js](/home/zaff/code/changal-24/src/jobs/publish.js).

The goal is to improve quality and trust before increasing automation. For this audience, the product should optimize for a small number of genuinely important AI/tech stories explained simply in Uzbek, not for maximum volume or speed (see brainstorm: `docs/brainstorms/2026-02-28-ai-news-telegram-brainstorm.md`).

## Proposed Solution

Add a lightweight editorial workflow on top of the existing SQLite-backed pipeline:

1. Ingest candidate stories from Denis' feed on a schedule.
2. Normalize and deduplicate them before scoring.
3. Compute a configurable relevance score using editable weights and explicit exclusion logic.
4. Generate Uzbek draft posts in a longer, accessible editorial format.
5. Store candidates and drafts in review states rather than publishing automatically.
6. Add a manual link intake path that feeds the same draft-generation flow, with normal or priority draft handling.
7. Allow approved drafts to be published to Telegram using the existing send mechanism.

This preserves the current architecture shape, keeps the first release focused, and leaves room for more feeds later without forcing multi-source complexity into v1 (see brainstorm: `docs/brainstorms/2026-02-28-ai-news-telegram-brainstorm.md`).

## Technical Considerations

- **Data model changes:** The current `posts` table stores score and publish state but does not distinguish candidate, drafted, approved, rejected, or priority content. A richer status model is needed in [db.js](/home/zaff/code/changal-24/src/lib/db.js).
- **Config surface:** Relevance weights need a configuration source. For v1, file- or env-backed config is simpler than adding a full admin UI, while still honoring the brainstorm requirement that scoring be configurable.
- **Prompting scope:** `localizeNews` in [tldr.js](/home/zaff/code/changal-24/src/lib/tldr.js) should evolve from short TL;DR output to a richer Uzbek editorial explainer with explicit audience and tone constraints.
- **Review interface:** The brainstorm intentionally deferred whether review happens in the web app or elsewhere. The plan should treat review as a required capability while isolating the review surface so it can be chosen during implementation.
- **Scheduling:** The system should support periodic checks every N hours, but the schedule driver can remain external if that matches current deployment. The app does not need an internal scheduler if cron-style execution is already sufficient.
- **Source scope:** v1 should keep Denis as the only automated source to minimize complexity and make scoring/prompt tuning measurable.

## System-Wide Impact

- **Interaction graph:** Feed fetch creates or updates candidate rows. Candidate rows flow into scoring. High-scoring rows trigger draft generation. Drafts move into a review queue. Approval triggers the existing Telegram send path. Manual links should enter that same pipeline after normalization rather than becoming a separate publishing path.
- **Error propagation:** Fetch failures should not block review or publishing of existing drafts. Draft generation failures should leave the candidate in a recoverable state rather than marking it published or discarded. Publish failures should keep the draft approved-but-unpublished for retry.
- **State lifecycle risks:** Today, `published_to_tg` mixes selection and terminal state. A new workflow must avoid half-processed rows where summarization happened but status is unclear. State transitions need to be explicit and idempotent.
- **API surface parity:** The current public web endpoints only expose published-style news browsing in [server.js](/home/zaff/code/changal-24/src/server.js). The review queue and manual link intake will need new internal-facing endpoints or equivalent interfaces.
- **Integration test scenarios:** Scored duplicates from the same story, political false positives, manual priority links, and publish retries all need end-to-end coverage because unit tests alone will miss state-transition bugs.

## SpecFlow Analysis

### Primary user flow

1. Scheduled fetch collects items from Denis' channel.
2. System deduplicates and scores candidates using configurable weights.
3. System generates Uzbek explainer drafts for viable candidates.
4. Drafts appear in a review queue.
5. Reviewer edits, approves, rejects, or defers drafts.
6. Approved draft is sent to Telegram and marked published.

### Secondary user flow

1. You submit a manual link.
2. System ingests the linked article as a candidate.
3. You choose normal draft or priority draft.
4. Draft enters the same review queue and approval flow.

### Edge cases to cover

- Source post has no usable original article URL.
- Multiple Telegram posts reference the same underlying article.
- A candidate matches AI/tech keywords but is mostly political or unrelated.
- Manual link content is thin, broken, or blocked from extraction.
- A draft is approved but Telegram delivery fails.
- Repeated scheduled fetches should not re-draft the same story endlessly.

## Acceptance Criteria

### Functional Requirements

- [ ] The system can continue ingesting from Denis' Telegram feed as the single automated source in v1.
- [ ] Candidate stories are scored using configurable weighted criteria rather than body length alone.
- [ ] Default scoring and filtering strongly avoid politics and duplicate coverage while prioritizing AI/tech relevance.
- [ ] The system generates Uzbek drafts in a longer explanatory format aimed at general readers, consistent with the brainstorm’s `ftsec`-style direction.
- [ ] Automated candidates are stored in a review-required state rather than being published automatically.
- [ ] The product supports manual link submission and lets you mark each submission as a normal or priority draft.
- [ ] Approved drafts can be published through the existing Telegram delivery path.
- [ ] Rejected or skipped drafts remain auditable and are not retried as if they were new items.

### Non-Functional Requirements

- [ ] Scheduled fetches and draft generation are idempotent for duplicate content.
- [ ] Workflow state transitions are explicit enough to recover safely from partial failures.
- [ ] Scoring configuration can be changed without editing core ranking logic across multiple files.

### Quality Gates

- [ ] End-to-end tests cover candidate ingestion, scoring, review state transitions, manual link intake, and publish approval.
- [ ] The plan or follow-up docs specify how scoring config is changed and how review/publish states are interpreted.

## Success Metrics

- Most approved posts need only small edits before publish.
- The review queue surfaces important AI/tech stories with low noise.
- Generated Uzbek drafts are understandable to a general reader without requiring technical background.
- The system avoids obvious political/off-topic items and duplicate story spam.

## Dependencies & Risks

- **LLM output quality:** The current draft generation depends on OpenAI responses in [tldr.js](/home/zaff/code/changal-24/src/lib/tldr.js). Prompting and output validation may need tightening to achieve consistent style and structure.
- **Content extraction quality:** Telegram-derived bodies may not contain enough context for strong explainers, so manual links and article extraction may become a bottleneck.
- **Workflow migration risk:** Replacing `published_to_tg` with a richer state model must preserve existing rows and avoid ambiguous legacy states.
- **Interface uncertainty:** The brainstorm left the review surface open. The plan should not assume a heavy dashboard if a simpler internal interface is sufficient.

## Implementation Suggestions

### Phase 1: Workflow foundation

- Add explicit content lifecycle states for candidate, drafted, approved, rejected, published, and errored items.
- Separate automated-source candidates from manually submitted links.
- Introduce a configuration layer for weighted scoring and default exclusions.
- Preserve origin metadata, duplicate keys, and priority flags.

### Phase 2: Drafting and review flow

- Replace simple score ordering with configurable relevance ranking.
- Update Uzbek generation prompts to produce longer “why this matters” explainers for non-technical readers.
- Add review queue read/write paths so drafts can be inspected, edited, approved, rejected, and deferred.

### Phase 3: Publish integration and polish

- Make Telegram publishing operate only on approved drafts.
- Add retry-safe publish behavior and clear failure states.
- Add visibility into why a story was scored, skipped, rejected, or published.

## Implementation Checklist

### 1. Schema and state model

- [ ] Replace or supersede `published_to_tg` with explicit workflow state fields in [src/lib/db.js](/home/zaff/code/changal-24/src/lib/db.js).
- [ ] Add columns for intake type (`feed` vs `manual`), priority flag, review timestamps, and publish timestamps.
- [ ] Add a durable duplicate key separate from the current `hash` if the existing key is too tied to title text.
- [ ] Decide and document how legacy rows are mapped into the new state model.

### 2. Relevance configuration

- [ ] Create a single scoring configuration source for weights and default exclusions.
- [ ] Define the first scoring factors: topic fit, freshness, source trust, duplicate penalty, politics penalty.
- [ ] Ensure scoring config can be changed without touching ranking logic in multiple files.
- [ ] Record score explanations so the reviewer can see why an item ranked high or low.

### 3. Feed ingestion path

- [ ] Keep Denis as the only automated source in v1 using the existing Telegram source path in [src/lib/sources.js](/home/zaff/code/changal-24/src/lib/sources.js).
- [ ] Normalize source items more aggressively before insert so repeated feed checks stay idempotent.
- [ ] Down-rank or suppress items that lack a usable original source URL unless explicitly allowed.
- [ ] Mark new automated items as review candidates instead of publish-ready items.

### 4. Manual link intake

- [ ] Add a manual link submission path that accepts a URL and desired priority mode.
- [ ] Route manual links through the same normalization, scoring, and drafting pipeline as feed items.
- [ ] Preserve manual-source metadata so manually submitted items are distinguishable in review.
- [ ] Handle broken or thin-content links without losing the submission record.

### 5. Draft generation

- [ ] Update [src/lib/tldr.js](/home/zaff/code/changal-24/src/lib/tldr.js) to produce longer Uzbek explainers for general readers, not just short TL;DR output.
- [ ] Keep output structured enough that drafts can be reviewed, edited, and published predictably.
- [ ] Tighten output validation and fallback behavior so bad model output does not corrupt workflow state.
- [ ] Preserve both short summary and longer body if both are useful in review and publishing.

### 6. Review queue

- [ ] Add internal read paths for candidate and drafted items in review state.
- [ ] Add review actions for approve, reject, defer, and edit.
- [ ] Keep the review surface isolated enough that the UI choice can change later without rewriting workflow logic.
- [ ] Make priority drafts visible and sortable in the queue.

### 7. Telegram publishing

- [ ] Change [src/jobs/publish.js](/home/zaff/code/changal-24/src/jobs/publish.js) so it publishes only approved drafts.
- [ ] Ensure publish failure leaves the item retryable instead of silently lost.
- [ ] Store publish result metadata for auditability.
- [ ] Keep the existing Telegram send mechanism unless it blocks the new workflow.

### 8. Public and internal API shape

- [ ] Separate public published-news endpoints from internal review endpoints in [src/server.js](/home/zaff/code/changal-24/src/server.js).
- [ ] Avoid leaking internal review states into the public news feed.
- [ ] Add endpoints or equivalent interfaces for manual intake and review actions.
- [ ] Keep response formats simple enough for a lightweight internal tool or dashboard.

### 9. Testing and verification

- [ ] Add end-to-end coverage for feed ingestion -> scoring -> drafting -> approval -> publish.
- [ ] Add coverage for manual priority links.
- [ ] Add coverage for duplicates, political/off-topic filtering, and publish retry behavior.
- [ ] Verify migrations against an existing `data.db` so legacy content is not stranded.

### 10. Rollout order

- [ ] Land schema and state changes first.
- [ ] Land scoring config and ranking second.
- [ ] Land draft-generation changes third.
- [ ] Land review queue capabilities fourth.
- [ ] Switch Telegram publishing to approved-only after review state is working end to end.

## Alternative Approaches Considered

- **Assisted automation:** Rejected for v1 because it adds policy complexity before editorial quality is proven (see brainstorm: `docs/brainstorms/2026-02-28-ai-news-telegram-brainstorm.md`).
- **Editorial workbench first:** Rejected because it pushes too much manual work into the workflow and underuses the existing automation already present in this repo.

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-02-28-ai-news-telegram-brainstorm.md](/home/zaff/code/changal-24/docs/brainstorms/2026-02-28-ai-news-telegram-brainstorm.md)
- Existing automated source ingest: [src/jobs/fetch.js](/home/zaff/code/changal-24/src/jobs/fetch.js)
- Telegram source parsing: [src/lib/sources.js](/home/zaff/code/changal-24/src/lib/sources.js)
- Current draft generation: [src/lib/tldr.js](/home/zaff/code/changal-24/src/lib/tldr.js)
- Current publish flow: [src/jobs/publish.js](/home/zaff/code/changal-24/src/jobs/publish.js)
- Current storage model: [src/lib/db.js](/home/zaff/code/changal-24/src/lib/db.js)
- Current read endpoints: [src/server.js](/home/zaff/code/changal-24/src/server.js)
