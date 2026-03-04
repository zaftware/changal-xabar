import { execFileSync } from 'node:child_process';

const BAD_FALLBACK_RE = /Qisqa:\s*manba yangiligini tekshirib ko'ring\.?/i;
const CLAUDE_BIN = '/home/zaff/.local/bin/claude';

function cleanText(s = '') {
  return String(s)
    .replace(/\s+/g, ' ')
    .replace(/\b(Score:\s*\d+[^\)]*\)|Comments?:\s*\S+|Link:\s*\S+)\b/gi, '')
    .trim();
}

function bulletCount(s = '') {
  return (String(s).match(/^\s*–\s+/gm) || []).length;
}

function extractJsonText(s = '') {
  const text = String(s).trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (fenced?.[1] || text).trim();
}

function bulletLines(s = '') {
  return String(s).split('\n').map((l) => l.trim()).filter((l) => l.startsWith('– '));
}

function normalizeOutput(parsed) {
  const body = String(parsed?.body_uz || '').trim();
  const tldr = String(parsed?.tldr_uz || '').trim();
  const normalizedTldr = bulletCount(tldr) >= 3 ? tldr : (bulletCount(body) >= 3 ? body : tldr);
  const out = {
    title_uz: cleanText(parsed?.title_uz || ''),
    body_uz: cleanText(body),
    tldr_uz: normalizedTldr,
    is_political: !!parsed?.is_political,
  };

  if (!out.tldr_uz || BAD_FALLBACK_RE.test(out.tldr_uz)) return null;
  if (out.tldr_uz.length < 120 || bulletCount(out.tldr_uz) < 3) return null;
  if (bulletLines(out.tldr_uz).some((l) => l.length > 72)) return null;
  return out;
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
  const txt = extractJsonText(envelope?.result || '');
  return normalizeOutput(JSON.parse(txt));
}

export async function localizeNews({ title = '', body = '' }) {
  const model = process.env.CLAUDE_MODEL || 'sonnet';

  const prompt = `
Vazifa:
- Kiruvchi AI/tech yangilik matnini uzbek lotiniga tarjima qil.
- Sarlavhani ham tarjima qil.
- ftsec uslubiga yaqin qisqa format qil.
- Siyosiy kontent bo'lsa is_political=true qilib qaytar.

Qoidalar:
- Faqat faktlar, hech qanday tarafkashlik yo'q.
- Mualliflik huquqini buzmaslik uchun matnni qayta ifodalab yoz (copy-paste yo'q).
- Faqat bitta JSON obyekt qaytar. Markdown, izoh, code fence bo'lmasin.
- body_uz: 1-3 ta qisqa gapdan iborat oddiy paragraf bo'lsin. Punkt ishlatma.
- tldr_uz: ko'p qatorli matn bo'lsin.
- tldr_uz ning 1-qatori juda qisqa lead bo'lsin. 60 belgidan oshmasin.
- tldr_uz ichida kamida 6 ta punkt bo'lsin.
- Har punkt yangi qatorda va aynan "– " bilan boshlansin.
- Natija sxemasi aniq shu bo'lsin: {"title_uz":"...","body_uz":"...","tldr_uz":"lead\\n– punkt 1\\n– punkt 2","is_political":false}

Sarlavha: ${title}
Matn: ${body.slice(0, 6000)}
`;

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
