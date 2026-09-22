/* ============================ القنبلة الموقوتة ============================
 *
 * تطلع فئة («اذكر فاكهة»)، والموبايل يمرّ من واحد لواحد: كل واحد يكول
 * كلمة بسرعة ويضغط «مرّرها». جوّه التطبيق فتيل عشوائي مخفي — ماكو أحد
 * يعرف شكد باقي، ولا التطبيق يبيّنه. الي بيده الموبايل لمن ينفجر يخرج.
 *
 * ليش لازم التطبيق: العشوائية المخفية. لو تستخدمون ساعة عادية، الكل
 * يشوف الوقت ويموت التوتر — وهذا كل معنى اللعبة.
 *
 * ملاحظة عن الوقت: نعتمد على Date.now() مو على عدّاد يزيد كل tick، لأن
 * setInterval يتأخر أو ينجمّد لمن الشاشة تنطفي أو التطبيق يروح للخلفية،
 * والفتيل لازم يمشي بالوقت الحقيقي.
 */

function renderBombSetup(){
  const wrap = el(`<div></div>`);

  wrap.appendChild(el(`<div class="panel">
    <div class="section-title">القنبلة الموقوتة</div>
    <div class="section-sub">تطلع فئة، وكل واحد يكول كلمة منها بسرعة ويمرّر الموبايل. الفتيل مخفي وعشوائي — الي بيده الموبايل لمن ينفجر يخرج، وآخر واحد صامد يفوز. الفئات تنزل من الإنترنت أول مرة وبعدها تشتغل بلا نت.</div>
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
    <div class="section-sub">لازم نعرف الأسماء حتى نعرف منو انفجرت بيده</div>
    <div id="bo-names" style="display:grid; gap:10px;"></div>
  </div>`);
  const namesList = namesPanel.querySelector('#bo-names');
  for(let i=0;i<state.bombPlayerCount;i++){
    const row = el(`<input type="text" placeholder="اللاعب ${i+1}" value="${escapeAttr(state.bombPlayerNames[i]||'')}"/>`);
    row.addEventListener('input', e=>{ state.bombPlayerNames[i] = e.target.value; });
    namesList.appendChild(row);
  }
  wrap.appendChild(namesPanel);

  const fusePanel = el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">طول الفتيل</div>
    <div class="section-sub">التطبيق يختار رقم عشوائي بين الحدّين — وما يبيّنه لأحد</div>
    <div class="field" style="margin-top:12px;">
      <label>أقل مدة (ثانية)</label>
      <input type="number" id="bo-min" min="10" max="120" value="${state.bombMinSec}"/>
    </div>
    <div class="field" style="margin-top:12px;">
      <label>أكثر مدة (ثانية)</label>
      <input type="number" id="bo-max" min="15" max="180" value="${state.bombMaxSec}"/>
    </div>
  </div>`);
  fusePanel.querySelector('#bo-min').addEventListener('input', e=>{
    state.bombMinSec = Math.min(120, Math.max(10, parseInt(e.target.value||'20',10)));
  });
  fusePanel.querySelector('#bo-max').addEventListener('input', e=>{
    state.bombMaxSec = Math.min(180, Math.max(15, parseInt(e.target.value||'60',10)));
  });
  wrap.appendChild(fusePanel);

  if(state.bombError){
    wrap.appendChild(el(`<div class="section-sub" style="color:var(--rose);">${escapeAttr(state.bombError)}</div>`));
  }

  const actions = el(`<div class="btn-row">
    <button class="btn btn-gold" id="bo-start" ${state.bombLoading?'disabled':''}>${state.bombLoading?'...جاري التحضير':'ابدأ اللعبة'}</button>
    <button class="btn btn-ghost" id="bo-back">رجوع</button>
  </div>`);
  actions.querySelector('#bo-back').addEventListener('click', ()=> goto('hub'));
  actions.querySelector('#bo-start').addEventListener('click', async ()=>{
    if(state.bombMaxSec <= state.bombMinSec){
      state.bombError = 'أكثر مدة لازم تكون أكبر من أقل مدة.';
      render(); return;
    }
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

function startBombRound(){
  const alive = bombAlivePlayers();
  if(alive.length <= 1){
    state.bombWinner = alive.length ? alive[0].name : null;
    goto('bomb-end');
    return;
  }
  state.bombCategory = pickPartyItems('bomb', 1)[0] || 'اذكر فاكهة';
  /* الفتيل: رقم عشوائي بالمدى الي اختاره اللاعب. ما ينعرض أبداً. */
  const span = (state.bombMaxSec - state.bombMinSec) * 1000;
  state.bombFuseMs = state.bombMinSec * 1000 + Math.random() * span;
  state.bombStartAt = Date.now();
  state.bombExploded = false;
  state.bombLoserIndex = null;
  /* نبدي من أول لاعب صامد */
  state.bombCurrent = state.bombPlayers.findIndex(p=>!p.out);
  goto('bomb-play');
  startBombTicker();
}

function bombAdvance(){
  if(state.bombExploded) return;
  let i = state.bombCurrent;
  for(let k=0;k<state.bombPlayers.length;k++){
    i = (i + 1) % state.bombPlayers.length;
    if(!state.bombPlayers[i].out){ state.bombCurrent = i; break; }
  }
  const holder = document.getElementById('bo-holder');
  if(holder) holder.textContent = state.bombPlayers[state.bombCurrent].name;
}

function startBombTicker(){
  stopBombTicker();
  const tick = ()=>{
    if(state.bombExploded) return;
    const elapsed = Date.now() - state.bombStartAt;
    const left = state.bombFuseMs - elapsed;
    if(left <= 0){ bombExplode(); return; }
    /* التكّات تتسارع كل ما يقرب الانفجار — بس بلا ما تكشف الوقت الحقيقي،
       لأن المدى نفسه عشوائي وما أحد يعرف من وين بدت */
    const frac = Math.max(0, Math.min(1, left / state.bombFuseMs));
    const delay = 140 + frac * 620;
    playTick(700 + (1 - frac) * 500);
    state.bombHandle = setTimeout(tick, delay);
  };
  state.bombHandle = setTimeout(tick, 400);
}

function stopBombTicker(){
  if(state.bombHandle){ clearTimeout(state.bombHandle); state.bombHandle = null; }
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
    <div class="section-sub" style="margin-top:18px;">بيد</div>
    <div class="bomb-holder" id="bo-holder">${escapeAttr(holder ? holder.name : '')}</div>
    <button class="bomb-pass" id="bo-pass">قلتها — مرّرها</button>
    <div class="section-sub" style="margin-top:16px;">الفتيل مخفي — ماكو أحد يعرف شكد باقي</div>
  </div>`);

  panel.querySelector('#bo-pass').addEventListener('click', ()=>{
    playTick(1200);
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
    <h2>انفجرت بيد ${escapeAttr(loser ? loser.name : '')}</h2>
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
