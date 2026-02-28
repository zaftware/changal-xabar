import OpenAI from 'openai';

const FALLBACK = {
  title_uz: 'Yangilik',
  body_uz: '',
  tldr_uz: 'Qisqa: manba yangiligini tekshirib ko‘ring.',
  is_political: false,
};

const SYSTEM_PROMPT = `
Sen Uzbek tilidagi AI va tech yangiliklar muharririsan.
Maqsad: murakkab yangilikni texnik bo'lmagan o'quvchiga sodda, aniq va qiziqarli qilib tushuntirish.

Yozish uslubi:
- ftsec kanaliga o'xshash editorial ohang, lekin ko'proq sodda va tushunarli
- ortiqcha jargon ishlatma; kerak bo'lsa atamani bir jumlada izohla
- shov-shuv, clickbait, taxmin va reklama ohangidan qoch
- copy-paste qilma, faqat qayta ifodalangan matn yoz
- faktlar noaniq bo'lsa ishonch bilan uydirma qo'shma
- quruq press-reliz tilidan qoch; o'quvchi uchun "nega bu muhim" degan savolga javob ber
- generik filler ishlatma: "bu yangilik muhim", "yaqinda", "yana", "inqilobiy", "ommaviy foydalanish uchun ahamiyati bor" kabi bo'sh gaplar yozma
- source matni opinion bo'lsa, buni neytral tarzda ko'rsat; fakt sifatida sotma
- GitHub loyiha yoki tool bo'lsa, uni "e'lon qilindi" deb yozishga shoshilma; bu vosita nima qiladi va kimga foydali ekanini ayt
- title_uz original da'voni saqlasin; ma'noni aylantirib yuborma

Format talablari:
- Faqat JSON qaytar
- title_uz: 1 ta tabiiy, qisqa sarlavha
- tldr_uz: ichki fallback uchun 1 ta qisqa jumla; kerak bo'lmasa bo'sh qoldir
- body_uz: ftsec uslubidagi 6-10 ta punktdan iborat bo'lsin, alohida lead bo'lmasin
- body_uz asosan punktlardan iborat bo'lsin; har punkt yangi qatordan boshlangan bo'lsin
- har punkt bitta asosiy fikr yoki bitta faktni bersin
- punktlarning ko'pi faktlar bo'lsin, faqat 2-3 tasi "bu oddiy odam uchun nimani anglatadi" degan izoh bersin
- har punkt qisqa bo'lsin: odatda 8-16 so'z atrofida, iloji boricha bir ekranda tez o'qiladigan uzunlikda
- punktlar orasida takror bo'lmasin; har biri yangi detail olib kelsin
- agar raqam, sana, narx, foiz bo'lsa, imkon qadar punktga kirit
- agar raqamlar, narxlar, foizlar bo'lsa, ularni saqla
- body_uz ichida har punkt "- " bilan boshlansin
- is_political: siyosiy mazmun dominant bo'lsa true
`.trim();

function extractJson(text = '') {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {}

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function cleanText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.replace(/\r\n/g, '\n').trim();
}

function normalizeComparableText(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const GENERIC_FILLER_PATTERNS = [
  /\boddiy odamlar uchun\b/gi,
  /\boddiy foydalanuvchilar uchun\b/gi,
  /\bshuni inobatga olish\b/gi,
  /\bbu yangilik\b/gi,
  /\bushbu yangilik\b/gi,
  /\byaqinda\b/gi,
  /\byana\b/gi,
  /\basosiy xulosa\b/gi,
  /\bbu xizmat yordamida\b/gi,
  /\bbu vosita yordamida\b/gi,
];

const WEAK_BULLET_PATTERNS = [
  /\bfoydali bo'lishi mumkin\b/i,
  /\banglatadi\b/i,
  /\bkelajakda\b/i,
  /\bishlatish oson\b/i,
  /\bqulay interfeys\b/i,
  /\bkatta qiziqish uyg'ot/i,
  /\btaqdim etadi\b/i,
  /\btaqdim etishi mumkin\b/i,
  /\btezlashtirishi mumkin\b/i,
  /\boddiy odam uchun\b/i,
  /\boddiy foydalanuvchi uchun\b/i,
  /\bo'zaro aloqalar uchun\b/i,
  /\bxohlagancha sozlashingiz mumkin\b/i,
  /\bimkoniyatlari mavjud\b/i,
];

function stripGenericFiller(text = '') {
  let out = text;
  for (const pattern of GENERIC_FILLER_PATTERNS) out = out.replace(pattern, '');
  return out.replace(/\s+/g, ' ').trim();
}

function firstUsefulClause(text = '') {
  const parts = text
    .split(/[;:!?]/)
    .flatMap((part) => part.split(/, lekin |, ammo |, chunki |, bu esa |, ya'ni |, va /i))
    .map((part) => stripGenericFiller(part))
    .filter(Boolean);

  return parts[0] || '';
}

function shortenBulletText(text = '') {
  let out = firstUsefulClause(text)
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = out.split(/\s+/).filter(Boolean);
  if (words.length > 16) {
    out = words.slice(0, 16).join(' ');
  }

  return out.replace(/[,:;.\-–—]+$/g, '').trim();
}

function overlapsWithTitle(title, bullet) {
  const normalizedTitle = normalizeComparableText(title);
  const normalizedBullet = normalizeComparableText(bullet);
  if (!normalizedTitle || !normalizedBullet) return false;
  if (normalizedBullet === normalizedTitle) return true;
  if (normalizedBullet.startsWith(normalizedTitle)) return true;

  const titleWords = new Set(normalizedTitle.split(' ').filter(Boolean));
  const bulletWords = normalizedBullet.split(' ').filter(Boolean);
  if (!titleWords.size || !bulletWords.length) return false;
  const overlapCount = bulletWords.filter((word) => titleWords.has(word)).length;
  return overlapCount >= Math.min(4, titleWords.size) && overlapCount / bulletWords.length > 0.6;
}

function isWeakBullet(text = '') {
  if (!text) return true;
  if (WEAK_BULLET_PATTERNS.some((pattern) => pattern.test(text))) return true;
  const words = text.split(/\s+/).filter(Boolean);
  return words.length < 4;
}

function suppressRepeatedSummary(title, summary) {
  const cleanSummary = cleanText(summary);
  if (!cleanSummary) return '';

  const normalizedTitle = normalizeComparableText(title);
  const normalizedSummary = normalizeComparableText(cleanSummary);
  if (!normalizedTitle || !normalizedSummary) return cleanSummary;

  if (normalizedSummary === normalizedTitle) return '';
  if (normalizedSummary.startsWith(normalizedTitle)) return '';
  if (normalizedTitle.startsWith(normalizedSummary)) return '';

  return cleanSummary;
}

function normalizeBulletFormatting(body = '', title = '', summary = '') {
  const cleaned = cleanText(body);
  if (!cleaned) return '';

  const withLineBullets = cleaned
    .replace(/\s+- /g, '\n- ')
    .replace(/\n{3,}/g, '\n\n');

  const lines = withLineBullets
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const seen = new Set();
  const normalizedLines = [];
  for (const line of lines) {
    const raw = line.replace(/^-+\s*/, '').replace(/\s+/g, ' ').trim();
    const short = shortenBulletText(raw);
    const comparable = normalizeComparableText(short);
    if (!short || comparable.split(' ').length < 3) continue;
    if (isWeakBullet(short)) continue;
    if (overlapsWithTitle(title, short)) continue;
    if (summary && normalizeComparableText(summary) === comparable) continue;
    if (seen.has(comparable)) continue;
    seen.add(comparable);
    normalizedLines.push(`- ${short}`);
    if (normalizedLines.length >= 10) break;
  }

  return normalizedLines.join('\n');
}

function normalizeBody(body, title, summary) {
  const cleanedBody = normalizeBulletFormatting(body, title, summary);
  if (cleanedBody) return cleanedBody;
  return summary ? `- ${summary}\n- Tafsilotlar keyinroq boyitiladi.` : '';
}

function normalizeDraft(parsed, originalTitle) {
  const summary = suppressRepeatedSummary(originalTitle, parsed?.tldr_uz);
  return {
    title_uz: cleanText(parsed?.title_uz, originalTitle || FALLBACK.title_uz),
    body_uz: normalizeBody(parsed?.body_uz, parsed?.title_uz || originalTitle, summary || FALLBACK.tldr_uz),
    tldr_uz: summary,
    is_political: !!parsed?.is_political,
  };
}

export async function localizeNews({ title = '', body = '' }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ...FALLBACK, title_uz: title || FALLBACK.title_uz };

  const client = new OpenAI({ apiKey: key });
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const prompt = `
Vazifa:
- Kiruvchi AI/tech yangilikni Uzbek lotinida sodda editorial postga aylantir.
- Asosiy savollarga javob ber: nima bo'ldi, nima uchun muhim, oddiy odam nimani tushunishi kerak.
- Matnning eng muhim joyi body_uz ichidagi punktlar bo'lsin.
- Siyosiy mavzu dominant bo'lsa is_political=true qil.

Cheklovlar:
- Faqat berilgan sarlavha va matndan foydalan.
- Agar ma'lumot yetarli bo'lmasa, bo'sh joyni taxmin bilan to'ldirma.
- Punktlar qisqa, aniq va o'qishga qulay bo'lsin.
- title'dagi gapni tldr_uz yoki birinchi punktda aynan takrorlama.
- avval faktlarni ber, keyin 1-3 punktda bu nima uchun muhimligini oddiy tilda tushuntir.
- title yoki body da source fikrini teskarisiga aylantirma.
- Agar post opinion bo'lsa, "muallif fikricha" yoki shunga yaqin neytral framing ishlat.
- Noaniq joylarda katta xulosa chiqarma; "inqilob", "katta burilish", "hamma uchun" kabi oshirib yuborilgan iboralardan qoch.
- Lead paragraf yozma; post faqat sarlavha + punktlardan iborat bo'lsin.
- Birinchi 4-6 punkt maksimal darajada konkret bo'lsin: kim, nima, qachon, qancha, qanday o'zgarish.
- Oxirgi 2-3 punktda umumiy auditoriya uchun oqibat yoki foydani sodda tilda tushuntir.

Qaytariladigan JSON formati:
{"title_uz":"...","body_uz":"...","tldr_uz":"...","is_political":false}

Kiruvchi sarlavha:
${title}

Kiruvchi matn:
${body.slice(0, 8000)}
`.trim();

  const r = await client.responses.create({
    model,
    instructions: SYSTEM_PROMPT,
    input: prompt,
  });
  const txt = (r.output_text || '').trim();
  const parsed = extractJson(txt);
  if (!parsed) return { ...FALLBACK, title_uz: title || FALLBACK.title_uz };
  return normalizeDraft(parsed, title);
}
