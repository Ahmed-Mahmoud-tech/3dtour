// يحوّل عقود الـ Markdown في هذا المجلد إلى صفحات HTML جاهزة للطباعة (A4 / عربي RTL).
// التشغيل:  node contracts/build-print.mjs      ثم افتح ملفات contracts/print/*.html واطبعها (Ctrl+P) أو احفظها PDF.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'print');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let para = [];
  let stack = []; // 'ol' | 'ul'

  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
  };
  const closeLists = (to = 0) => {
    while (stack.length > to) {
      const nested = stack.length > 1; // قائمة فرعية => أغلق معها الـ li الحاوي لها
      out.push(`</${stack.pop()}>${nested ? '</li>' : ''}`);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (!line.trim()) { flushPara(); closeLists(); continue; }

    // جدول
    if (line.trimStart().startsWith('|')) {
      flushPara(); closeLists();
      const rows = [];
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
        i++;
      }
      i--;
      const isSep = (r) => r.every((c) => /^:?-{2,}:?$/.test(c));
      const head = rows.length > 1 && isSep(rows[1]) ? rows[0] : null;
      const body = rows.filter((r, idx) => !isSep(r) && !(head && idx === 0));
      out.push('<table>');
      if (head) out.push(`<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`);
      out.push(`<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`);
      out.push('</table>');
      continue;
    }

    if (/^#\s+/.test(line)) { flushPara(); closeLists(); out.push(`<h1>${inline(line.replace(/^#\s+/, ''))}</h1>`); continue; }
    if (/^##\s+/.test(line)) { flushPara(); closeLists(); out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`); continue; }
    if (/^---+$/.test(line.trim())) { flushPara(); closeLists(); out.push('<hr>'); continue; }

    // عنصر قائمة مرقّمة (غير مُزاح)
    const ol = line.match(/^(\d+)\.\s+(.*)$/);
    if (ol) {
      flushPara(); closeLists(1);
      if (!stack.length) { stack.push('ol'); out.push(`<ol start="${ol[1]}">`); }
      out.push(`<li>${inline(ol[2])}</li>`);
      continue;
    }

    // عنصر نقطي — مُزاح = قائمة فرعية داخل المرقّمة
    const ul = line.match(/^(\s*)[-•]\s+(.*)$/);
    if (ul) {
      flushPara();
      const nested = ul[1].length >= 2 && stack[0] === 'ol';
      if (nested) {
        if (stack.length < 2) {
          // انقل الـ ul داخل الـ li السابق بدل أن يكون شقيقًا له
          out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, '');
          stack.push('ul');
          out.push('<ul>');
        }
      }
      else { closeLists(0); if (!stack.length) { stack.push('ul'); out.push('<ul>'); } }
      out.push(`<li>${inline(ul[2])}</li>`);
      continue;
    }

    closeLists();
    para.push(line.trim());
  }
  flushPara();
  closeLists();
  return out.join('\n');
}

const page = (title, body) => `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  /* margin:0 يمنع المتصفح من طباعة التاريخ ومسار الملف ورقم الصفحة في الترويسة والتذييل.
     المسافات الحقيقية تأتي من thead/tfoot المتكررين في كل صفحة + حشو الخلية. */
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    direction: rtl; margin: 0; background: #f3f4f6;
    font-family: "Segoe UI", Tahoma, "Traditional Arabic", Arial, sans-serif;
    font-size: 11.5pt; line-height: 1.85; color: #111;
  }
  .sheet { max-width: 210mm; margin: 24px auto; background: #fff; box-shadow: 0 2px 14px rgba(0,0,0,.12); }
  .page-wrap { width: 100%; border-collapse: collapse; }
  .page-wrap > thead > tr > td,
  .page-wrap > tfoot > tr > td { border: 0; padding: 0; }
  .pad-t { height: 17mm; }
  /* يتكرر أسفل كل صفحة مطبوعة — سطر التوقيع بالأحرف الأولى */
  .pfoot {
    height: 15mm; margin: 0 16mm; padding-top: 4mm; border-top: 1px solid #bbb;
    display: flex; justify-content: space-between; gap: 10mm;
    font-size: 8.5pt; color: #333; line-height: 1.4;
  }
  .content { border: 0; padding: 0 16mm; vertical-align: top; }

  h1 { font-size: 17pt; text-align: center; margin: 0 0 2px; line-height: 1.5; }
  h1 + h2 { text-align: center; border: 0; color: #444; font-size: 12.5pt; margin-top: 0; padding: 0; }
  h2 { font-size: 12.5pt; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1.5px solid #111; break-after: avoid; page-break-after: avoid; }
  p { margin: 6px 0; text-align: justify; }
  ol, ul { margin: 6px 0; padding-inline-start: 22px; }
  li { margin-bottom: 5px; }
  ul ul, ol ul { margin: 4px 0; }
  hr { border: 0; border-top: 1px solid #bbb; margin: 14px 0; }
  strong { font-weight: 700; }

  .content table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11pt; break-inside: avoid; page-break-inside: avoid; }
  .content th, .content td { border: 1px solid #888; padding: 6px 9px; text-align: right; vertical-align: top; }
  .content th { background: #eee; font-weight: 700; }

  .bar { position: sticky; top: 0; z-index: 2; background: #111; color: #fff; padding: 10px 16px; display: flex; gap: 12px; align-items: center; justify-content: center; font-size: 10pt; }
  .bar button { font: inherit; padding: 6px 16px; border: 0; border-radius: 4px; background: #0d9488; color: #fff; cursor: pointer; }
  @media print {
    body { background: #fff; }
    .sheet { max-width: none; margin: 0; box-shadow: none; }
    .bar { display: none; }
  }
</style>
</head>
<body>
<div class="bar">
  <span>جاهز للطباعة — A4 · لو ظهر تاريخ أو مسار الملف، ألغِ تحديد «الرؤوس والتذييلات» في نافذة الطباعة</span>
  <button onclick="window.print()">طباعة / حفظ PDF</button>
</div>
<div class="sheet">
<table class="page-wrap">
  <thead><tr><td><div class="pad-t"></div></td></tr></thead>
  <tfoot><tr><td>
    <div class="pfoot">
      <span>توقيع الطرف الأول: ........................</span>
      <span>توقيع الطرف الثاني: ........................</span>
    </div>
  </td></tr></tfoot>
  <tbody><tr><td class="content">
${body}
  </td></tr></tbody>
</table>
</div>
</body>
</html>`;

mkdirSync(OUT, { recursive: true });
const files = readdirSync(HERE).filter((f) => f.endsWith('.md'));
for (const f of files) {
  const md = readFileSync(join(HERE, f), 'utf8');
  const title = (md.match(/^#\s+(.*)$/m)?.[1] ?? f.replace(/\.md$/, '')).replace(/\*\*/g, '');
  writeFileSync(join(OUT, f.replace(/\.md$/, '.html')), page(title, mdToHtml(md)), 'utf8');
  console.log('✓', f);
}
console.log(`\nتم إنشاء ${files.length} ملف في: ${OUT}`);
