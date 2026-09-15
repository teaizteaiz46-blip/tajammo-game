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
    'shd-end':'الحلفاء والشياطين · النتيجة'
    
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
function renderHub(){
  const wrap = el(`<div>
    <div class="hero">
      <div class="bulb-row">${'<i></i>'.repeat(9)}</div>
      <h1>تجمّ<span>ع</span></h1>
      <p>${state.user ? `أهلاً ${escapeAttr(state.user.name)} — لعبت ${state.user.gamesPlayed||0} لعبة` : 'اختاروا لعبة والعبوها سوا'}</p>
    </div>

    <div class="feature-card" id="card-cat">
      <div class="feature-art"><img src="img/friends.webp" alt="" width="560" height="386" loading="eager" decoding="async"></div>
      <div class="feature-txt">
        <span class="ribbon">الأكثر لعباً</span>
        <h3>لعبة الفئات</h3>
        <p>فريقين، كل فريق يختار ٣ فئات،<br>وبكل فئة ٦ أسئلة</p>
        <span class="feature-cta">العب الآن ←</span>
      </div>
    </div>

    <div class="game-grid">
      <div class="game-tile" id="card-whoami">
        <svg class="tile-ico" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <circle cx="24" cy="24" r="19" stroke="#6FA287" stroke-width="2.4"/>
          <path d="M18 19a6 6 0 1 1 6.6 6v3.4" stroke="#D4A857" stroke-width="3" stroke-linecap="round"/>
          <circle cx="24.6" cy="33.5" r="2.1" fill="#D4A857"/>
        </svg>
        <h3>من أنا؟</h3>
        <small>٣-١٠ لاعبين<br>أسئلة نعم/لا</small>
      </div>
      <div class="game-tile" id="card-shd">
        <svg class="tile-ico" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M8 34c0-6 4.6-9.5 9.5-9.5S27 28 27 34" stroke="#6FA287" stroke-width="2.4" stroke-linecap="round"/>
          <circle cx="17.5" cy="17" r="5.5" stroke="#6FA287" stroke-width="2.4"/>
          <path d="M23 34c0-5.4 4.1-8.6 8.5-8.6S40 28.6 40 34" stroke="#C1443A" stroke-width="2.4" stroke-linecap="round"/>
          <circle cx="31.5" cy="18.5" r="5" stroke="#C1443A" stroke-width="2.4"/>
        </svg>
        <h3>الحلفاء والشياطين</h3>
        <small>٥-١٠ لاعبين<br>فريقين بالسر</small>
      </div>
      <div class="game-tile soon">
        <svg class="tile-ico" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect x="8" y="8" width="32" height="32" rx="8" stroke="#8FB3AC" stroke-width="2.4"/>
          <path d="M24 17v14M17 24h14" stroke="#8FB3AC" stroke-width="2.8" stroke-linecap="round"/>
        </svg>
        <h3>لعبة جديدة</h3>
        <span class="soon-badge">قريباً</span>
      </div>
      <div class="game-tile soon">
        <svg class="tile-ico" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect x="8" y="8" width="32" height="32" rx="8" stroke="#8FB3AC" stroke-width="2.4"/>
          <path d="M24 17v14M17 24h14" stroke="#8FB3AC" stroke-width="2.8" stroke-linecap="round"/>
        </svg>
        <h3>لعبة جديدة</h3>
        <span class="soon-badge">قريباً</span>
      </div>
    </div>
  </div>`);
  wrap.querySelector('#card-cat').addEventListener('click', ()=> openCategoryGame());
  wrap.querySelector('#card-whoami').addEventListener('click', ()=> goto('whoami-setup'));
  wrap.querySelector('#card-shd').addEventListener('click', ()=> goto('shd-setup'));
  return wrap;
}
