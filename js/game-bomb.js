/* ============================ القنبلة الموقوتة ============================
 *
 * تطلع فئة صعبة، والموبايل يمرّ من واحد لواحد. كل لاعب عنده **ثواني
 * معدودة** يكول بيهن كلمة من الفئة ويضغط «مرّرها». الي يخلص وقته يخرج،
 * وآخر واحد صامد يفوز.
 *
 * ليش المؤقت لكل لاعب مو فتيل واحد للجولة كلها:
 * بالفتيل العام، اللاعب يكدر يقعد يفكر براحته ما دام ما انفجرت بيده —
 * فالضغط يجي بالصدفة مو من الأداء. هسه كل واحد عليه نفس الضغط بدوره.
 *
 * والوقت **ينقص مع كل لفة**: أول لفة ٨ ثواني، الثانية ٧، وهكذا لحد الحد
 * الأدنى. بلا هذا الجولة ممكن تدور للأبد بين لاعبين شاطرين.
 *
 * ملاحظة عن الوقت: نعتمد Date.now() مو عدّاد يزيد كل tick، لأن المؤقتات
 * تتأخر أو تنجمّد لمن الشاشة تنطفي أو التطبيق يروح للخلفية.
 */

/* الحروف الي ينتقي منها التطبيق لفئات «يبدأ بحرف ...».
   مقصود ما بيها الحروف النادرة (ث ذ ض ظ غ ء) — عليها كلمات قليلة
   وتخلي الفئة مستحيلة مو صعبة. */
const BOMB_LETTERS = ['ا','ب','ت','ج','ح','د','ر','س','ش','ص','ط','ع','ف','ق','ك','ل','م','ن','ه','و','ي'];

/* يبدّل {حرف} بحرف عشوائي — هيچي نفس الفئة تنلعب مئة مرة وتطلع مختلفة */
function bombPrompt(raw){
  if(!raw) return '';
  if(raw.indexOf('{حرف}') === -1) return raw;
  const L = BOMB_LETTERS[Math.floor(Math.random() * BOMB_LETTERS.length)];
  return raw.split('{حرف}').join('«' + L + '»');
}

function renderBombSetup(){
  const wrap = el(`<div></div>`);

  wrap.appendChild(el(`<div class="panel">
    <div class="section-title">القنبلة الموقوتة</div>
    <div class="section-sub">تطلع فئة صعبة، وكل واحد عنده ثواني معدودة يكول بيهن كلمة منها ويمرّر الموبايل. الي يخلص وقته يخرج، وآخر واحد صامد يفوز. والوقت ينقص مع كل لفة. الفئات تنزل من الإنترنت أول مرة وبعدها تشتغل بلا نت.</div>
  </div>`));

  const countPanel = el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">عدد اللاعبين</div>
    <div style="display:flex; align-items:center; gap:16px; margin-top:10px;">
      <button class="btn btn-ghost btn-sm" id="bo-minus">−</button>
      <span class="display" style="font-size:26px; min-width:30px; text-align:center;">${state.bombPlayerCount}</span>
      <button class="btn btn-ghost btn-sm" id="bo-plus">+</button>
    </div>
  </div>`);
  countPanel.querySelector('#bo-minus').addEventListener('click', ()=>{
    if(state.bombPlayerCount > 3){ state.bombPlayerCount--; render(); }
  });
  countPanel.querySelector('#bo-plus').addEventListener('click', ()=>{
    if(state.bombPlayerCount < 12){ state.bombPlayerCount++; render(); }
  });
  wrap.appendChild(countPanel);

  const namesPanel = el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">أسماء اللاعبين (اختياري)</div>
    <div class="section-sub">لازم نعرف الأسماء حتى نعرف منو خلص وقته</div>
    <div id="bo-names" style="display:grid; gap:10px;"></div>
  </div>`);
  const namesList = namesPanel.querySelector('#bo-names');
  for(let i=0;i<state.bombPlayerCount;i++){
    const row = el(`<input type="text" placeholder="اللاعب ${i+1}" value="${escapeAttr(state.bombPlayerNames[i]||'')}"/>`);
    row.addEventListener('input', e=>{ state.bombPlayerNames[i] = e.target.value; });
    namesList.appendChild(row);
  }
  wrap.appendChild(namesPanel);

  const timePanel = el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">الوقت</div>
    <div class="field" style="margin-top:12px;">
      <label>ثواني لكل لاعب</label>
      <input type="number" id="bo-turn" min="3" max="20" value="${state.bombTurnSec}"/>
    </div>
    <div class="toggle-row" style="margin-top:16px;">
      <span>الوقت ينقص ثانية كل لفة</span>
      <div class="switch ${state.bombShrink?'on':''}" id="bo-shrink"><div class="knob"></div></div>
    </div>
    <div class="section-sub">${state.bombShrink
      ? `يبدي بـ${state.bombTurnSec} ثانية وينزل لحد ${state.bombFloorSec} — الجولة تتصاعد وما تدور للأبد`
      : 'كل الأدوار بنفس المدة'}</div>
  </div>`);
  timePanel.querySelector('#bo-turn').addEventListener('input', e=>{
    state.bombTurnSec = Math.min(20, Math.max(3, parseInt(e.target.value||'8',10)));
  });
  timePanel.querySelector('#bo-shrink').addEventListener('click', ()=>{
    state.bombShrink = !state.bombShrink; render();
  });
  wrap.appendChild(timePanel);

  if(state.bombError){
    wrap.appendChild(el(`<div class="section-sub" style="color:var(--rose);">${escapeAttr(state.bombError)}</div>`));
  }

  const actions = el(`<div class="btn-row">
    <button class="btn btn-gold" id="bo-start" ${state.bombLoading?'disabled':''}>${state.bombLoading?'...جاري التحضير':'ابدأ اللعبة'}</button>
    <button class="btn btn-ghost" id="bo-back">رجوع</button>
  </div>`);
  actions.querySelector('#bo-back').addEventListener('click', ()=> goto('hub'));
  actions.querySelector('#bo-start').addEventListener('click', async ()=>{
    state.bombLoading = true; state.bombError=''; render();
    const ok = await ensurePartyItems('bomb');
    state.bombLoading = false;
    if(!ok){
      state.bombError = 'تعذّر تحميل الفئات — تأكد من اتصال الإنترنت أول مرة، وبعدها تشتغل اللعبة بلا نت.';
      render(); return;
    }
    /* أول لمسة من المستخدم — هنا ننشئ AudioContext، لأن iOS يرفض
       أي صوت ما جاي من تفاعل مباشر */
    partyAudio();
    state.bombPlayers = [];
    for(let i=0;i<state.bombPlayerCount;i++){
      state.bombPlayers.push({
        name: (state.bombPlayerNames[i]||'').trim() || `اللاعب ${i+1}`,
        out: false
      });
    }
    state.bombKnockedOut = [];
    startBombRound();
  });
  wrap.appendChild(actions);

  return wrap;
}

function bombAlivePlayers(){
  return state.bombPlayers.filter(p=>!p.out);
}

/* المسموح بالدور الحالي بالملي ثانية */
function bombAllowMs(){
  const cut = state.bombShrink ? state.bombLap : 0;
  const sec = Math.max(state.bombFloorSec, state.bombTurnSec - cut);
  return sec * 1000;
}

function startBombRound(){
  const alive = bombAlivePlayers();
  if(alive.length <= 1){
    state.bombWinner = alive.length ? alive[0].name : null;
    goto('bomb-end');
    return;
  }
  state.bombCategory = bombPrompt(pickPartyItems('bomb', 1)[0] || 'اذكر أكلة عراقية');
  state.bombLap = 0;
  state.bombPasses = 0;
  state.bombExploded = false;
  state.bombLoserIndex = null;
  state.bombCurrent = state.bombPlayers.findIndex(p=>!p.out);
  goto('bomb-play');
  startBombTurn();
}

/* يبدي دور لاعب: يحدد لحظة النهاية ويشغّل العدّاد */
function startBombTurn(){
  stopBombTicker();
  state.bombDeadline = Date.now() + bombAllowMs();
  state.bombLastTickSec = -1;
  paintBombTimer();
  state.bombHandle = setInterval(bombTick, 100);
}

function bombTick(){
  if(state.bombExploded) return;
  const leftMs = state.bombDeadline - Date.now();
  if(leftMs <= 0){ bombExplode(); return; }
  const sec = Math.ceil(leftMs / 1000);
  if(sec !== state.bombLastTickSec){
    state.bombLastTickSec = sec;
    /* التكّة تعلى كل ما يقرب الصفر */
    playTick(sec <= 3 ? 1150 : 760);
  }
  paintBombTimer();
}

function paintBombTimer(){
  const leftMs = Math.max(0, state.bombDeadline - Date.now());
  const disp = document.getElementById('bo-timer');
  if(disp){
    disp.textContent = Math.ceil(leftMs / 1000);
    disp.classList.toggle('warn', leftMs <= 3000);
  }
  const bar = document.getElementById('bo-bar');
  if(bar){
    const pct = Math.max(0, Math.min(100, (leftMs / bombAllowMs()) * 100));
    bar.style.width = pct + '%';
  }
}

function stopBombTicker(){
  if(state.bombHandle){ clearInterval(state.bombHandle); state.bombHandle = null; }
}

/* مرّر الموبايل للي بعده ويبدي وقته من جديد */
function bombAdvance(){
  if(state.bombExploded) return;
  const alive = bombAlivePlayers().length;
  let i = state.bombCurrent;
  for(let k=0;k<state.bombPlayers.length;k++){
    i = (i + 1) % state.bombPlayers.length;
    if(!state.bombPlayers[i].out){ state.bombCurrent = i; break; }
  }
  state.bombPasses++;
  /* كملت لفة على كل الصامدين → ننقص الوقت */
  if(alive > 0 && state.bombPasses % alive === 0) state.bombLap++;

  const holder = document.getElementById('bo-holder');
  if(holder) holder.textContent = state.bombPlayers[state.bombCurrent].name;
  const lap = document.getElementById('bo-lap');
  if(lap) lap.textContent = Math.round(bombAllowMs()/1000);

  startBombTurn();
}

function bombExplode(){
  stopBombTicker();
  state.bombExploded = true;
  state.bombLoserIndex = state.bombCurrent;
  playBoom();
  const loser = state.bombPlayers[state.bombLoserIndex];
  if(loser){
    loser.out = true;
    state.bombKnockedOut.push(loser.name);
  }
  goto('bomb-out');
}

function renderBombPlay(){
  const wrap = el(`<div></div>`);
  const holder = state.bombPlayers[state.bombCurrent];

  const panel = el(`<div class="panel bomb-panel" style="text-align:center;">
    <div class="section-sub">الفئة</div>
    <div class="bomb-category">${escapeAttr(state.bombCategory)}</div>

    <div class="bomb-timer" id="bo-timer">${Math.round(bombAllowMs()/1000)}</div>
    <div class="bomb-bar-track"><div class="bomb-bar" id="bo-bar"></div></div>

    <div class="section-sub" style="margin-top:14px;">الدور على</div>
    <div class="bomb-holder" id="bo-holder">${escapeAttr(holder ? holder.name : '')}</div>

    <button class="bomb-pass" id="bo-pass">قلتها — مرّرها</button>
    <div class="section-sub" style="margin-top:14px;">
      ${state.bombShrink ? `<span id="bo-lap">${Math.round(bombAllowMs()/1000)}</span> ثانية لكل دور — وتنقص كل لفة` : 'ثواني ثابتة لكل دور'}
    </div>
  </div>`);

  panel.querySelector('#bo-pass').addEventListener('click', ()=>{
    playTick(1500);
    bombAdvance();
  });

  wrap.appendChild(panel);

  const alive = bombAlivePlayers();
  wrap.appendChild(el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">الصامدون (${alive.length})</div>
    <div class="place-grid">
      ${state.bombPlayers.map(p=>`<span class="place-chip ${p.out?'out':''}">${escapeAttr(p.name)}</span>`).join('')}
    </div>
  </div>`));

  return wrap;
}

function renderBombOut(){
  const loser = state.bombPlayers[state.bombLoserIndex];
  const alive = bombAlivePlayers();

  const wrap = el(`<div class="end-wrap">
    <div class="trophy boom">💥</div>
    <h2>خلص وقت ${escapeAttr(loser ? loser.name : '')}</h2>
    <p>${alive.length > 1 ? `باقي ${alive.length} لاعبين` : 'وهذا آخر واحد خرج'}</p>
  </div>`);

  const actions = el(`<div class="btn-row" style="justify-content:center;">
    <button class="btn btn-gold" id="bo-next">${alive.length > 1 ? 'الجولة الجاية' : 'شوف الفائز'}</button>
    <button class="btn btn-ghost" id="bo-quit">إنهاء اللعبة</button>
  </div>`);
  actions.querySelector('#bo-next').addEventListener('click', ()=> startBombRound());
  actions.querySelector('#bo-quit').addEventListener('click', ()=>{
    state.bombWinner = null;
    goto('bomb-end');
  });
  wrap.appendChild(actions);

  return wrap;
}

function renderBombEnd(){
  stopBombTicker();
  if(state.user && !state.statsRecordedForThisGame){
    state.statsRecordedForThisGame = true;
    recordGameResult(0);
  }

  /* ترتيب الخروج بالمقلوب = ترتيب الفوز */
  const order = [];
  if(state.bombWinner) order.push(state.bombWinner);
  for(let i = state.bombKnockedOut.length - 1; i >= 0; i--){
    order.push(state.bombKnockedOut[i]);
  }

  const wrap = el(`<div class="end-wrap">
    <div class="trophy">🏆</div>
    <h2>${state.bombWinner ? 'الفائز: ' + escapeAttr(state.bombWinner) : 'انتهت اللعبة'}</h2>
    <div class="panel" style="max-width:400px; margin:0 auto 24px; text-align:right;">
      ${order.map((n,i)=>`<div class="score-row"><span>${i+1}. ${escapeAttr(n)}</span></div>`).join('') || '<div class="section-sub">ماكو نتائج</div>'}
    </div>
  </div>`);

  const actions = el(`<div class="btn-row" style="justify-content:center;">
    <button class="btn btn-gold" id="bo-again">لعبة جديدة</button>
    <button class="btn btn-ghost" id="bo-hub">رجوع للرئيسية</button>
  </div>`);
  actions.querySelector('#bo-again').addEventListener('click', ()=>{
    state.statsRecordedForThisGame = false;
    goto('bomb-setup');
  });
  actions.querySelector('#bo-hub').addEventListener('click', ()=>{
    state.statsRecordedForThisGame = false;
    goto('hub');
  });
  wrap.appendChild(actions);

  return wrap;
}
