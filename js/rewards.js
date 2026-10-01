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

function avatarById(id){ return AVATARS.find(a => a.id === id) || null; }

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
    const slot = item.startsWith('avatar_') ? 'avatar' : 'frame';
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
    if(slot === 'avatar') state.user.avatar = item; else state.user.frame = item;
    await loadRewardState();
  }catch(e){
    state.rewardMsg = translateRewardError(e);
  }finally{
    state.rewardBusy = false;
    render();
  }
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
