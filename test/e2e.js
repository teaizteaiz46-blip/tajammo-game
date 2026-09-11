/**
 * اختبار تدفق الفئات المخصصة بمتصفح حقيقي.
 *
 * الشبكة الخارجية مقطوعة بهذي البيئة، فنعترض الطلبات:
 *   - سكربت unpkg  → نرجّع عميل Supabase مُحاكى يقلّد نفس صيغة {data, error}
 *   - بنك الأسئلة  → أسئلة معلّبة
 * يعني اللي يُختبر هنا هو منطق الواجهة والحالة واللوح — وهذا المقصود،
 * لأن سلوك قاعدة البيانات نفسه انتُحقق منه بـ SQL بدور anon مباشرة.
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:8099';
const GOOD_CODE = '4U6AMY';

const CANNED_TOPIC = {
  name: 'أسئلة عن الكروب',
  share_code: GOOD_CODE,
  author_name: 'أمير',
  questions: [
    { question: 'منو أكثر واحد يتأخر؟', answer: 'سيف', points: 100 },
    { question: 'منو ما يرد على الرسائل؟', answer: 'علي', points: 100 },
    { question: 'أي مقهى نلتم بيه دائماً؟', answer: 'الشهبندر', points: 200 },
    { question: 'منو خسران أكثر بالبلوت؟', answer: 'حسن', points: 200 },
    { question: 'شنو أغرب شي صار بالطلعة؟', answer: 'انكسر الشيشة', points: 400 },
    { question: 'منو أول واحد تعرفنا عليه؟', answer: 'أمير', points: 600 }
  ]
};

const SHIM = `
window.supabase = {
  createClient: function(url, key){
    return {
      auth: {
        onAuthStateChange: function(){ return { data:{ subscription:{ unsubscribe:function(){} } } }; },
        signInWithPassword: async function(){ return { error:{ message:'mock' } }; },
        signUp: async function(){ return { error:{ message:'mock' } }; },
        signOut: function(){}
      },
      rpc: async function(name, params){
        window.__rpcCalls = window.__rpcCalls || [];
        window.__rpcCalls.push({ name: name, params: params });
        if(name === 'get_custom_topic_by_code'){
          var c = (params.p_code || '').trim().toUpperCase();
          if(c === ${JSON.stringify(GOOD_CODE)}) return { data: ${JSON.stringify(CANNED_TOPIC)}, error: null };
          return { data: null, error: null };
        }
        if(name === 'save_custom_topic'){
          return { data: null, error: { message: 'SIGNIN_REQUIRED' } };
        }
        return { data: null, error: { message: 'unknown rpc ' + name } };
      },
      from: function(){
        var chain = {
          select: function(){ return chain; },
          delete: function(){ return chain; },
          insert: function(){ return chain; },
          update: function(){ return chain; },
          eq: function(){ return chain; },
          order: function(){ return Promise.resolve({ data: [], error: null }); },
          single: function(){ return Promise.resolve({ data: null, error: null }); },
          then: function(res){ return Promise.resolve({ data: [], error: null }).then(res); }
        };
        return chain;
      }
    };
  }
};
`;

const FREE = ['أمثال عراقية','لهجة عراقية','أكل عراقي','بغداد','محافظات العراق','تاريخ العراق','معلومات عامة','رياضة'];
// موضوع يسقط حصراً بالصفحة الثانية — هو الدليل إن الترقيم يشتغل
const PAGE2_ONLY_TOPIC = 'موضوع_بالصفحة_الثانية';
const CANNED_BANK = (() => {
  const rows = [];
  const pad = ['حشو أ','حشو ب','حشو ج','حشو د','حشو هـ','حشو و','حشو ز','حشو ح','حشو ط','حشو ي','حشو ك','حشو ل'];
  FREE.concat(pad).forEach(t => {
    [100,100,100,200,200,200,400,400,600,600].forEach((p, i) => {
      rows.push({ topic: t, points: p, question: `سؤال ${t} ${i}`, answer: `جواب ${i}`, image: null, media_type: null });
    });
  });
  // نكبّرها لتعدي ١٠٠٠ صف
  while (rows.length < 1040) {
    const i = rows.length;
    rows.push({ topic: 'حشو كبير', points: [100,200,400,600][i % 4], question: 'سؤال حشو ' + i, answer: 'جواب ' + i, image: null, media_type: null });
  }
  // الموضوع الحصري بالآخر → يطلع بالصفحة الثانية فقط
  [100,100,100,200,200,200,400,400,600,600].forEach((p, i) => {
    rows.push({ topic: PAGE2_ONLY_TOPIC, points: p, question: 'سؤال صفحة٢ ' + i, answer: 'جواب ' + i, image: null, media_type: null });
  });
  return rows;
})();

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();

  const pageRequests = [];
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.includes('unpkg.com') && url.includes('supabase')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: SHIM });
    }
    if (url.includes('/rest/v1/category_questions')) {
      // نقلّد سلوك Supabase: نحترم Range ونسقّف كل طلب بـ ١٠٠٠ صف
      const h = route.request().headers();
      let from = 0, to = 999;
      const m = /^(\d+)-(\d+)$/.exec(h['range'] || '');
      if (m) { from = +m[1]; to = Math.min(+m[2], from + 999); }
      const slice = CANNED_BANK.slice(from, to + 1);
      pageRequests.push(h['range'] || '(بلا Range)');
      return route.fulfill({
        status: 206, contentType: 'application/json',
        headers: { 'content-range': `${from}-${from + slice.length - 1}/${CANNED_BANK.length}` },
        body: JSON.stringify(slice)
      });
    }
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com') || url.includes('flagcdn.com')) {
      return route.abort();
    }
    if (url.startsWith(BASE)) return route.continue();
    return route.abort();
  });

  let pass = 0, fail = 0;
  const step = async (name, fn) => {
    try { await fn(); console.log('  ✓ ' + name); pass++; }
    catch (e) { console.log('  ✗ ' + name + '\n      → ' + e.message); fail++; }
  };

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  console.log('\nالأساسيات');
  await step('الصفحة تفتح والهب يظهر', async () => {
    await page.waitForSelector('#card-cat', { timeout: 10000 });
  });
  await step('لعبة الفئات توصل شاشة المواضيع', async () => {
    await page.click('#card-cat');
    await page.waitForSelector('#ct-new', { timeout: 15000 });
  });
  await step('لوحة الفئات المخصصة ظاهرة بلا تسجيل دخول وبلا قفل', async () => {
    const txt = await page.evaluate(() => document.body.innerText);
    if (await page.$('#user-box')) throw new Error('متوقع غير مسجلين');
    if (!txt.includes('سوّي فئة جديدة')) throw new Error('زر الإنشاء مو ظاهر');
    if (txt.includes('🔒 أضف موضوع خاص')) throw new Error('اللوحة القديمة المقفولة لا تزال ظاهرة');
  });

  console.log('\nترقيم بنك الأسئلة (الباگ اللي صار بـ limit=2000)');
  await step('الكود يطلب أكثر من صفحة وحدة', async () => {
    if (pageRequests.length < 2)
      throw new Error('طلب ' + pageRequests.length + ' صفحة فقط — الترقيم مو شغال: ' + pageRequests.join(' | '));
  });
  await step('موضوع موجود بالصفحة الثانية فقط يوصل للتطبيق', async () => {
    const got = await page.evaluate(t => CATEGORY_TOPICS.includes(t), PAGE2_ONLY_TOPIC);
    if (!got) throw new Error('الموضوع اللي بالصفحة الثانية ضاع — نفس الباگ القديم');
  });
  await step('كل الأسئلة وصلت بلا قطع', async () => {
    const n = await page.evaluate(() => {
      let c = 0;
      Object.values(CATEGORY_DATA).forEach(t => [100,200,400,600].forEach(p => c += (t[p] || []).length));
      return c;
    });
    if (n !== CANNED_BANK.length)
      throw new Error('وصل ' + n + ' سؤال من ' + CANNED_BANK.length);
  });

  console.log('\nالباقة المجانية عراقية');
  await step('مواضيع الباقة المجانية كلها موجودة بالبنك', async () => {
    const missing = await page.evaluate(
      free => free.filter(t => !CATEGORY_TOPICS.includes(t)), FREE
    );
    if (missing.length) throw new Error('مواضيع مجانية مفقودة من البنك: ' + missing.join(', '));
  });
  await step('أغلب الباقة المجانية عراقي (٦ من ٨ على الأقل)', async () => {
    const iraqi = await page.evaluate(() => FREE_TOPICS.filter(t => /عراق|بغداد|أمثال|لهجة/.test(t)).length);
    const total = await page.evaluate(() => FREE_TOPICS.length);
    if (iraqi < 6) throw new Error(`فقط ${iraqi} من ${total} مواضيع عراقية`);
  });

  console.log('\nالاستيراد بالكود');
  await step('كود غلط → رسالة واضحة', async () => {
    await page.fill('#ct-code', 'ZZZZZZ');
    await page.click('#ct-import');
    await page.waitForFunction(() => document.body.innerText.includes('ما لقيت فئة بهذا الكود'), { timeout: 8000 });
  });
  await step('كود صحيح → تُضاف الفئة مع اسم صاحبها', async () => {
    await page.fill('#ct-code', GOOD_CODE);
    await page.click('#ct-import');
    await page.waitForFunction(() => document.body.innerText.includes('تمت إضافة فئة'), { timeout: 8000 });
    const txt = await page.evaluate(() => document.body.innerText);
    if (!txt.includes('أمير')) throw new Error('اسم صاحب الفئة ما ظهر');
  });
  await step('أحرف صغيرة ومسافات بالكود تنقبل', async () => {
    await page.evaluate(() => {
      state.pool = state.pool.filter(t => t.bankKey !== null);
      state.importedNotice = ''; state.importError = ''; render();
    });
    await page.fill('#ct-code', '  ' + GOOD_CODE.toLowerCase() + ' ');
    await page.click('#ct-import');
    await page.waitForFunction(() => document.body.innerText.includes('تمت إضافة فئة'), { timeout: 8000 });
  });
  await step('استيراد نفس الفئة مرتين يُمنع برسالة', async () => {
    await page.fill('#ct-code', GOOD_CODE);
    await page.click('#ct-import');
    await page.waitForFunction(() => document.body.innerText.includes('مضافة عندك أصلاً'), { timeout: 8000 });
  });
  await step('الفئة المستوردة ٦ أسئلة بنقاط ١٠٠/١٠٠/٢٠٠/٢٠٠/٤٠٠/٦٠٠', async () => {
    const info = await page.evaluate(() => {
      const t = state.pool.find(x => x.bankKey === null);
      return t && {
        count: t.questions.length,
        pts: t.questions.map(q => q.points).join(','),
        allText: t.questions.every(q => q.text && q.text.trim()),
        allAns: t.questions.every(q => q.answer && q.answer.trim())
      };
    });
    if (!info) throw new Error('ما لقيت الفئة بالـ pool');
    if (info.count !== 6) throw new Error('عدد الأسئلة ' + info.count);
    if (info.pts !== '100,100,200,200,400,600') throw new Error('النقاط ' + info.pts);
    if (!info.allText) throw new Error('أسئلة بلا نص');
    if (!info.allAns) throw new Error('أسئلة بلا جواب');
  });

  console.log('\nإنشاء فئة');
  await step('شاشة الإنشاء فيها ٦ صفوف سؤال + ٦ أجوبة', async () => {
    await page.click('#ct-new');
    await page.waitForSelector('#cd-name', { timeout: 8000 });
    if ((await page.$$('.cd-q')).length !== 6) throw new Error('صفوف الأسئلة مو ٦');
    if ((await page.$$('.cd-a')).length !== 6) throw new Error('صفوف الأجوبة مو ٦');
  });
  await step('عدّاد الأسئلة المكمّلة يتحدث', async () => {
    await page.fill('#cd-name', 'فئة اختبار');
    for (let i = 0; i < 6; i++) {
      await page.fill(`.cd-q[data-i="${i}"]`, 'سؤال ' + (i + 1));
      await page.fill(`.cd-a[data-i="${i}"]`, 'جواب ' + (i + 1));
    }
    const n = await page.evaluate(() => customDraftFilledCount());
    if (n !== 6) throw new Error('العدّاد ' + n + ' مو ٦');
  });
  await step('الحفظ بلا حساب يفتح نافذة الدخول (مو يفشل بصمت)', async () => {
    await page.click('#cd-save');
    await page.waitForSelector('#tab-signin', { timeout: 8000 });
    await page.evaluate(() => { state.showAuthModal = false; render(); });
  });
  await step('"استخدمها بهذي الجلسة" تضيف الفئة بلا حساب', async () => {
    const before = await page.evaluate(() => state.pool.filter(t => t.bankKey === null).length);
    await page.click('#cd-session');
    await page.waitForSelector('#ct-new', { timeout: 8000 });
    const after = await page.evaluate(() => state.pool.filter(t => t.bankKey === null).length);
    if (after !== before + 1) throw new Error(`${before} → ${after}, متوقع +١`);
  });
  await step('فئة بلا اسم تُرفض برسالة', async () => {
    await page.click('#ct-new');
    await page.waitForSelector('#cd-session', { timeout: 8000 });
    await page.click('#cd-session');
    await page.waitForFunction(() => document.body.innerText.includes('اكتب اسم الفئة أول'), { timeout: 8000 });
    await page.click('#cd-back');
    await page.waitForSelector('#ct-new', { timeout: 8000 });
  });

  console.log('\nاللعب بفئة مستوردة');
  await step('نص السؤال يظهر (مو شاشة الكتابة اليدوية) والجواب يُكشف', async () => {
    const res = await page.evaluate(() => {
      const t = state.pool.find(x => x.bankKey === null && x.questions.every(q => q.text));
      if (!t) return { ok: false, why: 'ما أكو فئة مكتملة' };
      state.selectedTopicIds = [t.id];
      state.screen = 'board';
      state.activeCell = { topicId: t.id, qId: t.questions[0].id };
      render();
      return { ok: true, text: t.questions[0].text, answer: t.questions[0].answer };
    });
    if (!res.ok) throw new Error(res.why);

    const shown = await page.evaluate(() => document.body.innerText);
    if (shown.includes('اكتب السؤال الآن'))
      throw new Error('ظهرت شاشة كتابة السؤال اليدوية — الأسئلة ما وصلت للّوح');
    if (!shown.includes(res.text)) throw new Error('نص السؤال ما ظهر');

    await page.click('#reveal');
    const after = await page.evaluate(() => document.body.innerText);
    if (!after.includes(res.answer)) throw new Error('الجواب ما ظهر بعد "إظهار الإجابة"');
  });

  console.log('\nنافذة كود المشاركة');
  await step('النافذة تعرض الكود وأزرار النسخ والواتساب', async () => {
    await page.evaluate(() => { state.customShareCode = 'K7M2QP'; render(); });
    await page.waitForSelector('#sc-copy', { timeout: 8000 });
    const txt = await page.evaluate(() => document.body.innerText);
    if (!txt.includes('K7M2QP')) throw new Error('الكود ما ظهر');
    const wa = await page.getAttribute('#sc-wa', 'href');
    if (!wa || !wa.startsWith('https://wa.me/?text=')) throw new Error('رابط الواتساب غلط: ' + wa);
    if (!decodeURIComponent(wa).includes('K7M2QP')) throw new Error('الكود مو داخل رسالة الواتساب');
  });

  console.log('\nأخطاء جافاسكربت غير متوقعة');
  if (errors.length) { console.log('  ✗ ' + errors.join('\n  ')); fail++; }
  else console.log('  ✓ ماكو أي خطأ بالصفحة');

  if (consoleErrors.length) console.log('\n(console.error: ' + consoleErrors.join(' | ') + ')');

  console.log(`\n${'='.repeat(40)}\nناجح: ${pass}   فاشل: ${fail}\n${'='.repeat(40)}`);

  await browser.close();
  process.exit(fail ? 1 : 0);
})();
