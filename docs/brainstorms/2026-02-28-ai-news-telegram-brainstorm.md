---
date: 2026-02-28
topic: ai-news-telegram
---

# AI News Telegram Channel

## What We're Building
We are developing this project into an Uzbek-language AI and tech news channel that turns external news into Telegram-ready posts for a general audience. The system should monitor an AI-focused source feed, identify the most relevant stories every N hours, generate simple explanations in Uzbek, and prepare posts that read more like an editorial channel than a raw link dump.

The first version should start with Denis' news feed channel as the primary source. It should also support a second intake path where you can manually drop links and have the system generate candidate posts around them. In both cases, the product should create drafts for review rather than auto-publishing.

## Why This Approach
We considered three product shapes: a review-first editorial pipeline, assisted automation, and a heavier editorial workbench. The review-first pipeline was chosen because it matches the current repo structure, keeps the first version simple, and protects quality while the scoring and writing style are still being tuned.

This approach also fits the audience. Since the target reader is a general Uzbek audience with limited technical background, the product should optimize for clarity and trust instead of speed or output volume. Manual approval keeps the bar high while still allowing the system to do the expensive parts: intake, filtering, drafting, and simplification.

## Key Decisions
- Audience: The channel is for a general Uzbek audience, so posts should explain complex AI and tech news in simple language without assuming technical background.
- Content priority: The product should optimize for fewer, more important stories rather than high posting frequency.
- Source strategy: Version one starts with Denis' AI-focused feed as the only source, while keeping the product extensible for more sources later.
- Relevance model: Relevance should be fully configurable through editable scoring weights rather than fixed hardcoded ranking logic.
- Scoring factors: The first scoring model should emphasize structured weights such as topic, source, freshness, and similar factors instead of relying only on prompt-based judging.
- Publishing flow: The system should check on a schedule, but publishing should require review rather than happen automatically.
- Draft output: Telegram posts should be longer Uzbek editorial explainers in the style of `ftsec`, adapted for non-technical readers.
- Manual intake: You should be able to drop links into the system and choose case by case whether they become normal drafts or priority drafts.
- Default exclusions: Politics and duplicate coverage should be avoided or strongly down-ranked by default, while AI and tech remain the clear priority.
- Success criteria: The first version is successful if it consistently surfaces important AI and tech stories, produces understandable Uzbek explanations, and usually needs only small edits before approval.
- Review surface: A review step is required, but the exact interface does not need to be decided yet.

## Resolved Questions
- Review experience: The product must include a review queue before Telegram publishing, but the specific review interface can be decided during planning.

## Open Questions
- None for the brainstorm stage.

## Next Steps
→ `/prompts:workflows-plan` for implementation details
