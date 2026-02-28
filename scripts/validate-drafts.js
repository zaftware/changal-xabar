import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { localizeNews } from '../src/lib/tldr.js';

const fixturePath = process.argv[2] || 'fixtures/news-samples.json';

function readFixtures(filePath) {
  const absolutePath = path.resolve(filePath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Fixture file must contain a JSON array: ${absolutePath}`);
  }
  return { absolutePath, items: parsed };
}

function summarizeDraft(input, output) {
  const bodyLines = (output.body_uz || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletLines = bodyLines.filter((line) => line.startsWith('- '));

  return {
    source_title: input.title || '',
    title_uz: output.title_uz || '',
    tldr_length: (output.tldr_uz || '').length,
    body_lines: bodyLines.length,
    bullet_lines: bulletLines.length,
    is_political: !!output.is_political,
    body_preview: bodyLines.slice(0, 4).join(' | '),
  };
}

function printResult(index, fixture, output, error) {
  console.log(`\n=== Sample ${index + 1}: ${fixture.name || fixture.title || 'Untitled'} ===`);

  if (error) {
    console.log(`status: error`);
    console.log(`message: ${error.message}`);
    return;
  }

  const summary = summarizeDraft(fixture, output);
  console.log(`status: ok`);
  console.log(`source_title: ${summary.source_title}`);
  console.log(`title_uz: ${summary.title_uz}`);
  console.log(`is_political: ${summary.is_political}`);
  console.log(`tldr_length: ${summary.tldr_length}`);
  console.log(`body_lines: ${summary.body_lines}`);
  console.log(`bullet_lines: ${summary.bullet_lines}`);
  console.log(`tldr_uz: ${output.tldr_uz}`);
  console.log(`body_preview: ${summary.body_preview}`);
}

const { absolutePath, items } = readFixtures(fixturePath);
console.log(`Using fixtures: ${absolutePath}`);
if (!process.env.OPENAI_API_KEY) {
  console.log('OPENAI_API_KEY is not set. localizeNews will use fallback output.');
}

for (let index = 0; index < items.length; index += 1) {
  const fixture = items[index];
  try {
    const output = await localizeNews({
      title: fixture.title || '',
      body: fixture.body || '',
    });
    printResult(index, fixture, output, null);
  } catch (error) {
    printResult(index, fixture, null, error);
  }
}
