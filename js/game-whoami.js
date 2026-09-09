/* ============================ الحلفاء والشياطين (simplified Secret-Hitler-style) ============================ */
function shdEvilCountFor(n){
  const table = {5:2,6:2,7:3,8:3,9:4,10:4};
  return table[n] || 2;
}
function shdBuildDeck(){
  const deck = [];
  for(let i=0;i<6;i++) deck.push('good');
  for(let i=0;i<11;i++) deck.push('evil');
  return shuffled(deck);
}
function shdDrawThree(){
  if(state.shdDeck.length < 3){
    state.shdDeck = shuffled([...state.shdDeck, ...state.shdDiscard]);
    state.shdDiscard = [];
  }
  const drawn = state.shdDeck.splice(0,3);
  return drawn;
}
function shdEligibleChancellors(){
  const n = state.shdPlayers.length;
  return state.shdPlayers.map((p,i)=>i).filter(i=>{
    if(i === state.shdPresidentIdx) return false;
    if(n > 5 && i === state.shdLastPresidentIdx) return false;
    if(i === state.shdLastChancellorIdx) return false;
    return true;
  });
}

function renderShdSetup(){
  const wrap = el(`<div></div>`);

  const intro = el(`<div class="panel">
    <div class="section-title">الحلفاء والشياطين</div>
    <div class="section-sub">فريقين بالسر: أغلبية "حلفاء" وأقلية "شياطين" تعرف بعضها. انتخاب رئيس ووزير كل جولة، وتمرير قانون واحد. الحلفاء يفوزون بتمرير ٥ قوانين صالحة، والشياطين يفوزون بتمرير ٦ قوانين شريرة.</div>
  </div>`);
  wrap.appendChild(intro);

  const countPanel = el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">عدد اللاعبين (٥-١٠)</div>
    <div style="display:flex; align-items:center; gap:16px; margin-top:10px;">
      <button class="btn btn-ghost btn-sm" id="shd-count-minus">−</button>
      <span class="display" style="font-size:26px; min-width:30px; text-align:center;">${state.shdPlayerCount}</span>
      <button class="btn btn-ghost btn-sm" id="shd-count-plus">+</button>
    </div>
    <div class="section-sub" style="margin-top:10px;">عدد الشياطين بهذا العدد: ${shdEvilCountFor(state.shdPlayerCount)}</div>
  </div>`);
  countPanel.querySelector('#shd-count-minus').addEventListener('click', ()=>{
    if(state.shdPlayerCount > 5){ state.shdPlayerCount--; render(); }
  });
  countPanel.querySelector('#shd-count-plus').addEventListener('click', ()=>{
    if(state.shdPlayerCount < 10){ state.shdPlayerCount++; render(); }
  });
  wrap.appendChild(countPanel);

  const namesPanel = el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">أسماء اللاعبين (اختياري)</div>
    <div id="shd-names-list" style="display:grid; gap:10px;"></div>
  </div>`);
  const namesList = namesPanel.querySelector('#shd-names-list');
  for(let i=0;i<state.shdPlayerCount;i++){
    const row = el(`<input type="text" placeholder="اللاعب ${i+1}" value="${escapeAttr(state.shdPlayerNames[i]||'')}"/>`);
    row.addEventListener('input', e=>{ state.shdPlayerNames[i] = e.target.value; });
    namesList.appendChild(row);
  }
  wrap.appendChild(namesPanel);

  const actions = el(`<div class="btn-row">
    <button class="btn btn-gold" id="shd-start">ابدأ التوزيع</button>
    <button class="btn btn-ghost" id="shd-back">رجوع</button>
  </div>`);
  actions.querySelector('#shd-back').addEventListener('click', ()=> goto('hub'));
  actions.querySelector('#shd-start').addEventListener('click', ()=>{
    const n = state.shdPlayerCount;
    const evilCount = shdEvilCountFor(n);
    const roles = [];
    for(let i=0;i<evilCount;i++) roles.push('evil');
    for(let i=evilCount;i<n;i++) roles.push('good');
    const shuffledRoles = shuffled(roles);
    state.shdPlayers = shuffledRoles.map((role,i)=>({
      name: state.shdPlayerNames[i]?.trim() || `اللاعب ${i+1}`,
      role
    }));
    state.shdRevealIndex = 0;
    state.shdRevealShown = false;
    state.shdDeck = shdBuildDeck();
    state.shdDiscard = [];
    state.shdGoodCount = 0;
    state.shdEvilCount = 0;
    state.shdPresidentIdx = 0;
    state.shdChancellorIdx = null;
    state.shdLastPresidentIdx = null;
    state.shdLastChancellorIdx = null;
    state.shdWinner = null;
    goto('shd-reveal');
  });
  wrap.appendChild(actions);

  return wrap;
}

function renderShdReveal(){
  const wrap = el(`<div></div>`);
  const idx = state.shdRevealIndex;
  const player = state.shdPlayers[idx];

  if(!player){
    const done = el(`<div class="panel" style="text-align:center;">
      <div class="section-title">كل اللاعبين عرفوا أدوارهم ✓</div>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="shd-play-start">ابدأ اللعبة</button>
      </div>
    </div>`);
    done.querySelector('#shd-play-start').addEventListener('click', ()=> goto('shd-nominate'));
    wrap.appendChild(done);
    return wrap;
  }

  const panel = el(`<div class="panel" style="text-align:center;">
    <div class="section-title">🙈 الكل غير ${escapeAttr(player.name)} يبعدون نظرهم</div>
    <div class="section-sub">بس ${escapeAttr(player.name)} يشوف الشاشة الحين</div>
    ${state.shdRevealShown ? `
      <div class="q-points" style="font-size:22px; padding:16px 26px;">
        ${player.role === 'good' ? 'أنت من الحلفاء 😇' : 'أنت من الشياطين 😈'}
      </div>
      ${player.role === 'evil' ? `<div class="section-sub">زملاؤك: ${state.shdPlayers.filter((p,i)=>p.role==='evil' && i!==idx).map(p=>escapeAttr(p.name)).join('، ')}</div>` : ''}
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="shd-next">التالي</button>
      </div>
    ` : `
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="shd-reveal-role">إظهار دوري (لو الباقي مو ناظرين)</button>
      </div>
    `}
  </div>`);

  const revealBtn = panel.querySelector('#shd-reveal-role');
  if(revealBtn) revealBtn.addEventListener('click', ()=>{ state.shdRevealShown = true; render(); });
  const nextBtn = panel.querySelector('#shd-next');
  if(nextBtn) nextBtn.addEventListener('click', ()=>{
    state.shdRevealIndex++;
    state.shdRevealShown = false;
    render();
  });

  wrap.appendChild(panel);
  return wrap;
}

function renderShdNominate(){
  const wrap = el(`<div></div>`);
  wrap.appendChild(el(`<div class="section-sub" style="margin-bottom:14px;">الحلفاء: ${state.shdGoodCount}/٥ · الشياطين: ${state.shdEvilCount}/٦</div>`));

  const president = state.shdPlayers[state.shdPresidentIdx];
  const banner = el(`<div class="turn-banner">الرئيس هذي الجولة: <b>${escapeAttr(president.name)}</b> — يختار وزير</div>`);
  wrap.appendChild(banner);

  const eligible = shdEligibleChancellors();
  const grid = el(`<div class="pick-grid"></div>`);
  state.shdPlayers.forEach((p, i)=>{
    const ok = eligible.includes(i);
    const card = el(`<div class="pick-card ${ok?'':'taken'}">${escapeAttr(p.name)}</div>`);
    if(ok){
      card.addEventListener('click', ()=>{
        state.shdChancellorIdx = i;
        state.shdVotes = {};
        state.shdVoteStep = 0;
        state.shdVoteOrder = state.shdPlayers.map((_,idx)=>idx);
        goto('shd-vote');
      });
    }
    grid.appendChild(card);
  });
  wrap.appendChild(grid);
  return wrap;
}

function renderShdVote(){
  const wrap = el(`<div></div>`);
  const president = state.shdPlayers[state.shdPresidentIdx];
  const chancellor = state.shdPlayers[state.shdChancellorIdx];

  wrap.appendChild(el(`<div class="panel" style="text-align:center;">
    <div class="section-title">هل توافقون على هذي الحكومة؟</div>
    <div class="section-sub">الرئيس: ${escapeAttr(president.name)} — الوزير المرشّح: ${escapeAttr(chancellor.name)}</div>
  </div>`));

  const step = state.shdVoteStep;
  if(step >= state.shdVoteOrder.length){
    const yes = Object.values(state.shdVotes).filter(v=>v).length;
    const no = Object.values(state.shdVotes).filter(v=>!v).length;
    const passed = yes > no;
    const goBtn = el(`<div class="panel" style="text-align:center;">
      <div class="section-title">${passed? 'الحكومة موافق عليها ✓' : 'الحكومة مرفوضة ✕'}</div>
      <div class="section-sub">نعم: ${yes} — لا: ${no}</div>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="shd-vote-continue">متابعة</button>
      </div>
    </div>`);
    goBtn.querySelector('#shd-vote-continue').addEventListener('click', ()=>{
      if(passed){
        state.shdLastPresidentIdx = state.shdPresidentIdx;
        state.shdLastChancellorIdx = state.shdChancellorIdx;
        state.shdDrawnPolicies = shdDrawThree();
        state.shdRevealShown = false;
        goto('shd-president-policy');
      } else {
        state.shdPresidentIdx = (state.shdPresidentIdx + 1) % state.shdPlayers.length;
        state.shdChancellorIdx = null;
        goto('shd-nominate');
      }
    });
    wrap.appendChild(goBtn);
    return wrap;
  }

  const voterIdx = state.shdVoteOrder[step];
  const voter = state.shdPlayers[voterIdx];
  const panel = el(`<div class="panel" style="text-align:center;">
    <div class="section-title">تصويت: ${escapeAttr(voter.name)}</div>
    <div class="award-row">
      <button class="btn btn-gold btn-sm" id="shd-yes">نعم</button>
      <button class="btn btn-sm" style="background:var(--rose); color:#fff;" id="shd-no">لا</button>
    </div>
  </div>`);
  panel.querySelector('#shd-yes').addEventListener('click', ()=>{
    state.shdVotes[voterIdx] = true;
    state.shdVoteStep++;
    render();
  });
  panel.querySelector('#shd-no').addEventListener('click', ()=>{
    state.shdVotes[voterIdx] = false;
    state.shdVoteStep++;
    render();
  });
  wrap.appendChild(panel);
  return wrap;
}

function renderShdVoteResult(){
  return renderShdVote();
}

function renderShdPresidentPolicy(){
  const wrap = el(`<div></div>`);
  const president = state.shdPlayers[state.shdPresidentIdx];

  if(!state.shdRevealShown){
    const panel = el(`<div class="panel" style="text-align:center;">
      <div class="section-title">🙈 الكل غير ${escapeAttr(president.name)} يبعدون نظرهم</div>
      <div class="section-sub">الرئيس بس يشوف القوانين ويستبعد وحد</div>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="shd-show-pres">إظهار القوانين</button>
      </div>
    </div>`);
    panel.querySelector('#shd-show-pres').addEventListener('click', ()=>{ state.shdRevealShown = true; render(); });
    wrap.appendChild(panel);
    return wrap;
  }

  const panel = el(`<div class="panel" style="text-align:center;">
    <div class="section-title">اختر قانون تستبعده (يضل ٢ للوزير)</div>
    <div class="pick-grid" id="pres-tiles"></div>
  </div>`);
  const tilesGrid = panel.querySelector('#pres-tiles');
  state.shdDrawnPolicies.forEach((tile, i)=>{
    const card = el(`<div class="pick-card">${tile==='good'?'قانون صالح 😇':'قانون شرير 😈'}</div>`);
    card.addEventListener('click', ()=>{
      state.shdDiscard.push(tile);
      state.shdDrawnPolicies = state.shdDrawnPolicies.filter((_,idx)=>idx!==i);
      state.shdRevealShown = false;
      goto('shd-chancellor-policy');
    });
    tilesGrid.appendChild(card);
  });
  wrap.appendChild(panel);
  return wrap;
}

function renderShdChancellorPolicy(){
  const wrap = el(`<div></div>`);
  const chancellor = state.shdPlayers[state.shdChancellorIdx];

  if(!state.shdRevealShown){
    const panel = el(`<div class="panel" style="text-align:center;">
      <div class="section-title">🙈 الكل غير ${escapeAttr(chancellor.name)} يبعدون نظرهم</div>
      <div class="section-sub">الوزير بس يشوف القانونين ويستبعد وحد، والباقي ينطبق علناً</div>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="shd-show-chan">إظهار القوانين</button>
      </div>
    </div>`);
    panel.querySelector('#shd-show-chan').addEventListener('click', ()=>{ state.shdRevealShown = true; render(); });
    wrap.appendChild(panel);
    return wrap;
  }

  const panel = el(`<div class="panel" style="text-align:center;">
    <div class="section-title">اختر قانون تستبعده (الثاني ينطبق علناً)</div>
    <div class="pick-grid" id="chan-tiles"></div>
  </div>`);
  const tilesGrid = panel.querySelector('#chan-tiles');
  state.shdDrawnPolicies.forEach((tile, i)=>{
    const card = el(`<div class="pick-card">${tile==='good'?'قانون صالح 😇':'قانون شرير 😈'}</div>`);
    card.addEventListener('click', ()=>{
      state.shdDiscard.push(tile);
      const enacted = state.shdDrawnPolicies.find((_,idx)=>idx!==i);
      state.shdLastEnacted = enacted;
      if(enacted === 'good') state.shdGoodCount++; else state.shdEvilCount++;
      state.shdRevealShown = false;
      goto('shd-policy-result');
    });
    tilesGrid.appendChild(card);
  });
  wrap.appendChild(panel);
  return wrap;
}

function renderShdPolicyResult(){
  const wrap = el(`<div></div>`);
  const enacted = state.shdLastEnacted;
  const panel = el(`<div class="panel" style="text-align:center;">
    <div class="section-title">${enacted==='good' ? 'انطبق قانون صالح 😇' : 'انطبق قانون شرير 😈'}</div>
    <div class="section-sub">الحلفاء: ${state.shdGoodCount}/٥ — الشياطين: ${state.shdEvilCount}/٦</div>
  </div>`);
  wrap.appendChild(panel);

  if(state.shdGoodCount >= 5 || state.shdEvilCount >= 6){
    state.shdWinner = state.shdGoodCount >= 5 ? 'good' : 'evil';
    const btn = el(`<div class="btn-row" style="justify-content:center;"><button class="btn btn-gold" id="shd-to-end">عرض النتيجة النهائية</button></div>`);
    btn.querySelector('#shd-to-end').addEventListener('click', ()=> goto('shd-end'));
    wrap.appendChild(btn);
  } else {
    const btn = el(`<div class="btn-row" style="justify-content:center;"><button class="btn btn-gold" id="shd-next-round">الجولة التالية</button></div>`);
    btn.querySelector('#shd-next-round').addEventListener('click', ()=>{
      state.shdPresidentIdx = (state.shdPresidentIdx + 1) % state.shdPlayers.length;
      state.shdChancellorIdx = null;
      goto('shd-nominate');
    });
    wrap.appendChild(btn);
  }
  return wrap;
}

function renderShdEnd(){
  if(state.user && !state.statsRecordedForThisGame){
    state.statsRecordedForThisGame = true;
    recordGameResult(0);
  }
  const winner = state.shdWinner;
  const wrap = el(`<div class="end-wrap">
    <div class="trophy">${winner==='good'?'😇':'😈'}</div>
    <h2>${winner==='good' ? 'فاز الحلفاء' : 'فاز الشياطين'}</h2>
    <p>الأدوار الحقيقية:</p>
    <div class="panel" style="max-width:400px; margin:0 auto 30px; text-align:right;">
      ${state.shdPlayers.map(p=>`<div style="padding:8px 0; border-top:1px solid var(--line);">${escapeAttr(p.name)} — ${p.role==='good'?'حلفاء 😇':'شياطين 😈'}</div>`).join('')}
    </div>
    <div class="btn-row" style="justify-content:center;">
      <button class="btn btn-gold" id="shd-replay">جولة جديدة</button>
      <button class="btn btn-ghost" id="shd-hub">رجوع للرئيسية</button>
    </div>
  </div>`);
  wrap.querySelector('#shd-replay').addEventListener('click', ()=>{
    state.statsRecordedForThisGame = false;
    goto('shd-setup');
  });
  wrap.querySelector('#shd-hub').addEventListener('click', ()=>{
    state.statsRecordedForThisGame = false;
    showInterstitialAd();
    goto('hub');
  });
  return wrap;
}
