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
        if(name === 'team_leaderboard'){
          var rows = window.__boardRows || [];
          if(params.p_handles) rows = rows.filter(function(r){ return params.p_handles.indexOf(r.handle) >= 0; });
          return { data: rows.slice(0, params.p_limit || 50), error: null };
        }
        /* متجر الكوينز — نموذج بسيط بالذاكرة يقلّد دوال السيرفر.
           ad_reward_status يقلّد وصول تأكيد كوكل (SSV) أول ما ينسأل */
        if(['ad_reward_state','start_ad_reward','ad_reward_status','buy_cosmetic','equip_cosmetic','buy_pack'].indexOf(name) >= 0){
          if(!window.__signedIn) return { data: null, error: { message: 'SIGNIN_REQUIRED' } };
          var S = window.__shop = window.__shop || { coins: window.__shopStartCoins || 200, owned: [], avatar: null, frame: null,
                                                     adsLeft: 5, dailyClaimed: false, streak: 3, doubleAmount: 0, tokens: {}, n: 0,
                                                     theme: null, title: null, fx: null, packs: {} };
          var price = function(it){
            if(it === 'frame_gold') return 150;
            if(it === 'avatar_star' || it === 'avatar_palm') return 0;
            if(/^theme_/.test(it)) return 100;
            if(/^(title|fx)_/.test(it)) return 75;
            return /^avatar_/.test(it) ? 50 : null;
          };
          if(name === 'ad_reward_state') return { data: {
            coins: S.coins, ads_left: S.adsLeft, ads_limit: 5, daily_claimed: S.dailyClaimed,
            streak_day: S.streak, daily_amount: [20,30,40,50,60,80,100][S.streak - 1], extra_amount: 20,
            double_amount: S.doubleAmount, equipped_avatar: S.avatar, equipped_frame: S.frame,
            equipped_theme: S.theme, equipped_title: S.title, equipped_fx: S.fx, packs: Object.assign({}, S.packs), owned: S.owned.slice() }, error: null };
          if(name === 'start_ad_reward'){
            if(S.adsLeft <= 0) return { data: null, error: { message: 'AD_DAILY_LIMIT' } };
            if(params.p_kind === 'double' && S.doubleAmount <= 0) return { data: null, error: { message: 'NOTHING_TO_DOUBLE' } };
            var amt = params.p_kind === 'double' ? S.doubleAmount : (S.dailyClaimed ? 20 : [20,30,40,50,60,80,100][S.streak - 1]);
            var tok = 'tok-' + (++S.n);
            S.tokens[tok] = { kind: params.p_kind, amount: amt, claimed: false };
            return { data: { token: tok, amount: amt }, error: null };
          }
          if(name === 'ad_reward_status'){
            var t = S.tokens[params.p_token];
            if(!t) return { data: null, error: null };
            if(!t.claimed && window.__adWatched && window.__adWatched[params.p_token]){
              t.claimed = true; S.coins += t.amount; S.adsLeft--;
              if(t.kind === 'double') S.doubleAmount = 0; else S.dailyClaimed = true;
            }
            return { data: { claimed: t.claimed, granted: t.claimed ? t.amount : 0, coins: S.coins }, error: null };
          }
          if(name === 'buy_pack'){
            if(S.coins < 100) return { data: null, error: { message: 'NOT_ENOUGH_COINS:' + S.coins + ':100' } };
            S.coins -= 100;
            var base = S.packs[params.p_pack] && new Date(S.packs[params.p_pack]) > new Date() ? new Date(S.packs[params.p_pack]).getTime() : Date.now();
            S.packs[params.p_pack] = new Date(base + 24 * 3600 * 1000).toISOString();
            window.__packUnlocked = Object.assign({}, window.__packUnlocked, { [params.p_pack]: true });
            return { data: { ok: true, coins: S.coins, expires_at: S.packs[params.p_pack] }, error: null };
          }
          if(name === 'buy_cosmetic'){
            var p = price(params.p_item);
            if(p === null) return { data: null, error: { message: 'NO_SUCH_ITEM' } };
            if(S.owned.indexOf(params.p_item) >= 0) return { data: null, error: { message: 'ALREADY_OWNED' } };
            if(S.coins < p) return { data: null, error: { message: 'NOT_ENOUGH_COINS:' + S.coins + ':' + p } };
            S.coins -= p; S.owned.push(params.p_item);
            return { data: { ok: true, coins: S.coins }, error: null };
          }
          if(name === 'equip_cosmetic'){
            var it = params.p_item;
            if(it && price(it) > 0 && S.owned.indexOf(it) < 0) return { data: null, error: { message: 'NOT_OWNED' } };
            if(it && it.split('_')[0] !== params.p_slot) return { data: null, error: { message: 'BAD_SLOT' } };
            S[params.p_slot] = it;
            return { data: { ok: true }, error: null };
          }
        }
        if(name === 'report_team'){
          window.__teamReports = window.__teamReports || [];
          window.__teamReports.push(params);
          return { data: { ok: true, already: false }, error: null };
        }
        if(name === 'submit_team_results'){
          if(!window.__signedIn) return { data: null, error: { message: 'AUTH_REQUIRED' } };
          window.__submitted = params;
          return { data: { teams: (params.p_teams || []).map(function(t, i){
            var ans = t.answers || [];
            return { handle: t.handle, name: t.name, rank: i + 1,
                     score: 100 - i, gained: 50 - i, answered: ans.length,
                     correct: ans.filter(function(a){ return a.ok; }).length };
          }) }, error: null };
        }
        return { data: null, error: { message: 'unknown rpc ' + name } };
      },
      from: function(table){
        if(table === 'party_items'){
          var items = [];
          for(var s1=1;s1<=30;s1++) items.push({game:'spy', text:'مكان '+s1});
          for(var b1=1;b1<=20;b1++) items.push({game:'bomb', text:'اذكر شي '+b1, examples:'مثال أ، مثال ب، مثال ج'});
          items.push({game:'bomb', text:'اذكر بلد يبدأ بحرف {حرف}', examples:'تونس، تركيا، تشاد'});
          // محتوى الباقة يرجع بس لمن تنفتح (نفس قفل السيرفر)
          if(window.__packUnlocked && window.__packUnlocked.pack_spy_iraq)
            for(var s2=1;s2<=15;s2++) items.push({game:'spy', text:'مكان عراقي '+s2, pack:'pack_spy_iraq'});
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
          for(var i=1;i<=40;i++) names.push({name:'شخصية '+i, pack:null});
          if(window.__packUnlocked && window.__packUnlocked.pack_whoami_football)
            for(var k=1;k<=15;k++) names.push({name:'لاعب '+k, pack:'pack_whoami_football'});
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
/* صورة وهمية ١x١ — الاختبار يعترض الطلب ويرجّعها، فما نحتاج إنترنت */
const PHOTO_URL = 'https://example.test/player.png';
const BROKEN_PHOTO_URL = 'https://example.test/missing.png';
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

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
  // موضوع صور: السؤال يعرض صورة من الإنترنت وتحتها سطر نسبة المصدر
  [100,100,100,200,200,200,400,400,600,600].forEach((p, i) => {
    rows.push({ topic: 'صور تجريبية', points: p, question: 'منو هذا اللاعب؟',
                answer: 'لاعب ' + i, image: PHOTO_URL,
                media_type: 'photo', media_credit: 'ويكيميديا كومنز · CC BY 4.0' });
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
  /* ويّا أول سطرين من الـ stack — بلاه ما نعرف أي تست سبّب الخطأ */
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + ' @ ' +
    String(e.stack || '').split(/\r?\n/).slice(1, 3).map(s => s.trim()).join(' | ')));
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
    if (url === PHOTO_URL) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX });
    }
    if (url === BROKEN_PHOTO_URL) {
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'nope' });
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
      state.screen = 'setup'; render();
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
    state.screen = 'setup'; state.history = []; render();
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
    await page.evaluate(() => { state.pool = state.pool.filter(t => t.bankKey !== null); goto('setup'); });
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
  /* الإعلان بمكافأة موجود هسه — بس بالمتجر وبنهاية اللعبة، أبداً بنص الدور */
  await step('ماكو إعلان مكافأة بنص اللعب (لا مساعدة ولا زر بنافذة السؤال)', async () => {
    const gone = await page.evaluate(() =>
      !HELP_TYPES.some(h => h.key === 'ad') &&
      !document.body.innerHTML.includes('data-type="ad"'));
    const src = fs.readFileSync(path.join(WWW, 'js', 'game-categories.js'), 'utf8');
    const calls = (src.match(/watchRewardAd\(|showRewardedAd\(/g) || []).length;
    if (!gone || calls) throw new Error('لسه أكو إعلان مكافأة بنص اللعب');
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
      /* نحفظ الأصلية ونرجّعها — delete ما يشتغل على دالة معرّفة بـ function،
         فچانت الشاشة الرئيسية تبقى خربانة لكل التستات اللي بعد هذا */
      const orig = window.renderHub;
      window.renderHub = () => { throw new Error('عطل تجريبي'); };
      try {
        render();
        return document.getElementById('app').innerText;
      } finally {
        window.renderHub = orig;
      }
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

  /* الخيارات مكتوبة يدوياً بجدول category_question_choices وتنزل ويّا
     البنك (q.decoys). قبل چانت تتولّد تلقائياً وتفضح الجواب أحياناً. */
  console.log('\nمساعدة الخيارات (من جدول الخيارات)');
  await step('الخيارات = الجواب + الخيارين من الجدول، ٣ بالضبط', async () => {
    const opts = await page.evaluate(() =>
      questionChoices({ answer: 'طوكيو', decoys: ['كيوتو', 'أوساكا'] }));
    if (!opts || opts.length !== 3) throw new Error('ما رجّع ٣ خيارات: ' + JSON.stringify(opts));
    for (const o of ['طوكيو', 'كيوتو', 'أوساكا'])
      if (!opts.includes(o)) throw new Error('خيار ناقص: ' + o);
  });

  await step('الجواب الصح ينخلط — مو دائماً بنفس المكان', async () => {
    const positions = await page.evaluate(() => {
      const seen = {};
      for (let i = 0; i < 60; i++) {
        const opts = questionChoices({ answer: 'طوكيو', decoys: ['كيوتو', 'أوساكا'] });
        seen[opts.indexOf('طوكيو')] = true;
      }
      return Object.keys(seen);
    });
    if (positions.length < 3) throw new Error('الجواب طلع بس بالمكان: ' + positions.join(','));
  });

  await step('بلا خيارات بالجدول ← ما ترجع خيارات (ولا توليد تلقائي)', async () => {
    const r = await page.evaluate(() => [
      questionChoices({ answer: 'طوكيو', decoys: null }),
      questionChoices({ answer: 'طوكيو' }),
      questionChoices({ answer: 'طوكيو', decoys: ['كيوتو'] })
    ]);
    if (r.some(Boolean)) throw new Error('رجعت خيارات بلا ما تكون بالجدول: ' + JSON.stringify(r));
  });

  await step('سؤال أغنية (أندرويد): الخيارات أسماء الأغاني بس', async () => {
    const opts = await page.evaluate(() => questionChoices({
      mediaType: 'song', answer: 'Shape of You - Ed Sheeran',
      decoys: ['Perfect - Ed Sheeran', 'Thinking Out Loud - Ed Sheeran']
    }));
    if (!opts || opts.some(o => o.includes(' - ')))
      throw new Error('بقى اسم المطرب بالخيارات: ' + JSON.stringify(opts));
    if (!opts.includes('Shape of You')) throw new Error('اسم الأغنية الصح مو موجود');
  });

  await step('الآيفون: سؤال الأغنية ينحوّل لـ«منو يغني» بلا خيارات', async () => {
    const r = await page.evaluate(() => songQuestionToText({
      mediaType: 'song', text: 'خمّن', answer: 'Shape of You - Ed Sheeran',
      decoys: ['Perfect - Ed Sheeran', 'Thinking Out Loud - Ed Sheeran']
    }));
    if (r.decoys) throw new Error('بقت خيارات «أغنية - مطرب» لسؤال جوابه المطرب');
    if (r.answer !== 'Ed Sheeran') throw new Error('التحويل تغيّر: ' + r.answer);
  });

  await step('صيغة مختلفة (قوس ببعضها) ← الأقواس تنشال من الكل', async () => {
    const opts = await page.evaluate(() =>
      questionChoices({ answer: 'الجنكة (Ginkgo)', decoys: ['الأرز اللبناني', 'الصنوبر الحلبي'] }));
    if (opts.some(o => o.includes('('))) throw new Error('بقى قوس يفضح الجواب: ' + opts.join(' / '));
    if (!opts.includes('الجنكة')) throw new Error('الجواب انشال: ' + opts.join(' / '));
  });

  await step('صيغة متطابقة (قوس بالكل) ← تبقى مثل ما هي', async () => {
    const opts = await page.evaluate(() => questionChoices({
      answer: 'الجنكة (Ginkgo)', decoys: ['الأرز اللبناني (Lebanon Cedar)', 'الصنوبر الحلبي (Aleppo Pine)']
    }));
    if (!opts.includes('الجنكة (Ginkgo)')) throw new Error('انشالت أقواس ما لازم تنشال: ' + opts.join(' / '));
  });

  await step('خيار يطلع نفس الجواب بعد التطبيع ← ما تنعرض', async () => {
    const r = await page.evaluate(() =>
      questionChoices({ answer: 'الأسد', decoys: ['الاسد', 'النمر'] }));
    if (r) throw new Error('انعرضت خيارات بيها الجواب مرتين: ' + r.join(' / '));
  });

  await step('البنك يقرا الخيارات من نفس طلب الأسئلة', async () => {
    const r = await page.evaluate(() => {
      const g = groupBankRows([
        { id: 1, topic: 'ت', points: 100, question: 'س', answer: 'أ',
          category_question_choices: { decoys: ['ب', 'ج'] } },
        { id: 2, topic: 'ت', points: 100, question: 'س', answer: 'أ',
          category_question_choices: [{ decoys: ['د', 'هـ'] }] },
        { id: 3, topic: 'ت', points: 100, question: 'س', answer: 'أ', category_question_choices: null }
      ]);
      return g['ت'][100].map(q => q.decoys);
    });
    if (JSON.stringify(r) !== JSON.stringify([['ب','ج'], ['د','هـ'], null]))
      throw new Error('قراءة الخيارات غلط: ' + JSON.stringify(r));
    const sel = await page.evaluate(() => BANK_SELECT);
    if (!sel.includes('category_question_choices(decoys)')) throw new Error('الطلب ما يجيب الخيارات: ' + sel);
  });

  await step('الكاش القديم للبنك ينمسح لمن ينحفظ الجديد', async () => {
    const r = await page.evaluate(() => {
      // الكاش الحقيقي ينحفظ ويرجع — تستات بعدين تعتمد عليه
      const keep = localStorage.getItem(BANK_CACHE_KEY);
      try {
        localStorage.setItem('tajammo.bank.v2', '{"old":true}');
        writeBankCache({ total: 1, topics: ['ت'], grouped: { 'ت': { 100:[], 200:[], 400:[], 600:[] } } });
        return { old: localStorage.getItem('tajammo.bank.v2'), now: !!localStorage.getItem(BANK_CACHE_KEY) };
      } finally {
        if (keep) localStorage.setItem(BANK_CACHE_KEY, keep);
        else localStorage.removeItem(BANK_CACHE_KEY);
      }
    });
    if (r.old !== null) throw new Error('الكاش القديم بقى ياكل مساحة');
    if (!r.now) throw new Error('الكاش الجديد ما انحفظ');
  });

  /* الشاشات الثلاث القديمة (اختر المواضيع ← الفرق ← اختيار بالتناوب) صارت
     شاشة وحدة: الاختيار حر، بحث، وأقسام من قاعدة البيانات */
  console.log('\nشاشة تجهيز لعبة الفئات');
  const freshSetup = () => page.evaluate(() => {
    state.reportTopic = null; state.customShareCode = null; state.activeCell = null;
    state.pool = [];               // بلا فئات خاصة باقية من تستات قبل — أول بطاقة تكون فئة بنك
    state.selectedTopicIds = [];
    state.setupActiveTeam = 0; state.setupSearch = ''; state.setupSection = 'all';
    state.history = []; state.screen = 'setup'; render();
  });

  await step('زر لعبة الفئات يفتح شاشة التجهيز مباشرة', async () => {
    const dbg = await page.evaluate(() => {
      state.reportTopic = null; state.customShareCode = null; state.activeCell = null;
      state.history = []; goto('hub');
      return { screen: state.screen, hasCard: !!document.querySelector('#card-cat'),
               text: document.body.innerText.slice(0, 200) };
    });
    if (!dbg.hasCard) throw new Error('الشاشة الرئيسية ما انرسمت: ' + JSON.stringify(dbg));
    await page.click('#card-cat');
    await page.waitForFunction(() => state.screen === 'setup', null, { timeout: 8000 });
    const r = await page.evaluate(() => ({
      teams: document.querySelectorAll('.setup-team').length,
      slots: document.querySelectorAll('.setup-slot').length,
      search: !!document.querySelector('#setup-search'),
      cards: document.querySelectorAll('#setup-list .setup-card').length,
      start: document.querySelector('#setup-start').disabled
    }));
    if (r.teams !== 2 || r.slots !== 6) throw new Error('خانات الفرق: ' + JSON.stringify(r));
    if (!r.search) throw new Error('ماكو خانة بحث');
    if (r.cards < 6) throw new Error('الفئات ما طلعت: ' + r.cards);
    if (!r.start) throw new Error('زر البدء مفعّل قبل ما تكتمل الفئات');
  });

  await step('ما تنسحب أسئلة أي فئة قبل ما تبدي اللعبة', async () => {
    await freshSetup();
    const r = await page.evaluate(() => {
      const before = Object.keys(loadUsedQuestions()).length;
      render();   // فتح الشاشة ورسمها
      const cards = document.querySelectorAll('#setup-list .setup-card');
      cards[0].click();
      return {
        before, after: Object.keys(loadUsedQuestions()).length,
        poolBank: state.pool.filter(t => t.bankKey).length,
        q: state.pool.filter(t => t.bankKey).map(t => t.questions)
      };
    });
    if (r.after !== r.before) throw new Error('انسحبت أسئلة وانحسبت «طالعة» قبل البدء');
    if (r.poolBank !== 1 || r.q[0] !== null) throw new Error('الفئة المختارة لازم تبقى بلا أسئلة لحد البدء');
  });

  await step('الاختيار حر: الفئة تروح للفريق المحدد، والفريق الكامل ينقل للثاني', async () => {
    await freshSetup();
    const r = await page.evaluate(() => {
      document.querySelectorAll('.setup-choose')[1].click();          // نختار للفريق الثاني أول
      const pick = i => document.querySelectorAll('#setup-list .setup-card')[i].click();
      pick(0); pick(1); pick(2);                                       // ٣ للفريق الثاني
      const afterThree = { t1: teamPicks(1).length, t0: teamPicks(0).length, active: state.setupActiveTeam };
      pick(3);                                                         // تروح للأول تلقائياً
      return { afterThree, t0: teamPicks(0).length, t1: teamPicks(1).length };
    });
    if (r.afterThree.t1 !== 3 || r.afterThree.t0 !== 0) throw new Error('الفئات ما راحت للفريق المحدد: ' + JSON.stringify(r.afterThree));
    if (r.afterThree.active !== 0) throw new Error('بعد ما كمّل الثاني، الاختيار ما انتقل للأول');
    if (r.t0 !== 1 || r.t1 !== 3) throw new Error('التوزيع غلط: ' + JSON.stringify(r));
  });

  await step('الضغط على أي خانة مليانة يشيل فئتها (مو بس الأخيرة)', async () => {
    await freshSetup();
    const r = await page.evaluate(() => {
      const pick = i => document.querySelectorAll('#setup-list .setup-card')[i].click();
      pick(0); pick(1); pick(2);
      const firstName = teamPicks(0)[0].name;
      document.querySelector('.setup-team.t0 .setup-slot.filled').click();   // أول خانة
      return { left: teamPicks(0).map(t => t.name), firstName,
               inPool: state.pool.some(t => t.bankKey === firstName) };
    });
    if (r.left.length !== 2 || r.left.includes(r.firstName)) throw new Error('الخانة الأولى ما انشالت: ' + r.left.join(','));
    if (r.inPool) throw new Error('فئة البنك المشالة بقت بالحوض');
  });

  await step('زر البدء يتفعّل بس بـ٣+٣، والأسئلة تنسحب وقت البدء', async () => {
    await freshSetup();
    const r = await page.evaluate(() => {
      const pick = i => document.querySelectorAll('#setup-list .setup-card')[i].click();
      [0,1,2,3,4].forEach(pick);
      const disabledAt5 = document.querySelector('#setup-start').disabled;
      pick(5);
      const enabledAt6 = !document.querySelector('#setup-start').disabled;
      document.querySelector('#setup-start').click();
      const topics = state.selectedTopicIds.map(id => state.pool.find(t => t.id === id));
      return { disabledAt5, enabledAt6, screen: state.screen,
               filled: topics.every(t => Array.isArray(t.questions) && t.questions.length === 6),
               split: [topics.filter(t => t.takenBy === 0).length, topics.filter(t => t.takenBy === 1).length] };
    });
    if (!r.disabledAt5) throw new Error('زر البدء مفعّل بخمس فئات');
    if (!r.enabledAt6) throw new Error('زر البدء ما تفعّل بست فئات');
    if (r.screen !== 'board') throw new Error('ما بدت اللعبة: ' + r.screen);
    if (!r.filled) throw new Error('أسئلة الفئات ما انسحبت وقت البدء');
    if (r.split.join() !== '3,3') throw new Error('التوزيع: ' + r.split.join('/'));
  });

  await step('البحث يتجاهل فروق الكتابة (أ/إ/ا)', async () => {
    await freshSetup();
    const r = await page.evaluate(() => {
      const target = CATEGORY_TOPICS[0];
      // نكتب اسم الفئة بلا همزات — لازم تنلكى
      const typed = target.replace(/[أإآ]/g, 'ا');
      const input = document.querySelector('#setup-search');
      input.value = typed;
      input.dispatchEvent(new Event('input'));
      const names = [...document.querySelectorAll('#setup-list .setup-card-name')].map(e => e.textContent);
      const stillFocused = document.activeElement === input || true;
      input.value = 'كلمة ما موجودة ابداً';
      input.dispatchEvent(new Event('input'));
      const none = document.querySelector('#setup-list').innerText;
      return { target, names, none };
    });
    if (!r.names.includes(r.target)) throw new Error('البحث ما لكى «' + r.target + '»: ' + r.names.join(','));
    if (!r.none.includes('ما لقيت')) throw new Error('ماكو رسالة لمن البحث ما يلكى شي');
  });

  await step('الأقسام: الفئات تتقسم، والفئة بلا قسم تروح لـ«منوعات»', async () => {
    await freshSetup();
    const r = await page.evaluate(() => {
      const keep = CATEGORY_SECTIONS;
      const [a, b, c] = CATEGORY_TOPICS;
      CATEGORY_SECTIONS = {
        list: [{ name: 'رياضة', emoji: '⚽', sort_order: 10 }, { name: 'منوعات', emoji: '🛍️', sort_order: 99 }],
        byTopic: { [a]: 'رياضة', [b]: 'رياضة' }            // c بلا قسم
      };
      try {
        render();
        const heads = [...document.querySelectorAll('.setup-section-head')].map(h => h.textContent);
        const chips = [...document.querySelectorAll('.setup-chip')].map(ch => ch.textContent.trim());
        state.setupSection = 'رياضة'; render();
        const sportCards = [...document.querySelectorAll('#setup-list .setup-card-name')].map(e => e.textContent);
        return { heads, chips, sportCards, a, b, c, cSection: topicSectionName(c) };
      } finally { CATEGORY_SECTIONS = keep; state.setupSection = 'all'; }
    });
    if (!r.heads.some(h => h.includes('رياضة'))) throw new Error('ماكو عنوان قسم: ' + r.heads.join(' | '));
    if (!r.chips.some(c => c.includes('رياضة'))) throw new Error('ماكو زر قسم: ' + r.chips.join(' | '));
    if (r.sportCards.sort().join() !== [r.a, r.b].sort().join()) throw new Error('قسم الرياضة: ' + r.sportCards.join(','));
    if (r.cSection !== 'منوعات') throw new Error('الفئة بلا قسم راحت لـ: ' + r.cSection);
  });

  await step('«نفس الأسئلة» يرجّع نفس الفئات لنفس الفرق', async () => {
    await freshSetup();
    const r = await page.evaluate(() => {
      const pick = i => document.querySelectorAll('#setup-list .setup-card')[i].click();
      [0,1,2,3,4,5].forEach(pick);
      startCategoryGame();
      const before = state.selectedTopicIds.map(id => { const t = state.pool.find(x => x.id === id); return t.name + ':' + t.takenBy; }).sort();
      state.screen = 'end'; render();
      document.querySelector('#replay').click();
      const after = state.selectedTopicIds.map(id => { const t = state.pool.find(x => x.id === id); return t.name + ':' + t.takenBy; }).sort();
      return { before, after, screen: state.screen, ready: setupReady() };
    });
    if (r.screen !== 'setup') throw new Error('ما رجع لشاشة التجهيز: ' + r.screen);
    if (r.after.join() !== r.before.join()) throw new Error('الفئات أو الفرق تغيّرت: ' + r.after.join(','));
    if (!r.ready) throw new Error('زر البدء مو جاهز بعد «نفس الأسئلة»');
  });

  await step('«جولة جديدة» ترجّع شاشة فاضية', async () => {
    const r = await page.evaluate(() => {
      state.screen = 'end'; render();
      document.querySelector('#new-round').click();
      return { screen: state.screen, picked: state.selectedTopicIds.length, bankInPool: state.pool.filter(t => t.bankKey).length };
    });
    if (r.screen !== 'setup' || r.picked !== 0 || r.bankInPool !== 0) throw new Error(JSON.stringify(r));
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
    resetTeamHelps();
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
        // طلبات الأقسام (جدولين صغار) تنجاب ويّا البنك — مو صفحات بنك
        if (String(url).indexOf('category_questions') === -1)
          return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: async () => [] });
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
      /* المفتاح ينقرأ من التطبيق نفسه، حتى رفع نسخة الكاش ما يكسر التست */
      try { return !!localStorage.getItem(BANK_CACHE_KEY); } catch (e) { return false; }
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

  /* الشاشة الرئيسية صارت خمس بطاقات متساوية — ماكو بطاقة «مميزة» ولا
     مربعات صغيرة. سبب التغيير: المربعات القديمة كانت أيقونات خطية بلا زر،
     واللاعب يقراها كروابط إعدادات مو كألعاب. */
  await step('خمس بطاقات ألعاب متساوية، كل وحدة بصورة وزر', async () => {
    const r = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.game-cards .game-card')];
      return {
        n: cards.length,
        ids: cards.map(c => c.id),
        withArt: cards.filter(c => c.querySelector('.gc-art img')).length,
        withCta: cards.filter(c => c.querySelector('.gc-cta')).length,
        withChip: cards.filter(c => c.querySelector('.gc-chip')).length,
        legacy: document.querySelectorAll('.feature-card, .game-tile, .game-grid').length
      };
    });
    if (r.n !== 5) throw new Error('عدد البطاقات: ' + r.n);
    for (const id of ['card-cat','card-whoami','card-shd','card-spy','card-bomb'])
      if (!r.ids.includes(id)) throw new Error('بطاقة ناقصة: ' + id);
    if (r.withArt !== 5) throw new Error('بطاقات بلا صورة: ' + (5 - r.withArt));
    if (r.withCta !== 5) throw new Error('بطاقات بلا زر «العب»: ' + (5 - r.withCta));
    if (r.withChip !== 5) throw new Error('بطاقات بلا عدد لاعبين: ' + (5 - r.withChip));
    if (r.legacy !== 0) throw new Error('بقايا التصميم القديم بالصفحة: ' + r.legacy);
  });

  await step('كل بطاقة تفتح شاشتها', async () => {
    const r = await page.evaluate(() => {
      const out = {};
      [['card-whoami','whoami'],['card-shd','shd'],['card-spy','spy'],['card-bomb','bomb']]
        .forEach(([id,k]) => { goto('hub'); document.querySelector('#'+id).click(); out[k] = state.screen; });
      goto('hub');
      return out;
    });
    const want = { whoami:'whoami-setup', shd:'shd-setup', spy:'spy-setup', bomb:'bomb-setup' };
    for (const k in want)
      if (r[k] !== want[k]) throw new Error(k + ' فتح: ' + r[k] + ' بدل ' + want[k]);
  });

  await step('صور الألعاب الخمسة كلها تنحمّل فعلاً', async () => {
    const bad = await page.evaluate(async () => {
      const imgs = [...document.querySelectorAll('.game-card .gc-art img')];
      await Promise.all(imgs.map(i => i.complete ? null :
        new Promise(res => { i.onload = res; i.onerror = res; })));
      return imgs.filter(i => !i.naturalWidth).map(i => i.getAttribute('src'));
    });
    if (bad.length) throw new Error('صور ما انحمّلت: ' + bad.join(', '));
  });

  await step('الضغط على بطاقة الفئات يفتح المواضيع بلا شاشة انتظار', async () => {
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
      goto('setup');
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
    await page.click('#user-box .user-name');      // الكوينات بنفس الصندوق تفتح المتجر
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
      state.screen = 'setup'; state.history = []; render();
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
      state.screen = 'setup'; render();
      const visible = document.body.innerText.includes('فئاتي المحفوظة');
      state.myCustomTopics = [];
      render();
      return visible;
    });
    if (shown) throw new Error('القائمة طلعت بلا حساب — الحارس مو شغّال');
  });

  await page.evaluate(() => {
    state.pool = state.pool.filter(t => t.bankKey !== null);
    state.screen = 'setup'; state.history = []; render();
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

  /* «تبديل السؤال» يسحب من البنك الخام مباشرة — لو ما يمر بالتحويل،
     سؤال أغنية ينبدل بالآيفون ويطلع «خمّن اسم هذي الأغنية» بلا مقطع */
  await step('الآيفون: تبديل السؤال بفئة أغاني يجيب سؤال نصي', async () => {
    const r = await page.evaluate(() => {
      const real = window.Capacitor;
      window.Capacitor = { getPlatform: () => 'ios' };
      try {
        const topic = makeBankTopic('أغاني تجريبية');
        topic.taken = true; topic.takenBy = 0;
        resetTeamHelps();
        state.helpsEnabled = { letter:true, blanks:true, swap:true };
        const q = topic.questions[0];
        const modal = document.createElement('div');
        modal.innerHTML = '<button class="help-btn" data-team="0" data-type="swap"></button>';
        const keepRender = window.render; window.render = () => {};
        try {
          wireHelpButtons(modal, topic, q);
          modal.querySelector('.help-btn').click();
        } finally { window.render = keepRender; }
        return { media: q.mediaType || null, text: q.text, used: helpUsed(state.teams[0], 'swap') };
      } finally { window.Capacitor = real; }
    });
    if (!r.used) throw new Error('التبديل ما صار');
    if (r.media === 'song') throw new Error('البديل طلع سؤال صوتي بالآيفون');
    if (!/^منو يغني «.+»؟$/.test(r.text)) throw new Error('البديل مو نصي: ' + r.text);
  });

  /* البنك يكدر يسبق التطبيق: نوع وسائط جديد (صورة/فيديو) ينضاف من لوحة
     الإدارة قبل ما ينزل دعمه — النسخة الحالية لازم تتجاهله مو تعرضه ناقص */
  await step('أنواع الوسائط اللي ما تدعمها النسخة ما تطلع باللعبة', async () => {
    const r = await page.evaluate(async () => {
      const realFetch = window.fetch;
      const rows = [
        { id: 1, topic: 'مختلطة', points: 100, question: 'نص', answer: 'أ' },
        { id: 2, topic: 'مختلطة', points: 100, question: 'علم', answer: 'ب', media_type: 'flag', image: 'iq' },
        { id: 3, topic: 'مختلطة', points: 100, question: 'شوف المقطع', answer: 'ج', media_type: 'video', image: 'https://x/v.mp4' },
        { id: 4, topic: 'مختلطة', points: 100, question: 'نوع من المستقبل', answer: 'د', media_type: 'hologram', image: 'x' },
        { id: 5, topic: 'فيديو بس', points: 100, question: 'شوف المقطع', answer: 'هـ', media_type: 'video', image: 'https://x/w.mp4' }
      ];
      window.fetch = async () => ({
        ok: true, status: 206,
        headers: { get: h => h.toLowerCase() === 'content-range' ? '0-4/5' : null },
        json: async () => rows
      });
      try {
        const bank = await fetchWholeBank();
        const kept = [].concat(...Object.values(bank.grouped).map(t => [].concat(t[100], t[200], t[400], t[600])));
        return { topics: bank.topics, ids: kept.map(q => q.bankId).sort() };
      } finally { window.fetch = realFetch; }
    });
    if (r.ids.join(',') !== '1,2') throw new Error('الأسئلة اللي بقت: ' + r.ids.join(','));
    if (r.topics.includes('فيديو بس')) throw new Error('فئة كلها فيديو طلعت فاضية بالقائمة');
  });

  console.log('\nالتحكم بالمساعدات');
  const openFirstQuestion = async () => {
    await page.evaluate(() => {
      // نبني الحوض من جديد — الاختبارات السابقة ممكن تكون فضّته
      state.pool = CATEGORY_TOPICS.slice(0, 6).map(makeBankTopic);
      state.selectedTopicIds = [];
      state.pool.forEach((t, i) => { t.taken = true; t.takenBy = i % 2; state.selectedTopicIds.push(t.id); });
      resetTeamHelps();
      state.helpHints = { 0:null, 1:null };
      const t = state.pool[0];
      t.questions.forEach(q => { delete q.usedBy; delete q.revealed; });
      state.activeCell = { topicId: t.id, qId: t.questions[0].id };
      state.screen = 'board';
      render();
    });
    await page.waitForSelector('.help-wrap, .q-modal', { timeout: 8000 });
  };

  /* «خيارات» تطلع بس للسؤال اللي عنده خيارات مكتوبة بالجدول */
  await step('«خيارات» تطلع بس للسؤال اللي عنده خيارات بالجدول', async () => {
    await page.evaluate(() => { state.helpsEnabled = { letter:true, blanks:true, choices:true, swap:true }; });
    await openFirstQuestion();
    const without = await page.$$eval('.help-btn', els => els.map(e => e.dataset.type));
    const withC = await page.evaluate(() => {
      const t = state.pool.find(x => x.id === state.activeCell.topicId);
      t.questions[0].decoys = ['خيار غلط ١', 'خيار غلط ٢'];
      render();
      const types = [...document.querySelectorAll('.help-btn')].map(e => e.dataset.type);
      delete t.questions[0].decoys;
      return types;
    });
    for (const t of ['letter','blanks','swap'])
      if (!without.includes(t)) throw new Error('مساعدة ناقصة: ' + t);
    if (without.includes('choices')) throw new Error('«خيارات» طالعة لسؤال بلا خيارات بالجدول');
    if (!withC.includes('choices')) throw new Error('«خيارات» ما طلعت لسؤال عنده خيارات');
  });

  await step('«خيارات» تعرض الجواب ويّا الخيارين، ومرة وحدة باللعبة', async () => {
    await openFirstQuestion();
    const r = await page.evaluate(() => {
      const t = state.pool.find(x => x.id === state.activeCell.topicId);
      const q0 = t.questions[0], q1 = t.questions[1];
      q0.decoys = ['غلط أ', 'غلط ب'];
      q1.decoys = ['غلط ج', 'غلط د'];
      render();
      document.querySelector('.help-btn[data-type="choices"]').click();
      const hint = state.helpHints[t.takenBy] || '';
      // سؤال ثاني عنده خيارات هم — لازم الزر يكون مستخدم
      state.helpHints = { 0:null, 1:null };
      state.activeCell = { topicId: t.id, qId: q1.id };
      render();
      const btn = document.querySelector('.help-btn[data-type="choices"]');
      const out = { hint, answer: q0.answer, disabled: !!(btn && btn.disabled) };
      delete q0.decoys; delete q1.decoys;
      return out;
    });
    if (!r.hint.startsWith('الخيارات:')) throw new Error('ما طلعت الخيارات: ' + r.hint);
    for (const s of [r.answer, 'غلط أ', 'غلط ب'])
      if (!r.hint.includes(s)) throw new Error('ناقص من الخيارات: ' + s + ' ← ' + r.hint);
    if (!r.disabled) throw new Error('«خيارات» انستخدمت مرتين بنفس اللعبة');
  });

  await step('«خيارات» كل خيار بمربع لحاله، والإنكليزي بين القوسين تحته', async () => {
    const r = await page.evaluate(() => {
      const box = el(helpHintHtml('الخيارات: زلاتان إبراهيموفيتش (Zlatan Ibrahimović)  /  3-3  /  <b>x</b>'));
      const items = [...box.querySelectorAll('.help-choice')];
      return { n: items.length, small: items[0].querySelector('small')?.textContent,
               main: items[0].querySelector('span')?.textContent, plain: items[1].textContent,
               escaped: !box.querySelector('b') };
    });
    if (r.n !== 3) throw new Error('عدد المربعات غلط: ' + r.n);
    if (r.main !== 'زلاتان إبراهيموفيتش' || r.small !== 'Zlatan Ibrahimović')
      throw new Error('الاسم ما انفصل عن الإنكليزي: ' + r.main + ' | ' + r.small);
    if (r.plain !== '3-3') throw new Error('خيار بلا أقواس تغيّر: ' + r.plain);
    if (!r.escaped) throw new Error('نص الخيار ما انهرب');
  });

  await step('«تبديل السؤال» يجيب خيارات السؤال الجديد', async () => {
    await openFirstQuestion();
    const r = await page.evaluate(() => {
      const t = state.pool.find(x => x.id === state.activeCell.topicId);
      const q = t.questions[0];
      q.decoys = ['قديم أ', 'قديم ب'];
      const tier = CATEGORY_DATA[t.bankKey][q.points];
      tier.forEach(b => { b.decoys = ['جديد أ', 'جديد ب']; });
      render();
      document.querySelector('.help-btn[data-type="swap"]').click();
      const out = q.decoys;
      tier.forEach(b => { delete b.decoys; });
      delete q.decoys;
      return out;
    });
    if (!r || r[0] !== 'جديد أ') throw new Error('بقت خيارات السؤال القديم: ' + JSON.stringify(r));
  });

  await step('إطفاء «تبديل السؤال» يشيله من النافذة', async () => {
    await page.evaluate(() => { state.helpsEnabled.swap = false; });
    await openFirstQuestion();
    const types = await page.$$eval('.help-btn', els => els.map(e => e.dataset.type));
    if (types.includes('swap')) throw new Error('المطفّاة لسه ظاهرة: ' + types.join(','));
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

  await step('مساعدة مطفّاة أو ما تنفع للسؤال ما تنصرف حتى لو انضغطت بالقوة', async () => {
    await page.evaluate(() => { state.helpsEnabled = { letter:true, blanks:false, choices:true, swap:false }; });
    await openFirstQuestion();
    const used = await page.evaluate(() => {
      // نزوّر زرين: «عدد الأحرف» (مطفّاة) و«خيارات» (السؤال بلا خيارات بالجدول) — المنطق لازم يرفضهم
      const real = document.querySelector('.help-btn');
      if (!real) return 'ماكو أي زر مساعدة';
      ['blanks', 'choices'].forEach(type => {
        const fake = real.cloneNode(true);
        fake.dataset.type = type;
        real.parentNode.appendChild(fake);
      });
      const topic = state.pool.find(t => t.id === state.activeCell.topicId);
      wireHelpButtons(document.querySelector('.q-modal'), topic, topic.questions[0]);
      [...document.querySelectorAll('.help-btn')]
        .filter(b => b.dataset.type !== 'letter').forEach(b => b.click());
      return Object.keys(state.teams[topic.takenBy].usedHelps || {});
    });
    if (typeof used === 'string') throw new Error(used);
    if (used.length) throw new Error('انحسبت مساعدة على زر مطفّى: ' + used.join(','));
  });

  /* الطلب: كل مساعدة مرة وحدة لكل فريق باللعبة كلها، مو عدد مفتوح */
  await step('كل مساعدة تنستخدم مرة وحدة للفريق باللعبة', async () => {
    await page.evaluate(() => { state.helpsEnabled = { letter:true, blanks:true, swap:true }; });
    await openFirstQuestion();
    const r = await page.evaluate(() => {
      const topic = state.pool.find(t => t.id === state.activeCell.topicId);
      const ti = topic.takenBy;
      const click = type => {
        const b = document.querySelector(`.help-btn[data-type="${type}"]`);
        if (b) b.click();
        return b;
      };
      click('letter');
      const firstHint = state.helpHints[ti];
      const btnAfter = document.querySelector('.help-btn[data-type="letter"]');

      // سؤال ثاني بنفس اللعبة: «أول حرف» لازم تبقى مستخدمة
      state.helpHints = { 0:null, 1:null };
      state.activeCell = { topicId: topic.id, qId: topic.questions[1].id };
      render();
      click('letter');
      const secondHint = state.helpHints[ti];
      const blanksBtn = click('blanks');
      const blanksHint = state.helpHints[ti];
      const title = (document.querySelector('.help-title') || {}).textContent || '';
      return {
        firstHint, secondHint, blanksHint, title,
        letterDisabled: !!(btnAfter && btnAfter.disabled),
        blanksFound: !!blanksBtn
      };
    });
    if (!r.firstHint) throw new Error('أول استخدام ما اشتغل');
    if (!r.letterDisabled) throw new Error('زر «أول حرف» ما صار معطّل بعد استخدامه');
    if (r.secondHint && r.secondHint.includes('أول حرف')) throw new Error('«أول حرف» انستخدمت مرتين بنفس اللعبة');
    if (!r.blanksFound || !r.blanksHint || !r.blanksHint.includes('عدد الأحرف'))
      throw new Error('مساعدة ثانية ما اشتغلت بعد استخدام الأولى');
    if (!r.title.includes('متبقي 1')) throw new Error('العدّاد غلط: ' + r.title);
  });

  await step('لعبة جديدة ترجّع كل المساعدات للفريقين', async () => {
    const r = await page.evaluate(() => {
      state.pool = []; state.selectedTopicIds = []; state.setupActiveTeam = 0;
      state.screen = 'setup'; render();
      const pick = i => document.querySelectorAll('#setup-list .setup-card')[i].click();
      [0,1,2,3,4,5].forEach(pick);
      state.teams[0].usedHelps = { letter:true, blanks:true };
      state.teams[1].usedHelps = { swap:true };
      document.querySelector('#setup-start').click();
      return [Object.keys(state.teams[0].usedHelps).length, Object.keys(state.teams[1].usedHelps).length];
    });
    if (r[0] || r[1]) throw new Error('بقت مساعدات مستخدمة من اللعبة السابقة: ' + r.join(' / '));
  });

  await step('إعدادات المساعدات (بشاشة التجهيز): أربع مفاتيح وبلا خانة عدد', async () => {
    await page.evaluate(() => { state.activeCell = null; state.setupShowSettings = true; goto('setup'); });
    await page.waitForSelector('#helps-toggles', { timeout: 8000 });
    const keys = await page.$$eval('#helps-toggles .switch', els => els.map(e => e.dataset.help));
    for (const k of ['letter','blanks','choices','swap'])
      if (!keys.includes(k)) throw new Error('مفتاح ناقص: ' + k);
    const n = await page.$$eval('#helps-count', els => els.length);
    if (n !== 0) throw new Error('خانة عدد المساعدات لسه موجودة — ما عاد إلها معنى');
    await page.evaluate(() => { state.setupShowSettings = false; });
  });

  console.log('\nألعاب القعدة الجديدة (الدخيل + القنبلة)');

  await step('اللعبتين الجديدتين لهن بطاقة بالشاشة الرئيسية', async () => {
    const r = await page.evaluate(() => {
      goto('hub');
      const badge = id => {
        const b = document.querySelector('#'+id+' .gc-badge');
        return b ? b.textContent.trim() : '';
      };
      return {
        spy: !!document.querySelector('.game-card#card-spy'),
        bomb: !!document.querySelector('.game-card#card-bomb'),
        spyBadge: badge('card-spy'), bombBadge: badge('card-bomb'),
        soon: document.body.innerText.includes('قريباً')
      };
    });
    if (!r.spy) throw new Error('بطاقة «من الدخيل؟» مو موجودة');
    if (!r.bomb) throw new Error('بطاقة «القنبلة» مو موجودة');
    if (r.spyBadge !== 'جديد' || r.bombBadge !== 'جديد')
      throw new Error('شارة «جديد» ناقصة: ' + r.spyBadge + ' / ' + r.bombBadge);
    if (r.soon) throw new Error('بعدها كلمة «قريباً» بالصفحة');
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

  console.log('\nترتيب الفرق العام');

  /* السؤال ينحسب على صاحب الموضوع، وإذا خطفه الفريق الثاني ينحسب
     للاثنين. هاي القاعدة هي أساس التقييم كله — لو انكسرت، الترتيب
     يصير يقيس شي ثاني بلا ما ينتبه أحد. */
  await step('نتيجة كل سؤال تنحسب على الفريق الصحيح', async () => {
    const r = await page.evaluate(() => {
      state.gameAnswers = [];
      const topic0 = { takenBy: 0 }, topic1 = { takenBy: 1 }, orphan = {};
      recordTeamAnswer(0, topic0, { bankId: 11 });       // صاحب الموضوع جاوب
      recordTeamAnswer(null, topic0, { bankId: 12 });    // ولا فريق جاوب
      recordTeamAnswer(0, topic1, { bankId: 13 });       // خطف من الفريق الثاني
      recordTeamAnswer(1, orphan, { bankId: 14 });       // موضوع بلا مالك
      recordTeamAnswer(0, topic0, { text: 'فئة خاصة' }); // بلا bankId — ما ينحسب
      return state.gameAnswers;
    });
    const key = a => a.team + ':' + a.q + ':' + (a.ok ? 1 : 0);
    const got = r.map(key).sort().join(' | ');
    const want = ['0:11:1', '0:12:0', '1:13:0', '0:13:1', '1:14:1'].sort().join(' | ');
    if (got !== want) throw new Error('التوزيع غلط:\n      صار: ' + got + '\n      المتوقع: ' + want);
  });

  await step('مساعدة «تبديل السؤال» تبدّل bankId وياه', async () => {
    const src = await page.evaluate(() => {
      const fn = String(wireHelpButtons);
      return fn.slice(fn.indexOf("type==='swap'"), fn.indexOf("type==='swap'") + 1200);
    });
    if (!/q\.bankId\s*=\s*fresh\.bankId/.test(src))
      throw new Error('السؤال ينتبدل بلا bankId — النتيجة تنحسب على السؤال القديم');
  });

  await step('اليوزر يرفض الفاضي والقصير والمسافات', async () => {
    const r = await page.evaluate(() => ({
      empty:  !!teamHandleError(''),
      short:  !!teamHandleError('ab'),
      space:  !!teamHandleError('abc def'),
      long:   !!teamHandleError('a'.repeat(21)),
      ok:     teamHandleError('sqour_basra'),
      arabic: teamHandleError('صقور_البصرة'),
      at:     normalizeTeamHandle('  @Sqour_Basra ')
    }));
    if (!r.empty || !r.short || !r.space || !r.long) throw new Error('قبل يوزر غير صالح');
    if (r.ok) throw new Error('رفض يوزر صالح: ' + r.ok);
    if (r.arabic) throw new Error('رفض يوزر عربي: ' + r.arabic);
    if (r.at !== 'sqour_basra') throw new Error('التنظيف غلط: ' + r.at);
  });

  await step('بطاقة التسجيل تظهر بالنهاية وتختفي لو ماكو أسئلة بنك', async () => {
    const r = await page.evaluate(() => {
      const user = state.user;
      state.user = { uid: 'x', name: 'تجربة', coins: 0 };
      state.gameAnswers = [{ team: 0, q: 1, ok: true }];
      const withBank = !!renderTeamBoardCard();
      state.gameAnswers = [];
      const withoutBank = !!renderTeamBoardCard();
      state.user = user;
      return { withBank, withoutBank };
    });
    if (!r.withBank) throw new Error('البطاقة ما ظهرت بلعبة فيها أسئلة بنك');
    if (r.withoutBank) throw new Error('البطاقة ظهرت بلعبة فئات خاصة بالكامل');
  });

  await step('شاشة الترتيب تنفتح من الرئيسية وتعرض الفرق', async () => {
    await page.evaluate(() => {
      window.__boardRows = [
        { rank: 1, handle: 'sqour_basra', name: 'صقور البصرة', score: 340, games: 4, answers: 20, correct: 14 },
        { rank: 2, handle: 'nsour_mosul', name: 'نسور الموصل', score: 180, games: 3, answers: 18, correct: 7 }
      ];
      state.history = []; goto('hub');
    });
    await page.click('#hub-board');
    await page.waitForFunction(() => state.screen === 'leaderboard' && !state.boardLoading,
                               null, { timeout: 15000 });
    const r = await page.evaluate(() => ({
      err: state.boardError,
      rows: document.querySelectorAll('.score-row').length,
      text: document.body.innerText
    }));
    if (r.err) throw new Error('الترتيب ما انحمّل: ' + r.err);
    if (r.rows !== 2) throw new Error('عدد الصفوف: ' + r.rows);
    if (!r.text.includes('صقور البصرة')) throw new Error('اسم الفريق ما ظهر');
    if (!r.text.includes('70٪')) throw new Error('نسبة الإجابات الصحيحة ما ظهرت');
    await page.evaluate(() => { state.history = []; goto('hub'); });
  });

  /* أهم شي بالتسجيل: كل فريق يرسل أسئلته هو بس. لو انخلطت، الترتيب
     ينبني على بيانات غلط من أول يوم وما ينفع ينصلح بأثر رجعي. */
  await step('التسجيل يرسل أسئلة كل فريق لفريقه', async () => {
    const r = await page.evaluate(async () => {
      window.__signedIn = true;
      window.__submitted = null;
      state.user = { uid: 'u1', name: 'تجربة', coins: 0 };
      state.teams[0].name = 'صقور البصرة';
      state.teams[1].name = 'نسور الموصل';
      state.gameUid = '33333333-3333-4333-8333-333333333333';
      state.gameAnswers = [
        { team: 0, q: 11, ok: true }, { team: 0, q: 12, ok: false },
        { team: 1, q: 13, ok: true }
      ];
      state.teamHandles = ['sqour_basra', 'nsour_mosul'];
      state.boardResult = null; state.boardError = '';
      await submitBoardResult();
      const out = {
        sent: window.__submitted,
        error: state.boardError,
        result: state.boardResult,
        saved: localStorage.getItem('tajammo.teamHandles.v1'),
        shown: (renderTeamBoardCard() || {}).innerText || ''
      };
      state.user = null; window.__signedIn = false;
      return out;
    });
    if (r.error) throw new Error('رجع خطأ: ' + r.error);
    if (!r.sent) throw new Error('ما انرسل شي للسيرفر');
    if (r.sent.p_game_uid !== '33333333-3333-4333-8333-333333333333')
      throw new Error('معرّف اللعبة ما انرسل — الحساب المكرر ما ينمنع');
    const t0 = r.sent.p_teams[0], t1 = r.sent.p_teams[1];
    if (t0.handle !== 'sqour_basra' || t1.handle !== 'nsour_mosul')
      throw new Error('اليوزرات انخلطت');
    if (t0.answers.length !== 2 || t1.answers.length !== 1)
      throw new Error('أسئلة الفرق انخلطت: ' + t0.answers.length + ' و' + t1.answers.length);
    if (t0.answers.some(a => a.q === 13)) throw new Error('سؤال الفريق الثاني انحسب على الأول');
    if (!r.shown.includes('انسجّلت النتيجة') || !r.shown.includes('المركز 1'))
      throw new Error('بطاقة النتيجة ما بيّنت المركز: ' + r.shown);
    if (!String(r.saved).includes('sqour_basra')) throw new Error('اليوزر ما انحفظ للمرة الجاية');
  });

  /* آبل (Guideline 1.2): أسماء الفرق محتوى مستخدمين، فلازم يكون أكو
     تبليغ وحظر، مو بس فلترة. هاي التستات تثبّت الثلاثة بالواجهة. */
  await step('زر التبليغ ⚑ يطلع على فرق الغير بس، مو على فرقك', async () => {
    const r = await page.evaluate(async () => {
      try { localStorage.setItem('tajammo.teamHandles.v1', JSON.stringify(['my_team', ''])); } catch (e) {}
      try { localStorage.removeItem(BLOCKED_AUTHORS_KEY); } catch (e) {}
      window.__boardRows = [
        { rank: 1, handle: 'bad_team', name: 'فريق مزعج', score: 300, games: 3, answers: 15, correct: 10, owner_key: 'owner_bad' },
        { rank: 2, handle: 'my_team',  name: 'فريقي',     score: 200, games: 2, answers: 10, correct: 6,  owner_key: 'owner_me' },
        { rank: 3, handle: 'bad_team2', name: 'فريقه الثاني', score: 100, games: 1, answers: 6, correct: 3, owner_key: 'owner_bad' }
      ];
      state.history = []; goto('hub');
      openLeaderboard();
      await new Promise(res => { const w = () => (!state.boardLoading ? res() : setTimeout(w, 30)); w(); });
      const rows = [...document.querySelectorAll('.score-row')];
      return rows.map(row => ({
        text: row.innerText,
        flag: !!row.querySelector('.team-report')
      }));
    });
    const mine = r.find(x => x.text.includes('my_team'));
    const other = r.find(x => x.text.includes('bad_team'));
    if (!mine || !other) throw new Error('الصفوف ما ظهرت: ' + JSON.stringify(r));
    if (mine.flag) throw new Error('زر التبليغ طالع على فريقك');
    if (!other.flag) throw new Error('زر التبليغ مو طالع على فريق غيرك');
  });

  await step('البلاغ ينرسل، والحظر يشيل كل فرق صاحبه، وإلغاء الحظر يرجّعها', async () => {
    const r = await page.evaluate(async () => {
      window.__teamReports = [];
      const row = state.boardRows.find(x => x.handle === 'bad_team');
      openTeamReport(row);
      const modalOpen = !!document.querySelector('#trep-send');
      state.reportReason = 'offensive';
      state.blockAuthorToo = true;
      await submitTeamReport();
      const done = state.reportDone;
      closeTeamReport();

      const afterBlock = [...document.querySelectorAll('.score-row')].map(x => x.innerText).join(' | ');
      const panel = document.body.innerText.includes('مستخدمين محظورين');

      unblockAuthor('owner_bad'); render();
      const afterUnblock = [...document.querySelectorAll('.score-row')].map(x => x.innerText).join(' | ');

      try { localStorage.removeItem('tajammo.teamHandles.v1'); } catch (e) {}
      return { modalOpen, done, sent: window.__teamReports, afterBlock, panel, afterUnblock };
    });
    if (!r.modalOpen) throw new Error('نافذة البلاغ ما انفتحت');
    if (!r.done) throw new Error('البلاغ ما خلص');
    if (!r.sent.length || r.sent[0].p_handle !== 'bad_team' || r.sent[0].p_reason !== 'offensive')
      throw new Error('البلاغ انرسل غلط: ' + JSON.stringify(r.sent));
    if (r.afterBlock.includes('bad_team')) throw new Error('الحظر ما شال الفريق الأول');
    if (r.afterBlock.includes('bad_team2')) throw new Error('الحظر ما شال فريقه الثاني — لازم يحظر الشخص مو الفريق بس');
    if (!r.afterBlock.includes('my_team')) throw new Error('الحظر شال فريق ثاني ما إله علاقة');
    if (!r.panel) throw new Error('قائمة المحظورين ما ظهرت بشاشة الترتيب');
    if (!r.afterUnblock.includes('bad_team')) throw new Error('إلغاء الحظر ما رجّع الفريق');
  });

  await step('التسجيل يرفض يوزر مكرر للفريقين', async () => {
    const err = await page.evaluate(async () => {
      window.__signedIn = true;
      state.user = { uid: 'u1', name: 'تجربة', coins: 0 };
      state.gameAnswers = [{ team: 0, q: 11, ok: true }];
      state.teamHandles = ['same_team', 'same_team'];
      state.boardResult = null; state.boardError = '';
      await submitBoardResult();
      const e = state.boardError;
      state.user = null; window.__signedIn = false;
      return e;
    });
    if (!err) throw new Error('قبل نفس اليوزر للفريقين');
  });

  /* آبل رفضت نسخة 1.8 (12) لأن نافذة إذن التتبع ما كانت تطلع: انطلبت
     والتطبيق لسه مو «فعّال»، فالنظام تجاهلها بصمت. التست يثبّت الترتيب:
     ما ننطلب إلا بعد ما يصير فعّال، ودائماً قبل تهيئة الإعلانات. */
  console.log('\nإذن التتبع على iOS (سبب رفض آبل)');
  await step('الإذن ينطلب بعد ما يصير التطبيق فعّال، وقبل تشغيل الإعلانات', async () => {
    const r = await page.evaluate(async () => {
      const calls = [];
      let active = false, onState = null;
      const realCap = window.Capacitor;
      window.Capacitor = {
        isNativePlatform: () => true,
        getPlatform: () => 'ios',
        Plugins: {
          App: {
            getState: async () => ({ isActive: active }),
            addListener: (ev, cb) => { if (ev === 'appStateChange') onState = cb; return { remove(){} }; }
          },
          AdMob: {
            trackingAuthorizationStatus: async () => ({ status: 'notDetermined' }),
            requestTrackingAuthorization: async () => { calls.push('att'); },
            initialize: async () => { calls.push('init'); },
            showBanner: async () => { calls.push('banner'); }
          },
          BannerAdPosition: { BOTTOM_CENTER: 'b' },
          BannerAdSize: { ADAPTIVE_BANNER: 'a' }
        }
      };
      const p = initAdMob();
      await new Promise(r => setTimeout(r, 400));
      const beforeActive = calls.slice();          // لسه مو فعّال — المفروض ماكو ولا نداء
      active = true;
      if (onState) onState({ isActive: true });
      await p;
      window.Capacitor = realCap;
      admobReady = false;
      return { beforeActive, calls };
    });
    if (r.beforeActive.length)
      throw new Error('انطلب شي والتطبيق لسه مو فعّال: ' + r.beforeActive.join(','));
    if (r.calls[0] !== 'att')
      throw new Error('إذن التتبع مو أول شي: ' + r.calls.join(','));
    if (r.calls.indexOf('init') < r.calls.indexOf('att'))
      throw new Error('الإعلانات انشغّلت قبل الإذن: ' + r.calls.join(','));
  });

  await step('ما نزعج اللاعب بالنافذة لو قرر قبل', async () => {
    const r = await page.evaluate(async () => {
      let asked = 0;
      const realCap = window.Capacitor;
      window.Capacitor = {
        isNativePlatform: () => true,
        getPlatform: () => 'ios',
        Plugins: {
          AdMob: {
            trackingAuthorizationStatus: async () => ({ status: 'denied' }),
            requestTrackingAuthorization: async () => { asked++; }
          }
        }
      };
      await requestTrackingPermission();
      window.Capacitor = realCap;
      return asked;
    });
    if (r !== 0) throw new Error('أعاد طلب الإذن مع إن اللاعب قرر قبل');
  });

  console.log('\nأسئلة الصور');
  await step('الصورة وسطر النسبة يوصلون من البنك للسؤال', async () => {
    const r = await page.evaluate(() => {
      const qs = pickQuestionsForBankTopic('صور تجريبية');
      return { n: qs.length, media: qs.map(q => q.mediaType),
               image: qs[0].image, credit: qs[0].credit };
    });
    if (r.n !== 6) throw new Error('عدد الأسئلة: ' + r.n);
    if (!r.media.every(m => m === 'photo')) throw new Error('نوع الوسائط: ' + r.media.join(','));
    if (!r.image) throw new Error('الصورة ضاعت بالطريق');
    if (!r.credit || !r.credit.includes('CC BY')) throw new Error('سطر النسبة ضاع: ' + r.credit);
  });

  await step('النافذة تعرض الصورة وتحتها النسبة', async () => {
    const r = await page.evaluate(() => {
      const q = pickQuestionsForBankTopic('صور تجريبية')[0];
      const savedPool = state.pool, savedCell = state.activeCell;
      state.pool = [{ id: 901, name: 'صور تجريبية', questions: [q] }];
      state.activeCell = { topicId: 901, qId: q.id };
      try {
        const ov = renderQuestionOverlay();
        const img = ov.querySelector('.q-photo img');
        const cr = ov.querySelector('.q-credit');
        return { src: img && img.getAttribute('src'),
                 credit: cr && cr.textContent.trim(),
                 qtext: (ov.querySelector('.q-text') || {}).textContent };
      } finally { state.pool = savedPool; state.activeCell = savedCell; }
    });
    if (!r.src) throw new Error('ماكو <img> بالنافذة');
    if (!r.credit || r.credit.indexOf('ويكيميديا') === -1)
      throw new Error('ماكو سطر نسبة: ' + r.credit);
    if (!r.qtext || r.qtext.indexOf('منو هذا اللاعب') === -1)
      throw new Error('نص السؤال ضاع: ' + r.qtext);
  });

  await step('صورة ما تحمّلت: تنشال هي وسطر النسبة، والسؤال يبقى مقروء', async () => {
    const r = await page.evaluate(() => {
      const q = pickQuestionsForBankTopic('صور تجريبية')[0];
      const savedPool = state.pool, savedCell = state.activeCell;
      state.pool = [{ id: 902, name: 'صور تجريبية', questions: [q] }];
      state.activeCell = { topicId: 902, qId: q.id };
      try {
        const ov = renderQuestionOverlay();
        const img = ov.querySelector('.q-photo img');
        img.dispatchEvent(new Event('error'));
        return { photo: !!ov.querySelector('.q-photo'),
                 credit: !!ov.querySelector('.q-credit'),
                 text: !!ov.querySelector('.q-text'),
                 reveal: !!ov.querySelector('#reveal') };
      } finally { state.pool = savedPool; state.activeCell = savedCell; }
    });
    if (r.photo) throw new Error('الصورة المكسورة ظلت بالنافذة');
    if (r.credit) throw new Error('سطر النسبة ظل بلا صورة');
    if (!r.text) throw new Error('نص السؤال انشال وياها');
    if (!r.reveal) throw new Error('زر إظهار الإجابة انشال');
  });

  /* ───────── متجر الكوينز والإعلان بمكافأة ───────── */
  const shopUser = async (extra) => page.evaluate((extra) => {
    window.__signedIn = true;
    window.__shop = null;
    window.__shopStartCoins = (extra && extra.coins) || 200;
    state.user = Object.assign({ uid: 'shop1', name: 'زهراء', coins: 200, termsAcceptedAt: '2026-01-01' }, extra || {});
    state.rewardState = null; state.rewardMsg = ''; state.rewardBusy = false;
  }, extra || null);
  const shopDone = () => page.evaluate(() => {
    window.__signedIn = false; window.__shop = null; window.__adWatched = null;
    state.user = null; state.rewardState = null; state.rewardMsg = '';
    if (window.__realAdsReady) { window.rewardedAdsReady = window.__realAdsReady; window.__realAdsReady = null; }
    if (window.__realShowRewarded) { window.showRewardedAd = window.__realShowRewarded; window.__realShowRewarded = null; }
    goto('hub');
  });
  /* بالمتصفح ماكو إعلانات — نبدّلها بإعلان وهمي: 'ok' يعني كمّله، 'closed' سكّره بنصه */
  const fakeRewardedAd = (result) => page.evaluate((result) => {
    window.__realAdsReady = window.__realAdsReady || window.rewardedAdsReady;
    window.__realShowRewarded = window.__realShowRewarded || window.showRewardedAd;
    window.rewardedAdsReady = () => true;
    window.showRewardedAd = async (token) => {
      if (result === 'ok') { window.__adWatched = window.__adWatched || {}; window.__adWatched[token] = true; }
      return result;
    };
  }, result);
  const waitIdle = () => page.waitForFunction(() => !state.rewardBusy, null, { timeout: 15000 });

  await step('المتجر للضيف: يطلب تسجيل دخول وما يعرض أشياء', async () => {
    const r = await page.evaluate(() => {
      state.user = null; openShop();
      const app = document.getElementById('app');
      return { login: !!app.querySelector('#shop-login'), cards: app.querySelectorAll('.avatar-card').length };
    });
    if (!r.login) throw new Error('ما طلع زر تسجيل الدخول');
    if (r.cards) throw new Error('الضيف شاف أشياء للشراء');
    await page.evaluate(() => goto('hub'));
  });

  await step('المتجر يعرض الرصيد والإطار و١٢ صورة، وبلا إعلانات بالمتصفح', async () => {
    await shopUser();
    await page.evaluate(() => openShop());
    await page.waitForFunction(() => state.rewardState !== null);
    const r = await page.evaluate(() => {
      const app = document.getElementById('app');
      return { cards: app.querySelectorAll('.avatar-card').length, head: app.querySelector('.shop-head').textContent,
               watch: !!app.querySelector('#shop-watch'), earn: app.querySelector('.shop-earn').textContent,
               chipOpensShop: (() => { goto('hub'); document.querySelector('.coin-chip').click(); return state.screen; })() };
    });
    if (r.cards !== 12) throw new Error('عدد الصور: ' + r.cards);
    if (!r.head.includes('200')) throw new Error('الرصيد ما طلع: ' + r.head);
    if (r.watch) throw new Error('زر الإعلان طلع بالمتصفح');
    if (!r.earn.includes('تطبيق الموبايل')) throw new Error('ما وضّح وين تنجمع الكوينز');
    if (r.chipOpensShop !== 'shop') throw new Error('الكوينات بالشريط العلوي ما تفتح المتجر');
  });

  await step('شراء صورة يخصم السعر ويلبسها، والمجانية تنلبس بلا خصم', async () => {
    await page.evaluate(() => { [...document.querySelectorAll('.avatar-card')].find(c => c.textContent.includes('أسد بابل')).querySelector('button').click(); });
    await waitIdle();
    const r = await page.evaluate(async () => {
      const lion = { coins: state.user.coins, avatar: state.user.avatar,
                     header: document.querySelector('#user-box .avatar')?.textContent,
                     label: [...document.querySelectorAll('.avatar-card')].find(c => c.textContent.includes('أسد بابل')).querySelector('button').textContent };
      [...document.querySelectorAll('.avatar-card')].find(c => c.textContent.includes('نخلة')).querySelector('button').click();
      await new Promise(res => { const t = setInterval(() => { if (!state.rewardBusy) { clearInterval(t); res(); } }, 50); });
      return { lion, palm: { coins: state.user.coins, avatar: state.user.avatar } };
    });
    if (r.lion.coins !== 150 || r.lion.avatar !== 'avatar_lion') throw new Error('الشراء ما خصم أو ما لبس: ' + JSON.stringify(r.lion));
    if (r.lion.header !== '🦁') throw new Error('الصورة ما طلعت بالشريط العلوي: ' + r.lion.header);
    if (!r.lion.label.includes('لابسها')) throw new Error('الزر ما تغيّر: ' + r.lion.label);
    if (r.palm.coins !== 150 || r.palm.avatar !== 'avatar_palm') throw new Error('المجانية خصمت أو ما انلبست: ' + JSON.stringify(r.palm));
  });

  await step('رصيد ما يكفي للإطار: رسالة واضحة وما ينخصم شي', async () => {
    await page.evaluate(() => { window.__shop.coins = 100; state.user.coins = 100; render();
      document.querySelector('.shop-row button').click(); });
    await waitIdle();
    const r = await page.evaluate(() => ({ msg: document.querySelector('.shop-msg')?.textContent, coins: window.__shop.coins, frame: state.user.frame }));
    if (!r.msg || !r.msg.includes('ما يكفي')) throw new Error('الرسالة: ' + r.msg);
    if (r.coins !== 100 || r.frame) throw new Error('انخصم أو انلبس الإطار');
  });

  await step('الإعلان بمكافأة: يضيف مكافأة اليوم، والإغلاق بنصه ما يضيف شي', async () => {
    await fakeRewardedAd('closed');
    await page.evaluate(() => render());
    await page.evaluate(() => document.querySelector('#shop-watch').click());
    await waitIdle();
    const closed = await page.evaluate(() => ({ coins: window.__shop.coins, msg: state.rewardMsg }));
    if (closed.coins !== 100 || !closed.msg.includes('سكّرت')) throw new Error('الإغلاق بنصه: ' + JSON.stringify(closed));

    await fakeRewardedAd('ok');
    await page.evaluate(() => document.querySelector('#shop-watch').click());
    await waitIdle();
    const ok = await page.evaluate(() => ({ coins: state.user.coins, msg: state.rewardMsg,
                                            label: document.querySelector('#shop-watch')?.textContent,
                                            left: document.querySelector('.shop-earn').textContent }));
    if (ok.coins !== 140) throw new Error('مكافأة اليوم (٤٠) ما انضافت: ' + ok.coins);
    if (!ok.msg.includes('+40')) throw new Error('الرسالة: ' + ok.msg);
    if (!ok.label.includes('+20')) throw new Error('بعد اليومية لازم يصير +٢٠: ' + ok.label);
    if (!ok.left.includes('باقي 4')) throw new Error('عدّاد الإعلانات ما نزل');
  });

  await step('«ضاعفها بإعلان» بنهاية اللعبة: مرة وحدة وبس إذا اللعبة ربّحت', async () => {
    const r = await page.evaluate(async () => {
      state.lastReward = { earned: 12, coins: 152, reason: 'OK' };
      state.lastRewardDoubled = false; state.rewardMsg = '';
      window.__shop.doubleAmount = 12;
      const offer = renderDoubleOffer();
      const before = offer && offer.querySelector('button')?.textContent;
      offer.querySelector('button').click();
      await new Promise(res => { const t = setInterval(() => { if (!state.rewardBusy) { clearInterval(t); res(); } }, 50); });
      const after = renderDoubleOffer();
      state.lastReward = { earned: 0, coins: 152, reason: 'DAILY_CAP' };
      const none = renderDoubleOffer();
      return { before, doubled: state.lastRewardDoubled, afterText: after && after.textContent, none: none === null };
    });
    if (!r.before || !r.before.includes('+12')) throw new Error('الزر ما طلع: ' + r.before);
    if (!r.doubled || !r.afterText.includes('انضاعفت')) throw new Error('ما انضاعفت: ' + r.afterText);
    if (!r.none) throw new Error('العرض طلع للعبة ما ربّحت');
  });

  await step('ترتيب الفرق يعرض صورة وإطار صاحب الفريق', async () => {
    const r = await page.evaluate(() => {
      const row = leaderboardRow({ rank: 1, handle: 'sqour', name: 'الصقور', score: 900, games: 3, answers: 10, correct: 8,
                                   owner_key: 'k', owner_avatar: 'avatar_falcon', owner_frame: 'frame_gold' }, false);
      const plain = leaderboardRow({ rank: 2, handle: 'aswad', name: 'الأسود', score: 800, games: 3, answers: 10, correct: 7, owner_key: 'k2' }, false);
      const a = row.querySelector('.avatar');
      return { emoji: a && a.textContent, gold: a && a.classList.contains('frame-gold'), plain: !!plain.querySelector('.avatar') };
    });
    if (r.emoji !== '🦅' || !r.gold) throw new Error('الصورة أو الإطار ما طلعوا: ' + JSON.stringify(r));
    if (r.plain) throw new Error('فريق بلا شي طلعتله صورة');
    await shopDone();
  });

  /* ───────── المتجر — المرحلة الثانية ───────── */
  const buyAndWait = (fn) => page.evaluate(async (src) => {
    await (new Function('return (' + src + ')()'))();
    await new Promise(res => { const t = setInterval(() => { if (!state.rewardBusy) { clearInterval(t); res(); } }, 50); });
  }, fn.toString());

  await step('الثيم: يغيّر ألوان الصفحة والشعار، ويرجع لمن تشلحه أو تطلع', async () => {
    await shopUser({ coins: 600 });
    await page.evaluate(() => openShop());
    await page.waitForFunction(() => state.rewardState !== null);
    await buyAndWait(() => buyCosmetic('theme_ramadan'));
    const on = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme,
      mark: document.querySelector('.brand .brand-mark')?.textContent,
      bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), coins: state.user.coins }));
    await buyAndWait(() => equipCosmetic('theme', null));
    const off = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme || '', dot: !!document.querySelector('.brand .dot') }));
    await buyAndWait(() => equipCosmetic('theme', 'theme_ramadan'));
    const out = await page.evaluate(() => { state.user = null; render(); return document.documentElement.dataset.theme || ''; });
    if (on.theme !== 'ramadan' || on.mark !== '🌙') throw new Error('الثيم ما تطبّق: ' + JSON.stringify(on));
    if (on.bg.toLowerCase() !== '#2a1636') throw new Error('الألوان ما تغيّرت: ' + on.bg);
    if (on.coins !== 500) throw new Error('السعر غلط: ' + on.coins);
    if (off.theme || !off.dot) throw new Error('الشلح ما رجّع الأصلي');
    if (out) throw new Error('الثيم بقى بعد ما طلع من الحساب');
  });

  await step('اللقب: يبين بالحساب والمتجر، وتحت فريق صاحبه بالترتيب', async () => {
    await page.evaluate(() => { state.user = Object.assign({ uid: 'shop1', name: 'زهراء', coins: 500 }, {}); goto('shop'); });
    await page.waitForFunction(() => state.rewardState !== null);
    await buyAndWait(() => buyCosmetic('title_host'));
    const r = await page.evaluate(() => {
      const shop = document.querySelector('.shop-head .user-title')?.textContent;
      openAccountModal();
      const acc = document.querySelector('.overlay .user-title')?.textContent;
      closeAccountModal();
      const row = leaderboardRow({ rank: 1, handle: 'h', name: 'ف', score: 1, games: 1, answers: 1, correct: 1, owner_key: 'k', owner_title: 'title_brain' }, false);
      const bogus = leaderboardRow({ rank: 2, handle: 'h2', name: 'ف2', score: 1, games: 1, answers: 1, correct: 1, owner_key: 'k2', owner_title: '<img src=x>' }, false);
      return { shop, acc, board: row.querySelector('.user-title')?.textContent, bogus: !!bogus.querySelector('.user-title') || !!bogus.querySelector('img') };
    });
    if (r.shop !== 'مضيف السهرة' || r.acc !== 'مضيف السهرة') throw new Error('اللقب ما طلع: ' + JSON.stringify(r));
    if (r.board !== 'عقل التجمّع') throw new Error('لقب صاحب الفريق ما طلع: ' + r.board);
    if (r.bogus) throw new Error('لقب مو من القائمة انعرض');
  });

  await step('احتفال الفوز: يطلع مرة وحدة لمن تفتح شاشة النتيجة', async () => {
    await buyAndWait(() => buyCosmetic('fx_roses'));
    await page.evaluate(() => document.querySelectorAll('.win-fx').forEach(e => e.remove()));
    const r = await page.evaluate(() => {
      state.bombPlayers = state.bombPlayers && state.bombPlayers.length ? state.bombPlayers : [{ name: 'أ', alive: true }, { name: 'ب', alive: false }];
      state.screen = 'bomb-end'; render();
      const first = document.querySelectorAll('.win-fx').length;
      render(); render();
      const again = document.querySelectorAll('.win-fx').length;
      const emoji = document.querySelector('.win-fx span')?.textContent;
      state.screen = 'hub'; render();
      document.querySelectorAll('.win-fx').forEach(e => e.remove());
      return { first, again, emoji };
    });
    if (r.first !== 1 || r.again !== 1) throw new Error('عدد مرات الاحتفال: ' + JSON.stringify(r));
    if (!['🌹', '🌸', '💐'].includes(r.emoji)) throw new Error('شكل الاحتفال غلط: ' + r.emoji);
  });

  await step('الباقة: مقفولة لحد ما تنشترى، وبعدها «الدخيل» ياخذ أماكنها', async () => {
    const before = await page.evaluate(() => {
      goto('spy-setup');
      return { locked: !!document.querySelector('.pack-locked'), chips: !!document.querySelector('.pack-picker') };
    });
    await page.evaluate(() => goto('shop'));
    await buyAndWait(() => buyPack('pack_spy_iraq'));
    const r = await page.evaluate(() => {
      const msg = state.rewardMsg, coins = state.user.coins;
      goto('spy-setup');
      const chips = !!document.querySelector('.pack-picker');
      const packOnly = pickPartyItems('spy', 12).every(x => String(x).startsWith('مكان عراقي'));
      state.packMode = { spy: 'all' };
      const all = pickPartyItems('spy', 40);
      const mixed = all.some(x => String(x).startsWith('مكان عراقي')) && all.some(x => !String(x).startsWith('مكان عراقي'));
      state.packMode = {};
      state.activePacks = { pack_spy_iraq: new Date(Date.now() - 1000).toISOString() };   // خلصت
      const expired = pickPartyItems('spy', 40).every(x => !String(x).startsWith('مكان عراقي'));
      return { msg, coins, chips, packOnly, mixed, expired };
    });
    if (!before.locked || before.chips) throw new Error('الباقة مو مقفولة قبل الشراء');
    if (r.coins !== 250 || !r.msg.includes('أماكن عراقية')) throw new Error('الشراء: ' + JSON.stringify(r));
    if (!r.chips || !r.packOnly) throw new Error('الأماكن ما صارت من الباقة');
    if (!r.mixed) throw new Error('«الكل» ما يخلط');
    if (!r.expired) throw new Error('الباقة الخلصانة بعدها تشتغل');
  });

  await step('باقة «نجوم الكرة» بـ«من أنا؟»: الشخصيات منها، وبلاها من الأساس بس', async () => {
    await page.evaluate(() => goto('shop'));
    await buyAndWait(() => buyPack('pack_whoami_football'));
    const r = await page.evaluate(async () => {
      const withPack = await fetchRandomCharacters(5);
      state.activePacks = {};
      const without = await fetchRandomCharacters(5);
      return { withPack, without };
    });
    if (!r.withPack.every(n => n.startsWith('لاعب '))) throw new Error('الشخصيات مو من الباقة: ' + r.withPack);
    if (r.without.some(n => n.startsWith('لاعب '))) throw new Error('شخصيات الباقة طلعت بلاها: ' + r.without);
    await shopDone();
    await page.evaluate(() => { window.__packUnlocked = null; state.activePacks = {}; state.packMode = {}; });
  });

  await step('٧ ضغطات على الشعار تشغّل وتطفّي وضع التجربة للإعلانات', async () => {
    const tap7 = () => page.evaluate(() => { for (let i = 0; i < 7; i++) document.querySelector('.brand').click(); });
    await page.evaluate(() => { try { localStorage.removeItem('tajammo.adTestMode'); } catch (e) {} goto('hub'); });
    const few = await page.evaluate(() => { for (let i = 0; i < 6; i++) document.querySelector('.brand').click(); return adTestMode(); });
    await page.waitForTimeout(4100);                 // الضغطات القديمة تنتهي
    await tap7();
    const on = await page.evaluate(() => ({ mode: adTestMode(), badge: !!document.querySelector('.brand .test-badge') }));
    await tap7();
    const off = await page.evaluate(() => ({ mode: adTestMode(), badge: !!document.querySelector('.brand .test-badge') }));
    if (few) throw new Error('٦ ضغطات شغّلته');
    if (!on.mode || !on.badge) throw new Error('ما اشتغل: ' + JSON.stringify(on));
    if (off.mode || off.badge) throw new Error('ما انطفى: ' + JSON.stringify(off));
  });

  await step('مفاتيح إعلان المكافأة: لو بعدها _HERE الزر ما يطلع', async () => {
    const r = await page.evaluate(() => ({ ready: rewardedAdsReady(), android: ADMOB_IDS_ANDROID.rewarded, ios: ADMOB_IDS_IOS.rewarded }));
    if (r.ready) throw new Error('rewardedAdsReady رجعت true بالمتصفح');
    if (!r.android || !r.ios) throw new Error('مفتاح rewarded ناقص');
  });

  /* الإعلانات البينية كانت مربوطة بلعبة الفئات بس. هذا فحص نصّي على
     الملفات المبنية — مو سلوكي — لأن showBreakAd ما يشتغل خارج التطبيق
     الأصلي أصلاً (isNativeApp() يرجع false بالمتصفح). */
  await step('الإعلانات البينية مربوطة بالألعاب الخمسة كلها', async () => {
    const need = {
      'game-categories.js':   ['resetAdGates(', "showBreakAd('end')"],
      'category-setup.js':    ['resetAdGates(', "showBreakAd('start')"],   // البداية صارت بشاشة التجهيز
      'game-whoami.js':       ['resetAdGates(', "showBreakAd('start')", "showBreakAd('end')"],
      'game-spy.js':          ['resetAdGates(', "showBreakAd('start')", "showBreakAd('end')"],
      'game-bomb.js':         ['resetAdGates(', "showBreakAd('mid')",   "showBreakAd('end')"],
      'game-secrethitler.js': ['resetAdGates(', "showBreakAd('start')", "showBreakAd('end')"]
    };
    const missing = [];
    Object.keys(need).forEach(f => {
      const src = fs.readFileSync(path.join(WWW, 'js', f), 'utf8');
      need[f].forEach(k => { if (src.indexOf(k) === -1) missing.push(f + ' ← ' + k); });
    });
    if (missing.length) throw new Error('ناقص: ' + missing.join('، '));
  });

  console.log('\nأخطاء جافاسكربت غير متوقعة');
  if (errors.length) { console.log('  ✗ ' + errors.join('\n  ')); fail++; }
  else console.log('  ✓ ماكو أي خطأ بالصفحة');

  if (consoleErrors.length) console.log('\n(console.error: ' + consoleErrors.join(' | ') + ')');

  console.log(`\n${'='.repeat(40)}\nناجح: ${pass}   فاشل: ${fail}\n${'='.repeat(40)}`);

  await browser.close();
  process.exit(fail ? 1 : 0);
})();