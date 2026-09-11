#!/usr/bin/env node
/**
 * يبني مجلد www/ (اللي يحزمه Capacitor للتطبيق) من ملفات المصدر بالجذر.
 *
 * المصدر الوحيد للحقيقة هو: index.html + styles.css + privacy.html + js/
 * ومجلد www/ مُولَّد بالكامل — لا تعدّل أي ملف داخله، تعديلك راح يُمحى.
 *
 * الاستخدام:  npm run build
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'www');

const FILES = ['index.html', 'styles.css', 'privacy.html', 'terms.html'];
const DIRS = ['js'];

function fail(msg) {
  console.error('✗ ' + msg);
  process.exit(1);
}

// www/ مُولَّد بالكامل، فنمسحه ونبنيه من جديد حتى ما تبقى ملفات قديمة
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let copied = 0;

for (const f of FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) fail(`الملف المطلوب مفقود: ${f}`);
  fs.copyFileSync(src, path.join(OUT, f));
  copied++;
}

for (const d of DIRS) {
  const src = path.join(ROOT, d);
  if (!fs.existsSync(src)) fail(`المجلد المطلوب مفقود: ${d}/`);
  fs.cpSync(src, path.join(OUT, d), { recursive: true });
  copied += fs.readdirSync(src).length;
}

// تحقق إن كل ملف <script src="js/..."> مذكور بـ index.html موجود فعلاً بالمخرجات،
// حتى ما نرفع نسخة ناقصة للمتجر بلا ما نلاحظ
const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
const missing = [...html.matchAll(/<script\s+src="([^"]+\.js)"/g)]
  .map(m => m[1])
  .filter(rel => !rel.startsWith('http'))
  .filter(rel => !fs.existsSync(path.join(OUT, rel)));

if (missing.length) fail('ملفات سكربت مذكورة بـ index.html بس غير موجودة: ' + missing.join(', '));

console.log(`✓ تم بناء www/ — ${copied} ملف`);
