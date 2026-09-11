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
  if(state.showUpsellModal){
    app.appendChild(renderUpsellOverlay());
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
    const box = el(`<div style="display:flex; align-items:center; gap:8px; cursor:pointer;" id="user-box">
      ${state.user.photo ? `<img src="${escapeAttr(state.user.photo)}" style="width:28px;height:28px;border-radius:50%; border:1px solid var(--gold-dim);"/>` : ''}
      <span style="font-size:13px; color:var(--muted);">${escapeAttr(state.user.name)}</span>
    </div>`);
    box.addEventListener('click', ()=>{
      if(confirm('تسجيل الخروج؟')) signOutUser();
    });
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
    <div class="cards">
      <div class="card" id="card-cat">
        <span class="tag">فرق · ٢-فرق</span>
        <h3>لعبة الفئات</h3>
        <p>كل فريق يختار ٣ فئات، وكل فئة فيها ٦ أسئلة بنقاط متفاوتة. من يجمع نقاط أكثر يفوز.</p>
      </div>
      <div class="card" id="card-whoami">
        <span class="tag">جماعي · ٣-١٠ لاعبين${!isSubscribed()?' · 🔒 للمشتركين':''}</span>
        <h3>من أنا؟</h3>
        <p>كل لاعب تنحط له شخصية بالسر يشوفها الكل إلا هو، ويحاول يخمنها بأسئلة نعم/لا.</p>
      </div>
      <div class="card" id="card-shd">
        <span class="tag">جماعي · ٥-١٠ لاعبين${!isSubscribed()?' · 🔒 للمشتركين':''}</span>
        <h3>الحلفاء والشياطين</h3>
        <p>فريقين بالسر: حلفاء وشياطين. انتخاب رئيس ووزير، تمرير قوانين، ونقاش وشكوك. من يمرر أهدافه أول يفوز.</p>
      </div>
    </div>
  </div>`);
  wrap.querySelector('#card-cat').addEventListener('click', async ()=>{
    if(state.categoryDataLoaded){
      if(state.pool.length === 0){
        (isSubscribed() ? CATEGORY_TOPICS : FREE_TOPICS).forEach(t=> state.pool.push(makeBankTopic(t)));
      }
      goto('editor');
      return;
    }
    state.categoryDataError = '';
    goto('cat-loading');
    try{
      await loadCategoryDatabase();
      state.categoryDataLoaded = true;
      if(state.pool.length === 0){
        (isSubscribed() ? CATEGORY_TOPICS : FREE_TOPICS).forEach(t=> state.pool.push(makeBankTopic(t)));
      }
      goto('editor');
    } catch(e){
      console.error('loadCategoryDatabase failed:', e);
      state.categoryDataError = 'تعذّر تحميل بنك الأسئلة — ' + (e && (e.message || e.error_description || JSON.stringify(e)) || 'خطأ غير معروف');
      render();
    }
  });
  wrap.querySelector('#card-whoami').addEventListener('click', ()=>{
    if(!isSubscribed()){ openUpsell('لعبة "من أنا؟" حصرية للمشتركين.'); return; }
    goto('whoami-setup');
  });
  wrap.querySelector('#card-shd').addEventListener('click', ()=>{
    if(!isSubscribed()){ openUpsell('لعبة "الحلفاء والشياطين" حصرية للمشتركين.'); return; }
    goto('shd-setup');
  });
  return wrap;
}
