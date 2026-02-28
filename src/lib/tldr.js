import OpenAI from 'openai';

const FALLBACK = {
  title_uz: 'Yangilik',
  body_uz: '',
  tldr_uz: 'Qisqa: manba yangiligini tekshirib ko‘ring.',
  is_political: false,
};

export async function localizeNews({ title = '', body = '' }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ...FALLBACK, title_uz: title || FALLBACK.title_uz };

  const client = new OpenAI({ apiKey: key });
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const prompt = `
Vazifa:
- Kiruvchi AI/tech yangilik matnini uzbek lotiniga tarjima qil.
- Sarlavhani ham tarjima qil.
- ftsec uslubiga yaqin qisqa format qil: 1 ta juda qisqa lead + 6-12 ta punkt.
- Siyosiy kontent bo'lsa is_political=true qilib qaytar.

Qoidalar:
- Faqat faktlar, hech qanday tarafkashlik yo'q.
- Mualliflik huquqini buzmaslik uchun matnni qayta ifodalab yoz (copy-paste yo'q).
- Har punkt "– " bilan boshlansin, qisqa va aniq bo'lsin.
- Natija JSON bo'lsin: {"title_uz":"...","body_uz":"...","tldr_uz":"...","is_political":false}

Sarlavha: ${title}
Matn: ${body.slice(0, 6000)}
`;

  const r = await client.responses.create({ model, input: prompt });
  const txt = (r.output_text || '').trim();
  try {
    const parsed = JSON.parse(txt);
    return {
      title_uz: (parsed.title_uz || title || FALLBACK.title_uz).trim(),
      body_uz: (parsed.body_uz || '').trim(),
      tldr_uz: (parsed.tldr_uz || FALLBACK.tldr_uz).trim(),
      is_political: !!parsed.is_political,
    };
  } catch {
    return { ...FALLBACK, title_uz: title || FALLBACK.title_uz };
  }
}
