import 'dotenv/config';
import { fetchArticleContent } from '../src/lib/article.js';

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/inspect-article.js <url>');
  process.exit(1);
}

const article = await fetchArticleContent(url);
if (!article) {
  console.log('No article content extracted.');
  process.exit(0);
}

console.log(JSON.stringify(article, null, 2));
