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

/* ---------- التبليغ والحظر (App Store 1.2) ----------
   أسماء الفرق يكتبها اللاعبين ويشوفها الكل، فهي محتوى مستخدمين مثل
   الفئات الخاصة ولازم تمر بنفس الحمايات الثلاث:
   - الفلترة: بالسيرفر (submit_team_results ← first_banned_term)
   - التبليغ: ⚑ بكل صف ← report_team، وينخفي بعد بلاغات ٣ حسابات
   - الحظر: نفس قائمة حظر الناشرين. owner_key = نفس بصمة author_key،
     فحظر شخص من الترتيب يشيل فئاته الخاصة هم، والعكس. */
/* تنحسب وقت الاستخدام مو وقت التحميل: هذا الملف ينحمّل قبل custom-topics.js
   اللي يعرّف REPORT_REASONS، فلو انحسبت هنا تطلع ReferenceError وتنكسر النافذة.
   «أجوبة غلط» ما إلها معنى لاسم فريق، فنشيلها. */
function teamReportReasons(){
  return REPORT_REASONS.filter(([key]) => key !== 'wrong');
}

function isMyTeamRow(r){
  return loadSavedTeamHandles().indexOf(r.handle) >= 0;
}

function visibleBoardRows(rows){
  return (rows || []).filter(r => !isAuthorBlocked(r.owner_key));
}

function openTeamReport(row){
  state.reportTopic = null;
  state.reportTeam = row;
  state.reportReason = '';
  state.reportNote = '';
  state.reportError = '';
  state.reportDone = false;
  state.reportBusy = false;
  state.blockAuthorToo = false;
  render();
}

function closeTeamReport(){
  state.reportTeam = null;
  state.reportDone = false;
  render();
}

async function submitTeamReport(){
  const t = state.reportTeam;
  if(!t) return;
  if(!state.reportReason){ state.reportError = 'اختار سبب البلاغ.'; render(); return; }
  if(!sb){ state.reportError = 'تحتاج اتصال إنترنت حتى ترسل البلاغ.'; render(); return; }

  state.reportBusy = true; state.reportError = ''; render();
  try{
    const { data, error } = await sb.rpc('report_team', {
      p_handle: t.handle,
      p_reason: state.reportReason,
      p_note: state.reportNote || null
    });
    if(error) throw error;
    if(data && data.ok === false){
      state.reportError = 'ما لقيت هذا الفريق — يمكن انحذف.';
    } else {
      /* الحظر محلي بالجهاز، فيتنفّذ حتى لو البلاغ مكرر */
      if(state.blockAuthorToo && t.owner_key){
        blockAuthor(t.owner_key, 'صاحب فريق «' + (t.name || t.handle) + '»');
      }
      state.reportDone = true;
    }
  }catch(e){
    state.reportError = 'تعذّر إرسال البلاغ — تأكد من الإنترنت وجرب مرة ثانية.';
  }
  state.reportBusy = false;
  render();
}

function renderTeamReportOverlay(){
  const t = state.reportTeam || {};
  const overlay = el(`<div class="overlay"></div>`);

  if(state.reportDone){
    const done = el(`<div class="q-modal" style="max-width:400px; text-align:center;">
      <div style="font-size:38px; margin-bottom:8px;">✓</div>
      <div class="section-title" style="justify-content:center;">وصلنا بلاغك</div>
      <p style="color:var(--muted); font-size:14px; margin-bottom:18px;">
        راح نراجع اسم الفريق. إذا وصلته بلاغات كافية ينخفي فوراً من الترتيب
        لحد ما تنتهي المراجعة.${state.blockAuthorToo ? '<br>وحظرنا صاحب الفريق — ما راح تشوف فرقه ولا فئاته بعدها.' : ''}
      </p>
      <div class="btn-row" style="justify-content:center; margin-top:0;">
        <button class="btn btn-gold" id="trep-close">تم</button>
      </div>
    </div>`);
    done.querySelector('#trep-close').addEventListener('click', closeTeamReport);
    overlay.appendChild(done);
    return overlay;
  }

  const modal = el(`<div class="q-modal" style="max-width:440px; text-align:right;">
    <div class="section-title">بلّغ عن فريق</div>
    <div class="section-sub">
      «${escapeAttr(t.name || '')}» <span dir="ltr">@${escapeAttr(t.handle || '')}</span> — شنو المشكلة بيه؟
    </div>
    <div id="trep-reasons" style="display:flex; flex-direction:column; gap:7px; margin-bottom:14px;"></div>
    <div class="field">
      <input type="text" id="trep-note" maxlength="500"
             placeholder="تفاصيل إضافية (اختياري)" value="${escapeAttr(state.reportNote || '')}"/>
    </div>
    ${t.owner_key ? `
    <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer;
           font-size:13px; color:var(--muted); margin:2px 0 12px; line-height:1.6;">
      <input type="checkbox" id="trep-block" ${state.blockAuthorToo ? 'checked' : ''}
             style="margin-top:3px; width:auto; accent-color:var(--gold);"/>
      <span>احظر <b style="color:var(--ivory);">صاحب هذا الفريق</b> — تنشال كل فرقه من
      الترتيب عندك، وفئاته الخاصة ما توصلك. تكدر تلغي الحظر من أسفل شاشة الترتيب.</span>
    </label>` : ''}
    ${state.reportError ? `<div style="color:var(--rose); font-size:13px; margin-bottom:10px;">${escapeAttr(state.reportError)}</div>` : ''}
    <div class="btn-row" style="justify-content:center; margin-top:6px;">
      <button class="btn btn-gold" id="trep-send">${state.reportBusy ? '...' : 'أرسل البلاغ'}</button>
      <button class="btn btn-ghost" id="trep-cancel">إلغاء</button>
    </div>
  </div>`);

  const box = modal.querySelector('#trep-reasons');
  teamReportReasons().forEach(([key, label])=>{
    const on = state.reportReason === key;
    const b = el(`<button class="btn ${on ? 'btn-gold' : 'btn-ghost'} btn-sm"
                    style="text-align:right; justify-content:flex-start;">${escapeAttr(label)}</button>`);
    b.addEventListener('click', ()=>{ state.reportReason = key; state.reportError = ''; render(); });
    box.appendChild(b);
  });

  modal.querySelector('#trep-note').addEventListener('input', e=>{ state.reportNote = e.target.value; });
  const blockBox = modal.querySelector('#trep-block');
  if(blockBox) blockBox.addEventListener('change', e=>{ state.blockAuthorToo = e.target.checked; });
  modal.querySelector('#trep-send').disabled = state.reportBusy;
  modal.querySelector('#trep-send').addEventListener('click', submitTeamReport);
  modal.querySelector('#trep-cancel').addEventListener('click', closeTeamReport);

  overlay.appendChild(modal);
  return overlay;
}

/* قائمة المحظورين بشاشة الترتيب نفسها — اللي مو مسجّل دخول ما يوصل
   لشاشة الحساب، ولازم يكدر يلغي الحظر من مكان ما سوّاه. */
function renderBlockedUsersPanel(){
  const blocked = loadBlockedAuthors();
  if(!blocked.length) return null;
  const box = el(`<div class="panel">
    <div class="section-sub" style="margin-bottom:6px;">
      مستخدمين محظورين (${blocked.length}) — فرقهم وفئاتهم ما تطلع عندك</div>
  </div>`);
  blocked.forEach(a=>{
    const row = el(`<div style="display:flex; align-items:center; justify-content:space-between; gap:10px;
                      padding:7px 2px; border-top:1px solid var(--line);">
      <span style="font-size:13.5px;">${escapeAttr(a.name || 'مستخدم')}</span>
      <button class="btn btn-ghost btn-sm">ألغِ الحظر</button>
    </div>`);
    row.querySelector('button').addEventListener('click', ()=>{ unblockAuthor(a.key); render(); });
    box.appendChild(row);
  });
  return box;
}

function accuracyText(r){
  if(!r.answers) return '—';
  return Math.round((r.correct / r.answers) * 100) + '٪';
}

function leaderboardRow(r, highlight){
  const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank;
  const mine = isMyTeamRow(r);
  const row = el(`<div class="score-row" ${highlight ? 'style="border-color:var(--gold-dim); background:rgba(212,168,87,0.10);"' : ''}>
    <span style="display:flex; gap:10px; align-items:baseline; min-width:0;">
      <b style="min-width:28px; display:inline-block;">${medal}</b>
      <span style="min-width:0; overflow-wrap:anywhere;">
        ${escapeAttr(r.name)}
        <small style="color:var(--muted); display:block;" dir="ltr">@${escapeAttr(r.handle)}</small>
      </span>
    </span>
    <span style="display:flex; align-items:center; gap:10px;">
      <span class="display" style="text-align:left;">
        ${Math.round(r.score)}
        <small style="color:var(--muted); display:block;">${r.games} لعبة · ${accuracyText(r)}</small>
      </span>
      ${mine ? '' : `<button class="btn btn-ghost btn-sm team-report" title="بلّغ عن اسم الفريق"
                       aria-label="بلّغ عن اسم الفريق" style="padding:4px 9px;">⚑</button>`}
    </span>
  </div>`);
  const rep = row.querySelector('.team-report');
  if(rep) rep.addEventListener('click', ()=> openTeamReport(r));
  return row;
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
  const rows = visibleBoardRows(state.boardRows);
  const topHandles = rows.map(r=>r.handle);
  const missing = mine.filter(r => topHandles.indexOf(r.handle) < 0);
  if(missing.length){
    const box = el(`<div class="panel"><div class="section-title" style="font-size:16px;">فرقكم</div></div>`);
    missing.forEach(r=> box.appendChild(leaderboardRow(r, true)));
    wrap.appendChild(box);
  }

  const list = el(`<div class="panel"></div>`);
  if(!rows.length){
    list.appendChild(el(`<div class="section-sub">
      ماكو فرق مسجّلة ${state.boardPeriod === 'week' ? 'هذا الأسبوع' : 'بعد'}. العبوا لعبة فئات وسجّلوا فرقكم بالنهاية.
    </div>`));
  } else {
    rows.forEach(r=>{
      list.appendChild(leaderboardRow(r, mine.some(m=>m.handle === r.handle)));
    });
    list.appendChild(el(`<div class="section-sub" style="margin-top:12px; font-size:12.5px;">
      شفت اسم فريق مسيء؟ اضغط ⚑ جنبه حتى تبلّغ عنه أو تحظر صاحبه.
    </div>`));
  }
  wrap.appendChild(list);

  const blockedPanel = renderBlockedUsersPanel();
  if(blockedPanel) wrap.appendChild(blockedPanel);

  const back = el(`<div class="btn-row" style="justify-content:center;">
    <button class="btn btn-ghost" id="board-hub">رجوع للرئيسية</button>
  </div>`);
  back.querySelector('#board-hub').addEventListener('click', ()=> goto('hub'));
  wrap.appendChild(back);

  return wrap;
}
