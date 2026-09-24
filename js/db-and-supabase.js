/* ============================ CATEGORY QUESTION BANK (Supabase) ============================ */
let CATEGORY_TOPICS = [];
let CATEGORY_DATA = {};

/* Supabase يحدد سقف الصفوف لكل طلب (غالباً ١٠٠٠)، فـ limit=2000 كان يقطع
   البنك بصمت وتضيع مواضيع كاملة. نجيبه على صفحات لحد ما يخلص. */
const CATEGORY_PAGE_SIZE = 1000;

/* id ضروري لترتيب الفرق — بيه نعرف أي سؤال انجاوب صح */
const BANK_SELECT =
  'select=id,topic,points,question,answer,image,media_type,clip_start,clip_seconds&order=id.asc';

/* البنك ينحفظ بالجهاز بعد أول تحميل، فالمرات الجاية تفتح فوراً بلا انتظار.
   النسخة (v2) بالمفتاح: لو غيّرنا شكل البيانات، نرفع الرقم ويُهمل الكاش القديم.
   v2 أضافت id لكل سؤال، فكاش v1 ما ينفع. */
const BANK_CACHE_KEY = 'tajammo.bank.v2';
const BANK_CACHE_TTL = 24 * 60 * 60 * 1000;   // بعد يوم نجدّده بالخلفية

/* طلب صفحة وحدة. Prefer: count=exact يخلي السيرفر يرجّع العدد الكلي
   بترويسة Content-Range (مثال: 0-999/3091)، وبيها نعرف كم صفحة باقية
   ونجيبهن كلهن بالتوازي بدل وحدة ورا وحدة. */
async function fetchBankRange(from, to){
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/category_questions?' + BANK_SELECT,
    { headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Range-Unit': 'items',
        'Range': from + '-' + to,
        'Prefer': 'count=exact'
    } }
  );
  if(!res.ok && res.status !== 206) throw new Error('فشل تحميل الأسئلة (HTTP ' + res.status + ')');
  const page = await res.json();
  const cr = res.headers.get('content-range') || '';
  const total = parseInt(cr.split('/')[1], 10);
  return { rows: Array.isArray(page) ? page : [], total: isFinite(total) ? total : null };
}

function groupBankRows(rows){
  const grouped = {};
  rows.forEach(row=>{
    if(!grouped[row.topic]) grouped[row.topic] = { 100:[], 200:[], 400:[], 600:[] };
    const tier = grouped[row.topic][row.points] ? row.points : 200;
    grouped[row.topic][tier].push({ bankId:row.id, text:row.question, answer:row.answer, image:row.image, mediaType:row.media_type, clipStart:row.clip_start, clipSeconds:row.clip_seconds });
  });
  return grouped;
}

async function fetchWholeBank(){
  const first = await fetchBankRange(0, CATEGORY_PAGE_SIZE - 1);
  let rows = first.rows;

  if(first.total && first.total > CATEGORY_PAGE_SIZE){
    const jobs = [];
    for(let from = CATEGORY_PAGE_SIZE; from < first.total; from += CATEGORY_PAGE_SIZE){
      jobs.push(fetchBankRange(from, from + CATEGORY_PAGE_SIZE - 1));
    }
    (await Promise.all(jobs)).forEach(p=>{ rows = rows.concat(p.rows); });
  } else if(first.total === null && first.rows.length === CATEGORY_PAGE_SIZE){
    /* السيرفر ما رجّع العدد الكلي — نرجع للطريقة القديمة المتسلسلة */
    for(let from = CATEGORY_PAGE_SIZE; ; from += CATEGORY_PAGE_SIZE){
      const p = await fetchBankRange(from, from + CATEGORY_PAGE_SIZE - 1);
      if(!p.rows.length) break;
      rows = rows.concat(p.rows);
      if(p.rows.length < CATEGORY_PAGE_SIZE) break;
      if(from > 100000) break; // صمام أمان ضد حلقة لا نهائية
    }
  }

  const grouped = groupBankRows(rows);
  const topics = Object.keys(grouped);
  if(!topics.length) throw new Error('بنك الأسئلة رجع فارغ');
  return { grouped: grouped, topics: topics, total: first.total || rows.length };
}

function readBankCache(){
  try{
    const raw = localStorage.getItem(BANK_CACHE_KEY);
    if(!raw) return null;
    const c = JSON.parse(raw);
    if(!c || !c.data || !Array.isArray(c.topics) || !c.topics.length) return null;
    return c;
  }catch(e){ return null; }
}

function writeBankCache(bank){
  try{
    localStorage.setItem(BANK_CACHE_KEY, JSON.stringify({
      at: Date.now(), total: bank.total, topics: bank.topics, data: bank.grouped
    }));
  }catch(e){ /* ذاكرة الجهاز ممتلئة — نكمل بدون كاش، مو مشكلة حرجة */ }
}

function applyBank(grouped, topics){
  CATEGORY_DATA = grouped;
  CATEGORY_TOPICS = topics;
}

let bankLoadPromise = null;
let bankRefreshing = false;

function refreshBankInBackground(){
  if(bankRefreshing) return;
  bankRefreshing = true;
  fetchWholeBank()
    .then(bank=>{ applyBank(bank.grouped, bank.topics); writeBankCache(bank); })
    .catch(e=> console.warn('تعذّر تحديث بنك الأسئلة بالخلفية:', e))
    .then(()=>{ bankRefreshing = false; });
}

async function loadCategoryDatabase(){
  if(CATEGORY_TOPICS.length) return;

  const cached = readBankCache();
  if(cached){
    applyBank(cached.data, cached.topics);
    if(Date.now() - (cached.at || 0) > BANK_CACHE_TTL) refreshBankInBackground();
    return;
  }

  const bank = await fetchWholeBank();
  applyBank(bank.grouped, bank.topics);
  writeBankCache(bank);
}

/* نقطة الدخول الوحيدة: لو التحميل شغّال أصلاً (تحميل مسبق مثلاً)،
   كل النداءات تنتظر نفس الوعد بدل ما يصير تحميل مكرر. */
function ensureCategoryDatabase(){
  if(CATEGORY_TOPICS.length) return Promise.resolve();
  if(!bankLoadPromise){
    bankLoadPromise = loadCategoryDatabase().catch(e=>{ bankLoadPromise = null; throw e; });
  }
  return bankLoadPromise;
}

function bankIsReady(){ return CATEGORY_TOPICS.length > 0; }

/* يُنادى أول ما يفتح التطبيق: البنك ينزل بالخلفية بينما اللاعب
   يتفرج على الشاشة الرئيسية، فلمن يضغط اللعبة يكون جاهز. */
function prefetchCategoryDatabase(){
  ensureCategoryDatabase()
    .catch(e=> console.warn('تعذّر التحميل المسبق لبنك الأسئلة:', e));
}

function shuffled(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
/* ذاكرة الأسئلة اللي طلعت: تنحفظ بالجهاز فتبقى بين الكيمات حتى لو
   انسدّ التطبيق. كل سؤال ينحفظ بوقت ظهوره، ويرجع يصير متاح بعد
   USED_QUESTIONS_TTL — يعني تجمّع وحد ما تتكرر بيه الأسئلة، وباچر تنفتح من جديد.
   المفتاح مبني على نص السؤال مو ترتيبه، فتحديث البنك ما يخربط الحساب. */
const USED_QUESTIONS_KEY = 'tajammo.usedQuestions.v1';
const USED_QUESTIONS_TTL = 12 * 60 * 60 * 1000;
let usedQuestions = null;   // { مفتاح: وقت الظهور }

function questionKey(topicName, pts, q){
  const s = topicName + '|' + pts + '|' + (q.text || '') + '|' + (q.answer || '') + '|' + (q.image || '');
  let h = 5381;
  for(let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + s.length.toString(36);
}

function loadUsedQuestions(){
  if(usedQuestions) return usedQuestions;
  usedQuestions = {};
  try{
    const raw = JSON.parse(localStorage.getItem(USED_QUESTIONS_KEY) || '{}');
    const now = Date.now();
    Object.keys(raw).forEach(k=>{ if(now - raw[k] < USED_QUESTIONS_TTL) usedQuestions[k] = raw[k]; });
  }catch(e){ /* ذاكرة تالفة أو ممنوعة — نبدي من الصفر */ }
  return usedQuestions;
}

function saveUsedQuestions(){
  try{ localStorage.setItem(USED_QUESTIONS_KEY, JSON.stringify(usedQuestions || {})); }
  catch(e){ /* الذاكرة ممتلئة — نكمل بالذاكرة المؤقتة بس */ }
}

function pickFromTier(tier, topicName, pts, n){
  tier = tier || [];
  const used = loadUsedQuestions();
  const now = Date.now();
  const keys = tier.map(q=> questionKey(topicName, pts, q));
  const isFresh = i => !used[keys[i]] || now - used[keys[i]] >= USED_QUESTIONS_TTL;

  let chosen = shuffled(tier.map((_,i)=>i).filter(isFresh)).slice(0, n);
  if(chosen.length < n){
    /* الفئة خلصت أسئلتها الجديدة — نكمّل بالأقدم ظهوراً حتى يبقى التكرار أبعد ما يمكن */
    const oldest = tier.map((_,i)=>i)
      .filter(i=> chosen.indexOf(i) < 0)
      .sort((a,b)=> (used[keys[a]]||0) - (used[keys[b]]||0));
    chosen = chosen.concat(oldest.slice(0, n - chosen.length));
  }
  chosen.forEach(i=>{ used[keys[i]] = now; });
  saveUsedQuestions();
  return chosen.map(i=>tier[i]);
}
/* أسئلة الأغاني تشتغل بتشغيل مقطع ٣٠ ثانية من متجر آبل (iTunes Search API).
   شروط آبل تسمح بهذا المحتوى للترويج لمتجرها فقط — مو كمحتوى ترفيهي داخل
   لعبة. فعلى الآيفون نحوّل السؤال لصيغة نصية بدل ما نشغّل المقطع:
   الجواب بالبنك «اسم الأغنية - المطرب»، فنسأل عن المطرب ونعطي الاسم.
   أندرويد يبقى مثل ما هو. */
function songQuestionToText(q){
  if(q.mediaType !== 'song') return q;
  const dash = String(q.answer || '').lastIndexOf(' - ');
  if(dash < 0) return q;                       // صيغة غير متوقعة — نتركه
  const title  = q.answer.slice(0, dash).trim();
  const artist = q.answer.slice(dash + 3).trim();
  if(!title || !artist) return q;
  return Object.assign({}, q, {
    text: 'منو يغني «' + title + '»؟',
    answer: artist,
    mediaType: null,                            // يلغي مشغّل المقطع
    image: null
  });
}

function pickQuestionsForBankTopic(topicName){
  const bank = CATEGORY_DATA[topicName] || {};
  const counts = { 100:2, 200:2, 400:1, 600:1 };
  const noSongClips = (typeof currentPlatform === 'function') && currentPlatform() === 'ios';
  const result = [];
  [100,200,400,600].forEach(pts=>{
    const picked = pickFromTier(bank[pts], topicName, pts, counts[pts]);
    picked.forEach(raw=>{
      const q = noSongClips ? songQuestionToText(raw) : raw;
      result.push({ id:nextId(), bankId:q.bankId, text:q.text, answer:q.answer, points:pts, image:q.image, mediaType:q.mediaType, clipStart:q.clipStart, clipSeconds:q.clipSeconds });
    });
  });
  return result;
}

/* ============================ SUPABASE (حسابات + إحصائيات) ============================ */
const SUPABASE_URL = "https://pajxormplmloivyankji.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhanhvcm1wbG1sb2l2eWFua2ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0ODQ3OTksImV4cCI6MjA3NjA2MDc5OX0.eEPB_Gt5HywU9oGNXLpSNc4IA7CTTL7CX-EMKDE3yec";

let sb = null;
try{
  if(typeof supabase !== 'undefined'){
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
}catch(e){ console.warn('تعذّر تهيئة Supabase (لا يوجد اتصال بالإنترنت على الأغلب)', e); }

async function signUpWithEmail(email, password){
  if(!sb) throw new Error('لا يوجد اتصال بالإنترنت');
  const { error } = await sb.auth.signUp({ email, password });
  if(error) throw error;
}

async function signInWithEmail(email, password){
  if(!sb) throw new Error('لا يوجد اتصال بالإنترنت');
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if(error) throw error;
}

function signOutUser(){
  if(!sb) return;
  sb.auth.signOut();
}

/* حذف الحساب من داخل التطبيق — متطلب إلزامي بـ App Store (5.1.1(v)).
   الدالة بالسيرفر تمسح الملف الشخصي والفئات والأسئلة وسجل الكوينات
   وصف المصادقة نفسه. عملية نهائية ما ترجع. */
async function deleteMyAccount(){
  if(!sb) throw new Error('لا يوجد اتصال بالإنترنت');
  const { error } = await sb.rpc('delete_my_account');
  if(error) throw error;
  try{ await sb.auth.signOut(); }catch(e){ /* الحساب انمسح أصلاً */ }
  state.user = null;
}

async function loadOrCreateProfile(authUser){
  let { data } = await sb.from('tajammo_profiles').select('*').eq('id', authUser.id).single();
  if(!data){
    const fresh = {
      id: authUser.id,
      name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || (authUser.email ? authUser.email.split('@')[0] : 'لاعب'),
      email: authUser.email || '',
      avatar_url: '',
      games_played: 0,
      total_points: 0
    };
    const { data: inserted, error: insertErr } = await sb.from('tajammo_profiles').insert(fresh).select().single();
    if(insertErr){
      console.warn('تعذّر إنشاء الملف الشخصي', insertErr);
      return { uid: authUser.id, name: fresh.name, photo: '', gamesPlayed: 0, totalPoints: 0, coins: 0, termsAcceptedAt: null };
    }
    data = inserted;
  }
  return {
    uid: authUser.id,
    name: data.name,
    photo: data.avatar_url,
    gamesPlayed: data.games_played,
    totalPoints: data.total_points,
    coins: data.coins || 0,
    termsAcceptedAt: data.terms_accepted_at || null
  };
}

/* الإحصائيات والكوينات تنحسب بالسيرفر مو هنا.
   عمود coins ممنوع تعديله من المتصفح — لو كان مسموح، أي لاعب يفتح
   أدوات المطور ويحط لنفسه رصيد بلا حدود. الدالة تحدد كم يستحق،
   وتفرض سقف للّعبة الوحدة وسقف لليوم. */
async function recordGameResult(totalPoints){
  if(!sb || !state.user) return null;
  try{
    const { data, error } = await sb.rpc('award_game_coins', { p_total_points: totalPoints });
    if(error) throw error;
    state.user.gamesPlayed = (state.user.gamesPlayed||0) + 1;
    state.user.totalPoints = (state.user.totalPoints||0) + totalPoints;
    if(data && typeof data.coins === 'number') state.user.coins = data.coins;
    return data;                      // { earned, coins, reason }
  } catch(e){
    console.warn('تعذّر حفظ الإحصائيات', e);
    return null;
  }
}

/* ============================ ترتيب الفرق العام ============================ */
/* الفريق يتعرّف بـ«يوزر» فريد بالتطبيق كله (مثل sqour_basra)، والاسم يبقى
   حر ويتكرر. التسجيل اختياري ويصير بنهاية اللعبة.

   النقاط تنحسب بالسيرفر مو هنا: كل سؤال إله وزن = صعوبته الحقيقية
   (كم فريق جاوبه صح من كل اللي شافوه)، فسؤال قليل من يعرفه ينطي أكثر.
   لو انحسبت هنا، أي واحد يفتح أدوات المطور ويكتب لنفسه أي رقم. */
const TEAM_HANDLE_RE = /^[a-z0-9_ء-ي]{3,20}$/;

function normalizeTeamHandle(s){
  return String(s || '').trim().toLowerCase().replace(/^@+/, '');
}

function teamHandleError(handle){
  const h = normalizeTeamHandle(handle);
  if(!h) return 'اكتب يوزر الفريق';
  if(h.length < 3)  return 'اليوزر قصير — ٣ حروف على الأقل';
  if(h.length > 20) return 'اليوزر طويل — ٢٠ حرف كحد أعلى';
  if(!TEAM_HANDLE_RE.test(h)) return 'اليوزر يقبل حروف وأرقام و«_» بس، بلا مسافات';
  return '';
}

/* نتيجة اللعبة: لكل فريق يوزره وقائمة أسئلته.
   p_game_uid يمنع الحساب المكرر لو انرسلت نفس اللعبة مرتين. */
async function submitTeamResults(gameUid, teams){
  if(!sb) throw new Error('لا يوجد اتصال بالإنترنت');
  if(!state.user) throw new Error('لازم تسجل دخول حتى تدخل الترتيب');
  const { data, error } = await sb.rpc('submit_team_results', {
    p_game_uid: gameUid,
    p_teams: teams
  });
  if(error) throw error;
  return data;                         // { teams:[{handle,name,score,rank,gained,...}] }
}

async function fetchTeamLeaderboard(period, limit, handles){
  if(!sb) throw new Error('لا يوجد اتصال بالإنترنت');
  const { data, error } = await sb.rpc('team_leaderboard', {
    p_period: period === 'week' ? 'week' : 'all',
    p_limit: limit || 50,
    p_handles: handles && handles.length ? handles : null
  });
  if(error) throw error;
  return Array.isArray(data) ? data : [];
}

function translateTeamError(msg){
  const m = String(msg || '').toUpperCase();
  if(m.includes('AUTH_REQUIRED')) return 'لازم تسجل دخول حتى تدخل الترتيب.';
  if(m.includes('DAILY_LIMIT'))   return 'وصلت سقف الألعاب المسجّلة اليوم. جرب باچر.';
  if(m.includes('BAD_TEAMS'))     return 'بيانات الفرق غير صالحة.';
  return 'تعذّر تسجيل النتيجة — تأكد من الإنترنت وجرب مرة ثانية.';
}
