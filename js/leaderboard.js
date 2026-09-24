/* ============================ ترتيب الفرق العام ============================ */
/* الفريق يدخل الترتيب بيوزر فريد يكتبه بنهاية اللعبة. التسجيل اختياري:
   اللي يريد يلعب بس، يتجاهل البطاقة ويكمل.

   النقاط تنحسب بالسيرفر على أساس صعوبة كل سؤال (كم فريق جاوبه صح من
   كل اللي شافوه)، فالفرق اللي عمرها ما التقت تنقارن — الأسئلة هي
   الخصم المشترك بينها. */

const TEAM_HANDLES_KEY = 'tajammo.teamHandles.v1';

function loadSavedTeamHandles(){
  try{
    const a = JSON.parse(localStorage.getItem(TEAM_HANDLES_KEY) || '[]');
    if(Array.isArray(a)) return [a[0] || '', a[1] || ''];
  }catch(e){ /* ذاكرة ممنوعة أو تالفة */ }
  return ['', ''];
}

function saveTeamHandles(handles){
  try{ localStorage.setItem(TEAM_HANDLES_KEY, JSON.stringify(handles.slice(0,2))); }
  catch(e){ /* ما تستاهل نوقف عليها */ }
}

/* ---------- بطاقة التسجيل بنهاية اللعبة ---------- */
function renderTeamBoardCard(){
  const answered = (state.gameAnswers || []).length;
  if(!answered) return null;                 // لعبة فئات خاصة بالكامل — ماكو شي ينحسب

  const panel = el(`<div class="panel" style="max-width:520px; margin:0 auto 20px;">
    <div class="section-title">ترتيب الفرق</div>
  </div>`);

  if(!state.user){
    panel.appendChild(el(`<div class="section-sub">
      سجّل دخول حتى تدخل فرقك بترتيب الفرق العام وتشوف مركزها بين كل اللاعبين.
    </div>`));
    const btn = el(`<div class="btn-row" style="justify-content:center;">
      <button class="btn btn-gold btn-sm" id="board-signin">تسجيل الدخول</button>
    </div>`);
    btn.querySelector('#board-signin').addEventListener('click', ()=>{
      state.showAuthModal = true; state.authMode = 'signin'; state.authError = ''; render();
    });
    panel.appendChild(btn);
    return panel;
  }

  /* انسجّلت — نعرض المركز والنقاط اللي زادت */
  if(state.boardResult && Array.isArray(state.boardResult.teams)){
    panel.appendChild(el(`<div class="section-sub">انسجّلت النتيجة 🎉</div>`));
    state.boardResult.teams.forEach(t=>{
      panel.appendChild(el(`<div class="score-row">
        <span>${escapeAttr(t.name)} <small style="color:var(--muted);">@${escapeAttr(t.handle)}</small></span>
        <span class="display">المركز ${t.rank} · +${Math.round(t.gained)}</span>
      </div>`));
    });
    const go = el(`<div class="btn-row" style="justify-content:center;">
      <button class="btn btn-ghost btn-sm" id="board-open">شوف الترتيب الكامل</button>
    </div>`);
    go.querySelector('#board-open').addEventListener('click', ()=> openLeaderboard());
    panel.appendChild(go);
    return panel;
  }

  panel.appendChild(el(`<div class="section-sub">
    اكتبوا يوزر كل فريق حتى تدخل نتيجتكم بالترتيب العام. اليوزر خاص بالفريق وما
    يتكرر — حتى لو اسم فريقكم مثل اسم فريق ثاني. تكدرون تتجاهلونها وتكملون.
  </div>`));

  [0,1].forEach(i=>{
    const f = el(`<div class="field" style="margin-top:12px;">
      <label>يوزر «${escapeAttr(state.teams[i].name)}»</label>
      <input type="text" id="th${i}" dir="ltr" placeholder="مثال: sqour_basra"
             value="${escapeAttr(state.teamHandles[i] || '')}" maxlength="20"/>
    </div>`);
    f.querySelector('input').addEventListener('input', e=>{
      state.teamHandles[i] = normalizeTeamHandle(e.target.value);
    });
    panel.appendChild(f);
  });

  if(state.boardError){
    panel.appendChild(el(`<div class="section-sub" style="color:var(--rose); margin-top:12px;">
      ${escapeAttr(state.boardError)}</div>`));
  }

  const row = el(`<div class="btn-row" style="justify-content:center;">
    <button class="btn btn-gold btn-sm" id="board-submit" ${state.boardBusy?'disabled':''}>
      ${state.boardBusy ? 'دا ينرسل…' : 'سجّل النتيجة'}
    </button>
    <button class="btn btn-ghost btn-sm" id="board-open2">شوف الترتيب</button>
  </div>`);
  row.querySelector('#board-submit').addEventListener('click', submitBoardResult);
  row.querySelector('#board-open2').addEventListener('click', ()=> openLeaderboard());
  panel.appendChild(row);

  return panel;
}

async function submitBoardResult(){
  if(state.boardBusy) return;

  const teams = [];
  for(let i = 0; i < 2; i++){
    const h = normalizeTeamHandle(state.teamHandles[i]);
    if(!h) continue;                                  // فريق ما يريد يسجّل — عادي
    const err = teamHandleError(h);
    if(err){ state.boardError = `«${state.teams[i].name}»: ${err}`; render(); return; }
    teams.push({
      handle: h,
      name: state.teams[i].name,
      answers: (state.gameAnswers || [])
                 .filter(a => a.team === i)
                 .map(a => ({ q: a.q, ok: a.ok }))
    });
  }

  if(!teams.length){ state.boardError = 'اكتب يوزر فريق واحد على الأقل.'; render(); return; }
  if(teams.length === 2 && teams[0].handle === teams[1].handle){
    state.boardError = 'لازم يوزر مختلف لكل فريق.'; render(); return;
  }

  state.boardBusy = true; state.boardError = ''; render();
  try{
    const res = await submitTeamResults(state.gameUid, teams);
    state.boardResult = res;
    saveTeamHandles(teams.map(t=>t.handle));
  }catch(e){
    state.boardError = translateTeamError(e && (e.message || e.code));
  }
  state.boardBusy = false;
  render();
}

/* ---------- شاشة الترتيب ---------- */
function openLeaderboard(){
  goto('leaderboard');
  loadLeaderboardRows();
}

async function loadLeaderboardRows(){
  state.boardLoading = true; state.boardError = ''; render();
  try{
    const mine = loadSavedTeamHandles().filter(Boolean);
    const [top, ours] = await Promise.all([
      fetchTeamLeaderboard(state.boardPeriod, 50, null),
      mine.length ? fetchTeamLeaderboard(state.boardPeriod, 20, mine) : Promise.resolve([])
    ]);
    state.boardRows = top;
    state.boardMine = ours;
  }catch(e){
    state.boardError = 'تعذّر تحميل الترتيب — تأكد من الإنترنت.';
    state.boardRows = [];
    state.boardMine = [];
  }
  state.boardLoading = false;
  render();
}

function accuracyText(r){
  if(!r.answers) return '—';
  return Math.round((r.correct / r.answers) * 100) + '٪';
}

function leaderboardRow(r, highlight){
  const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank;
  return el(`<div class="score-row" ${highlight ? 'style="border-color:var(--gold-dim); background:rgba(212,168,87,0.10);"' : ''}>
    <span style="display:flex; gap:10px; align-items:baseline;">
      <b style="min-width:28px; display:inline-block;">${medal}</b>
      <span>
        ${escapeAttr(r.name)}
        <small style="color:var(--muted); display:block;" dir="ltr">@${escapeAttr(r.handle)}</small>
      </span>
    </span>
    <span class="display" style="text-align:left;">
      ${Math.round(r.score)}
      <small style="color:var(--muted); display:block;">${r.games} لعبة · ${accuracyText(r)}</small>
    </span>
  </div>`);
}

function renderLeaderboard(){
  const wrap = el(`<div></div>`);

  const head = el(`<div class="panel">
    <div class="section-title">ترتيب الفرق</div>
    <div class="section-sub">
      نقاط الفريق = مجموع صعوبات الأسئلة اللي جاوبها صح. السؤال اللي قليل من
      يعرفه ينطي أكثر من سؤال الكل يعرفه.
    </div>
    <div class="btn-row" style="justify-content:center; margin-top:14px;">
      <button class="btn ${state.boardPeriod==='week'?'btn-gold':'btn-ghost'} btn-sm" id="p-week">هذا الأسبوع</button>
      <button class="btn ${state.boardPeriod==='all'?'btn-gold':'btn-ghost'} btn-sm" id="p-all">من البداية</button>
    </div>
  </div>`);
  head.querySelector('#p-week').addEventListener('click', ()=>{
    if(state.boardPeriod === 'week') return;
    state.boardPeriod = 'week'; loadLeaderboardRows();
  });
  head.querySelector('#p-all').addEventListener('click', ()=>{
    if(state.boardPeriod === 'all') return;
    state.boardPeriod = 'all'; loadLeaderboardRows();
  });
  wrap.appendChild(head);

  if(state.boardLoading){
    wrap.appendChild(el(`<div class="panel"><div class="section-sub">دا يحمّل…</div></div>`));
    return wrap;
  }

  if(state.boardError){
    const p = el(`<div class="panel">
      <div class="section-sub" style="color:var(--rose);">${escapeAttr(state.boardError)}</div>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-ghost btn-sm" id="board-retry">جرب مرة ثانية</button>
      </div>
    </div>`);
    p.querySelector('#board-retry').addEventListener('click', ()=> loadLeaderboardRows());
    wrap.appendChild(p);
    return wrap;
  }

  const mine = state.boardMine || [];
  const topHandles = (state.boardRows || []).map(r=>r.handle);
  const missing = mine.filter(r => topHandles.indexOf(r.handle) < 0);
  if(missing.length){
    const box = el(`<div class="panel"><div class="section-title" style="font-size:16px;">فرقكم</div></div>`);
    missing.forEach(r=> box.appendChild(leaderboardRow(r, true)));
    wrap.appendChild(box);
  }

  const list = el(`<div class="panel"></div>`);
  if(!state.boardRows.length){
    list.appendChild(el(`<div class="section-sub">
      ماكو فرق مسجّلة ${state.boardPeriod === 'week' ? 'هذا الأسبوع' : 'بعد'}. العبوا لعبة فئات وسجّلوا فرقكم بالنهاية.
    </div>`));
  } else {
    state.boardRows.forEach(r=>{
      list.appendChild(leaderboardRow(r, mine.some(m=>m.handle === r.handle)));
    });
  }
  wrap.appendChild(list);

  const back = el(`<div class="btn-row" style="justify-content:center;">
    <button class="btn btn-ghost" id="board-hub">رجوع للرئيسية</button>
  </div>`);
  back.querySelector('#board-hub').addEventListener('click', ()=> goto('hub'));
  wrap.appendChild(back);

  return wrap;
}
