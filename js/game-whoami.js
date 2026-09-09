/* ============================ WHO AM I? (من أنا؟) ============================ */
async function fetchRandomCharacters(n){
  if(!sb) throw new Error('لا يوجد اتصال بالإنترنت');
  const { data, error } = await sb
    .from('whoami_characters')
    .select('name')
    .limit(500);
  if(error) throw error;
  const shuffledNames = data.map(r=>r.name).sort(()=> Math.random()-0.5);
  if(shuffledNames.length < n) throw new Error('not enough characters');
  return shuffledNames.slice(0, n);
}

function renderWhoamiSetup(){
  const wrap = el(`<div></div>`);

  const intro = el(`<div class="panel">
    <div class="section-title">من أنا؟</div>
    <div class="section-sub">كل لاعب تنحط له شخصية بالسر — يشوفها كل الحاضرين إلا هو، ويحاول يخمنها بأسئلة نعم/لا. الشخصيات تنجلب أونلاين من قاعدة بيانات، فلازم اتصال إنترنت.</div>
  </div>`);
  wrap.appendChild(intro);

  const countPanel = el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">عدد اللاعبين</div>
    <div style="display:flex; align-items:center; gap:16px; margin-top:10px;">
      <button class="btn btn-ghost btn-sm" id="count-minus">−</button>
      <span class="display" style="font-size:26px; min-width:30px; text-align:center;">${state.whoamiPlayerCount}</span>
      <button class="btn btn-ghost btn-sm" id="count-plus">+</button>
    </div>
  </div>`);
  countPanel.querySelector('#count-minus').addEventListener('click', ()=>{
    if(state.whoamiPlayerCount > 3){ state.whoamiPlayerCount--; render(); }
  });
  countPanel.querySelector('#count-plus').addEventListener('click', ()=>{
    if(state.whoamiPlayerCount < 10){ state.whoamiPlayerCount++; render(); }
  });
  wrap.appendChild(countPanel);

  const namesPanel = el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">أسماء اللاعبين (اختياري)</div>
    <div class="section-sub">لو تركتها فاضية، بنسميهم "اللاعب ١"، "اللاعب ٢"...</div>
    <div id="names-list" style="display:grid; gap:10px;"></div>
  </div>`);
  const namesList = namesPanel.querySelector('#names-list');
  for(let i=0;i<state.whoamiPlayerCount;i++){
    const row = el(`<input type="text" placeholder="اللاعب ${i+1}" value="${escapeAttr(state.whoamiPlayerNames[i]||'')}"/>`);
    row.addEventListener('input', e=>{ state.whoamiPlayerNames[i] = e.target.value; });
    namesList.appendChild(row);
  }
  wrap.appendChild(namesPanel);

  const timerPanel = el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">المؤقت</div>
    <div class="toggle-row">
      <span>تفعيل مؤقت لكل دور</span>
      <div class="switch ${state.whoamiTimerEnabled?'on':''}" id="wa-timer-switch"><div class="knob"></div></div>
    </div>
    <div class="field" style="margin-top:16px; ${state.whoamiTimerEnabled?'':'display:none;'}" id="wa-timer-field">
      <label>مدة كل دور (بالثواني)</label>
      <input type="number" id="wa-timer-seconds" min="10" max="180" value="${state.whoamiTimerSeconds}"/>
    </div>
  </div>`);
  timerPanel.querySelector('#wa-timer-switch').addEventListener('click', ()=>{
    state.whoamiTimerEnabled = !state.whoamiTimerEnabled;
    render();
  });
  const waSec = timerPanel.querySelector('#wa-timer-seconds');
  if(waSec) waSec.addEventListener('input', e=>{
    state.whoamiTimerSeconds = Math.max(5, parseInt(e.target.value||'30',10));
  });
  wrap.appendChild(timerPanel);

  if(state.whoamiError){
    wrap.appendChild(el(`<div class="section-sub" style="color:var(--rose);">${escapeAttr(state.whoamiError)}</div>`));
  }

  const actions = el(`<div class="btn-row">
    <button class="btn btn-gold" id="wa-start" ${state.whoamiLoading?'disabled':''}>${state.whoamiLoading?'...جاري الجلب':'ابدأ التوزيع'}</button>
    <button class="btn btn-ghost" id="wa-back">رجوع</button>
  </div>`);
  actions.querySelector('#wa-back').addEventListener('click', ()=> goto('hub'));
  actions.querySelector('#wa-start').addEventListener('click', async ()=>{
    state.whoamiLoading = true; state.whoamiError=''; render();
    try{
      const names = await fetchRandomCharacters(state.whoamiPlayerCount);
      state.whoamiPlayers = names.map((character, i)=>({
        name: state.whoamiPlayerNames[i]?.trim() || `اللاعب ${i+1}`,
        character,
        guessed: false
      }));
      state.whoamiRevealIndex = 0;
      state.whoamiRevealShown = false;
      state.whoamiTurn = 0;
      state.whoamiFinishOrder = [];
      state.whoamiLoading = false;
      goto('whoami-reveal');
    } catch(e){
      state.whoamiLoading = false;
      state.whoamiError = 'تعذّر جلب الشخصيات — تأكد من اتصال الإنترنت وحاول مرة ثانية.';
      render();
    }
  });
  wrap.appendChild(actions);

  return wrap;
}

function renderWhoamiReveal(){
  const wrap = el(`<div></div>`);
  const idx = state.whoamiRevealIndex;
  const player = state.whoamiPlayers[idx];

  if(!player){
    const done = el(`<div class="panel" style="text-align:center;">
      <div class="section-title">كل الشخصيات اتوزعت ✓</div>
      <div class="section-sub">جاهزين نبدأ اللعب</div>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="wa-play-start">ابدأ اللعبة</button>
      </div>
    </div>`);
    done.querySelector('#wa-play-start').addEventListener('click', ()=> goto('whoami-play'));
    wrap.appendChild(done);
    return wrap;
  }

  const panel = el(`<div class="panel" style="text-align:center;">
    <div class="section-title">🙈 ${escapeAttr(player.name)} يبعد نظره عن الشاشة</div>
    <div class="section-sub">باقي كل اللاعبين ينطرون ويشوفون — بس مو هو</div>
    ${state.whoamiRevealShown ? `
      <div class="q-points" style="font-size:26px; padding:16px 26px;">${escapeAttr(player.character)}</div>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="wa-next">التالي</button>
      </div>
    ` : `
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="wa-reveal">إظهار الشخصية (لو ${escapeAttr(player.name)} مو ناظر)</button>
      </div>
    `}
  </div>`);

  const revealBtn = panel.querySelector('#wa-reveal');
  if(revealBtn) revealBtn.addEventListener('click', ()=>{ state.whoamiRevealShown = true; render(); });
  const nextBtn = panel.querySelector('#wa-next');
  if(nextBtn) nextBtn.addEventListener('click', ()=>{
    state.whoamiRevealIndex++;
    state.whoamiRevealShown = false;
    render();
  });

  wrap.appendChild(panel);
  return wrap;
}

function activeWhoamiPlayers(){
  return state.whoamiPlayers.filter(p=>!p.guessed);
}

function renderWhoamiPlay(){
  const wrap = el(`<div></div>`);

  const remaining = activeWhoamiPlayers();
  if(remaining.length === 0){
    goto('whoami-end');
    return wrap;
  }

  if(state.whoamiTurn >= state.whoamiPlayers.length) state.whoamiTurn = 0;
  while(state.whoamiPlayers[state.whoamiTurn].guessed){
    state.whoamiTurn = (state.whoamiTurn + 1) % state.whoamiPlayers.length;
  }
  const player = state.whoamiPlayers[state.whoamiTurn];

  const scoreStrip = el(`<div class="section-sub" style="margin-bottom:14px;">فازوا: ${state.whoamiFinishOrder.map(n=>escapeAttr(n)).join('، ') || '—'}</div>`);
  wrap.appendChild(scoreStrip);

  const panel = el(`<div class="panel" style="text-align:center;">
    <div class="section-title">دور: ${escapeAttr(player.name)}</div>
    <div class="section-sub">يسأل سؤال نعم/لا بصوته، والباقي يردون بصوتهم</div>
    ${state.whoamiTimerEnabled ? `<div class="timer" id="wa-timer-display">${state.whoamiTimerLeft}</div>` : ''}
    <div class="award-row">
      <button class="btn btn-gold btn-sm" id="wa-yes">نعم (استمر)</button>
      <button class="btn btn-sm" style="background:var(--rose); color:#fff;" id="wa-no">لا (الدور التالي)</button>
    </div>
    <div class="btn-row" style="justify-content:center;">
      <button class="btn btn-gold" id="wa-correct">خمّنت صح ✅</button>
    </div>
  </div>`);

  panel.querySelector('#wa-yes').addEventListener('click', ()=>{
    if(state.whoamiTimerEnabled) startWhoamiTimer();
    render();
  });
  panel.querySelector('#wa-no').addEventListener('click', ()=>{
    stopWhoamiTimer();
    state.whoamiTurn = (state.whoamiTurn + 1) % state.whoamiPlayers.length;
    render();
  });
  panel.querySelector('#wa-correct').addEventListener('click', ()=>{
    stopWhoamiTimer();
    player.guessed = true;
    state.whoamiFinishOrder.push(player.name);
    const stillLeft = activeWhoamiPlayers();
    if(stillLeft.length === 0){
      goto('whoami-end');
    } else {
      state.whoamiTurn = (state.whoamiTurn + 1) % state.whoamiPlayers.length;
      render();
    }
  });

  wrap.appendChild(panel);
  return wrap;
}

function startWhoamiTimer(){
  stopWhoamiTimer();
  state.whoamiTimerLeft = state.whoamiTimerSeconds;
  state.whoamiTimerHandle = setInterval(()=>{
    state.whoamiTimerLeft -= 1;
    const disp = document.getElementById('wa-timer-display');
    if(disp){
      disp.textContent = state.whoamiTimerLeft;
      disp.classList.toggle('warn', state.whoamiTimerLeft <= 5);
    }
    if(state.whoamiTimerLeft <= 0){ stopWhoamiTimer(); }
  }, 1000);
}
function stopWhoamiTimer(){
  if(state.whoamiTimerHandle){ clearInterval(state.whoamiTimerHandle); state.whoamiTimerHandle = null; }
}

function renderWhoamiEnd(){
  if(state.user && !state.statsRecordedForThisGame){
    state.statsRecordedForThisGame = true;
    recordGameResult(0);
  }

  const wrap = el(`<div class="end-wrap">
    <div class="trophy">🎉</div>
    <h2>انتهت اللعبة</h2>
    <p>ترتيب من خمّن شخصيته أول:</p>
    <div class="panel" style="max-width:400px; margin:0 auto 30px; text-align:right;">
      ${state.whoamiFinishOrder.map((n,i)=>`<div style="padding:8px 0; ${i? 'border-top:1px solid var(--line);':''}">${i+1}. ${escapeAttr(n)}</div>`).join('') || '<div>ما فيه نتائج</div>'}
    </div>
    <div class="btn-row" style="justify-content:center;">
      <button class="btn btn-gold" id="wa-new-round">جولة جديدة — شخصيات جديدة</button>
      <button class="btn btn-ghost" id="wa-new-hub">رجوع للرئيسية</button>
    </div>
  </div>`);

  wrap.querySelector('#wa-new-round').addEventListener('click', ()=>{
    state.statsRecordedForThisGame = false;
    goto('whoami-setup');
  });
  wrap.querySelector('#wa-new-hub').addEventListener('click', ()=>{
    state.statsRecordedForThisGame = false;
    goto('hub');
  });

  return wrap;
}
