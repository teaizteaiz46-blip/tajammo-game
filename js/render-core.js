/* ============================ RENDER ROOT ============================ */
function render(){
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(renderTopbar());
  let body;
  switch(state.screen){
    case 'hub': body = renderHub(); break;
    case 'cat-loading': body = renderCatLoading(); break;
    case 'editor': body = renderEditor(); break;
    case 'teams': body = renderTeams(); break;
    case 'select': body = renderSelect(); break;
    case 'board': body = renderBoard(); break;
    case 'end': body = renderEnd(); break;
    case 'whoami-setup': body = renderWhoamiSetup(); break;
    case 'whoami-reveal': body = renderWhoamiReveal(); break;
    case 'whoami-play': body = renderWhoamiPlay(); break;
    case 'whoami-end': body = renderWhoamiEnd(); break;
    case 'shd-setup': body = renderShdSetup(); break;
    case 'shd-roles': body = renderShdRoles(); break;
    case 'shd-reveal': body = renderShdReveal(); break;
    case 'shd-winner': body = renderShdWinner(); break;
    case 'shd-end': body = renderShdEnd(); break;
    default: body = renderHub();
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
