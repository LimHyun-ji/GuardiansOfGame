// dist-single/index.html → artifact/backstage-crew.html (공유용 단일 파일, html/head/body 래퍼 제거)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
let html = readFileSync('dist-single/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>/, '')
  .replace(/<meta name="viewport"[^>]*>/, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
mkdirSync('artifact', { recursive: true });
writeFileSync('artifact/backstage-crew.html', head.trim() + '\n' + body.trim() + '\n');
console.log('wrote artifact/backstage-crew.html');
