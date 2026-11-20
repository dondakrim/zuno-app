// Lit tous les écrans de Zuno et note les textes français dans zuno-textes.txt
// Lancer depuis le dossier du projet :  node extract-textes.js
const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.js$/.test(f)) out.push(p);
  }
  return out;
}

const found = new Set();
const add = (s) => {
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 220) return;
  if (!/[A-Za-zÀ-ÿ]{2,}/.test(s)) return;
  if (/^[\w./:#@-]+$/.test(s) && !/[À-ÿ]/.test(s)) return; // identifiants, chemins, couleurs
  if (/^[)\];,=:?&|]|&&|=>|\|\||\) \?|\? \(|\)\s*:/.test(s)) return; // morceaux de code
  if (/^(https?:|\.\/|\.\.\/|@|#)/.test(s)) return;
  found.add(s);
};

const files = [...walk('src'), 'App.js', 'AppMain.js'].filter((f) => fs.existsSync(f));
for (const f of files) {
  const code = fs.readFileSync(f, 'utf8');
  let m;
  const jsx = />([^<>{}]*[A-Za-zÀ-ÿ][^<>{}]*)</g;
  while ((m = jsx.exec(code))) add(m[1]);
  const attr = /(?:placeholder|title|label|text|message|description|subtitle|name)\s*[=:]\s*(?:\{?\s*)(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g;
  while ((m = attr.exec(code))) add(m[2]);
  const alertRe = /Alert\.alert\(\s*(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1(?:\s*,\s*(["'`])((?:(?!\3)[^\\\n]|\\.)*)\3)?/g;
  while ((m = alertRe.exec(code))) { add(m[2]); if (m[4]) add(m[4]); }
  const str = /(["'])((?:(?!\1)[^\\\n]|\\.){3,})\1/g;
  while ((m = str.exec(code))) if (/[À-ÿ]| (le|la|les|de|du|des|un|une|ton|ta|tes|pour|vous|vos|votre|ce|cette|et|ou|à|en) /i.test(m[2]) || /^[A-ZÀ-Ý][a-zà-ÿ]+( [a-zà-ÿ]+)*$/.test(m[2])) add(m[2]);
}
const list = [...found].sort();
fs.writeFileSync('zuno-textes.txt', list.join('\n'));
console.log(files.length + ' fichiers lus, ' + list.length + ' textes trouvés → zuno-textes.txt');
