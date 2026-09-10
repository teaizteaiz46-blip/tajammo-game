/* ============================ الحلفاء والشياطين (توزيع أدوار + لوحة نقاط) ============================ */
function shdMaxDemons(n){ return Math.max(1, Math.ceil(n/2) - 1); }
function shdMaxSpecial(n){ return Math.max(0, Math.floor(n/4)); }

function renderShdSetup(){
  const wrap = el(`<div></div>`);
  const intro = el(`<div class="panel"><div class="section-title">الحلفاء والشياطين</div><div class="section-sub">أدخلوا أسماء اللاعبين، حددوا الأدوار، وزّعوها بالسر، والعبوا براحتكم!</div></div>`);
  wrap.appendChild(intro);
  const namesPanel = el(`<div class="panel"><div class="section-title" style="font-size:16px;">أسماء اللاعبين (${state.shdPlayerNames.length})</div><div id="shd-names-list" style="display:grid; gap:10px; margin-top:10px;"></div><div class="btn-row" style="margin-top:10px;"><button class="btn btn-ghost btn-sm" id="shd-add-name">+ إضافة لاعب</button><button class="btn btn-ghost btn-sm" id="shd-remove-name" ${state.shdPlayerNames.length?'':'disabled'}>- حذف آخر لاعب</button></div></div>`);
  const namesList = namesPanel.querySelector('#shd-names-list');
  state.shdPlayerNames.forEach((name, i)=>{ const row = el(`<input type="text" placeholder="اللاعب ${i+1}" value="${escapeAttr(name)}"/>`); row.addEventListener('input', e=>{ state.shdPlayerNames[i] = e.target.value; }); namesList.appendChild(row); });
  wrap.appendChild(namesPanel);
  const actions = el(`<div class="btn-row"><button class="btn btn-gold" id="shd-next-roles">التالي: تحديد الأدوار</button><button class="btn btn-ghost" id="shd-back">رجوع</button></div>`);
  actions.querySelector('#shd-back').addEventListener('click', ()=> goto('hub'));
  namesPanel.querySelector('#shd-add-name').addEventListener('click', ()=>{ state.shdPlayerNames.push(''); render(); });
  const removeBtn = namesPanel.querySelector('#shd-remove-name');
  if(!removeBtn.disabled) removeBtn.addEventListener('click', ()=>{ state.shdPlayerNames.pop(); render(); });
  actions.querySelector('#shd-next-roles').addEventListener('click', ()=>{
    const names = state.shdPlayerNames.map(n=>n.trim()).filter(n=>n);
    if(names.length < 4){ alert('لازم ٤ لاعبين على الأقل'); return; }
    state.shdPlayerNames = names;
    const maxD = shdMaxDemons(names.length);
    const maxS = shdMaxSpecial(names.length);
    state.shdDemonCount = Math.min(state.shdDemonCount || 1, maxD);
    state.shdDoctorCount = Math.min(state.shdDoctorCount || 0, maxS);
    state.shdPoliceCount = Math.min(state.shdPoliceCount || 0, maxS);
    goto('shd-roles');
  });
  wrap.appendChild(actions);
  return wrap;
}

function renderShdRoles(){
  const wrap = el(`<div></div>`);
  const n = state.shdPlayerNames.length;
  const maxD = shdMaxDemons(n);
  const maxS = shdMaxSpecial(n);
  const demons = Math.min(state.shdDemonCount||1, maxD);
  const doctors = Math.min(state.shdDoctorCount||0, maxS);
  const police = Math.min(state.shdPoliceCount||0, maxS);
  const allies = n - demons - doctors - police;
  const panel = el(`<div class="panel"><div class="section-title">تحديد الأدوار (${n} لاعبين)</div><div class="section-sub">حددوا عدد كل دور — الحلفاء يتحسبون تلقائياً</div><div style="margin-top:16px;"><div class="section-title" style="font-size:16px;">😈 الشياطين (أقصى ${maxD})</div><div style="display:flex; align-items:center; gap:16px; margin-top:8px;"><button class="btn btn-ghost btn-sm" id="shd-demon-minus">−</button><span class="display" style="font-size:24px; min-width:30px; text-align:center;">${demons}</span><button class="btn btn-ghost btn-sm" id="shd-demon-plus">+</button></div></div><div style="margin-top:16px;"><div class="section-title" style="font-size:16px;">💉 الطبيب (أقصى ${maxS})</div><div style="display:flex; align-items:center; gap:16px; margin-top:8px;"><button class="btn btn-ghost btn-sm" id="shd-doctor-minus">−</button><span class="display" style="font-size:24px; min-width:30px; text-align:center;">${doctors}</span><button class="btn btn-ghost btn-sm" id="shd-doctor-plus">+</button></div></div><div style="margin-top:16px;"><div class="section-title" style="font-size:16px;">👮 الشرطي (أقصى ${maxS})</div><div style="display:flex; align-items:center; gap:16px; margin-top:8px;"><button class="btn btn-ghost btn-sm" id="shd-police-minus">−</button><span class="display" style="font-size:24px; min-width:30px; text-align:center;">${police}</span><button class="btn btn-ghost btn-sm" id="shd-police-plus">+</button></div></div><div class="section-sub" style="margin-top:16px; font-size:18px;">🙂 الحلفاء العاديين: <b>${allies}</b></div></div>`);
  panel.querySelector('#shd-demon-minus').addEventListener('click', ()=>{ state.shdDemonCount = Math.max(1, demons-1); render(); });
  panel.querySelector('#shd-demon-plus').addEventListener('click', ()=>{ state.shdDemonCount = Math.min(maxD, demons+1); render(); });
  panel.querySelector('#shd-doctor-minus').addEventListener('click', ()=>{ state.shdDoctorCount = Math.max(0, doctors-1); render(); });
  panel.querySelector('#shd-doctor-plus').addEventListener('click', ()=>{ state.shdDoctorCount = Math.min(maxS, doctors+1); render(); });
  panel.querySelector('#shd-police-minus').addEventListener('click', ()=>{ state.shdPoliceCount = Math.max(0, police-1); render(); });
  panel.querySelector('#shd-police-plus').addEventListener('click', ()=>{ state.shdPoliceCount = Math.min(maxS, police+1); render(); });
  wrap.appendChild(panel);
  const actions = el(`<div class="btn-row"><button class="btn btn-gold" id="shd-start" ${allies<0?'disabled':''}>ابدأ التوزيع</button><button class="btn btn-ghost" id="shd-back">رجوع</button></div>`);
  actions.querySelector('#shd-back').addEventListener('click', ()=> goto('shd-setup'));
  const startBtn = actions.querySelector('#shd-start');
  if(!startBtn.disabled) startBtn.addEventListener('click', ()=>{
    const roles = [];
    for(let i=0;i<demons;i++) roles.push('demon');
    for(let i=0;i<doctors;i++) roles.push('doctor');
    for(let i=0;i<police;i++) roles.push('police');
    for(let i=0;i<allies;i++) roles.push('ally');
    const shuffledRoles = shuffled(roles);
    state.shdPlayers = shuffledRoles.map((role,i)=>({ name: state.shdPlayerNames[i], role }));
    state.shdRevealIndex = 0;
    state.shdRevealShown = false;
    goto('shd-reveal');
  });
  wrap.appendChild(actions);
  return wrap;
}

const shdRoleLabel = { demon:'شيطان 😈', doctor:'طبيب 💉', police:'شرطي 👮', ally:'حليف 🙂' };

function renderShdReveal(){
  const wrap = el(`<div></div>`);
  const idx = state.shdRevealIndex;
  const player = state.shdPlayers[idx];
  if(!player){
    const done = el(`<div class="panel" style="text-align:center;"><div class="section-title">كل اللاعبين عرفوا أدوارهم ✅</div><div class="section-sub">العبوا براحتكم، ولما تخلصون ارجعوا حددوا الفريق الفائز</div><div class="btn-row" style="justify-content:center;"><button class="btn btn-gold" id="shd-go-winner">تحديد الفائز</button></div></div>`);
    done.querySelector('#shd-go-winner').addEventListener('click', ()=> goto('shd-winner'));
    wrap.appendChild(done);
    return wrap;
  }
  const isDemon = player.role === 'demon';
  const panel = el(`<div class="panel" style="text-align:center;"><div class="section-title">📱 خل غير ${escapeAttr(player.name)} يبعدون نظرهم</div><div class="section-sub">بس ${escapeAttr(player.name)} يشوف الشاشة الحين</div>${state.shdRevealShown ? `<div class="q-points" style="font-size:22px; padding:16px 26px;">أنت ${shdRoleLabel[player.role]}</div>${isDemon ? `<div class="section-sub">زملاءك الشياطين: ${state.shdPlayers.filter((p,i)=>p.role==='demon' && i!==idx).map(p=>escapeAttr(p.name)).join('، ') || 'لا أحد، أنت وحيد!'}</div>` : ''}<div class="btn-row" style="justify-content:center;"><button class="btn btn-gold" id="shd-next">التالي</button></div>` : `<div class="btn-row" style="justify-content:center;"><button class="btn btn-gold" id="shd-reveal-role">إظهار دوري (خل الباقي ما يناظرون)</button></div>`}</div>`);
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

function renderShdWinner(){
  const wrap = el(`<div></div>`);
  const panel = el(`<div class="panel" style="text-align:center;"><div class="section-title">مين فاز؟</div><div class="section-sub">اختاروا الفريق الفائز هالجولة</div><div class="btn-row" style="justify-content:center; flex-wrap:wrap; margin-top:16px;"><button class="btn btn-gold" id="shd-win-demon">😈 فاز الشياطين</button><button class="btn btn-gold" id="shd-win-good">🛡️ فاز الحلفاء</button></div></div>`);
  panel.querySelector('#shd-win-demon').addEventListener('click', ()=>{ shdApplyWin('demon'); });
  panel.querySelector('#shd-win-good').addEventListener('click', ()=>{ shdApplyWin('good'); });
  wrap.appendChild(panel);
  return wrap;
}

function shdApplyWin(winnerSide){
  state.shdWinner = winnerSide;
  if(!state.shdScores) state.shdScores = {};
  state.shdPlayers.forEach(p=>{
    const onWinningSide = winnerSide==='demon' ? p.role==='demon' : p.role!=='demon';
    if(onWinningSide){ state.shdScores[p.name] = (state.shdScores[p.name]||0) + 1; }
    else if(!(p.name in state.shdScores)){ state.shdScores[p.name] = 0; }
  });
  goto('shd-end');
}

function renderShdEnd(){
  const wrap = el(`<div></div>`);
  const sorted = state.shdPlayerNames.map(name=>({ name, score: (state.shdScores && state.shdScores[name]) || 0 })).sort((a,b)=>b.score-a.score);
  const panel = el(`<div class="panel"><div class="section-title" style="text-align:center;">${state.shdWinner==='demon' ? '😈 فاز الشياطين' : '🛡️ فاز الحلفاء'}</div><div class="section-title" style="font-size:16px; margin-top:16px;">لوحة النقاط</div><div style="display:grid; gap:8px; margin-top:10px;">${sorted.map(p=>`<div style="display:flex; justify-content:space-between; padding:10px 14px; background:rgba(255,255,255,0.05); border-radius:10px;"><span>${escapeAttr(p.name)}</span><span style="font-weight:700;">${p.score}</span></div>`).join('')}</div></div>`);
  wrap.appendChild(panel);
  const actions = el(`<div class="btn-row" style="margin-top:16px;"><button class="btn btn-gold" id="shd-new-round">جولة جديدة (نفس اللاعبين)</button><button class="btn btn-ghost" id="shd-hub">الرئيسية</button></div>`);
  actions.querySelector('#shd-new-round').addEventListener('click', ()=> goto('shd-roles'));
  actions.querySelector('#shd-hub').addEventListener('click', ()=> goto('hub'));
  wrap.appendChild(actions);
  return wrap;
}
