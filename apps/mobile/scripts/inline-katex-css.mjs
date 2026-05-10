import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const cssPath = path.join(root, 'node_modules/katex/dist/katex.min.css');
const outPath = path.join(root, 'lib/exam/katex-inline-css.ts');

const css = fs.readFileSync(cssPath, 'utf8');
const escaped = css.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const header =
  '/** Bundled KaTeX CSS from node_modules/katex — avoids per-WebView CDN fetch and layout jumps. */\n';
fs.writeFileSync(outPath, `${header}export const KATEX_MIN_CSS = \`${escaped}\` as const\n`);
console.log('wrote', outPath, fs.statSync(outPath).size);
