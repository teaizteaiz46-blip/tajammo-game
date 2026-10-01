/* ============================ متجر الكوينز + الإعلان بمكافأة ============================ */
/* الكوينز تنجمع من اللعب، ومن إعلان بمكافأة يختاره اللاعب بنفسه (ما يطلع غصب).
   تنصرف على أشكال جاهزة بس — صورة بروفايل وإطار — فما أحد ياخذ أفضلية باللعب،
   وما أكو صور يرفعها المستخدمين (فما تتغير السياسات).

   الأسعار الحقيقية بالسيرفر (cosmetic_price) — هنا بس للعرض. الشراء واللبس
   والمكافآت كلها دوال بالسيرفر، والمتصفح ما يكدر يغيّر الرصيد. */

const AVATARS = [
  { id: 'avatar_star',   emoji: '⭐', name: 'نجمة',        price: 0 },
  { id: 'avatar_palm',   emoji: '🌴', name: 'نخلة',        price: 0 },
  { id: 'avatar_lion',   emoji: '🦁', name: 'أسد بابل',    price: 50 },
  { id: 'avatar_camel',  emoji: '🐪', name: 'جمل',         price: 50 },
  { id: 'avatar_falcon', emoji: '🦅', name: 'صقر',         price: 50 },
  { id: 'avatar_horse',  emoji: '🐎', name: 'حصان',        price: 50 },
  { id: 'avatar_ball',   emoji: '⚽', name: 'كرة',         price: 50 },
  { id: 'avatar_tea',    emoji: '☕', name: 'استكان چاي',  price: 50 },
  { id: 'avatar_moon',   emoji: '🌙', name: 'هلال',        price: 50 },
  { id: 'avatar_mask',   emoji: '🎭', name: 'مسرح',        price: 50 },
  { id: 'avatar_crown',  emoji: '👑', name: 'تاج',         price: 50 },
  { id: 'avatar_fire',   emoji: '🔥', name: 'نار',         price: 50 }
];
const FRAME_GOLD = { id: 'frame_gold', name: 'الإطار الذهبي', price: 150 };
const DAILY_AMOUNTS = [20, 30, 40, 50, 60, 80, 100];   // نفس reward_daily_amount بالسيرفر

/* المرحلة الثانية — كلها شكلية إلا الباقات (محتوى إضافي للجلسة كلها) */
const THEMES = [
  { id: 'theme_night',   name: 'ليلي',        mark: '⭐', swatch: ['#0A0F1C', '#161F36', '#C9B27A'], price: 100 },
  { id: 'theme_ramadan', name: 'رمضاني',      mark: '🌙', swatch: ['#1F0F29', '#3A1F4A', '#E2B857'], price: 100 },
  { id: 'theme_baghdad', name: 'أزرق بغدادي', mark: '💠', swatch: ['#081C2A', '#10364E', '#E0B45A'], price: 100 },
  { id: 'theme_rose',    name: 'وردي',        mark: '🌸', swatch: ['#200F18', '#3B1D2B', '#F2A7B9'], price: 100 }
];
const TITLES = [
  { id: 'title_cat_king',   name: 'ملك الفئات' },
  { id: 'title_spy_hunter', name: 'كاشف الدخلاء' },
  { id: 'title_clasico',    name: 'خبير الكلاسيكو' },
  { id: 'title_unexploded', name: 'ما ينفجر' },
  { id: 'title_host',       name: 'مضيف السهرة' },
  { id: 'title_brain',      name: 'عقل التجمّع' },
  { id: 'title_legend',     name: 'أسطورة الجمعة' },
  { id: 'title_lucky',      name: 'صاحب الحظ' }
].map(t => Object.assign(t, { price: 75 }));
const WIN_FX = [
  { id: 'fx_fireworks', name: 'ألعاب نارية', emoji: ['🎆', '🎇', '✨'], price: 75 },
  { id: 'fx_gold',      name: 'مطر ذهب',     emoji: ['🪙', '✨', '🏆'], price: 75 },
  { id: 'fx_roses',     name: 'ورد',         emoji: ['🌹', '🌸', '💐'], price: 75 }
];
/* الباقات تنفتح ٢٤ ساعة، والقفل بالسيرفر (pack_active بسياسة الجدول) */
const PACKS = [
  { id: 'pack_whoami_football', game: 'whoami', emoji: '⚽', name: 'نجوم الكرة',    desc: '٥٠ شخصية: لاعبين ومدربين عالميين وعراقيين', price: 100 },
  { id: 'pack_spy_iraq',        game: 'spy',    emoji: '📍', name: 'أماكن عراقية',  desc: '٣٠ مكان: المتنبي، الشورجة، الملوية، الأهوار…', price: 100 },
  { id: 'pack_bomb_iraq',       game: 'bomb',   emoji: '🔥', name: 'فئات عراقية',   desc: '٢٣ فئة: أكلات، مناطق بغداد، تمور، ألعاب شعبية…', price: 100 }
];

function avatarById(id){ return AVATARS.find(a => a.id === id) || null; }
function themeById(id){ return THEMES.find(t => t.id === id) || null; }
function titleName(id){ const t = TITLES.find(t => t.id === id); return t ? t.name : ''; }
function fxById(id){ return WIN_FX.find(f => f.id === id) || null; }
function packForGame(game){ return PACKS.find(p => p.game === game) || null; }

/* الباقة مفتوحة؟ — حسب آخر حالة من السيرفر. السيرفر هو اللي يقفل فعلاً */
function packActive(packId){
  const exp = (state.activePacks || {})[packId];
  return !!exp && new Date(exp).getTime() > Date.now();
}
function packHoursLeft(packId){
  const exp = (state.activePacks || {})[packId];
  return exp ? Math.max(0, Math.ceil((new Date(exp).getTime() - Date.now()) / 3600000)) : 0;
}
/* باللعبة: الباقة وحدها (الافتراضي لمن تكون مفتوحة) لو «الكل» */
function packMode(game){
  const p = packForGame(game);
  if(!p || !packActive(p.id)) return null;
  return (state.packMode || {})[game] === 'all' ? 'all' : 'pack';
}

/* الثيم يتطبق على كل الصفحة — بس للاعب المسجّل اللي لابسه */
function applyTheme(){
  const t = state.user && themeById(state.user.theme);
  const v = t ? t.id.replace('theme_', '') : '';
  if(document.documentElement.dataset.theme !== v){
    if(v) document.documentElement.dataset.theme = v;
    else delete document.documentElement.dataset.theme;
  }
}
/* شعار «تجمّع» بالشريط: النقطة الذهبية، أو رمز الثيم */
function brandMarkHtml(){
  const t = state.user && themeById(state.user.theme);
  return t ? `<span class="brand-mark" aria-hidden="true">${t.mark}</span>` : `<span class="dot"></span>`;
}

/* احتفال الفوز: يطلع مرة وحدة لمن تفتح شاشة النتيجة */
const WIN_SCREENS = ['end', 'whoami-end', 'shd-end', 'spy-result', 'bomb-end'];
let lastFxScreen = null;
function maybePlayWinFx(){
  const onWin = WIN_SCREENS.includes(state.screen);
  if(onWin && lastFxScreen !== state.screen) playWinFx();
  lastFxScreen = onWin ? state.screen : null;
}
function playWinFx(fxId){
  const fx = fxById(fxId || (state.user && state.user.fx));
  if(!fx) return;
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.className = 'win-fx';
  layer.setAttribute('aria-hidden', 'true');
  for(let i = 0; i < 28; i++){
    const s = document.createElement('span');
    s.textContent = fx.emoji[i % fx.emoji.length];
    s.style.left = (Math.random() * 100) + '%';
    s.style.animationDelay = (Math.random() * 1.2) + 's';
    s.style.fontSize = (18 + Math.random() * 22) + 'px';
    layer.appendChild(s);
  }
  document.body.appendChild(layer);
  setTimeout(()=> layer.remove(), 4200);
}

/* بعد الدخول: حالة المتجر والباقات، وإذا أكو باقة مفتوحة نجيب محتواها */
async function onUserChanged(){
  if(!state.user){
    state.activePacks = {};
    state.rewardState = null;
    applyTheme();
    return;
  }
  const rs = await loadRewardState();
  if(rs && Object.keys(rs.packs || {}).length && typeof fetchPartyItems === 'function'){
    await fetchPartyItems();
  }
  render();
}

/* صورة البروفايل: الشكل المختار، وإلا صورة الحساب القديمة لو موجودة.
   ترجع '' إذا ماكو شي — إلا إذا forcePlaceholder (بالمتجر والحساب) */
function avatarHtml(avatarId, frameId, size, opts){
  const a = avatarById(avatarId);
  const photo = opts && opts.photo;
  const gold = frameId === FRAME_GOLD.id ? ' frame-gold' : '';
  if(!a && !photo && !gold && !(opts && opts.forcePlaceholder)) return '';
  const inner = a ? a.emoji
    : photo ? `<img src="${escapeAttr(photo)}" alt="">`
    : '👤';
  return `<span class="avatar${gold}" style="--s:${size}px" aria-hidden="true">${inner}</span>`;
}

function myAvatarHtml(size, forcePlaceholder){
  const u = state.user;
  if(!u) return '';
  return avatarHtml(u.avatar, u.frame, size, { photo: u.photo, forcePlaceholder });
}

/* ───────── السيرفر ───────── */
async function loadRewardState(){
  if(!sb || !state.user) return null;
  try{
    const { data, error } = await sb.rpc('ad_reward_state');
    if(error) throw error;
    state.rewardState = data;
    state.user.coins = data.coins;
    state.user.avatar = data.equipped_avatar || null;
    state.user.frame = data.equipped_frame || null;
    state.user.theme = data.equipped_theme || null;
    state.user.title = data.equipped_title || null;
    state.user.fx = data.equipped_fx || null;
    state.activePacks = data.packs || {};
    return data;
  }catch(e){
    console.warn('تعذّر جلب حالة المكافآت', e);
    return null;
  }
}

function translateRewardError(e){
  const m = String((e && (e.message || e.error_description)) || e || '');
  if(m.includes('AD_DAILY_LIMIT')) return 'خلصت إعلانات اليوم — ارجع باچر.';
  if(m.includes('NOTHING_TO_DOUBLE')) return 'كوينات هاي اللعبة انضاعفت قبل.';
  if(m.includes('TOO_MANY_PENDING')) return 'استنى شوية وجرّب مرة ثانية.';
  if(m.includes('NOT_ENOUGH_COINS')) return 'رصيدك ما يكفي.';
  if(m.includes('ALREADY_OWNED')) return 'هاي عندك من قبل.';
  if(m.includes('NOT_OWNED')) return 'لازم تشتريها أول.';
  if(m.includes('SIGNIN_REQUIRED')) return 'سجّل دخول أول.';
  return 'صار خطأ — تأكد من الإنترنت وجرّب مرة ثانية.';
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* بعد الإعلان كوكل يبلّغ السيرفر خلال ثواني — ننتظر لحد ما تبين الكوينز */
async function waitForAdReward(token){
  for(let i = 0; i < 12; i++){
    await sleep(i < 4 ? 1000 : 2000);
    try{
      const { data } = await sb.rpc('ad_reward_status', { p_token: token });
      if(data && data.claimed) return data;
    }catch(e){ /* نحاول مرة ثانية */ }
  }
  return null;
}

/* kind: 'ad' (المتجر — اليومية أو +٢٠) | 'double' (ضاعف كوينات آخر لعبة) */
async function watchRewardAd(kind){
  if(state.rewardBusy || !state.user || !rewardedAdsReady()) return;
  state.rewardBusy = true;
  state.rewardMsg = '';
  render();
  try{
    const { data, error } = await sb.rpc('start_ad_reward', { p_kind: kind });
    if(error) throw error;
    const result = await showRewardedAd(data.token);
    if(result === 'nofill'){ state.rewardMsg = 'ماكو إعلان متوفر هسه — جرّب بعد شوية.'; return; }
    if(result === 'closed'){ state.rewardMsg = 'سكّرت الإعلان قبل ما يخلص، فما انضافت كوينز.'; return; }

    state.rewardMsg = '...جاري إضافة الكوينز';
    render();
    const got = await waitForAdReward(data.token);
    if(got){
      state.user.coins = got.coins;
      state.rewardMsg = got.granted > 0 ? `+${got.granted} 🪙 انضافت لرصيدك!` : 'وصلت حد إعلانات اليوم.';
      if(kind === 'double' && got.granted > 0) state.lastRewardDoubled = true;
    } else {
      state.rewardMsg = 'الكوينز راح توصل خلال دقيقة.';
    }
    await loadRewardState();
  }catch(e){
    state.rewardMsg = translateRewardError(e);
  }finally{
    state.rewardBusy = false;
    render();
  }
}

async function buyCosmetic(item){
  if(state.rewardBusy || !state.user) return;
  state.rewardBusy = true;
  state.rewardMsg = '';
  render();
  try{
    const { error } = await sb.rpc('buy_cosmetic', { p_item: item });
    if(error) throw error;
    // اللي ينشترى يتلبس على طول — هذا اللي يريده اللاعب
    const slot = item.split('_')[0];
    const eq = await sb.rpc('equip_cosmetic', { p_slot: slot, p_item: item });
    if(eq.error) throw eq.error;
    await loadRewardState();
    state.rewardMsg = 'تمت ✓';
  }catch(e){
    state.rewardMsg = translateRewardError(e);
  }finally{
    state.rewardBusy = false;
    render();
  }
}

async function equipCosmetic(slot, item){
  if(state.rewardBusy || !state.user) return;
  state.rewardBusy = true;
  state.rewardMsg = '';
  render();
  try{
    const { error } = await sb.rpc('equip_cosmetic', { p_slot: slot, p_item: item });
    if(error) throw error;
    state.user[slot] = item;
    await loadRewardState();
    if(slot === 'fx' && item) playWinFx(item);       // يشوف شكله على طول
  }catch(e){
    state.rewardMsg = translateRewardError(e);
  }finally{
    state.rewardBusy = false;
    render();
  }
}

async function buyPack(packId){
  if(state.rewardBusy || !state.user) return;
  state.rewardBusy = true;
  state.rewardMsg = '';
  render();
  try{
    const { error } = await sb.rpc('buy_pack', { p_pack: packId });
    if(error) throw error;
    await loadRewardState();
    // المحتوى ما كان ينقرا قبل الفتح — نجيبه هسه
    const p = PACKS.find(x => x.id === packId);
    if(p && p.game !== 'whoami' && typeof fetchPartyItems === 'function') await fetchPartyItems();
    state.rewardMsg = `انفتحت «${p ? p.name : ''}» — باقي ${packHoursLeft(packId)} ساعة`;
  }catch(e){
    state.rewardMsg = translateRewardError(e);
  }finally{
    state.rewardBusy = false;
    render();
  }
}

/* سطر صغير بإعدادات «من أنا؟» و«الدخيل» و«القنبلة» — مو نافذة تطلع غصب */
function renderPackPicker(game){
  const p = packForGame(game);
  if(!p) return el(`<div></div>`);
  if(packActive(p.id)){
    const mode = packMode(game);
    const box = el(`<div class="panel pack-picker">
      <div class="section-sub" style="margin:0 0 8px;">${p.emoji} باقة «${p.name}» مفتوحة — باقي ${packHoursLeft(p.id)} ساعة</div>
      <div class="setup-chips">
        <button type="button" class="setup-chip ${mode === 'pack' ? 'on' : ''}" data-m="pack">${p.emoji} ${p.name} بس</button>
        <button type="button" class="setup-chip ${mode === 'all' ? 'on' : ''}" data-m="all">الكل</button>
      </div>
    </div>`);
    box.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', ()=>{
      state.packMode = Object.assign({}, state.packMode, { [game]: b.dataset.m });
      render();
    }));
    return box;
  }
  const box = el(`<button type="button" class="pack-locked">
    <span>🔒 ${p.emoji} باقة «${p.name}»</span><small>${p.desc} · من متجر الكوينز</small>
  </button>`);
  box.addEventListener('click', openShop);
  return box;
}

function openShop(){
  state.rewardMsg = '';
  state.showAccountModal = false;
  goto('shop');
  if(state.user) loadRewardState().then(()=> render());
}

/* ───────── شاشة المتجر ───────── */
function renderShopEarnPanel(rs){
  const panel = el(`<div class="panel shop-earn"></div>`);
  if(!rewardedAdsReady()){
    panel.appendChild(el(`<div class="section-sub" style="margin:0;">
      تجمع كوينز من كل لعبة فئات تخلصها${isNativeApp() ? '' : '، ومن الإعلانات بمكافأة بتطبيق الموبايل'}.</div>`));
    return panel;
  }
  if(!rs){
    panel.appendChild(el(`<div class="section-sub" style="margin:0;">...جاري التحميل</div>`));
    return panel;
  }
  const day = rs.streak_day || 1;
  const strip = DAILY_AMOUNTS.map((amt, i) => {
    const n = i + 1;
    const cls = n < day || (n === day && rs.daily_claimed) ? 'done' : n === day ? 'today' : '';
    return `<span class="streak-day ${cls}"><b>${amt}</b><small>يوم ${n}</small></span>`;
  }).join('');
  const left = rs.ads_left || 0;
  const label = !left ? 'خلصت إعلانات اليوم — ارجع باچر'
    : !rs.daily_claimed ? `🎁 شوف إعلان وخذ مكافأة اليوم (+${rs.daily_amount})`
    : `📺 شوف إعلان وخذ +${rs.extra_amount} كوين`;
  const box = el(`<div>
    <div class="section-title" style="font-size:17px;">🎁 مكافأة يومية</div>
    <div class="section-sub">ارجع كل يوم والمكافأة تكبر. إذا فوّت يوم ترجع من الأول.</div>
    <div class="streak-strip">${strip}</div>
    <div class="btn-row" style="justify-content:center; margin-top:12px;">
      <button class="btn btn-gold" id="shop-watch" ${!left || state.rewardBusy ? 'disabled' : ''}>${state.rewardBusy ? '...' : label}</button>
    </div>
    <div class="section-sub" style="text-align:center; margin:8px 0 0;">الإعلان اختياري · باقي ${left} من ${rs.ads_limit} اليوم</div>
  </div>`);
  const btn = box.querySelector('#shop-watch');
  if(btn) btn.addEventListener('click', ()=> watchRewardAd('ad'));
  panel.appendChild(box);
  return panel;
}

function shopItemButton(owned, equipped, price, onBuy, onEquip, onTakeOff){
  if(equipped) return { label: '✓ لابسها', cls: 'btn-ghost on', act: onTakeOff };
  if(owned || price === 0) return { label: 'البس', cls: 'btn-ghost', act: onEquip };
  return { label: `🪙 ${price}`, cls: 'btn-gold', act: onBuy };
}

function renderShop(){
  const wrap = el(`<div class="shop-wrap"></div>`);
  const u = state.user;

  if(!u){
    const p = el(`<div class="panel" style="text-align:center;">
      <div class="section-title" style="justify-content:center;">🪙 متجر الكوينز</div>
      <div class="section-sub">سجّل حساب حتى تجمع كوينز من اللعب وتشتري صور بروفايل وإطار ذهبي.
        اللعب نفسه ما يحتاج حساب.</div>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="shop-login">تسجيل الدخول</button>
      </div>
    </div>`);
    p.querySelector('#shop-login').addEventListener('click', ()=>{
      state.showAuthModal = true; state.authMode = 'signin'; state.authError = ''; render();
    });
    wrap.appendChild(p);
    return wrap;
  }

  const rs = state.rewardState;
  const owned = new Set((rs && rs.owned) || []);

  wrap.appendChild(el(`<div class="panel shop-head">
    ${myAvatarHtml(64, true)}
    <div>
      ${u.title ? `<div class="user-title">${titleName(u.title)}</div>` : ''}
      <div class="section-title" style="margin:0;">🪙 ${u.coins || 0} كوين</div>
      <div class="section-sub" style="margin:4px 0 0;">الأشياء هنا شكلية بس — ما تغيّر شي باللعب.</div>
    </div>
  </div>`));

  if(state.rewardMsg) wrap.appendChild(el(`<div class="shop-msg">${escapeAttr(state.rewardMsg)}</div>`));

  wrap.appendChild(renderShopEarnPanel(rs));

  // الإطار الذهبي
  const fEq = u.frame === FRAME_GOLD.id;
  const fBtn = shopItemButton(owned.has(FRAME_GOLD.id), fEq, FRAME_GOLD.price,
    ()=> buyCosmetic(FRAME_GOLD.id), ()=> equipCosmetic('frame', FRAME_GOLD.id), ()=> equipCosmetic('frame', null));
  const frame = el(`<div class="panel shop-row">
    ${avatarHtml(u.avatar, FRAME_GOLD.id, 52, { photo: u.photo, forcePlaceholder: true })}
    <div style="flex:1;">
      <div class="section-title" style="font-size:17px; margin:0;">✨ ${FRAME_GOLD.name}</div>
      <div class="section-sub" style="margin:4px 0 0;">حول صورتك بالحساب، وحول فريقك بترتيب الفرق — الكل يشوفه.</div>
    </div>
    <button class="btn btn-sm ${fBtn.cls}" ${state.rewardBusy ? 'disabled' : ''}>${fBtn.label}</button>
  </div>`);
  frame.querySelector('button').addEventListener('click', fBtn.act);
  wrap.appendChild(frame);

  // صور البروفايل
  const grid = el(`<div class="panel">
    <div class="section-title" style="font-size:17px;">🖼️ صورة البروفايل</div>
    <div class="avatar-grid"></div>
  </div>`);
  const g = grid.querySelector('.avatar-grid');
  AVATARS.forEach(a=>{
    const eq = u.avatar === a.id;
    const b = shopItemButton(owned.has(a.id), eq, a.price,
      ()=> buyCosmetic(a.id), ()=> equipCosmetic('avatar', a.id), ()=> equipCosmetic('avatar', null));
    const card = el(`<div class="avatar-card ${eq ? 'on' : ''}">
      <span class="avatar" style="--s:52px">${a.emoji}</span>
      <span class="avatar-name">${a.name}</span>
      <button class="btn btn-sm ${b.cls}" ${state.rewardBusy ? 'disabled' : ''}>${b.label}</button>
    </div>`);
    card.querySelector('button').addEventListener('click', b.act);
    g.appendChild(card);
  });
  wrap.appendChild(grid);

  const busy = state.rewardBusy ? 'disabled' : '';
  const itemButton = (slot, item) => shopItemButton(owned.has(item.id), u[slot] === item.id, item.price,
    ()=> buyCosmetic(item.id), ()=> equipCosmetic(slot, item.id), ()=> equipCosmetic(slot, null));

  // باقات المحتوى — للجلسة كلها، ٢٤ ساعة
  const packs = el(`<div class="panel">
    <div class="section-title" style="font-size:17px;">📦 باقات محتوى — ٢٤ ساعة</div>
    <div class="section-sub">محتوى جديد يلعب بيه الكروب كله. الألعاب نفسها تبقى مفتوحة للكل.</div>
    <div class="shop-list"></div>
  </div>`);
  PACKS.forEach(p=>{
    const on = packActive(p.id);
    const row = el(`<div class="shop-row pack-row">
      <span class="avatar" style="--s:44px">${p.emoji}</span>
      <div style="flex:1;">
        <div style="font-weight:700;">${p.name}</div>
        <div class="section-sub" style="margin:2px 0 0;">${p.desc}${on ? ` · <b style="color:var(--sage);">مفتوحة، باقي ${packHoursLeft(p.id)} ساعة</b>` : ''}</div>
      </div>
      <button class="btn btn-sm ${on ? 'btn-ghost' : 'btn-gold'}" ${busy}>${on ? `مدّد 🪙 ${p.price}` : `🪙 ${p.price}`}</button>
    </div>`);
    row.querySelector('button').addEventListener('click', ()=> buyPack(p.id));
    packs.querySelector('.shop-list').appendChild(row);
  });
  wrap.appendChild(packs);

  // الثيمات
  const themes = el(`<div class="panel">
    <div class="section-title" style="font-size:17px;">🎨 ثيم التطبيق</div>
    <div class="section-sub">ألوان التطبيق كلها وشعار «تجمّع» تتغيّر — على جهازك بس.</div>
    <div class="theme-grid"></div>
  </div>`);
  THEMES.forEach(t=>{
    const b = itemButton('theme', t);
    const card = el(`<div class="theme-card ${u.theme === t.id ? 'on' : ''}">
      <span class="theme-swatch" style="background:linear-gradient(135deg, ${t.swatch[0]} 0 45%, ${t.swatch[1]} 45% 80%, ${t.swatch[2]} 80%)">${t.mark}</span>
      <span class="avatar-name">${t.name}</span>
      <button class="btn btn-sm ${b.cls}" ${busy}>${b.label}</button>
    </div>`);
    card.querySelector('button').addEventListener('click', b.act);
    themes.querySelector('.theme-grid').appendChild(card);
  });
  wrap.appendChild(themes);

  // الألقاب
  const titles = el(`<div class="panel">
    <div class="section-title" style="font-size:17px;">🏷️ لقب تحت اسمك</div>
    <div class="section-sub">يبين بحسابك وتحت فريقك بترتيب الفرق.</div>
    <div class="shop-list"></div>
  </div>`);
  TITLES.forEach(t=>{
    const b = itemButton('title', t);
    const row = el(`<div class="shop-row title-row ${u.title === t.id ? 'on' : ''}">
      <span class="user-title" style="flex:1;">${t.name}</span>
      <button class="btn btn-sm ${b.cls}" ${busy}>${b.label}</button>
    </div>`);
    row.querySelector('button').addEventListener('click', b.act);
    titles.querySelector('.shop-list').appendChild(row);
  });
  wrap.appendChild(titles);

  // احتفال الفوز
  const fxPanel = el(`<div class="panel">
    <div class="section-title" style="font-size:17px;">🎉 احتفال الفوز</div>
    <div class="section-sub">يطلع على الشاشة بنهاية أي لعبة من الخمسة.</div>
    <div class="shop-list"></div>
  </div>`);
  WIN_FX.forEach(f=>{
    const b = itemButton('fx', f);
    const row = el(`<div class="shop-row ${u.fx === f.id ? 'on' : ''}">
      <span class="avatar" style="--s:44px">${f.emoji[0]}</span>
      <span style="flex:1; font-weight:700;">${f.name}</span>
      <button class="btn btn-ghost btn-sm fx-try" type="button">جرّب</button>
      <button class="btn btn-sm ${b.cls}" ${busy}>${b.label}</button>
    </div>`);
    row.querySelector('.fx-try').addEventListener('click', ()=> playWinFx(f.id));
    row.querySelector('.btn:not(.fx-try)').addEventListener('click', b.act);
    fxPanel.querySelector('.shop-list').appendChild(row);
  });
  wrap.appendChild(fxPanel);

  const back = el(`<div class="btn-row" style="justify-content:center;"><button class="btn btn-ghost">رجوع</button></div>`);
  back.querySelector('button').addEventListener('click', ()=> goto('hub'));
  wrap.appendChild(back);
  return wrap;
}

/* ───────── «ضاعف كوينزك» بنهاية لعبة الفئات ───────── */
function renderDoubleOffer(){
  const r = state.lastReward;
  if(!state.user || !r || !(r.earned > 0) || !rewardedAdsReady()) return null;
  if(state.lastRewardDoubled){
    return el(`<div class="reward-line">✓ انضاعفت: +${r.earned * 2} 🪙 من هاي اللعبة</div>`);
  }
  const box = el(`<div class="double-offer">
    <button class="btn btn-ghost btn-sm" ${state.rewardBusy ? 'disabled' : ''}>📺 ضاعفها بإعلان (+${r.earned} 🪙)</button>
    ${state.rewardMsg ? `<div class="section-sub" style="margin:6px 0 0;">${escapeAttr(state.rewardMsg)}</div>` : ''}
  </div>`);
  box.querySelector('button').addEventListener('click', ()=> watchRewardAd('double'));
  return box;
}
