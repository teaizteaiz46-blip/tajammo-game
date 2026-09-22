/* ============================ من الدخيل؟ ============================
 *
 * كل اللاعبين يشوفون نفس المكان إلا واحد (أو اثنين) يشوفون «أنت الدخيل».
 * يبدون يسألون بعض أسئلة عن المكان: الدخيل يحاول ما ينكشف، والباقي
 * يحاولون يكشفونه. بالنهاية تصويت.
 *
 * ليش لازم التطبيق: توزيع سر مختلف لكل لاعب على نفس الجهاز — شي مستحيل
 * بورقة وقلم.
 *
 * قائمة الأماكن المحتملة تنعرض للكل أثناء النقاش (SPY_POOL_SIZE مكان من
 * ضمنهم المكان الحقيقي). بلاها الدخيل ما عنده أي فرصة يخمّن، وتصير
 * اللعبة ظالمة.
 */

const SPY_POOL_SIZE = 12;

function spySuggestedSpies(count){
  return count >= 7 ? 2 : 1;
}

function renderSpySetup(){
  const wrap = el(`<div></div>`);

  wrap.appendChild(el(`<div class="panel">
    <div class="section-title">من الدخيل؟</div>
    <div class="section-sub">كلكم تشوفون نفس المكان — إلا واحد يطلع له «أنت الدخيل». تتناوبون تسألون بعض أسئلة عن المكان، والدخيل يحاول يجاوب بلا ما ينكشف. بالنهاية تصوّتون. الكلمات تنزل من الإنترنت أول مرة وبعدها تشتغل بلا نت.</div>
  </div>`));

  const countPanel = el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">عدد اللاعبين</div>
    <div style="display:flex; align-items:center; gap:16px; margin-top:10px;">
      <button class="btn btn-ghost btn-sm" id="sp-minus">−</button>
      <span class="display" style="font-size:26px; min-width:30px; text-align:center;">${state.spyPlayerCount}</span>
      <button class="btn btn-ghost btn-sm" id="sp-plus">+</button>
    </div>
  </div>`);
  countPanel.querySelector('#sp-minus').addEventListener('click', ()=>{
    if(state.spyPlayerCount > 4){
      state.spyPlayerCount--;
      state.spySpyCount = Math.min(state.spySpyCount, spySuggestedSpies(state.spyPlayerCount));
      render();
    }
  });
  countPanel.querySelector('#sp-plus').addEventListener('click', ()=>{
    if(state.spyPlayerCount < 12){ state.spyPlayerCount++; render(); }
  });
  wrap.appendChild(countPanel);

  const namesPanel = el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">أسماء اللاعبين (اختياري)</div>
    <div class="section-sub">لو تركتها فاضية، بنسميهم "اللاعب ١"، "اللاعب ٢"...</div>
    <div id="sp-names" style="display:grid; gap:10px;"></div>
  </div>`);
  const namesList = namesPanel.querySelector('#sp-names');
  for(let i=0;i<state.spyPlayerCount;i++){
    const row = el(`<input type="text" placeholder="اللاعب ${i+1}" value="${escapeAttr(state.spyPlayerNames[i]||'')}"/>`);
    row.addEventListener('input', e=>{ state.spyPlayerNames[i] = e.target.value; });
    namesList.appendChild(row);
  }
  wrap.appendChild(namesPanel);

  const optPanel = el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">إعدادات الجولة</div>
    <div class="toggle-row" style="margin-top:8px;">
      <span>عدد الدخلاء</span>
      <div style="display:flex; align-items:center; gap:14px;">
        <button class="btn btn-ghost btn-sm" id="sp-spy-minus">−</button>
        <span class="display" style="font-size:20px; min-width:20px; text-align:center;">${state.spySpyCount}</span>
        <button class="btn btn-ghost btn-sm" id="sp-spy-plus">+</button>
      </div>
    </div>
    <div class="section-sub">${state.spyPlayerCount >= 7 ? 'مع ٧ لاعبين فأكثر، دخيلين يخلون اللعبة أمتع.' : 'دخيل واحد يكفي لهذا العدد.'}</div>
    <div class="field" style="margin-top:14px;">
      <label>مدة النقاش (بالدقائق)</label>
      <input type="number" id="sp-minutes" min="2" max="15" value="${state.spyMinutes}"/>
    </div>
  </div>`);
  optPanel.querySelector('#sp-spy-minus').addEventListener('click', ()=>{
    if(state.spySpyCount > 1){ state.spySpyCount--; render(); }
  });
  optPanel.querySelector('#sp-spy-plus').addEventListener('click', ()=>{
    /* لازم يبقى غير الدخلاء أكثر منهم، وإلا ماكو لعبة */
    if(state.spySpyCount < 2 && state.spyPlayerCount >= 7){ state.spySpyCount++; render(); }
  });
  optPanel.querySelector('#sp-minutes').addEventListener('input', e=>{
    state.spyMinutes = Math.min(15, Math.max(2, parseInt(e.target.value||'6',10)));
  });
  wrap.appendChild(optPanel);

  if(state.spyError){
    wrap.appendChild(el(`<div class="section-sub" style="color:var(--rose);">${escapeAttr(state.spyError)}</div>`));
  }

  const actions = el(`<div class="btn-row">
    <button class="btn btn-gold" id="sp-start" ${state.spyLoading?'disabled':''}>${state.spyLoading?'...جاري التحضير':'ابدأ التوزيع'}</button>
    <button class="btn btn-ghost" id="sp-back">رجوع</button>
  </div>`);
  actions.querySelector('#sp-back').addEventListener('click', ()=> goto('hub'));
  actions.querySelector('#sp-start').addEventListener('click', async ()=>{
    state.spyLoading = true; state.spyError=''; render();
    const ok = await ensurePartyItems('spy');
    state.spyLoading = false;
    if(!ok){
      state.spyError = 'تعذّر تحميل الأماكن — تأكد من اتصال الإنترنت أول مرة، وبعدها تشتغل اللعبة بلا نت.';
      render(); return;
    }
    startSpyRound();
  });
  wrap.appendChild(actions);

  if(Object.keys(state.spyScores).length){
    wrap.appendChild(renderSpyScoreboard('النقاط من الجولات السابقة'));
  }

  return wrap;
}

function startSpyRound(){
  const n = state.spyPlayerCount;
  const pool = pickPartyItems('spy', SPY_POOL_SIZE);
  const place = pool[Math.floor(Math.random()*pool.length)];

  const spies = [];
  while(spies.length < Math.min(state.spySpyCount, n-2)){
    const i = Math.floor(Math.random()*n);
    if(spies.indexOf(i) === -1) spies.push(i);
  }

  state.spyPool = pool;
  state.spyPlace = place;
  state.spyPlayers = [];
  for(let i=0;i<n;i++){
    const nm = (state.spyPlayerNames[i]||'').trim() || `اللاعب ${i+1}`;
    state.spyPlayers.push({ name: nm, isSpy: spies.indexOf(i) !== -1 });
    if(state.spyScores[nm] === undefined) state.spyScores[nm] = 0;
  }
  state.spyRevealIndex = 0;
  state.spyRevealShown = false;
  state.spyVotes = {};
  state.spyVoteIndex = 0;
  state.spyRoundResult = null;
  goto('spy-reveal');
}

function renderSpyReveal(){
  const wrap = el(`<div></div>`);
  const idx = state.spyRevealIndex;
  const player = state.spyPlayers[idx];

  if(!player){
    const done = el(`<div class="panel" style="text-align:center;">
      <div class="section-title" style="justify-content:center;">كلكم شفتوا ورقتكم ✓</div>
      <div class="section-sub">حطوا الموبايل بالنص وابدوا تسألون بعض</div>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="sp-go-play">ابدأ النقاش</button>
      </div>
    </div>`);
    done.querySelector('#sp-go-play').addEventListener('click', ()=>{
      goto('spy-play');
      startSpyTimer();
    });
    wrap.appendChild(done);
    return wrap;
  }

  const panel = el(`<div class="panel" style="text-align:center;">
    <div class="section-title" style="justify-content:center;">الموبايل لـ ${escapeAttr(player.name)}</div>
    <div class="section-sub">${state.spyRevealShown ? 'احفظها وانطِ الموبايل للي بعدك' : 'لا تخلي أحد يشوف الشاشة غيرك'}</div>
    ${state.spyRevealShown ? `
      <div class="secret-card ${player.isSpy?'spy':''}">
        ${player.isSpy
          ? `<div class="secret-title">أنت الدخيل</div>
             <div class="secret-sub">ما تعرف المكان — اسمع وجاوب بحذر، وحاول تخمّنه</div>`
          : `<div class="secret-sub">المكان</div>
             <div class="secret-title">${escapeAttr(state.spyPlace)}</div>`}
      </div>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="sp-next">خلصت — التالي</button>
      </div>
    ` : `
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="sp-show">إظهار ورقتي</button>
      </div>
    `}
  </div>`);

  const showBtn = panel.querySelector('#sp-show');
  if(showBtn) showBtn.addEventListener('click', ()=>{ state.spyRevealShown = true; render(); });
  const nextBtn = panel.querySelector('#sp-next');
  if(nextBtn) nextBtn.addEventListener('click', ()=>{
    state.spyRevealIndex++;
    state.spyRevealShown = false;
    render();
  });

  wrap.appendChild(panel);
  return wrap;
}

function spyClock(sec){
  const m = Math.floor(Math.max(0,sec)/60), s = Math.max(0,sec)%60;
  return m + ':' + (s<10?'0':'') + s;
}

function startSpyTimer(){
  stopSpyTimer();
  state.spyTimerLeft = state.spyMinutes * 60;
  state.spyTimerHandle = setInterval(()=>{
    state.spyTimerLeft -= 1;
    const disp = document.getElementById('sp-timer');
    if(disp){
      disp.textContent = spyClock(state.spyTimerLeft);
      disp.classList.toggle('warn', state.spyTimerLeft <= 30);
    }
    if(state.spyTimerLeft <= 0){
      stopSpyTimer();
      if(state.screen === 'spy-play'){ goto('spy-vote'); }
    }
  }, 1000);
}
function stopSpyTimer(){
  if(state.spyTimerHandle){ clearInterval(state.spyTimerHandle); state.spyTimerHandle = null; }
}

function renderSpyPlay(){
  const wrap = el(`<div></div>`);

  const panel = el(`<div class="panel" style="text-align:center;">
    <div class="section-title" style="justify-content:center;">وقت الأسئلة</div>
    <div class="section-sub">كل واحد يسأل الي بعده سؤال عن المكان، والثاني لازم يجاوب</div>
    <div class="timer" id="sp-timer">${spyClock(state.spyTimerLeft)}</div>
    <div class="btn-row" style="justify-content:center;">
      <button class="btn btn-gold" id="sp-vote-now">خلص — نصوّت</button>
    </div>
  </div>`);
  panel.querySelector('#sp-vote-now').addEventListener('click', ()=>{
    stopSpyTimer();
    goto('spy-vote');
  });
  wrap.appendChild(panel);

  const places = el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">الأماكن المحتملة</div>
    <div class="section-sub">المكان الحقيقي واحد من هذولا — الدخيل يشوفها هم، وهذا الي ينطيه فرصة يخمّن</div>
    <div class="place-grid">
      ${state.spyPool.map(p=>`<span class="place-chip">${escapeAttr(p)}</span>`).join('')}
    </div>
  </div>`);
  wrap.appendChild(places);

  return wrap;
}

function renderSpyVote(){
  const wrap = el(`<div></div>`);
  const idx = state.spyVoteIndex;
  const voter = state.spyPlayers[idx];

  if(!voter){
    return renderSpyVoteDone(wrap);
  }

  const panel = el(`<div class="panel" style="text-align:center;">
    <div class="section-title" style="justify-content:center;">صوت ${escapeAttr(voter.name)}</div>
    <div class="section-sub">منو تشك بيه؟ صوّت بالسر وانطِ الموبايل للي بعدك</div>
    <div class="vote-grid" id="sp-vote-grid"></div>
  </div>`);

  const grid = panel.querySelector('#sp-vote-grid');
  state.spyPlayers.forEach((p, i)=>{
    if(i === idx) return;   // ما ينفع يصوّت على نفسه
    const b = el(`<button class="btn btn-ghost vote-btn">${escapeAttr(p.name)}</button>`);
    b.addEventListener('click', ()=>{
      state.spyVotes[idx] = i;
      state.spyVoteIndex++;
      render();
    });
    grid.appendChild(b);
  });

  wrap.appendChild(panel);
  return wrap;
}

function spyTally(){
  const counts = {};
  Object.keys(state.spyVotes).forEach(k=>{
    const t = state.spyVotes[k];
    counts[t] = (counts[t]||0) + 1;
  });
  let best = -1, bestN = -1, tie = false;
  Object.keys(counts).forEach(k=>{
    const n = counts[k];
    if(n > bestN){ best = parseInt(k,10); bestN = n; tie = false; }
    else if(n === bestN){ tie = true; }
  });
  return { counts, accused: tie ? -1 : best, tie: tie };
}

function renderSpyVoteDone(wrap){
  const t = spyTally();
  const accusedIsSpy = t.accused >= 0 && state.spyPlayers[t.accused].isSpy;

  const panel = el(`<div class="panel" style="text-align:center;">
    <div class="section-title" style="justify-content:center;">خلص التصويت</div>
    ${t.tie
      ? `<div class="section-sub">تعادل بالأصوات — ماكو متهم واضح، الدخيل نجا</div>`
      : `<div class="section-sub">الأغلبية شكّت بـ</div>
         <div class="secret-card"><div class="secret-title">${escapeAttr(state.spyPlayers[t.accused].name)}</div></div>`}
    <div class="section-sub" style="margin-top:14px;">قبل الكشف: خلّي الدخيل يخمّن المكان لو يريد</div>
    <div class="btn-row" style="justify-content:center; flex-wrap:wrap;">
      <button class="btn btn-gold" id="sp-guess-yes">الدخيل خمّن المكان صح</button>
      <button class="btn btn-ghost" id="sp-guess-no">ما خمّنه</button>
    </div>
  </div>`);

  const finish = (spyGuessedRight)=>{
    state.spyRoundResult = {
      accused: t.accused,
      tie: t.tie,
      caught: accusedIsSpy,
      spyGuessedRight: spyGuessedRight
    };
    applySpyScores(state.spyRoundResult);
    goto('spy-result');
  };
  panel.querySelector('#sp-guess-yes').addEventListener('click', ()=> finish(true));
  panel.querySelector('#sp-guess-no').addEventListener('click', ()=> finish(false));

  wrap.appendChild(panel);
  return wrap;
}

/* النقاط: الباقي +١ لكل واحد لو انكشف الدخيل · الدخيل +٢ لو نجا
   · و+٢ زيادة لو خمّن المكان صح (حتى لو انكشف) */
function applySpyScores(res){
  state.spyPlayers.forEach(p=>{
    if(state.spyScores[p.name] === undefined) state.spyScores[p.name] = 0;
  });
  if(res.caught){
    state.spyPlayers.forEach(p=>{ if(!p.isSpy) state.spyScores[p.name] += 1; });
  } else {
    state.spyPlayers.forEach(p=>{ if(p.isSpy) state.spyScores[p.name] += 2; });
  }
  if(res.spyGuessedRight){
    state.spyPlayers.forEach(p=>{ if(p.isSpy) state.spyScores[p.name] += 2; });
  }
}

function renderSpyScoreboard(title){
  const rows = Object.keys(state.spyScores)
    .map(n=>({name:n, pts:state.spyScores[n]}))
    .sort((a,b)=> b.pts - a.pts);
  return el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">${escapeAttr(title||'النقاط')}</div>
    ${rows.map((r,i)=>`<div class="score-row">
      <span>${i+1}. ${escapeAttr(r.name)}</span><span class="display">${r.pts}</span>
    </div>`).join('') || '<div class="section-sub">ماكو نقاط بعد</div>'}
  </div>`);
}

function renderSpyResult(){
  /* نسجّل مرة وحدة بالجلسة، مو كل جولة — الجولات تتكرر بنفس اللعبة */
  if(state.user && !state.statsRecordedForThisGame){
    state.statsRecordedForThisGame = true;
    recordGameResult(0);
  }

  const res = state.spyRoundResult || {};
  const spies = state.spyPlayers.filter(p=>p.isSpy).map(p=>p.name);

  const wrap = el(`<div class="end-wrap">
    <div class="trophy">${res.caught ? '🔍' : '🕵️'}</div>
    <h2>${res.caught ? 'انكشف الدخيل' : 'الدخيل نجا'}</h2>
    <div class="panel" style="max-width:420px; margin:0 auto 20px;">
      <div class="section-sub">المكان كان</div>
      <div class="secret-title" style="margin-bottom:16px;">${escapeAttr(state.spyPlace)}</div>
      <div class="section-sub">${spies.length>1?'الدخلاء':'الدخيل'}</div>
      <div class="secret-title" style="color:var(--rose);">${spies.map(escapeAttr).join(' · ')}</div>
      ${res.spyGuessedRight ? '<div class="section-sub" style="margin-top:14px;">وخمّن المكان صح — نقطتين زيادة</div>' : ''}
    </div>
  </div>`);

  wrap.appendChild(renderSpyScoreboard('النقاط'));

  const actions = el(`<div class="btn-row" style="justify-content:center;">
    <button class="btn btn-gold" id="sp-again">جولة جديدة — مكان جديد</button>
    <button class="btn btn-ghost" id="sp-hub">رجوع للرئيسية</button>
  </div>`);
  actions.querySelector('#sp-again').addEventListener('click', ()=> startSpyRound());
  actions.querySelector('#sp-hub').addEventListener('click', ()=>{
    stopSpyTimer();
    goto('hub');
  });
  wrap.appendChild(actions);

  return wrap;
}
