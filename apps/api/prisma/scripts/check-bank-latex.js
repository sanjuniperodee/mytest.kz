// Проверяет каждый фрагмент $...$ в prisma/ent-banks/**/*.txt реальным KaTeX (strict, throwOnError).
// Запуск: node prisma/scripts/check-bank-latex.js
const fs = require('fs');
const path = require('path');
// KaTeX: apps/web/node_modules, иначе путь из KATEX_PATH (например, npm i katex в /tmp)
const katex = require(process.env.KATEX_PATH || path.join(__dirname, '../../../web/node_modules/katex'));
const root = path.join(__dirname, '../ent-banks');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.txt') ? [path.join(d, e.name)] : []);
let bad = 0, total = 0;
for (const f of walk(root)) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$/g)) {
      total++;
      try { katex.renderToString(m[1].trim(), { throwOnError: true, strict: 'error' }); }
      catch (e) { bad++; console.log(`${path.relative(root, f)}:${i + 1}: ${m[1]} -> ${e.message.split('\n')[0]}`); }
    }
  });
}
console.log(`LaTeX-фрагментов: ${total}, ошибок: ${bad}`);
process.exit(bad ? 1 : 0);
