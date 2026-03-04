import { execFileSync } from 'node:child_process';

const BAD_FALLBACK_RE = /Qisqa:\s*manba yangiligini tekshirib ko‘ring\.?/i;

function cleanText(s = '') {
  return String(s)
    .replace(/\s+/g, ' ')
    .replace(/\b(Score:\s*\d+[^\)]*\)|Comments?:\s*\S+|Link:\s*\S+)\b/gi, '')
    .trim();
}

function bulletCount(s = '') {
  return (String(s).match(/^\s*–\s+/gm) || []).length;
}

function bulletLines(s = '') {
  return String(s)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('– '));
}

function extractJsonText(s = '') {
  const text = String(s).trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (fenced?.[1] || text).trim();
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

  const bullets = bulletCount(out.tldr_uz);
  const bulletTooLong = bulletLines(out.tldr_uz).some((line) => line.length > 72);
  if (!out.tldr_uz || BAD_FALLBACK_RE.test(out.tldr_uz) || out.tldr_uz.length < 120 || bullets < 3 || bulletTooLong) {
    return null;
  }
  return out;
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
- Har punkt juda qisqa bo'lsin: ideal 6-10 so'z, maksimum 72 belgi.
- Maqsad: iPhone 14 Pro ekranida har punkt taxminan 1-1.5 qator bo'lsin, 2 qatordan oshmasin.
- Natija sxemasi aniq shu bo'lsin: {"title_uz":"...","body_uz":"...","tldr_uz":"lead\\n– punkt 1\\n– punkt 2","is_political":false}

Sarlavha: ${title}
Matn: ${body.slice(0, 6000)}
`;

  try {
    const args = ['--print', '--output-format', 'json', '--permission-mode', 'bypassPermissions', '--model', model];
    const raw = execFileSync('claude', args, {
      input: prompt,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 8,
    });
    const envelope = JSON.parse(raw);
    const txt = extractJsonText(envelope?.result || '');
    try {
      const parsed = JSON.parse(txt);
      return normalizeOutput(parsed);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}
