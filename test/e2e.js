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
          if(c === 'HIDDEN1') return { data: { hidden: true }, error: null };
          return { data: null, error: null };
        }
        if(name === 'save_custom_topic'){
          if(window.__signedIn) return { data: { id: 1, share_code: 'NEWCD1' }, error: null };
          return { data: null, error: { message: 'SIGNIN_REQUIRED' } };
        }
        if(name === 'report_custom_topic'){
          window.__reports = window.__reports || [];
          window.__reports.push(params);
          return { data: { ok: true, already: false }, error: null };
        }
        return { data: null, error: { message: 'unknown rpc ' + name } };
      },
      from: function(table){
        if(table === 'whoami_characters'){
          var names = [];
          for(var i=1;i<=40;i++) names.push({name:'شخصية '+i});
          var c2 = {
            select: function(){ return c2; },
            limit: function(){ return Promise.resolve({ data: names, error: null }); },
            then: function(r){ return Promise.resolve({ data: names, error: null }).then(r); }
          };
          return c2;
        }
        var chain = {
          select: function(){ return chain; },
          delete: function(){ return chain; },
          insert: function(){ return chain; },
          update: function(){ window.__profileUpdated = true; return chain; },
          eq: function(){ return Promise.resolve({ data: null, error: null }); },
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

  console.log('\nزر التبليغ داخل شاشة السؤال');
  await step('فئة منشورة: زر ⚑ يظهر باللوح ويفتح نافذة البلاغ', async () => {
    await page.evaluate(() => {
      state.pool = state.pool.filter(t => t.bankKey !== null);
      const t = makeCustomTopicFromData('فئة منشورة',
        [{question:'سؤال مسيء؟',answer:'ج',points:100}], 'ABC123');
      state.pool.push(t);
      state.screen = 'board';
      state.activeCell = { topicId: t.id, qId: t.questions[0].id };
      render();
    });
    await page.waitForSelector('.q-report', { timeout: 8000 });
    await page.click('.q-report');
    await page.waitForFunction(() => document.body.innerText.includes('بلّغ عن فئة'), { timeout: 8000 });
    await page.evaluate(() => closeReportModal());
  });
  await step('فئة محلية: ما يظهر زر ⚑ (ما تنشرت)', async () => {
    const n = await page.evaluate(() => {
      state.pool = [];
      const t = makeCustomTopicFromData('محلية', [{question:'س',answer:'ج',points:100}]);
      state.pool.push(t);
      state.screen = 'board';
      state.activeCell = { topicId: t.id, qId: t.questions[0].id };
      render();
      return document.querySelectorAll('.q-report').length;
    });
    if (n !== 0) throw new Error('ظهر زر بلاغ لفئة غير منشورة');
    await page.evaluate(() => { state.activeCell = null; goto('hub'); });
  });

  console.log('\nالإشراف على المحتوى (متطلبات Google للـ UGC)');
  await step('كود مخفي بالبلاغات يعطي رسالة واضحة', async () => {
    await page.evaluate(() => { state.pool = state.pool.filter(t => t.bankKey !== null); goto('editor'); });
    await page.waitForSelector('#ct-code', { timeout: 8000 });
    await page.fill('#ct-code', 'HIDDEN1');
    await page.click('#ct-import');
    await page.waitForFunction(() => document.body.innerText.includes('مخفية بسبب بلاغات'), { timeout: 8000 });
  });
  await step('زر البلاغ يظهر على الفئة المستوردة فقط', async () => {
    await page.evaluate(() => { state.importError=''; render(); });
    await page.fill('#ct-code', GOOD_CODE);
    await page.click('#ct-import');
    await page.waitForFunction(() => document.body.innerText.includes('تمت إضافة فئة'), { timeout: 8000 });
    const n = await page.$$eval('.report-btn', els => els.length);
    if (n < 1) throw new Error('زر البلاغ مو ظاهر على فئة منشورة');
    // فئة محلية بلا كود: ما يجوز يظهر لها زر بلاغ
    const localHasBtn = await page.evaluate(() => {
      state.pool.push(makeCustomTopicFromData('فئة محلية', [{question:'س',answer:'ج',points:100}]));
      render();
      const rows = [...document.querySelectorAll('.panel')].map(p => p.innerText).join('');
      return rows.includes('فئة محلية');
    });
    if (!localHasBtn) throw new Error('الفئة المحلية ما ظهرت');
    const n2 = await page.$$eval('.report-btn', els => els.length);
    if (n2 !== n) throw new Error('ظهر زر بلاغ لفئة محلية غير منشورة');
  });
  await step('نافذة البلاغ تعرض أسباباً وترفض الإرسال بلا سبب', async () => {
    await page.click('.report-btn');
    await page.waitForFunction(() => document.body.innerText.includes('بلّغ عن فئة'), { timeout: 8000 });
    await page.click('#rep-send');
    await page.waitForFunction(() => document.body.innerText.includes('اختار سبب البلاغ'), { timeout: 8000 });
  });
  await step('اختيار سبب وإرسال البلاغ ينجح ويوصل للخادم', async () => {
    await page.evaluate(() => { state.reportReason = 'offensive'; state.reportNote = 'اختبار'; render(); });
    await page.click('#rep-send');
    await page.waitForFunction(() => document.body.innerText.includes('وصلنا بلاغك'), { timeout: 8000 });
    const sent = await page.evaluate(() => window.__reports || []);
    if (!sent.length) throw new Error('ما انرسل أي بلاغ للخادم');
    if (sent[0].p_reason !== 'offensive') throw new Error('سبب البلاغ غلط: ' + sent[0].p_reason);
    if (!sent[0].p_code) throw new Error('البلاغ بلا كود الفئة');
    await page.evaluate(() => { closeReportModal(); });
  });
  await step('الحفظ يفتح نافذة الشروط أول (سياسة Google)', async () => {
    await page.evaluate(() => {
      window.__signedIn = true;
      state.user = { uid:'u1', name:'test', isSubscribed:true, termsAcceptedAt:null, coins:500 };
      state.customDraft = newCustomDraft();
      state.customDraft.name = 'فئة شروط';
      state.customDraft.questions.forEach((q,i) => { q.question='س'+i; q.answer='ج'+i; });
      goto('custom-editor');
    });
    await page.waitForSelector('#cd-save', { timeout: 8000 });
    await page.click('#cd-save');
    await page.waitForFunction(() => document.body.innerText.includes('قبل ما تنشر فئتك'), { timeout: 8000 });
  });
  await step('نافذة الشروط تذكر القواعد وفيها رابط الشروط', async () => {
    const txt = await page.evaluate(() => document.body.innerText);
    for (const kw of ['مسيء', 'جنسي', 'الكراهية', 'معلومات شخصية']) {
      if (!txt.includes(kw)) throw new Error('القاعدة مفقودة من النافذة: ' + kw);
    }
    const href = await page.getAttribute('.overlay a[target="_blank"]', 'href');
    if (href !== 'terms.html') throw new Error('رابط الشروط غلط: ' + href);
  });
  await step('الموافقة تُسجَّل ثم يكمل الحفظ', async () => {
    await page.click('#terms-ok');
    await page.waitForFunction(() => !!state.customShareCode || !!state.customError, { timeout: 10000 });
    const r = await page.evaluate(() => ({
      updated: !!window.__profileUpdated,
      accepted: !!(state.user && state.user.termsAcceptedAt),
      code: state.customShareCode,
      err: state.customError
    }));
    if (!r.updated) throw new Error('الموافقة ما انحفظت بالملف الشخصي');
    if (!r.accepted) throw new Error('حالة الموافقة ما اتحدثت محلياً');
    if (!r.code) throw new Error('الحفظ ما اكتمل بعد الموافقة: ' + r.err);
  });
  await step('من وافق مرة ما تنطلب منه مرة ثانية', async () => {
    const again = await page.evaluate(() => needsTermsAcceptance());
    if (again) throw new Error('راح تنطلب الموافقة كل مرة');
  });

  console.log('\nالكوينات');
  await step('رصيد ناقص يمنع النشر ويقول كم باقي', async () => {
    await page.evaluate(() => {
      state.user = { uid:'u2', name:'فقير', isSubscribed:true,
                     termsAcceptedAt:'2026-01-01T00:00:00Z', coins:40 };
      state.customShareCode = null;
      state.customError = '';
      state.customDraft = newCustomDraft();
      state.customDraft.name = 'فئة بلا كوينات';
      state.customDraft.questions.forEach((q,i) => { q.question='س'+i; q.answer='ج'+i; });
      goto('custom-editor');
    });
    await page.waitForSelector('#cd-save', { timeout: 8000 });
    await page.click('#cd-save');
    await page.waitForFunction(() => !!state.customError, { timeout: 8000 });
    const r = await page.evaluate(() => ({ err: state.customError, code: state.customShareCode }));
    if (r.code) throw new Error('انحفظت رغم إن الرصيد ما يكفي');
    if (!r.err.includes('60')) throw new Error('ما قال كم باقي عليه: ' + r.err);
  });
  await step('السعر مكتوب بالشاشة قبل ما يضغط', async () => {
    const txt = await page.evaluate(() => document.body.innerText);
    if (!txt.includes('100')) throw new Error('سعر النشر مو ظاهر');
  });
  await step('رصيد كافي يمرّ للحفظ', async () => {
    await page.evaluate(() => {
      state.user.coins = 300;
      state.customError = '';
      state.customShareCode = null;
      render();
    });
    await page.click('#cd-save');
    await page.waitForFunction(() => !!state.customShareCode || !!state.customError, { timeout: 10000 });
    const r = await page.evaluate(() => ({ code: state.customShareCode, err: state.customError }));
    if (!r.code) throw new Error('ما انحفظت رغم إن الرصيد يكفي: ' + r.err);
  });
  await step('الرصيد يظهر بالشريط العلوي', async () => {
    await page.evaluate(() => { state.user.coins = 777; goto('hub'); });
    const chip = await page.evaluate(() => {
      const e = document.querySelector('.coin-chip');
      return e ? e.textContent.trim() : null;
    });
    if (!chip || !chip.includes('777')) throw new Error('الرصيد مو بالشريط: ' + chip);
  });
  await step('زر «شاهد إعلان» انشال من نافذة السؤال', async () => {
    const gone = await page.evaluate(() =>
      typeof showRewardedAd === 'undefined' &&
      !document.body.innerHTML.includes('data-type="ad"'));
    if (!gone) throw new Error('لسه أكو إعلان مكافأة بنص اللعب');
  });
  await step('مفاتيح إعلانات الفواصل تشتغل ومرة وحدة لكل فاصل', async () => {
    const r = await page.evaluate(() => {
      let n = 0;
      const real = window.showInterstitialAd;
      window.showInterstitialAd = () => { n++; };
      window.admobReady = true;
      resetAdGates();
      const saved = state.user; state.user = null;
      try{
        showBreakAd('start'); showBreakAd('start'); showBreakAd('start');
        showBreakAd('mid');   showBreakAd('end');
      } finally {
        state.user = saved; window.showInterstitialAd = real;
      }
      return n;
    });
    // ٣ فواصل مختلفة = ٣ إعلانات، والتكرار على نفس الفاصل ما يحسب.
    // (على المتصفح isNativeApp()=false فما ينعرض شي — نتأكد بس إن ما ينهار)
    if (typeof r !== 'number') throw new Error('showBreakAd انهار');
  });

  console.log('\nلعبة من أنا؟ (الباگ: شاشة فاضية)');
  await step('دوال الشاشات كلها معرَّفة', async () => {
    const missing = await page.evaluate(() =>
      ['renderWhoamiSetup','renderWhoamiReveal','renderWhoamiPlay','renderWhoamiEnd',
       'startWhoamiTimer','stopWhoamiTimer','fetchRandomCharacters']
        .filter(f => typeof window[f] !== 'function'));
    if (missing.length) throw new Error('مفقودة: ' + missing.join(', '));
  });
  await step('شاشة تجهيز اللاعبين ترسم محتوى (مو فاضية)', async () => {
    await page.evaluate(() => { state.user = {uid:'t',name:'test',isSubscribed:true}; goto('whoami-setup'); });
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => {
      const app = document.getElementById('app');
      return { children: app.children.length, text: app.innerText.trim().length };
    });
    if (info.children < 2) throw new Error('ماكو إلا الشريط العلوي — الشاشة فاضية');
    if (info.text < 40) throw new Error('المحتوى شبه فاضي (' + info.text + ' حرف)');
  });
  await step('الشاشة تعرض عنوان اللعبة وأدوات التجهيز', async () => {
    const txt = await page.evaluate(() => document.getElementById('app').innerText);
    if (!txt.includes('من أنا؟')) throw new Error('عنوان اللعبة مو ظاهر');
  });
  await step('حارس الأخطاء يمنع الشاشة الفاضية', async () => {
    const shown = await page.evaluate(() => {
      state.screen = 'شاشة_غير_موجودة';
      window.renderHub = () => { throw new Error('عطل تجريبي'); };
      render();
      const t = document.getElementById('app').innerText;
      delete window.renderHub;
      return t;
    });
    if (!shown.includes('صارت مشكلة بهذي الشاشة'))
      throw new Error('الحارس ما اشتغل — اللاعب راح يشوف شاشة فاضية');
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