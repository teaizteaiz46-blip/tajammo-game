/* ============================ RENDER ROOT ============================ */
function render(){
  const app = document.getElementById('app');
  app.innerHTML = '';
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

  if(state.screen === 'board' && state.activeCell){
    app.appendChild(renderQuestionOverlay());
  }
  if(state.showAuthModal){
    app.appendChild(renderAuthOverlay());
  }
  if(state.customShareCode){
    app.appendChild(renderShareCodeOverlay());
  }
  if(state.reportTopic){
    app.appendChild(renderReportOverlay());
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
    case 'editor':        return renderEditor();
    case 'custom-editor': return renderCustomEditor();
    case 'teams':         return renderTeams();
    case 'select':        return renderSelect();
    case 'board':         return renderBoard();
    case 'end':           return renderEnd();
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

function renderTopbar(){
  const bar = el(`<div class="topbar">
    <button class="btn btn-ghost btn-sm" id="back-arrow" style="display:${state.history.length?'inline-flex':'none'};">→ رجوع</button>
    <div class="brand"><span class="dot"></span> تجمّع</div>
    <div class="topbar-right" style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
      <div class="crumb"></div>
    </div>
  </div>`);
  bar.querySelector('.brand').addEventListener('click', ()=>{
    stopTimer();
    stopWhoamiTimer();
    stopSpyTimer();
    stopBombTicker();
    goto('hub');
  });
    
  const crumbMap = {
    'cat-loading':'لعبة الفئات · تحميل البنك',
    editor:'لعبة الفئات · اختيار المواضيع',
    'custom-editor':'لعبة الفئات · فئة خاصة',
    teams:'لعبة الفئات · الفرق والإعدادات',
    select:'لعبة الفئات · اختيار الفئات',
    board:'لعبة الفئات · اللعب',
    end:'لعبة الفئات · النتيجة',
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
      ${state.user.photo ? `<img src="${escapeAttr(state.user.photo)}" style="width:28px;height:28px;border-radius:50%; border:1px solid var(--gold-dim);"/>` : ''}
      <span style="font-size:13px; color:var(--muted);">${escapeAttr(state.user.name)}</span>
      <span class="coin-chip" title="كوينات">🪙 ${coins}</span>
    </div>`);
    // قبل: confirm('تسجيل الخروج؟') — هسه تفتح شاشة الحساب، وبيها الخروج
    // وحذف الحساب وإدارة الناشرين المحظورين
    box.addEventListener('click', openAccountModal);
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
  rightGroup.appendChild(authArea);

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
  const wrap = el(`<div>
    <div class="hero">
      <div class="bulb-row">${'<i></i>'.repeat(9)}</div>
      <!-- الاسم نص واحد بلا أي تقسيم. كل حروف «تجمّع» توصل لليسار، فأي <span>
           جوّه الكلمة يكسر تشكيل الحروف على ويب‌كِت (آيفون). اللون من CSS. -->
      <h1>تجمّع</h1>
      <p>${state.user ? `أهلاً ${escapeAttr(state.user.name)} — لعبت ${state.user.gamesPlayed||0} لعبة` : 'اختاروا لعبة والعبوها سوا'}</p>
    </div>
    <div class="game-cards"></div>
  </div>`);

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
