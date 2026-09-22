/* ==================== بنك كلمات ألعاب القعدة (الدخيل + القنبلة) ====================
 *
 * اللعبتين ياخذون كلماتهم من جدول party_items بـSupabase، وتنحفظ نسخة
 * بالجهاز حتى اللعبة تفتح فوراً بالمرات الجاية بلا شاشة تحميل.
 *
 * مهم: التحديث **يستبدل** النسخة المخزونة كاملة، مو يضيف عليها. فأي كلمة
 * تنمسح من السيرفر أو ينطفّي is_active تختفي من جهاز اللاعب بأول فتحة
 * ويّه إنترنت. لو دمجنا بدل ما نستبدل، الكلمات الممسوحة تضل عايشة
 * بأجهزة اللاعبين للأبد.
 */
const PARTY_CACHE_KEY = 'tajammo.partyItems.v1';

/* أقل عدد يخلي اللعبة تشتغل بشكل معقول */
const PARTY_MIN = { spy: 12, bomb: 5 };

let partyItems = { spy: [], bomb: [] };
let partyFetching = null;

function loadPartyCache(){
  try{
    const raw = localStorage.getItem(PARTY_CACHE_KEY);
    if(!raw) return;
    const data = JSON.parse(raw);
    if(data && Array.isArray(data.spy) && Array.isArray(data.bomb)){
      /* نسخة قديمة خزنت فئات القنبلة كنصوص بس — نرقّيها لكائنات
         حتى ما ينكسر الكود الي يقرأ .text */
      const bomb = data.bomb.map(x =>
        (x && typeof x === 'object') ? x : { text: String(x), examples: '' });
      partyItems = { spy: data.spy, bomb: bomb };
    }
  }catch(e){ /* ذاكرة الجهاز مقفلة أو النسخة تالفة — ننزّل من جديد */ }
}

function savePartyCache(){
  try{
    localStorage.setItem(PARTY_CACHE_KEY, JSON.stringify({
      spy: partyItems.spy, bomb: partyItems.bomb, at: Date.now()
    }));
  }catch(e){ /* ما نكدر نخزّن — اللعبة تشتغل بهذي الجلسة على الأقل */ }
}

/* ينزّل الكل ويستبدل المخزون. يرجّع true لو نجح. */
async function fetchPartyItems(){
  /* sb معرّف بـdb-and-supabase.js وهذا الملف ينحمّل بعده */
  if(!sb) return false;
  if(partyFetching) return partyFetching;
  partyFetching = (async ()=>{
    try{
      const { data, error } = await sb
        .from('party_items')
        .select('game,text,examples')
        .eq('is_active', true)
        .limit(2000);
      if(error) throw error;
      const fresh = { spy: [], bomb: [] };
      (data||[]).forEach(r=>{
        if(!fresh[r.game] || !r.text) return;
        /* الدخيل يحتاج النص بس؛ القنبلة تحتاج الأمثلة هم لشاشة النتيجة */
        fresh[r.game].push(r.game === 'bomb'
          ? { text: r.text, examples: r.examples || '' }
          : r.text);
      });
      /* استبدال كامل — مو دمج. شوف التعليق فوك. */
      if(fresh.spy.length || fresh.bomb.length){
        partyItems = fresh;
        savePartyCache();
        return true;
      }
      return false;
    }catch(e){
      console.warn('تعذّر تحديث كلمات ألعاب القعدة', e);
      return false;
    }finally{
      partyFetching = null;
    }
  })();
  return partyFetching;
}

/* تنادى من main.js وقت الإقلاع — تحدّث بالخلفية بلا ما تعطّل أي شاشة */
function prefetchPartyItems(){
  loadPartyCache();
  fetchPartyItems();
}

function partyReady(game){
  return (partyItems[game] || []).length >= (PARTY_MIN[game] || 1);
}

/* تنادى قبل ما تبدي جولة: لو المخزون كافي نمشي فوراً، وإلا ننتظر التنزيل */
async function ensurePartyItems(game){
  if(partyReady(game)) return true;
  await fetchPartyItems();
  return partyReady(game);
}

/* n عنصر عشوائي بلا تكرار */
function pickPartyItems(game, n){
  const all = (partyItems[game] || []).slice();
  for(let i = all.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, n);
}

/* ---------------- أصوات مولّدة بـWebAudio ----------------
   بلا أي ملف صوتي: يعني بلا حجم زايد بالحزمة وبلا انتظار تحميل.
   AudioContext ينبني بأول ضغطة زر — iOS يرفض أي صوت ما جاي من لمسة. */
let partyAudioCtx = null;

function partyAudio(){
  if(partyAudioCtx) return partyAudioCtx;
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(Ctx) partyAudioCtx = new Ctx();
  }catch(e){ /* الجهاز ما يدعم — اللعبة تشتغل بلا صوت */ }
  return partyAudioCtx;
}

function playTick(pitch){
  const ctx = partyAudio(); if(!ctx) return;
  try{
    if(ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = pitch || 880;
    g.gain.setValueAtTime(0.09, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.07);
  }catch(e){}
}

function playBoom(){
  const ctx = partyAudio(); if(!ctx) return;
  try{
    if(ctx.state === 'suspended') ctx.resume();
    const dur = 1.1;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for(let i = 0; i < ch.length; i++){
      // ضجيج أبيض ينخمد أسّياً = صوت انفجار
      ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 2.4);
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain(); g.gain.value = 0.85;
    src.connect(lp); lp.connect(g); g.connect(ctx.destination);
    src.start();
  }catch(e){}
  try{ if(navigator.vibrate) navigator.vibrate([250, 90, 250]); }catch(e){}
}
