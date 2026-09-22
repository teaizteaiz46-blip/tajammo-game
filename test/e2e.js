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
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8099';
const PORT = 8099;
const WWW = path.join(__dirname, '..', 'www');

/* متصفح الاختبار: بالحاويات مثبّت بمسار ثابت، وعلى ويندوز/ماك
   ينزّله playwright بمكانه الخاص. نستخدم الثابت إذا موجود بس. */
const PINNED = '/opt/pw-browsers/chromium';
const LAUNCH = fs.existsSync(PINNED) ? { executablePath: PINNED } : {};

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

/* نشغّل خادم الملفات جوّا الاختبار — حتى `npm test` يشتغل بأمر واحد
   بلا ما تحتاج تفتح نافذة ثانية وتشغّل خادم بإيدك. */
function startServer(){
  return new Promise((resolve)=>{
    const srv = http.createServer((req, res)=>{
      let p = decodeURIComponent(req.url.split('?')[0]);
      if(p === '/' || p.endsWith('/')) p += 'index.html';
      const file = path.join(WWW, path.normalize(p).replace(/^[\\/]+/, ''));
      if(!file.startsWith(WWW) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){
        res.writeHead(404); return res.end('404');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.on('error', e=>{
      // خادم شغال أصلاً على نفس المنفذ — نكمل عليه
      if(e.code === 'EADDRINUSE'){ console.log('(خادم شغال أصلاً على ' + PORT + ')'); resolve(null); }
      else throw e;
    });
    srv.listen(PORT, ()=> resolve(srv));
  });
}
const GOOD_CODE = '4U6AMY';

const CANNED_TOPIC = {
  name: 'أسئلة عن الكروب',
  share_code: GOOD_CODE,
  author_name: 'أمير',
  author_key: 'authorkey-test-1',
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
        if(name === 'delete_my_account'){
          window.__accountDeleted = true;
          return { data: { ok: true }, error: null };
        }
        if(name === 'report_custom_topic'){
          window.__reports = window.__reports || [];
          window.__reports.push(params);
          return { data: { ok: true, already: false }, error: null };
        }
        return { data: null, error: { message: 'unknown rpc ' + name } };
      },
      from: function(table){
        if(table === 'party_items'){
          var items = [];
          for(var s1=1;s1<=30;s1++) items.push({game:'spy', text:'مكان '+s1});
          for(var b1=1;b1<=20;b1++) items.push({game:'bomb', text:'اذكر شي '+b1, examples:'مثال أ، مثال ب، مثال ج'});
          items.push({game:'bomb', text:'اذكر بلد يبدأ بحرف {حرف}', examples:'تونس، تركيا، تشاد'});
          var c3 = {
            select: function(){ return c3; },
            eq: function(){ return c3; },
            limit: function(){ return Promise.resolve({ data: items, error: null }); },
            then: function(r){ return Promise.resolve({ data: items, error: null }).then(r); }
          };
          return c3;
        }
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
  // موضوع أغاني: أسئلته تعتمد مقطع صوتي من متجر آبل
  [100,100,100,200,200,200,400,400,600,600].forEach((p, i) => {
    rows.push({ topic: 'أغاني تجريبية', points: p, question: 'خمّن اسم هذي الأغنية',
                answer: 'أغنية ' + i + ' - مطرب ' + i, image: 'أغنية ' + i,
                media_type: 'song', clip_start: 0, clip_seconds: 10 });
  });
  // الموضوع الحصري بالآخر → يطلع بالصفحة الثانية فقط
  [100,100,100,200,200,200,400,400,600,600].forEach((p, i) => {
    rows.push({ topic: PAGE2_ONLY_TOPIC, points: p, question: 'سؤال صفحة٢ ' + i, answer: 'جواب ' + i, image: null, media_type: null });
  });
  return rows;
})();

(async () => {
  if(!fs.existsSync(path.join(WWW, 'index.html'))){
    console.error('مجلد www فاضي — شغّل `npm run build` أول.');
    process.exit(1);
  }
  const server = await startServer();
  const browser = await chromium.launch(LAUNCH);
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

  console.log('\nماكو اشتراك — كل شي مفتوح');
  await step('المواضيع العراقية كلها موجودة بالبنك', async () => {
    const missing = await page.evaluate(
      free => free.filter(t => !CATEGORY_TOPICS.includes(t)), FREE
    );
    if (missing.length) throw new Error('مواضيع مفقودة من البنك: ' + missing.join(', '));
  });

  await step('ماكو أي أثر لنظام الاشتراك بالكود', async () => {
    const left = await page.evaluate(() => ({
      isSub:  typeof isSubscribed,
      free:   typeof FREE_TOPICS,
      upsell: typeof openUpsell,
      modal:  typeof renderUpsellOverlay
    }));
    const alive = Object.keys(left).filter(k => left[k] !== 'undefined');
    if (alive.length) throw new Error('بقايا اشتراك: ' + alive.join(', '));
  });

  await step('كل مواضيع البنك تنحط بالحوض بلا قفل', async () => {
    const r = await page.evaluate(() => {
      state.pool = [];
      CATEGORY_TOPICS.forEach(t => state.pool.push(makeBankTopic(t)));
      state.screen = 'editor'; render();
      const txt = document.body.innerText;
      return { pool: state.pool.length, bank: CATEGORY_TOPICS.length,
               lock: txt.includes('🔒') || txt.includes('للمشتركين') };
    });
    if (r.pool !== r.bank) throw new Error('الحوض ' + r.pool + ' من ' + r.bank);
    if (r.lock) throw new Error('لسه أكو قفل بشاشة المواضيع');
  });

  await step('الألعاب الثلاث تنفتح بلا حساب ولا قفل', async () => {
    const r = await page.evaluate(() => {
      state.user = null;
      state.screen = 'hub'; render();
      const txt = document.body.innerText;
      const out = { lock: txt.includes('🔒') || txt.includes('للمشتركين'), opened: [] };
      ['card-whoami','card-shd'].forEach(id => {
        state.screen = 'hub'; render();
        document.getElementById(id).click();
        out.opened.push(state.screen);
      });
      return out;
    });
    if (r.lock) throw new Error('لسه أكو قفل بالصفحة الرئيسية');
    if (r.opened[0] !== 'whoami-setup') throw new Error('«من أنا؟» ما انفتحت: ' + r.opened[0]);
    if (r.opened[1] !== 'shd-setup')    throw new Error('«الحلفاء والشياطين» ما انفتحت: ' + r.opened[1]);
  });

  await step('الإعلانات ما تنتجاوز لأي لاعب', async () => {
    const r = await page.evaluate(() => {
      resetAdGates();
      let shown = 0;
      const real = window.showInterstitialAd;
      window.showInterstitialAd = () => { shown++; };
      const nativeReal = window.isNativeApp;
      window.isNativeApp = () => true;
      window.admobReady = true;
      state.user = { uid:'x', name:'مشترك قديم', isSubscribed:true };
      showBreakAd('start');
      window.showInterstitialAd = real; window.isNativeApp = nativeReal;
      return { shown };
    });
    // admobReady متغيّر داخلي ما ينكتب من برا، فالمهم إن ماكو شرط اشتراك يمنع
    const src = await page.evaluate(() => showBreakAd.toString());
    if (/isSubscribed/.test(src)) throw new Error('لسه أكو شرط اشتراك يمنع الإعلان');
  });

  /* هذي الاختبارات نقلت الشاشة — نرجّعها لشاشة المواضيع
     لأن اللي بعدها يشتغل عليها */
  await page.evaluate(() => {
    state.user = null;               // اختبار الإعلانات خلّى لاعب مسجّل
    state.screen = 'editor'; state.history = []; render();
  });
  await page.waitForSelector('#ct-code', { timeout: 8000 });

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
      state.user = { uid:'u1', name:'test', termsAcceptedAt:null, coins:500 };
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
      state.user = { uid:'u2', name:'فقير',
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
    await page.evaluate(() => { state.user = {uid:'t',name:'test'}; goto('whoami-setup'); });
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

  console.log('\nمساعدة الخيارات');
  await step('الجواب رقم ← كل الخيارات أرقام بنفس الوحدة', async () => {
    const opts = await page.evaluate(() => {
      const topic = { bankKey: 'ت', questions: [] };
      const keep = CATEGORY_DATA;
      CATEGORY_DATA = { 'ت': { 100:[{answer:'٨ أرجل'},{answer:'الأسد'},{answer:'فيبي'},
                                    {answer:'الحوت الأزرق'},{answer:'الزرافة'}], 200:[],400:[],600:[] } };
      const out = buildChoices(topic, { answer: '٨ أرجل' });
      CATEGORY_DATA = keep;
      return out;
    });
    if (!opts || opts.length !== 3) throw new Error('ما رجّع ٣ خيارات: ' + JSON.stringify(opts));
    if (!opts.includes('٨ أرجل')) throw new Error('الجواب الصحيح مو ضمن الخيارات');
    const noDigits = opts.filter(o => !/[٠-٩0-9]/.test(o));
    if (noDigits.length) throw new Error('خيار بلا رقم وية جواب رقمي: ' + noDigits.join(','));
  });

  await step('الجواب اسم ← ماكو خيار رقمي ينفضح', async () => {
    const opts = await page.evaluate(() => {
      const topic = { bankKey: 'ت', questions: [] };
      const keep = CATEGORY_DATA;
      CATEGORY_DATA = { 'ت': { 100:[{answer:'فيبي (Phoebe)'},{answer:'مونيكا'},{answer:'روس'},
                                    {answer:'١٠ مواسم'},{answer:'٦ أصدقاء'}], 200:[],400:[],600:[] } };
      const out = buildChoices(topic, { answer: 'فيبي (Phoebe)' });
      CATEGORY_DATA = keep;
      return out;
    });
    if (!opts || opts.length !== 3) throw new Error('ما رجّع ٣ خيارات');
    if (!opts.includes('فيبي')) throw new Error('الجواب مو ضمن الخيارات: ' + opts.join('/'));
    const withDigits = opts.filter(o => /[٠-٩0-9]/.test(o));
    if (withDigits.length) throw new Error('خيار رقمي وية جواب اسم: ' + withDigits.join(','));
  });

  await step('كل الخيارات بنفس الصيغة — ماكو (English) بوحدة بس', async () => {
    const opts = await page.evaluate(() => {
      const topic = { bankKey: 'ت', questions: [] };
      const keep = CATEGORY_DATA;
      CATEGORY_DATA = { 'ت': { 100:[{answer:'اليابانية (Japanese)'},{answer:'اليونانية (Greek)'},
                                    {answer:'العربية'},{answer:'الفرنسية'}], 200:[],400:[],600:[] } };
      const out = buildChoices(topic, { answer: 'اليابانية (Japanese)' });
      CATEGORY_DATA = keep;
      return out;
    });
    if (opts.some(o => o.includes('('))) throw new Error('بقى قوس إنكليزي يفضح الخيار: ' + opts.join('/'));
  });

  console.log('\nالتراجع عن اختيار الفئة');
  await step('زر التراجع يرجّع الفئة والدور', async () => {
    const r = await page.evaluate(() => {
      state.screen = 'select';
      state.selectedTopicIds = [];
      state.turn = 0;
      state.pool = [
        { id: 1, name: 'أ', taken: false, questions: [] },
        { id: 2, name: 'ب', taken: false, questions: [] },
        { id: 3, name: 'ج', taken: false, questions: [] }
      ];
      render();
      document.querySelectorAll('.pick-card')[0].click();   // الفريق الأول يختار «أ»
      const afterPick = { turn: state.turn, picked: state.selectedTopicIds.slice(), taken: state.pool[0].taken };
      const btn = document.getElementById('undo-pick');
      const hasBtn = !!btn;
      if (btn) btn.click();
      return { afterPick, hasBtn, turn: state.turn, picked: state.selectedTopicIds.slice(), taken: state.pool[0].taken };
    });
    if (r.afterPick.turn !== 1 || r.afterPick.picked.length !== 1) throw new Error('الاختيار نفسه ما اشتغل');
    if (!r.hasBtn) throw new Error('زر التراجع ما ظهر بعد أول اختيار');
    if (r.picked.length !== 0) throw new Error('الفئة ظلت مختارة بعد التراجع');
    if (r.taken !== false) throw new Error('علامة taken ما انشالت');
    if (r.turn !== 0) throw new Error('الدور ما رجع للفريق الأول: ' + r.turn);
  });

  await step('ماكو زر تراجع قبل أي اختيار', async () => {
    const has = await page.evaluate(() => {
      state.screen = 'select';
      state.selectedTopicIds = [];
      state.turn = 0;
      state.pool = [{ id: 1, name: 'أ', taken: false, questions: [] }];
      render();
      return !!document.getElementById('undo-pick');
    });
    if (has) throw new Error('زر التراجع ظهر وماكو شي ينتراجع عنه');
  });

  await step('التراجع متاح حتى بعد اكتمال الفئات الست', async () => {
    const r = await page.evaluate(() => {
      state.screen = 'select';
      state.pool = [1,2,3,4,5,6].map(i => ({ id: i, name: 'ف'+i, taken: true, takenBy: (i+1)%2, questions: [] }));
      state.selectedTopicIds = [1,2,3,4,5,6];
      state.turn = 0;
      render();
      const hasStart = !!document.getElementById('start-board');
      const btn = document.getElementById('undo-pick');
      if (btn) btn.click();
      return { hasStart, hadUndo: !!btn, picked: state.selectedTopicIds.length, taken6: state.pool[5].taken };
    });
    if (!r.hasStart) throw new Error('زر البدء اختفى');
    if (!r.hadUndo) throw new Error('ماكو زر تراجع بشاشة الاكتمال');
    if (r.picked !== 5 || r.taken6 !== false) throw new Error('التراجع ما شال الفئة السادسة');
  });

  console.log('\nنافذة السؤال: رجوع وإخفاء الإجابة');
  const setupQ = () => page.evaluate(() => {
    // اختبارات قبلها تخلي نوافذ ثانية مفتوحة، وهي تنرسم فوق نافذة
    // السؤال وتغطي أزرارها — ننظّفها أول
    state.customShareCode = null;
    state.reportTopic = null;
    state.showAuthModal = false;
    state.showUpsellModal = false;
    state.showTermsModal = false;
    state.pool = state.pool.filter(t => t.bankKey !== null);
    const t = makeCustomTopicFromData('فئة اختبار',
      [{question:'ما هي عاصمة اليابان؟', answer:'طوكيو', points:100}]);
    state.pool.push(t);
    state.selectedTopicIds = [t.id];
    state.teams[0].helps = 3; state.teams[1].helps = 3;
    t.taken = true; t.takenBy = 0;
    state.screen = 'board';
    state.activeCell = { topicId: t.id, qId: t.questions[0].id };
    delete t.questions[0].revealed;
    delete t.questions[0].usedBy;
    render();
    return { tid: t.id, qid: t.questions[0].id };
  });

  await step('زر الرجوع يسكّر النافذة والسؤال يبقى متاح', async () => {
    await setupQ();
    if (!(await page.$('#q-close'))) throw new Error('زر الرجوع مو موجود بالنافذة');
    await page.click('#q-close');
    const r = await page.evaluate(() => {
      const t = state.pool.find(x => x.bankKey === null);
      return { active: state.activeCell, used: t.questions[0].usedBy, overlay: !!document.querySelector('.overlay') };
    });
    if (r.overlay) throw new Error('النافذة ظلت مفتوحة');
    if (r.active !== null) throw new Error('activeCell ما انصفّر');
    if (r.used !== undefined) throw new Error('السؤال انحرق — المفروض يبقى متاح');
  });

  await step('الرجوع بعد كشف الإجابة يرجّعها مخفية', async () => {
    await setupQ();
    await page.click('#reveal');
    let txt = await page.evaluate(() => document.body.innerText);
    if (!txt.includes('طوكيو')) throw new Error('الجواب ما انكشف أصلاً');
    await page.click('#q-close');
    // نفتحه من جديد
    await page.evaluate(() => {
      const t = state.pool.find(x => x.bankKey === null);
      state.activeCell = { topicId: t.id, qId: t.questions[0].id };
      render();
    });
    txt = await page.evaluate(() => document.body.innerText);
    if (txt.includes('طوكيو')) throw new Error('الجواب ظل مكشوف بعد ما رجع وفتح من جديد');
    if (!(await page.$('#reveal'))) throw new Error('زر «إظهار الإجابة» ما رجع');
  });

  await step('زر «إخفاء الإجابة» يخفيها ويرجّع زر الإظهار', async () => {
    await setupQ();
    await page.click('#reveal');
    if (!(await page.$('#hide-answer'))) throw new Error('زر الإخفاء مو موجود بعد الكشف');
    await page.click('#hide-answer');
    const r = await page.evaluate(() => {
      const t = state.pool.find(x => x.bankKey === null);
      return { txt: document.body.innerText, revealed: !!t.questions[0].revealed,
               open: !!state.activeCell, used: t.questions[0].usedBy };
    });
    if (r.txt.includes('طوكيو')) throw new Error('الجواب بعده ظاهر');
    if (r.revealed) throw new Error('revealed ما انصفّر');
    if (!r.open) throw new Error('النافذة انسكّرت — المفروض تظل مفتوحة');
    if (r.used !== undefined) throw new Error('السؤال انحرق بالغلط');
    if (!(await page.$('#reveal'))) throw new Error('زر «إظهار الإجابة» ما رجع');
  });

  await step('نافذة كتابة السؤال اليدوي بيها رجوع هي بعد', async () => {
    await page.evaluate(() => {
      state.customShareCode = null; state.reportTopic = null;
      state.showAuthModal = false; state.showUpsellModal = false; state.showTermsModal = false;
      state.pool = state.pool.filter(t => t.bankKey !== null);
      const t = makeCustomTopic('فئة فاضية');   // أسئلتها بلا نص
      state.pool.push(t);
      state.selectedTopicIds = [t.id];
      state.screen = 'board';
      state.activeCell = { topicId: t.id, qId: t.questions[0].id };
      render();
    });
    const txt = await page.evaluate(() => document.body.innerText);
    if (!txt.includes('اكتب السؤال الآن')) throw new Error('مو شاشة الكتابة اليدوية');
    if (!(await page.$('#q-close-live'))) throw new Error('ماكو زر رجوع بشاشة الكتابة');
    await page.click('#q-close-live');
    if (await page.evaluate(() => !!document.querySelector('.overlay')))
      throw new Error('النافذة ظلت مفتوحة');
  });

  console.log('\nاللوح المقسوم (منو ضد منو)');
  const setupBoard = (owners) => page.evaluate((own) => {
    state.customShareCode = null; state.reportTopic = null;
    state.showAuthModal = false; state.showUpsellModal = false; state.showTermsModal = false;
    state.pool = [];
    const names = ['الموسيقى','الفن والرسم','الأساطير','الاختراعات','الأعلام والدول','الطبخ والأكل'];
    names.forEach((n, i) => {
      const t = makeCustomTopicFromData(n, [100,100,200,200,400,600].map((p, j) =>
        ({ question:'س'+j, answer:'ج'+j, points:p })));
      t.taken = true; t.takenBy = own[i];
      state.pool.push(t);
    });
    state.selectedTopicIds = state.pool.map(t => t.id);
    state.teams[0].score = 700; state.teams[1].score = 500;
    state.screen = 'board'; state.activeCell = null;
    render();
  }, owners);

  await step('اللوح ينقسم ورؤوس الأعمدة تنصبغ بلون كل فريق', async () => {
    await setupBoard([0,1,0,1,0,1]);
    const r = await page.evaluate(() => {
      const b = document.querySelector('.board.split');
      if (!b) return { split:false };
      return {
        split: true,
        t0: b.querySelectorAll('.topic-head.t0').length,
        t1: b.querySelectorAll('.topic-head.t1').length,
        band: !!document.querySelector('.team-band'),
        oldScore: !!document.querySelector('.scoreboard')
      };
    });
    if (!r.split) throw new Error('اللوح ما انقسم');
    if (r.t0 !== 3 || r.t1 !== 3) throw new Error('توزيع الرؤوس غلط: ' + r.t0 + '/' + r.t1);
    if (!r.band) throw new Error('شريط «منو ضد منو» ما ظهر');
    if (r.oldScore) throw new Error('لوحة النتيجة القديمة لسه موجودة — تكرار');
  });

  await step('الشريط يكتب كل قيمة مرة وحدة بدل ٣٦ رقم', async () => {
    const r = await page.evaluate(() => {
      const rails = [...document.querySelectorAll('.board.split .rail')]
        .filter(x => !x.classList.contains('head'));
      return {
        vals: rails.map(x => x.textContent),
        spans: rails.map(x => x.style.gridRow),
        heights: rails.map(x => Math.round(x.getBoundingClientRect().height))
      };
    });
    if (r.vals.join(',') !== '100,200,400,600')
      throw new Error('قيم الشريط: ' + r.vals.join(','));
    if (r.spans[0] !== 'span 2' || r.spans[2] !== 'span 1')
      throw new Error('امتداد الصفوف غلط: ' + r.spans.join(' | '));
    // ١٠٠ و٢٠٠ صفّين ← لازم أطول من ٤٠٠ و٦٠٠
    if (!(r.heights[0] > r.heights[2]))
      throw new Error('خانة الـ١٠٠ مو ممتدة على صفّين: ' + r.heights.join(','));
  });

  await step('الخانة المنلعبة تاخذ لون الفريق اللي كسبها', async () => {
    const r = await page.evaluate(() => {
      state.pool[0].questions[0].usedBy = 0;   // الفريق الأول
      state.pool[1].questions[0].usedBy = 1;   // الفريق الثاني
      state.pool[2].questions[0].usedBy = null; // ماكو جواب صحيح
      render();
      const b = document.querySelector('.board.split');
      const none = b.querySelector('.cell.used:not(.win0):not(.win1)');
      return {
        w0: b.querySelectorAll('.cell.win0').length,
        w1: b.querySelectorAll('.cell.win1').length,
        noneVisible: none ? getComputedStyle(none).color !== 'rgba(0, 0, 0, 0)' : false,
        dots: b.querySelectorAll('.cell .dot').length
      };
    });
    if (r.w0 !== 1 || r.w1 !== 1) throw new Error('التلوين غلط: ' + r.w0 + '/' + r.w1);
    if (!r.noneVisible) throw new Error('خانة «بدون إجابة» طالعة فاضية تماماً');
    if (r.dots !== 33) throw new Error('عدد الخانات الفارغة: ' + r.dots + ' (المتوقع ٣٣)');
  });

  await step('توزيع غير متساوٍ يرجع للشكل القديم بلا ما ينكسر', async () => {
    await setupBoard([0,0,0,0,1,1]);   // ٤ مقابل ٢
    const r = await page.evaluate(() => ({
      split: !!document.querySelector('.board.split'),
      flat: !!document.querySelector('.board:not(.split)'),
      score: !!document.querySelector('.scoreboard'),
      cells: document.querySelectorAll('.cell').length
    }));
    if (r.split) throw new Error('انقسم مع إنه التوزيع مو ٣/٣');
    if (!r.flat || !r.score) throw new Error('ما رجع للشكل القديم');
    if (r.cells !== 36) throw new Error('عدد الخانات: ' + r.cells);
  });

  console.log('\nسرعة تحميل بنك الأسئلة');
  await step('صفحات البنك تنطلب بالتوازي مو وحدة ورا وحدة', async () => {
    const r = await page.evaluate(async () => {
      const real = window.fetch;
      let inFlight = 0, maxConcurrent = 0;
      const calls = [];
      window.fetch = (url, opts) => {
        const range = (opts && opts.headers && opts.headers.Range) || '';
        calls.push(range);
        inFlight++; maxConcurrent = Math.max(maxConcurrent, inFlight);
        return new Promise(res => setTimeout(() => {
          inFlight--;
          const m = /^(\d+)-(\d+)$/.exec(range);
          const from = m ? +m[1] : 0;
          const end = Math.min(from + 1000, 2500);
          const rows = [];
          for (let i = from; i < end; i++) rows.push({ topic: 'تجريبي', points: 100, question: 'س' + i, answer: 'ج' + i });
          res({
            ok: true, status: 206,
            headers: { get: h => h.toLowerCase() === 'content-range' ? from + '-' + (end - 1) + '/2500' : null },
            json: async () => rows
          });
        }, 40));
      };
      try { await fetchWholeBank(); } finally { window.fetch = real; }
      return { calls, maxConcurrent };
    });
    if (r.calls.length !== 3) throw new Error('المتوقع ٣ طلبات لـ٢٥٠٠ صف، صار: ' + r.calls.length);
    if (r.maxConcurrent < 2) throw new Error('الطلبات صارت متسلسلة — التوازي مو شغال');
  });

  await step('البنك ينحفظ بالجهاز ويُستعمل بدل الشبكة بعد إعادة الفتح', async () => {
    const saved = await page.evaluate(() => {
      try { return !!localStorage.getItem('tajammo.bank.v1'); } catch (e) { return false; }
    });
    if (!saved) throw new Error('الكاش ما انحفظ بـ localStorage');

    const before = pageRequests.length;
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#card-cat', { timeout: 10000 });
    await page.waitForFunction(() => CATEGORY_TOPICS.length > 0, null, { timeout: 8000 });
    if (pageRequests.length !== before)
      throw new Error('نزّل ' + (pageRequests.length - before) + ' طلب من الشبكة مع إن الكاش موجود');
  });

  console.log('\nالشاشة الرئيسية الجديدة');
  await step('اسم التطبيق نص واحد بلا تقسيم (ينكسر تشكيله على الآيفون)', async () => {
    const r = await page.evaluate(() => {
      const h = document.querySelector('.hero h1');
      if (!h) return null;
      return {
        text: h.textContent,
        childEls: h.children.length,
        nodes: h.childNodes.length,
        zwj: /‍/.test(h.textContent)
      };
    });
    if (!r) throw new Error('عنوان الشاشة الرئيسية مو موجود');
    if (r.text !== 'تجمّع') throw new Error('نص الاسم تغيّر: ' + JSON.stringify(r.text));
    if (r.childEls !== 0) throw new Error('الاسم مقسوم على ' + r.childEls + ' عنصر — يكسر وصل الحروف بويب‌كِت');
    if (r.nodes !== 1) throw new Error('الاسم مقسوم على ' + r.nodes + ' عقدة نصية');
    if (r.zwj) throw new Error('بقى حرف ZWJ بالاسم — ما عاد له داعي بعد إلغاء التقسيم');
  });

  /* الخانتين «قريباً» انبدلوا بـ«من الدخيل؟» و«القنبلة الموقوتة»،
     فالشبكة صارت أربع ألعاب شغّالة بلا أي خانة فاضية. */
  await step('بطاقة مميزة + شبكة أربع ألعاب شغّالة', async () => {
    const r = await page.evaluate(() => ({
      feature: !!document.querySelector('.feature-card#card-cat'),
      cta: !!document.querySelector('.feature-cta'),
      tiles: document.querySelectorAll('.game-grid .game-tile').length,
      soon: document.querySelectorAll('.game-grid .game-tile.soon').length,
      whoami: !!document.querySelector('.game-tile#card-whoami'),
      shd: !!document.querySelector('.game-tile#card-shd'),
      spy: !!document.querySelector('.game-tile#card-spy'),
      bomb: !!document.querySelector('.game-tile#card-bomb')
    }));
    if (!r.feature) throw new Error('البطاقة المميزة مو موجودة');
    if (!r.cta) throw new Error('زر «العب الآن» مو موجود');
    if (r.tiles !== 4) throw new Error('عدد خانات الشبكة: ' + r.tiles);
    if (r.soon !== 0) throw new Error('بعده أكو خانة «قريباً»: ' + r.soon);
    if (!r.whoami || !r.shd || !r.spy || !r.bomb) throw new Error('لعبة ناقصة من الشبكة');
  });

  await step('كل مربع باللعبة يفتح شاشته', async () => {
    const r = await page.evaluate(() => {
      const out = {};
      document.querySelector('#card-spy').click();  out.spy = state.screen;
      goto('hub');
      document.querySelector('#card-bomb').click(); out.bomb = state.screen;
      goto('hub');
      return out;
    });
    if (r.spy !== 'spy-setup') throw new Error('مربع الدخيل فتح: ' + r.spy);
    if (r.bomb !== 'bomb-setup') throw new Error('مربع القنبلة فتح: ' + r.bomb);
  });

  await step('رسمة البطاقة المميزة تنحمّل فعلاً', async () => {
    const ok = await page.evaluate(async () => {
      const img = document.querySelector('.feature-art img');
      if (!img) return 'ماكو صورة بالبطاقة';
      if (!img.complete) await new Promise(res => { img.onload = res; img.onerror = res; });
      return img.naturalWidth > 0 ? true : 'الصورة ما انحمّلت: ' + img.getAttribute('src');
    });
    if (ok !== true) throw new Error(ok);
  });

  await step('الضغط على البطاقة المميزة يفتح المواضيع بلا شاشة انتظار', async () => {
    await page.click('#card-cat');
    await page.waitForSelector('#ct-new', { timeout: 8000 });
    const stuck = await page.evaluate(() => state.screen === 'cat-loading');
    if (stuck) throw new Error('علق على شاشة التحميل مع إن البنك جاهز');
  });

  console.log('\nتصفية المحتوى قبل النشر (App Store 1.2)');
  await step('كلمة بذيئة بالسؤال تمنع النشر وما توصل للخادم', async () => {
    await page.evaluate(() => {
      window.__signedIn = true;
      window.__rpcCalls = [];
      state.user = { uid:'u9', name:'test', termsAcceptedAt:'2026-01-01T00:00:00Z', coins:500 };
      state.customShareCode = null;
      state.customError = '';
      state.customDraft = newCustomDraft();
      state.customDraft.name = 'فئة عادية';
      state.customDraft.questions.forEach((q, i) => { q.question = 'س' + i; q.answer = 'ج' + i; });
      state.customDraft.questions[2].answer = 'يا شرمُوط';   // بتشكيل — لازم ينمسك
      goto('custom-editor');
    });
    await page.waitForSelector('#cd-save', { timeout: 8000 });
    await page.click('#cd-save');
    await page.waitForFunction(() => (state.customError || '').includes('غير لائقة'), { timeout: 8000 });
    const calls = await page.evaluate(() => (window.__rpcCalls || []).filter(c => c.name === 'save_custom_topic').length);
    if (calls !== 0) throw new Error('انرسل للخادم مع إنه مرفوض محلياً — راح ينخصم كوين على الفاضي');
  });

  await step('نص نظيف يمرّ عادي', async () => {
    await page.evaluate(() => {
      state.customError = '';
      state.customShareCode = null;
      state.customDraft = newCustomDraft();
      state.customDraft.name = 'فئة نظيفة';
      state.customDraft.questions.forEach((q, i) => { q.question = 'س' + i; q.answer = 'ج' + i; });
      render();
    });
    await page.click('#cd-save');
    await page.waitForFunction(() => !!state.customShareCode || !!state.customError, { timeout: 10000 });
    const err = await page.evaluate(() => state.customError);
    if (err) throw new Error('نص نظيف انرفض: ' + err);
  });

  await step('كلمات سليمة ما تنمسك غلط', async () => {
    // كل وحدة من هذي كانت تنمسك غلط قبل ما نضبّط القائمة —
    // وكلهن موجودات فعلاً ببنك الأسئلة
    const clean = [
      'شنو سبب كسوف الشمس؟',
      'الكسل صفة سيئة',
      'كسر الرقم القياسي',
      'أول قمر صناعي أطلقته البشرية؟ سبوتنيك ١',
      'طريقة العناصر المحددة بالهندسة',
      'شنو تعني عرصة؟ ساحة بين البيوت',
      'كمّل المثل: الجوع كافر',
      'اقتلاع الشجرة من جذورها',
      'fresh grape juice',
      'دخول الطلاب للقاعة',
      'زبدة الفستق'
    ];
    const hits = await page.evaluate(list => list
      .map(t => [t, findBannedTerm(t)])
      .filter(([, hit]) => hit), clean);
    if (hits.length) throw new Error('إيجابيات كاذبة: ' + hits.map(([t, h]) => `«${h}» بـ"${t}"`).join(' · '));
  });

  await step('الشتائم الحقيقية لسه تنمسك', async () => {
    const missed = await page.evaluate(() => ['يا شرمُوط', 'يلعن ابوك', 'this is fucking bad', 'كس امك']
      .filter(t => !findBannedTerm(t)));
    if (missed.length) throw new Error('فلتت: ' + missed.join(' · '));
  });

  console.log('\nحظر الناشر (App Store 1.2)');
  await page.evaluate(() => { try { localStorage.removeItem('tajammo.blockedAuthors.v1'); } catch (e) {} });

  await step('نافذة البلاغ بيها خيار حظر الناشر', async () => {
    await page.evaluate(({ code, qs }) => {
      state.customShareCode = null;
      state.pool = state.pool.filter(t => t.bankKey !== null);
      state.pool.push(makeCustomTopicFromData('فئة مستوردة', qs, code, 'authorkey-test-1', 'أمير'));
      goto('editor');
      openReportModal(state.pool.find(t => t.authorKey === 'authorkey-test-1'));
    }, { code: GOOD_CODE, qs: CANNED_TOPIC.questions });
    await page.waitForSelector('#rep-block', { timeout: 8000 });
    const txt = await page.evaluate(() => document.querySelector('#rep-block-row').innerText);
    if (!txt.includes('أمير')) throw new Error('اسم الناشر مو ظاهر بخيار الحظر');
  });

  await step('البلاغ مع الحظر يحظر الناشر فعلاً', async () => {
    await page.check('#rep-block');
    await page.evaluate(() => { state.reportReason = 'offensive'; render(); });
    await page.check('#rep-block');
    await page.click('#rep-send');
    await page.waitForFunction(() => document.body.innerText.includes('وصلنا بلاغك'), { timeout: 8000 });
    const r = await page.evaluate(() => {
      closeReportModal();
      return {
        blocked: isAuthorBlocked('authorkey-test-1'),
        stillInPool: state.pool.some(t => t.authorKey === 'authorkey-test-1')
      };
    });
    if (!r.blocked) throw new Error('الناشر ما انحظر');
    if (r.stillInPool) throw new Error('فئة الناشر المحظور باقية بالحوض');
  });

  await step('الاستيراد بكود من ناشر محظور ينرفض', async () => {
    await page.waitForSelector('#ct-code', { timeout: 8000 });
    await page.fill('#ct-code', GOOD_CODE);
    await page.click('#ct-import');
    await page.waitForFunction(() => (state.importError || '').includes('محظور'), { timeout: 8000 });
  });

  await step('الحظر يبقى بعد إعادة فتح التطبيق', async () => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#card-cat', { timeout: 10000 });
    const still = await page.evaluate(() => isAuthorBlocked('authorkey-test-1'));
    if (!still) throw new Error('الحظر ضاع بعد إعادة التشغيل');
  });

  console.log('\nحذف الحساب (App Store 5.1.1(v))');
  await step('شاشة الحساب تنفتح من الشريط وفيها زر حذف الحساب', async () => {
    await page.evaluate(() => {
      state.user = { uid:'u9', name:'أمير', coins: 120, gamesPlayed: 4 };
      render();
    });
    await page.click('#user-box');
    await page.waitForSelector('#acc-delete', { timeout: 8000 });
    const txt = await page.evaluate(() => document.querySelector('.overlay').innerText);
    if (!txt.includes('تسجيل الخروج')) throw new Error('زر الخروج راح من الشاشة');
    if (!txt.includes('محظور')) throw new Error('قائمة الناشرين المحظورين مو ظاهرة');
  });

  await step('الحذف يطلب تأكيد مكتوب ويرفض كلمة غلط', async () => {
    await page.click('#acc-delete');
    await page.waitForSelector('#acc-del-type', { timeout: 8000 });
    await page.fill('#acc-del-type', 'اي');
    await page.click('#acc-del-go');
    await page.waitForFunction(() => (state.accountError || '').includes('حذف'), { timeout: 8000 });
    const gone = await page.evaluate(() => !!window.__accountDeleted);
    if (gone) throw new Error('انحذف الحساب بتأكيد غلط');
  });

  await step('التأكيد الصحيح ينادي delete_my_account ويسجّل الخروج', async () => {
    await page.fill('#acc-del-type', 'حذف');
    await page.click('#acc-del-go');
    await page.waitForFunction(() => !!window.__accountDeleted, { timeout: 10000 });
    const r = await page.evaluate(() => ({
      user: state.user,
      modal: state.showAccountModal,
      screen: state.screen
    }));
    if (r.user) throw new Error('اللاعب باقي مسجّل بعد حذف الحساب');
    if (r.modal) throw new Error('النافذة ما انسكرت');
    if (r.screen !== 'hub') throw new Error('ما رجع للشاشة الرئيسية: ' + r.screen);
  });

  await step('إلغاء الحظر من شاشة الحساب يرجّع الناشر', async () => {
    await page.evaluate(() => { unblockAuthor('authorkey-test-1'); });
    const still = await page.evaluate(() => isAuthorBlocked('authorkey-test-1'));
    if (still) throw new Error('إلغاء الحظر ما اشتغل');
  });

  console.log('\nتسجيل الخروج ينظّف بيانات الحساب');
  await step('قبل الخروج: «فئاتي المحفوظة» ظاهرة', async () => {
    await page.evaluate(() => {
      state.user = { uid:'u10', name:'أمير', coins: 50, gamesPlayed: 1 };
      state.myCustomTopics = [
        { id:'t1', name:'شباب تجربة', share_code:'PZVDBA', plays_count:0,
          custom_topic_questions:[{question:'س',answer:'ج',points:100,sort_order:1}] }
      ];
      // فئة مالته بالحوض + فئة مستوردة من ناشر ثاني
      state.pool.push(makeCustomTopicFromData('شباب تجربة',
        [{question:'س',answer:'ج',points:100}], 'PZVDBA'));
      state.pool.push(makeCustomTopicFromData('فئة ضيف',
        [{question:'س',answer:'ج',points:100}], 'GUEST1', 'author-other', 'ناشر ثاني'));
      state.screen = 'editor'; state.history = []; render();
    });
    const txt = await page.evaluate(() => document.body.innerText);
    if (!txt.includes('فئاتي المحفوظة')) throw new Error('القائمة مو ظاهرة وهو مسجّل دخول');
  });

  await step('بعد الخروج: القائمة تختفي وفئته تنشال من الحوض', async () => {
    await page.evaluate(() => { state.user = null; clearUserScopedState(); render(); });
    const r = await page.evaluate(() => ({
      txt: document.body.innerText,
      saved: state.myCustomTopics.length,
      mine: state.pool.filter(t => t.sharedCode === 'PZVDBA').length,
      guest: state.pool.filter(t => t.sharedCode === 'GUEST1').length
    }));
    if (r.txt.includes('فئاتي المحفوظة')) throw new Error('القائمة باقية بعد تسجيل الخروج');
    if (r.saved !== 0) throw new Error('myCustomTopics ما انمسحت: ' + r.saved);
    if (r.mine !== 0) throw new Error('فئة الحساب باقية بالحوض بعد الخروج');
    if (r.guest !== 1) throw new Error('الفئة المستوردة انشالت غلط — الاستيراد ما يحتاج حساب');
  });

  await step('الرجوع لشاشة سابقة ما يرجّع القائمة (state.user هو الحارس)', async () => {
    const shown = await page.evaluate(() => {
      // نحاكي حالة قديمة باقية بالذاكرة مع لاعب مو مسجّل
      state.myCustomTopics = [{ id:'t1', name:'شباب تجربة', share_code:'PZVDBA',
        plays_count:0, custom_topic_questions:[] }];
      state.screen = 'editor'; render();
      const visible = document.body.innerText.includes('فئاتي المحفوظة');
      state.myCustomTopics = [];
      render();
      return visible;
    });
    if (shown) throw new Error('القائمة طلعت بلا حساب — الحارس مو شغّال');
  });

  await page.evaluate(() => {
    state.pool = state.pool.filter(t => t.bankKey !== null);
    state.screen = 'editor'; state.history = []; render();
  });

  console.log('\nمقاطع الأغاني — شروط متجر آبل');
  await step('على أندرويد: السؤال يبقى صوتي ويستعمل مقطع المتجر', async () => {
    const r = await page.evaluate(() => {
      const real = window.Capacitor;
      window.Capacitor = { getPlatform: () => 'android' };
      try {
        const qs = pickQuestionsForBankTopic('أغاني تجريبية');
        return { media: qs.map(q => q.mediaType), text: qs[0].text, answer: qs[0].answer };
      } finally { window.Capacitor = real; }
    });
    if (!r.media.every(m => m === 'song')) throw new Error('انشال الصوت من أندرويد: ' + r.media.join(','));
    if (r.text !== 'خمّن اسم هذي الأغنية') throw new Error('تغيّر نص السؤال بأندرويد: ' + r.text);
    if (!r.answer.includes(' - ')) throw new Error('تغيّر الجواب بأندرويد: ' + r.answer);
  });

  await step('على الآيفون: يتحوّل لسؤال نصي «منو يغني…؟» بلا مقطع', async () => {
    const r = await page.evaluate(() => {
      const real = window.Capacitor;
      window.Capacitor = { getPlatform: () => 'ios' };
      try {
        const qs = pickQuestionsForBankTopic('أغاني تجريبية');
        return {
          media: qs.map(q => q.mediaType),
          images: qs.map(q => q.image),
          text: qs[0].text,
          answer: qs[0].answer,
          count: qs.length
        };
      } finally { window.Capacitor = real; }
    });
    if (r.count !== 6) throw new Error('عدد الأسئلة تغيّر: ' + r.count);
    if (r.media.some(m => m === 'song')) throw new Error('بقي سؤال صوتي بالآيفون');
    if (r.images.some(Boolean)) throw new Error('بقيت بيانات المقطع بالآيفون');
    if (!/^منو يغني «.+»؟$/.test(r.text)) throw new Error('صيغة السؤال غلط: ' + r.text);
    if (r.answer.includes(' - ')) throw new Error('الجواب لازم يكون اسم المطرب بس: ' + r.answer);
    if (!r.answer.startsWith('مطرب')) throw new Error('الجواب مو اسم المطرب: ' + r.answer);
  });

  await step('الآيفون ما ينادي متجر آبل إطلاقاً', async () => {
    const hits = await page.evaluate(async () => {
      const realFetch = window.fetch;
      const realCap = window.Capacitor;
      const calls = [];
      window.fetch = (u, o) => { calls.push(String(u)); return realFetch(u, o); };
      window.Capacitor = { getPlatform: () => 'ios' };
      try {
        const qs = pickQuestionsForBankTopic('أغاني تجريبية');
        // نجرّب المشغّل مباشرة على سؤال صوتي — حزام الأمان لازم يوقفه
        const modal = document.createElement('div');
        modal.innerHTML = '<div id="song-player"></div>';
        wireSongPlayer(modal, { mediaType: 'song', image: 'أي أغنية', answer: 'أ - ب' });
        await new Promise(r => setTimeout(r, 200));
        return { calls: calls.filter(u => u.includes('itunes.apple.com')),
                 note: modal.querySelector('#song-player').innerText,
                 songs: qs.filter(q => q.mediaType === 'song').length };
      } finally { window.fetch = realFetch; window.Capacitor = realCap; }
    });
    if (hits.songs !== 0) throw new Error('بقيت أسئلة صوتية');
    if (hits.calls.length) throw new Error('انطلب متجر آبل بالآيفون: ' + hits.calls.join(' | '));
    if (!hits.note.includes('منو يغني')) throw new Error('ماكو بديل نصي بالمشغّل: ' + hits.note);
  });

  console.log('\nالتحكم بالمساعدات');
  const openFirstQuestion = async () => {
    await page.evaluate(() => {
      // نبني الحوض من جديد — الاختبارات السابقة ممكن تكون فضّته
      state.pool = CATEGORY_TOPICS.slice(0, 6).map(makeBankTopic);
      state.selectedTopicIds = [];
      state.pool.forEach((t, i) => { t.taken = true; t.takenBy = i % 2; state.selectedTopicIds.push(t.id); });
      state.teams[0].helps = 3; state.teams[1].helps = 3;
      state.helpHints = { 0:null, 1:null };
      const t = state.pool[0];
      t.questions.forEach(q => { delete q.usedBy; delete q.revealed; });
      state.activeCell = { topicId: t.id, qId: t.questions[0].id };
      state.screen = 'board';
      render();
    });
    await page.waitForSelector('.help-wrap, .q-modal', { timeout: 8000 });
  };

  await step('الافتراضي: الأربع مساعدات كلهن يظهرن', async () => {
    await page.evaluate(() => { state.helpsEnabled = { letter:true, blanks:true, choices:true, swap:true }; });
    await openFirstQuestion();
    const types = await page.$$eval('.help-btn', els => els.map(e => e.dataset.type));
    for (const t of ['letter','blanks','choices','swap'])
      if (!types.includes(t)) throw new Error('مساعدة ناقصة: ' + t);
  });

  await step('إطفاء «خيارات» و«تبديل السؤال» يشيلهن من النافذة', async () => {
    await page.evaluate(() => { state.helpsEnabled.choices = false; state.helpsEnabled.swap = false; });
    await openFirstQuestion();
    const types = await page.$$eval('.help-btn', els => els.map(e => e.dataset.type));
    if (types.includes('choices') || types.includes('swap')) throw new Error('المطفّاة لسه ظاهرة: ' + types.join(','));
    if (!types.includes('letter') || !types.includes('blanks')) throw new Error('انشالت مساعدة مفروض تبقى: ' + types.join(','));
  });

  await step('إطفاء الكل يشيل صندوق المساعدات نهائياً', async () => {
    await page.evaluate(() => { state.helpsEnabled = { letter:false, blanks:false, choices:false, swap:false }; });
    await openFirstQuestion();
    const r = await page.evaluate(() => ({
      box: !!document.querySelector('.help-wrap'),
      modal: !!document.querySelector('.q-modal')
    }));
    if (r.box) throw new Error('صندوق المساعدات لسه ظاهر');
    if (!r.modal) throw new Error('نافذة السؤال انكسرت');
  });

  await step('مساعدة مطفّاة ما تنصرف حتى لو انضغطت بالقوة', async () => {
    const before = await page.evaluate(() => {
      state.helpsEnabled = { letter:true, blanks:false, choices:false, swap:false };
      return state.teams[0].helps;
    });
    await openFirstQuestion();
    const used = await page.evaluate(() => {
      // نزوّر زر مساعدة مطفّاة ونضغطه — المنطق لازم يرفضه
      const real = document.querySelector('.help-btn');
      if (!real) return 'ماكو أي زر مساعدة';
      const fake = real.cloneNode(true);
      fake.dataset.type = 'choices';
      real.parentNode.appendChild(fake);
      wireHelpButtons(document.querySelector('.q-modal'),
        state.pool.find(t => t.id === state.activeCell.topicId),
        state.pool.find(t => t.id === state.activeCell.topicId).questions[0]);
      fake.click();
      return state.teams[state.pool.find(t => t.id === state.activeCell.topicId).takenBy].helps;
    });
    if (typeof used === 'string') throw new Error(used);
    if (used !== before) throw new Error('انخصمت مساعدة على زر مطفّى: ' + before + ' ← ' + used);
  });

  await step('عدد المساعدات من الإعدادات ينطبّق على الفريقين', async () => {
    const r = await page.evaluate(() => {
      state.helpsEnabled = { letter:true, blanks:true, choices:true, swap:true };
      state.helpsPerTeam = 5;
      goto('teams');
      document.querySelector('#to-select').click();
      return [state.teams[0].helps, state.teams[1].helps];
    });
    if (r[0] !== 5 || r[1] !== 5) throw new Error('عدد المساعدات: ' + r.join(' / '));
    await page.evaluate(() => { state.helpsPerTeam = 3; });
  });

  await step('شاشة الإعدادات بيها مفاتيح المساعدات الأربعة', async () => {
    await page.evaluate(() => goto('teams'));
    await page.waitForSelector('#helps-toggles', { timeout: 8000 });
    const keys = await page.$$eval('#helps-toggles .switch', els => els.map(e => e.dataset.help));
    for (const k of ['letter','blanks','choices','swap'])
      if (!keys.includes(k)) throw new Error('مفتاح ناقص: ' + k);
    const n = await page.$$eval('#helps-count', els => els.length);
    if (n !== 1) throw new Error('خانة عدد المساعدات مو موجودة');
  });

  console.log('\nألعاب القعدة الجديدة (الدخيل + القنبلة)');

  await step('مربعي «قريباً» انبدلوا بلعبتين حقيقيتين', async () => {
    const r = await page.evaluate(() => {
      goto('hub');
      return {
        spy: !!document.querySelector('#card-spy'),
        bomb: !!document.querySelector('#card-bomb'),
        soon: document.querySelectorAll('.game-tile.soon').length
      };
    });
    if (!r.spy) throw new Error('مربع «من الدخيل؟» مو موجود');
    if (!r.bomb) throw new Error('مربع «القنبلة» مو موجود');
    if (r.soon !== 0) throw new Error('بعده أكو ' + r.soon + ' مربع «قريباً»');
  });

  await step('كلمات اللعبتين تنزل وتنخزن بالجهاز', async () => {
    const r = await page.evaluate(async () => {
      localStorage.removeItem('tajammo.partyItems.v1');
      partyItems = { spy: [], bomb: [] };
      const ok = await ensurePartyItems('spy');
      const cached = JSON.parse(localStorage.getItem('tajammo.partyItems.v1') || 'null');
      return { ok, spy: partyItems.spy.length, bomb: partyItems.bomb.length,
               cachedSpy: cached ? cached.spy.length : 0,
               bombHasExamples: partyItems.bomb.every(b => b && b.examples) };
    });
    if (!r.ok) throw new Error('ensurePartyItems رجّعت false');
    if (r.spy !== 30 || r.bomb !== 21) throw new Error('عدد الكلمات: ' + r.spy + '/' + r.bomb);
    if (!r.bombHasExamples) throw new Error('فئات القنبلة انخزنت بلا أمثلة');
    if (r.cachedSpy !== 30) throw new Error('ما انخزنت بالجهاز: ' + r.cachedSpy);
  });

  await step('التحديث يستبدل النسخة المخزونة مو يضيف عليها (المحذوف يختفي)', async () => {
    const r = await page.evaluate(async () => {
      // نحط كلمة وهمية بالمخزون كأنها انمسحت من السيرفر
      partyItems.spy.push('مكان انمسح من السيرفر');
      savePartyCache();
      const beforeN = partyItems.spy.length;
      await fetchPartyItems();
      return { beforeN, afterN: partyItems.spy.length,
               stillThere: partyItems.spy.indexOf('مكان انمسح من السيرفر') !== -1 };
    });
    if (r.stillThere) throw new Error('الكلمة الممسوحة بقت بعد التحديث — يعني ندمج مو نستبدل');
    if (r.afterN !== 30) throw new Error('العدد بعد التحديث: ' + r.afterN);
  });

  await step('من الدخيل: توزيع الأوراق يعطي دخيل واحد والباقي نفس المكان', async () => {
    const r = await page.evaluate(() => {
      state.spyPlayerCount = 6;
      state.spySpyCount = 1;
      state.spyPlayerNames = [];
      startSpyRound();
      return {
        screen: state.screen,
        n: state.spyPlayers.length,
        spies: state.spyPlayers.filter(p => p.isSpy).length,
        place: state.spyPlace,
        poolN: state.spyPool.length,
        placeInPool: state.spyPool.indexOf(state.spyPlace) !== -1
      };
    });
    if (r.screen !== 'spy-reveal') throw new Error('ما راح لشاشة التوزيع: ' + r.screen);
    if (r.n !== 6) throw new Error('عدد اللاعبين: ' + r.n);
    if (r.spies !== 1) throw new Error('عدد الدخلاء: ' + r.spies);
    if (r.poolN !== 12) throw new Error('حجم قائمة الأماكن: ' + r.poolN);
    if (!r.placeInPool) throw new Error('المكان الحقيقي مو ضمن القائمة المعروضة — الدخيل ما عنده فرصة');
  });

  await step('من الدخيل: ورقة الدخيل ما تكشف المكان', async () => {
    const r = await page.evaluate(() => {
      const spyIdx = state.spyPlayers.findIndex(p => p.isSpy);
      state.spyRevealIndex = spyIdx;
      state.spyRevealShown = true;
      render();
      const txt = document.querySelector('#app').textContent;
      return { showsSpy: txt.indexOf('أنت الدخيل') !== -1, leaks: txt.indexOf(state.spyPlace) !== -1 };
    });
    if (!r.showsSpy) throw new Error('ما طلعت له «أنت الدخيل»');
    if (r.leaks) throw new Error('المكان انكشف بورقة الدخيل');
  });

  await step('من الدخيل: ورقة اللاعب العادي تكشف المكان', async () => {
    const r = await page.evaluate(() => {
      const norm = state.spyPlayers.findIndex(p => !p.isSpy);
      state.spyRevealIndex = norm;
      state.spyRevealShown = true;
      render();
      const txt = document.querySelector('#app').textContent;
      return { shows: txt.indexOf(state.spyPlace) !== -1, saysSpy: txt.indexOf('أنت الدخيل') !== -1 };
    });
    if (!r.shows) throw new Error('المكان ما ظهر للاعب العادي');
    if (r.saysSpy) throw new Error('طلعت له «أنت الدخيل» وهو مو دخيل');
  });

  await step('من الدخيل: ماكو أحد يصوّت على نفسه', async () => {
    const r = await page.evaluate(() => {
      state.spyVoteIndex = 0;
      state.spyVotes = {};
      goto('spy-vote');
      const btns = [...document.querySelectorAll('#sp-vote-grid .vote-btn')].map(b => b.textContent);
      return { count: btns.length, hasSelf: btns.indexOf(state.spyPlayers[0].name) !== -1 };
    });
    if (r.count !== 5) throw new Error('عدد أزرار التصويت: ' + r.count + ' (المفروض ٥)');
    if (r.hasSelf) throw new Error('اللاعب يكدر يصوّت على نفسه');
  });

  await step('من الدخيل: النقاط تنحسب صح لمن ينكشف الدخيل', async () => {
    const r = await page.evaluate(() => {
      const spyIdx = state.spyPlayers.findIndex(p => p.isSpy);
      state.spyScores = {};
      state.spyPlayers.forEach(p => { state.spyScores[p.name] = 0; });
      applySpyScores({ caught: true, spyGuessedRight: false });
      return {
        spy: state.spyScores[state.spyPlayers[spyIdx].name],
        others: state.spyPlayers.filter(p => !p.isSpy).map(p => state.spyScores[p.name])
      };
    });
    if (r.spy !== 0) throw new Error('الدخيل أخذ نقاط وهو انكشف: ' + r.spy);
    if (r.others.some(v => v !== 1)) throw new Error('نقاط الباقين: ' + r.others.join(','));
  });

  await step('من الدخيل: الدخيل ياخذ ٤ لو نجا وخمّن المكان', async () => {
    const r = await page.evaluate(() => {
      const spyIdx = state.spyPlayers.findIndex(p => p.isSpy);
      state.spyScores = {};
      state.spyPlayers.forEach(p => { state.spyScores[p.name] = 0; });
      applySpyScores({ caught: false, spyGuessedRight: true });
      return state.spyScores[state.spyPlayers[spyIdx].name];
    });
    if (r !== 4) throw new Error('نقاط الدخيل: ' + r + ' (المفروض ٤)');
  });

  await step('القنبلة: الجولة تبدأ بفئة ومؤقت لكل لاعب', async () => {
    const r = await page.evaluate(async () => {
      await ensurePartyItems('bomb');
      state.bombTurnSec = 8; state.bombFloorSec = 3; state.bombShrink = true;
      state.bombPlayerCount = 4;
      state.bombPlayerNames = ['أ','ب','ج','د'];
      state.bombPlayers = state.bombPlayerNames.map(n => ({ name: n, out: false }));
      state.bombKnockedOut = [];
      startBombRound();
      stopBombTicker();   // نوقف العدّاد حتى الاختبار يتحكم بالوقت
      return { screen: state.screen, cat: state.bombCategory, holder: state.bombCurrent,
               lap: state.bombLap, allow: bombAllowMs(),
               shown: document.querySelector('#bo-timer') ? document.querySelector('#bo-timer').textContent : null };
    });
    if (r.screen !== 'bomb-play') throw new Error('الشاشة: ' + r.screen);
    if (!r.cat) throw new Error('ماكو فئة');
    if (r.holder !== 0) throw new Error('أول حامل: ' + r.holder);
    if (r.lap !== 0) throw new Error('اللفة تبدي من: ' + r.lap);
    if (r.allow !== 8000) throw new Error('وقت الدور الأول: ' + r.allow);
    if (r.shown !== '8') throw new Error('العدّاد المعروض: ' + r.shown);
  });

  await step('القنبلة: فئة {حرف} تنبدل بحرف حقيقي', async () => {
    const r = await page.evaluate(() => {
      const out = [];
      for (let i = 0; i < 40; i++) out.push(bombPrompt('اذكر بلد يبدأ بحرف {حرف}'));
      return {
        leftover: out.filter(t => t.indexOf('{حرف}') !== -1).length,
        distinct: new Set(out).size,
        sample: out[0]
      };
    });
    if (r.leftover) throw new Error('بقى {حرف} بلا استبدال بـ' + r.leftover + ' مرة');
    if (r.distinct < 5) throw new Error('نفس الحرف يتكرر دائماً — عدد الصيغ: ' + r.distinct);
  });

  await step('القنبلة: التمرير ينقل الدور ويصفّر المؤقت', async () => {
    const r = await page.evaluate(() => {
      const before = state.bombCurrent;
      document.querySelector('#bo-pass').click();
      const after = state.bombCurrent;
      const leftAfterPass = state.bombDeadline - Date.now();
      stopBombTicker();
      document.querySelector('#bo-pass').click();
      stopBombTicker();
      return { before, after, third: state.bombCurrent, leftAfterPass,
               holderText: document.querySelector('#bo-holder').textContent };
    });
    if (r.after !== 1 || r.third !== 2) throw new Error('التسلسل: ' + [r.before, r.after, r.third].join('→'));
    if (r.holderText !== 'ج') throw new Error('اسم الحامل المعروض: ' + r.holderText);
    if (r.leftAfterPass < 7000) throw new Error('المؤقت ما انصفّر بالتمرير: ' + r.leftAfterPass + 'ms');
  });

  await step('القنبلة: الوقت ينقص ثانية بعد كل لفة كاملة', async () => {
    const r = await page.evaluate(() => {
      state.bombPlayers = ['أ','ب','ج','د'].map(n => ({ name: n, out: false }));
      state.bombLap = 0; state.bombPasses = 0; state.bombCurrent = 0;
      state.bombExploded = false;
      state.bombTurnSec = 8; state.bombFloorSec = 3; state.bombShrink = true;
      const seq = [bombAllowMs()];
      for (let i = 0; i < 12; i++) { bombAdvance(); stopBombTicker(); seq.push(bombAllowMs()); }
      return { seq, lap: state.bombLap };
    });
    // ٤ لاعبين: بعد ٤ تمريرات تكمل لفة → ٧٠٠٠، وبعد ٨ → ٦٠٠٠، وبعد ١٢ → ٥٠٠٠
    if (r.seq[0] !== 8000 || r.seq[4] !== 7000 || r.seq[8] !== 6000 || r.seq[12] !== 5000)
      throw new Error('تسلسل الوقت: ' + r.seq.join(','));
    if (r.lap !== 3) throw new Error('عدد اللفات: ' + r.lap);
  });

  await step('القنبلة: الوقت ما ينزل تحت الحد الأدنى', async () => {
    const r = await page.evaluate(() => {
      state.bombLap = 50;
      const a = bombAllowMs();
      state.bombLap = 0;
      state.bombShrink = false;
      state.bombLap = 50;
      const b = bombAllowMs();
      state.bombShrink = true; state.bombLap = 0;
      return { shrunk: a, fixed: b };
    });
    if (r.shrunk !== 3000) throw new Error('بعد ٥٠ لفة: ' + r.shrunk + ' (المفروض ٣٠٠٠)');
    if (r.fixed !== 8000) throw new Error('مع إطفاء التناقص: ' + r.fixed);
  });

  await step('القنبلة: انتهاء الوقت يفجّر على صاحب الدور', async () => {
    const r = await page.evaluate(async () => {
      state.bombPlayers = ['أ','ب','ج','د'].map(n => ({ name: n, out: false }));
      state.bombKnockedOut = [];
      state.bombCurrent = 1; state.bombExploded = false;
      state.bombDeadline = Date.now() + 250;
      state.bombLastTickSec = -1;
      state.bombHandle = setInterval(bombTick, 60);
      await new Promise(r => setTimeout(r, 900));
      return { screen: state.screen, loser: state.bombLoserIndex,
               out: state.bombPlayers[1].out, handle: state.bombHandle };
    });
    if (r.screen !== 'bomb-out') throw new Error('الشاشة: ' + r.screen);
    if (r.loser !== 1) throw new Error('الخاسر: ' + r.loser);
    if (!r.out) throw new Error('الخاسر ما انشال من الصامدين');
    if (r.handle !== null) throw new Error('العدّاد بعده شغّال بعد الانفجار');
  });

  await step('القنبلة: الجولة الجاية تتخطى الخارجين وترجّع الوقت للبداية', async () => {
    const r = await page.evaluate(() => {
      startBombRound();
      stopBombTicker();
      const seq = [state.bombCurrent];
      for (let i = 0; i < 3; i++) { bombAdvance(); stopBombTicker(); seq.push(state.bombCurrent); }
      return { seq, lapAtStart: seq.length, allow: bombAllowMs() };
    });
    if (r.seq.indexOf(1) !== -1) throw new Error('الخارج «ب» رجع بالدور: ' + r.seq.join('→'));
  });

  await step('القنبلة: آخر واحد صامد يطلع فائز', async () => {
    const r = await page.evaluate(() => {
      state.bombPlayers.forEach((p, i) => { p.out = (i !== 2); });
      state.bombKnockedOut = ['أ', 'ب', 'د'];
      startBombRound();
      stopBombTicker();
      return { screen: state.screen, winner: state.bombWinner };
    });
    if (r.screen !== 'bomb-end') throw new Error('الشاشة: ' + r.screen);
    if (r.winner !== 'ج') throw new Error('الفائز: ' + r.winner);
  });

  await step('القنبلة: قاعدة «بلا تكرار» ظاهرة بالتجهيز وباللعب', async () => {
    const r = await page.evaluate(() => {
      goto('bomb-setup');
      const setup = document.querySelector('#app').textContent;
      state.bombPlayers = ['أ','ب','ج'].map(n => ({ name: n, out: false }));
      state.bombKnockedOut = [];
      startBombRound(); stopBombTicker();
      const play = document.querySelector('#app').textContent;
      return { setup: setup.indexOf('بلا تكرار') !== -1,
               play: play.indexOf('ما تنعاد') !== -1 };
    });
    if (!r.setup) throw new Error('القاعدة مو مذكورة بشاشة التجهيز');
    if (!r.play) throw new Error('ماكو تذكير بالقاعدة بشاشة اللعب');
  });

  await step('القنبلة: أمثلة الأجوبة تظهر بعد الانفجار مو قبله', async () => {
    const r = await page.evaluate(() => {
      const duringPlay = document.querySelector('#app').textContent;
      const leakedEarly = duringPlay.indexOf(state.bombExamples) !== -1 && !!state.bombExamples;
      bombExplode();
      const afterBoom = document.querySelector('#app').textContent;
      return { leakedEarly, ex: state.bombExamples,
               shown: afterBoom.indexOf('أمثلة على أجوبة مقبولة') !== -1,
               hasText: !!state.bombExamples && afterBoom.indexOf(state.bombExamples) !== -1 };
    });
    if (!r.ex) throw new Error('الفئة انسحبت بلا أمثلة');
    if (r.leakedEarly) throw new Error('الأمثلة انكشفت أثناء اللعب');
    if (!r.shown || !r.hasText) throw new Error('الأمثلة ما ظهرت بشاشة الخروج');
  });

  await step('الخروج من اللعبتين يوقّف كل المؤقتات', async () => {
    const r = await page.evaluate(() => {
      startSpyTimer();
      state.bombDeadline = Date.now() + 60000;
      startBombTurn();
      goto('hub');
      stopSpyTimer();
      stopBombTicker();
      return { spy: state.spyTimerHandle, bomb: state.bombHandle };
    });
    if (r.spy !== null || r.bomb !== null) throw new Error('بقى مؤقت شغّال');
  });

  console.log('\nأخطاء جافاسكربت غير متوقعة');
  if (errors.length) { console.log('  ✗ ' + errors.join('\n  ')); fail++; }
  else console.log('  ✓ ماكو أي خطأ بالصفحة');

  if (consoleErrors.length) console.log('\n(console.error: ' + consoleErrors.join(' | ') + ')');

  console.log(`\n${'='.repeat(40)}\nناجح: ${pass}   فاشل: ${fail}\n${'='.repeat(40)}`);

  await browser.close();
  process.exit(fail ? 1 : 0);
})();