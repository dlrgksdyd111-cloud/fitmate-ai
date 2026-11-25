import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const revision = process.argv[2];

function readSource(path) {
  if (revision) {
    return execFileSync('git', ['show', `${revision}:${path}`], { cwd: root, encoding: 'utf8' });
  }
  return readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

const html = readSource('dist/index.html');
const css = readSource('dist/style.css').trimEnd().replace(/<\/style/gi, '<\\/style');
const planner = readSource('dist/planner.mjs').trimEnd().replace(/^export /gm, '');
const source = readSource('dist/app.mjs').trimEnd();
const app = source.replace(/^import [^\n]+ from '\.\/planner\.mjs';\n/, '');
const cssTag = '<link rel="stylesheet" href="./style.css">';
const jsTag = '<script type="module" src="./app.mjs"></script>';

if (app === source || !html.includes(cssTag) || !html.includes(jsTag) || !html.includes('</body>')) {
  throw new Error('Offline build could not locate the expected app entry points.');
}

const script = `(() => {\n'use strict';\n${planner}\n\n${app}\n})();`.replace(/<\/script/gi, '<\\/script');
const standalone = html
  .replace(cssTag, () => `<style>\n${css}\n</style>`)
  .replace(`  ${jsTag}\n`, '')
  .replace('</body>', () => `<script>\n${script}\n</script>\n</body>`);

writeFileSync(new URL('FitMate-AI.html', import.meta.url), standalone);
