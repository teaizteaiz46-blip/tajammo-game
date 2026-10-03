/* ============================ RENDER ROOT ============================ */
function render(){
  const app = document.getElementById('app');
  app.innerHTML = '';
  applyTheme();
  app.appendChild(renderTopbar());
  let body;
  try{
    body = renderScreen();
  }catch(err){
    // بلا هذا، أي خطأ بشاشة يخلي اللاعب قدام صفحة فاضية بلا أي تفسير
    console.error('فشل رسم الشاشة "' + state.screen + '":', err);
    body = el(`<div class="panel" style="text-align:center;">
      <div class="section-title" style="justify-content:center;">صارت مشكلة بهذي الشاشة</div>
      <div class="section-sub">${escapeAttr(String(err && err.message || err))}</div>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="err-hub">رجوع للرئيسية</button>
      </div>
    </div>`);
    const b = body.querySelector('#err-hub');
    if(b) b.addEventListener('click', ()=>{ state.screen='hub'; state.history=[]; render(); });
  }
  app.appendChild(body);
  maybePlayWinFx();

  if(state.screen === 'board' && state.activeCell){
    app.appendChild(renderQuestionOverlay());
  }
  if(state.showAuthModal){
    app.appendChild(renderAuthOverlay());
  }
  if(state.customShareCode){
    app.appendChild(renderShareCodeOverlay());
  }
  if(state.showFeedbackIntro){
    app.appendChild(renderFeedbackIntro());
  }
  if(state.feedbackQ){
    app.appendChild(renderQuestionFeedbackOverlay());
  }
  if(state.reportTopic){
    app.appendChild(renderReportOverlay());
  }
  if(state.reportTeam){
    app.appendChild(renderTeamReportOverlay());
  }
  if(state.showTermsModal){
    app.appendChild(renderTermsOverlay());
  }
  if(state.showAccountModal && state.user){
    app.appendChild(renderAccountOverlay());
  }
}

function renderScreen(){
  switch(state.screen){
    case 'hub':           return renderHub();
    case 'cat-loading':   return renderCatLoading();
    case 'setup':         return renderCategorySetup();
    /* أسماء الشاشات القديمة — صارت كلها شاشة التجهيز */
    case 'editor':
    case 'teams':
    case 'select':        return renderCategorySetup();
    case 'custom-editor': return renderCustomEditor();
    case 'board':         return renderBoard();
    case 'end':           return renderEnd();
    case 'leaderboard':   return renderLeaderboard();
    case 'shop':          return renderShop();
    case 'whoami-setup':  return renderWhoamiSetup();
    case 'whoami-reveal': return renderWhoamiReveal();
    case 'whoami-play':   return renderWhoamiPlay();
    case 'whoami-end':    return renderWhoamiEnd();
    case 'shd-setup':     return renderShdSetup();
    case 'shd-roles':     return renderShdRoles();
    case 'shd-reveal':    return renderShdReveal();
    case 'shd-winner':    return renderShdWinner();
    case 'shd-end':       return renderShdEnd();
    case 'spy-setup':     return renderSpySetup();
    case 'spy-reveal':    return renderSpyReveal();
    case 'spy-play':      return renderSpyPlay();
    case 'spy-vote':      return renderSpyVote();
    case 'spy-result':    return renderSpyResult();
    case 'bomb-setup':    return renderBombSetup();
    case 'bomb-play':     return renderBombPlay();
    case 'bomb-out':      return renderBombOut();
    case 'bomb-end':      return renderBombEnd();
    default:              return renderHub();
  }
}

let brandTaps = [];
function renderTopbar(){
  const bar = el(`<div class="topbar">
    <button class="btn btn-ghost btn-sm" id="back-arrow" style="display:${state.history.length?'inline-flex':'none'};">→ رجوع</button>
    <div class="brand">${brandMarkHtml()} تجمّع${adTestMode() ? ' <span class="test-badge">🧪 إعلانات تجربة</span>' : ''}</div>
    <div class="topbar-right" style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
      <div class="crumb"></div>
    </div>
  </div>`);
  bar.querySelector('.brand').addEventListener('click', ()=>{
    /* ٧ ضغطات خلال ٤ ثواني = وضع التجربة للإعلانات (شوف admob.js) */
    const now = Date.now();
    brandTaps = brandTaps.filter(t => now - t < 4000).concat(now);
    if(brandTaps.length >= 7){
      brandTaps = [];
      const on = toggleAdTestMode();
      alert(on ? '🧪 وضع التجربة شغّال على هذا الموبايل: كل الإعلانات صارت إعلانات تجربة وما تنحسب. إعلان المكافأة يطلع بس الكوينز ما تنضاف.'
               : 'وضع التجربة انطفى — الإعلانات رجعت طبيعية.');
      render();
      return;
    }
    stopTimer();
    stopWhoamiTimer();
    stopSpyTimer();
    stopBombTicker();
    goto('hub');
  });
    
  const crumbMap = {
    'cat-loading':'لعبة الفئات · تحميل البنك',
    setup:'لعبة الفئات · تجهيز اللعبة',
    'custom-editor':'لعبة الفئات · فئة خاصة',
    board:'لعبة الفئات · اللعب',
    end:'لعبة الفئات · النتيجة',
    leaderboard:'ترتيب الفرق',
    shop:'متجر الكوينز',
    'whoami-setup':'من أنا؟ · تجهيز اللاعبين',
    'whoami-reveal':'من أنا؟ · توزيع الشخصيات',
    'whoami-play':'من أنا؟ · اللعب',
    'whoami-end':'من أنا؟ · النتيجة',
    'shd-setup':'الحلفاء والشياطين · تجهيز',
    'shd-roles':'الحلفاء والشياطين · تحديد الأدوار',
    'shd-reveal':'الحلفاء والشياطين · توزيع الأدوار',
    'shd-winner':'الحلفاء والشياطين · تحديد الفائز',
    'shd-end':'الحلفاء والشياطين · النتيجة',
    'spy-setup':'من الدخيل؟ · تجهيز',
    'spy-reveal':'من الدخيل؟ · توزيع الأوراق',
    'spy-play':'من الدخيل؟ · النقاش',
    'spy-vote':'من الدخيل؟ · التصويت',
    'spy-result':'من الدخيل؟ · النتيجة',
    'bomb-setup':'القنبلة الموقوتة · تجهيز',
    'bomb-play':'القنبلة الموقوتة · اللعب',
    'bomb-out':'القنبلة الموقوتة · انفجار',
    'bomb-end':'القنبلة الموقوتة · النتيجة'
  };
  if(crumbMap[state.screen]) bar.querySelector('.crumb').textContent = crumbMap[state.screen];

  const rightGroup = bar.querySelector('.topbar-right');
  const authArea = el(`<div style="display:flex; align-items:center; gap:10px;"></div>`);
  if(state.user){
    const coins = state.user.coins || 0;
    const box = el(`<div style="display:flex; align-items:center; gap:8px; cursor:pointer;" id="user-box">
      ${myAvatarHtml(28)}
      <span class="user-name" style="font-size:13px; color:var(--muted);">${escapeAttr(state.user.name)}</span>
      <span class="coin-chip" title="متجر الكوينز" role="button">🪙 ${coins}</span>
    </div>`);
    // قبل: confirm('تسجيل الخروج؟') — هسه تفتح شاشة الحساب، وبيها الخروج
    // وحذف الحساب وإدارة الناشرين المحظورين
    box.addEventListener('click', openAccountModal);
    // الكوينات تفتح المتجر مباشرة
    box.querySelector('.coin-chip').addEventListener('click', e=>{ e.stopPropagation(); openShop(); });
    authArea.appendChild(box);
  } else {
    const btn = el(`<button class="btn btn-ghost btn-sm" id="open-auth">تسجيل الدخول</button>`);
    btn.addEventListener('click', ()=>{
      state.showAuthModal = true;
      state.authMode = 'signin';
      state.authError = '';
      render();
    });
    authArea.appendChild(btn);
  }
  // بالشاشة الرئيسية البروفايل والكوينز وزر الدخول صاروا بالبطاقة اللي فوگ الألعاب
  if(state.screen !== 'hub') rightGroup.appendChild(authArea);

  return bar;
}

/* ============================ HUB ============================ */
/* خمس بطاقات متساوية: كل لعبة بصورتها وزرها. قبل، كانت بطاقة وحدة كبيرة
   بصورة وزر «العب الآن»، وأربعة مربعات بأيقونات خطية بلا زر — فالعين
   تقراهن كروابط إعدادات مو كألعاب تنلعب. */
const HUB_GAMES = [
  { id:'card-cat',    screen:null,          img:'img/friends.webp',    accent:'gold',
    title:'لعبة الفئات', desc:'فريقين، كل فريق يختار ٣ فئات، وبكل فئة ٦ أسئلة',
    players:'٤+ لاعبين', badge:'الأكثر لعباً' },
  { id:'card-whoami', screen:'whoami-setup', img:'img/game-whoami.webp', accent:'sage',
    title:'من أنا؟', desc:'شخصيتك على جبينك — خمّنها بأسئلة نعم/لا',
    players:'٣-١٠ لاعبين', badge:'' },
  { id:'card-shd',    screen:'shd-setup',    img:'img/game-shd.webp',    accent:'rose',
    title:'الحلفاء والشياطين', desc:'فريقين بالسر — منو ويّاك ومنو ضدك؟',
    players:'٥-١٠ لاعبين', badge:'' },
  { id:'card-spy',    screen:'spy-setup',    img:'img/game-spy.webp',    accent:'sage',
    title:'من الدخيل؟', desc:'الكل يعرف المكان إلا واحد — اكشفوه',
    players:'٤-١٢ لاعب', badge:'جديد' },
  { id:'card-bomb',   screen:'bomb-setup',   img:'img/game-bomb.webp',   accent:'rose',
    title:'القنبلة الموقوتة', desc:'ثواني معدودة لكل واحد — والي يتأخر يخرج',
    players:'٣-١٢ لاعب', badge:'جديد' }
];

function renderHub(){
  /* أعلى الشاشة: البروفايل والكوينز، وتحته ٣ مربعات (مكافأة اليوم، المتجر،
     الترتيب) — حتى اللاعب يعرف إن أكو حساب ومتجر. اسم التطبيق بالشريط العلوي. */
  const u = state.user;
  const rs = state.rewardState;
  const dailyReady = !!(u && rs && !rs.daily_claimed && rs.ads_left > 0 && rewardedAdsReady());
  const dailyTile = !u
    ? { hot: false, b: '🎁', t: 'مكافأة يومية', s: 'سجّل حتى تاخذها' }
    : dailyReady ? { hot: true, b: '🎁', t: 'مكافأة اليوم', s: `+${rs.daily_amount} كوين` }
    : rewardedAdsReady() ? { hot: false, b: '🎁', t: 'مكافأة اليوم', s: 'ارجع باچر' }
    : { hot: false, b: '🪙', t: 'اجمع كوينز', s: 'من كل لعبة فئات' };

  const wrap = el(`<div>
    <div class="hub-profile">
      ${u ? `
        <button type="button" class="hub-me" id="hub-me">
          ${myAvatarHtml(52, true)}
          <span class="hub-me-text">
            <span class="hub-hello">أهلاً ${escapeAttr(u.name)} 👋</span>
            <span class="hub-sub">${u.title ? `${titleName(u.title)} · ` : ''}لعبت ${u.gamesPlayed || 0} لعبة</span>
          </span>
        </button>
        <button type="button" class="hub-coins" id="hub-coins" aria-label="متجر الكوينز">🪙 ${u.coins || 0}</button>
      ` : `
        <span class="hub-me-text">
          <span class="hub-hello">اختاروا لعبة والعبوها سوا</span>
          <span class="hub-sub">سجّل حساب حتى تجمع كوينز وتلبس صورة وإطار</span>
        </span>
        <button type="button" class="btn btn-gold btn-sm" id="hub-login">تسجيل الدخول</button>
      `}
    </div>
    <div class="hub-tiles">
      <button type="button" class="hub-tile ${dailyTile.hot ? 'hot' : ''}" id="hub-daily">
        <b>${dailyTile.b}</b>${dailyTile.t}<small>${dailyTile.s}</small></button>
      <button type="button" class="hub-tile" id="hub-shop"><b>🛍️</b>المتجر<small>صور، ثيمات، باقات</small></button>
      <button type="button" class="hub-tile" id="hub-board"><b>🏆</b>الترتيب<small>ترتيب الفرق</small></button>
    </div>
    <div class="game-cards"></div>
  </div>`);
  wrap.querySelector('#hub-board').addEventListener('click', ()=> openLeaderboard());
  wrap.querySelector('#hub-shop').addEventListener('click', openShop);
  wrap.querySelector('#hub-daily').addEventListener('click', ()=>{
    if(u) openShop();
    else { state.showAuthModal = true; state.authMode = 'signin'; state.authError = ''; render(); }
  });
  if(u){
    wrap.querySelector('#hub-me').addEventListener('click', openAccountModal);
    wrap.querySelector('#hub-coins').addEventListener('click', openShop);
  } else {
    wrap.querySelector('#hub-login').addEventListener('click', ()=>{
      state.showAuthModal = true; state.authMode = 'signin'; state.authError = ''; render();
    });
  }

  const list = wrap.querySelector('.game-cards');
  HUB_GAMES.forEach(g=>{
    const card = el(`<button class="game-card acc-${g.accent}" id="${g.id}">
      <span class="gc-art"><img src="${g.img}" alt="" width="600" height="440" loading="eager" decoding="async"></span>
      <span class="gc-body">
        ${g.badge ? `<span class="gc-badge">${g.badge}</span>` : ''}
        <span class="gc-title">${g.title}</span>
        <span class="gc-desc">${g.desc}</span>
        <span class="gc-foot">
          <span class="gc-chip">${g.players}</span>
          <span class="gc-cta">العب ←</span>
        </span>
      </span>
    </button>`);
    /* لعبة الفئات تمرّ بتحميل البنك أول، فالها مسار خاص */
    card.addEventListener('click', ()=> g.screen ? goto(g.screen) : openCategoryGame());
    list.appendChild(card);
  });

  return wrap;
}
