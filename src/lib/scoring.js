import fs from 'node:fs';

const DEFAULT_CONFIG_PATH = process.env.SCORING_CONFIG_PATH || 'config/scoring.json';

const DEFAULT_CONFIG = {
  weights: {
    source: 25,
    freshness: 25,
    aiKeywords: 30,
    techKeywords: 10,
    bodyLength: 10,
  },
  sourceWeights: {
    telegram_s: 1,
  },
  freshnessWindowHours: 72,
  aiKeywords: [
    'ai',
    'artificial intelligence',
    'openai',
    'anthropic',
    'claude',
    'gpt',
    'gemini',
    'llm',
    'model',
    'inference',
    'agent',
    'agents',
    'deepseek',
    'mistral',
    'perplexity',
    'cursor',
    'copilot',
  ],
  techKeywords: [
    'software',
    'developer',
    'api',
    'cloud',
    'security',
    'cybersecurity',
    'chip',
    'gpu',
    'launch',
    'release',
  ],
  excludedKeywords: [
    'election',
    'senate',
    'president',
    'war',
    'military',
    'crime',
    'murder',
    'arrest',
    'police',
    'court',
  ],
  politicalKeywords: [
    'government',
    'minister',
    'congress',
    'parliament',
    'sanction',
    'campaign',
    'politics',
    'political',
  ],
};

function loadConfigFromDisk(path) {
  if (!fs.existsSync(path)) return null;
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function normalizeConfig(raw = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    weights: { ...DEFAULT_CONFIG.weights, ...(raw.weights || {}) },
    sourceWeights: { ...DEFAULT_CONFIG.sourceWeights, ...(raw.sourceWeights || {}) },
    aiKeywords: raw.aiKeywords || DEFAULT_CONFIG.aiKeywords,
    techKeywords: raw.techKeywords || DEFAULT_CONFIG.techKeywords,
    excludedKeywords: raw.excludedKeywords || DEFAULT_CONFIG.excludedKeywords,
    politicalKeywords: raw.politicalKeywords || DEFAULT_CONFIG.politicalKeywords,
  };
}

export function loadScoringConfig() {
  const envJson = process.env.SCORING_CONFIG_JSON;
  if (envJson) {
    try {
      return normalizeConfig(JSON.parse(envJson));
    } catch {
      return normalizeConfig();
    }
  }

  return normalizeConfig(loadConfigFromDisk(DEFAULT_CONFIG_PATH));
}

function countMatches(text, keywords) {
  return keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function buildDuplicateKey(item = {}) {
  return item.url || item.sourceUrl || item.title || item.body || '';
}

export function scoreCandidate(item, config = loadScoringConfig(), now = new Date()) {
  const combined = `${item.title || ''}\n${item.body || ''}`.toLowerCase();
  const aiMatches = countMatches(combined, config.aiKeywords);
  const techMatches = countMatches(combined, config.techKeywords);
  const excludedMatches = countMatches(combined, config.excludedKeywords);
  const politicalMatches = countMatches(combined, config.politicalKeywords);
  const sourceWeight = config.sourceWeights[item.source] ?? 0.5;

  const ageMs = item.publishedAt ? Math.max(0, now - new Date(item.publishedAt)) : 0;
  const freshnessWindowMs = (config.freshnessWindowHours || 72) * 60 * 60 * 1000;
  const freshnessRatio = freshnessWindowMs > 0 ? clamp(1 - ageMs / freshnessWindowMs, 0, 1) : 0;
  const bodyLengthRatio = clamp((item.body?.length || 0) / 1800, 0, 1);
  const relevancePenalty = clamp(excludedMatches * 8 + politicalMatches * 10, 0, 40);

  const details = {
    source: Math.round(sourceWeight * config.weights.source),
    freshness: Math.round(freshnessRatio * config.weights.freshness),
    aiKeywordMatches: aiMatches,
    techKeywordMatches: techMatches,
    excludedMatches,
    politicalMatches,
    bodyLength: Math.round(bodyLengthRatio * config.weights.bodyLength),
    penalties: relevancePenalty,
  };

  const score =
    details.source +
    details.freshness +
    Math.min(aiMatches * 10, config.weights.aiKeywords) +
    Math.min(techMatches * 4, config.weights.techKeywords) +
    details.bodyLength -
    relevancePenalty;

  return {
    score: clamp(Math.round(score), 0, 100),
    isPolitical: politicalMatches > 0,
    details,
  };
}
