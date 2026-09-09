/* ============================ EDITOR (choose topics) ============================ */
function renderCatLoading(){
  const wrap = el(`<div></div>`);
  if(state.categoryDataError){
    const panel = el(`<div class="panel" style="text-align:center;">
      <div class="section-title">${escapeAttr(state.categoryDataError)}</div>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="retry-load">حاول مرة ثانية</button>
        <button class="btn btn-ghost" id="back-hub-load">رجوع</button>
      </div>
    </div>`);
    panel.querySelector('#retry-load').addEventListener('click', async ()=>{
      state.categoryDataError = '';
      render();
      try{
        await loadCategoryDatabase();
        state.categoryDataLoaded = true;
        if(state.pool.length === 0){
          CATEGORY_TOPICS.forEach(t=> state.pool.push(makeBankTopic(t)));
        }
        goto('editor');
      } catch(e){
        state.categoryDataError = 'تعذّر تحميل بنك الأسئلة — تأكد من اتصال الإنترنت وحاول مرة ثانية.';
        render();
      }
    });
    panel.querySelector('#back-hub-load').addEventListener('click', ()=> goto('hub'));
    wrap.appendChild(panel);
  } else {
    wrap.appendChild(el(`<div class="panel" style="text-align:center;">
      <div class="section-title">...جاري تحميل بنك الأسئلة</div>
      <div class="section-sub">يحتاج اتصال إنترنت</div>
    </div>`));
  }
  return wrap;
}

function renderEditor(){
  const wrap = el(`<div></div>`);

  const intro = el(`<div class="panel">
    <div class="section-title">اختر المواضيع</div>
    <div class="section-sub">مواضيع جاهزة بأسئلتها — بس اختار وشيل اللي يعجبك، وتقدر تضيف موضوعك الخاص إذا حبيت. لازم يبقى ٦ مواضيع على الأقل.</div>
    <div class="pool-counter">مختار حالياً <b id="pool-count">${state.pool.length}</b> من ٦ مواضيع على الأقل</div>
  </div>`);
  wrap.appendChild(intro);

  const grid = el(`<div class="pick-grid" id="bank-grid" style="margin-bottom:20px;"></div>`);
  CATEGORY_TOPICS.forEach(topicName=>{
    const inPool = state.pool.find(t=>t.bankKey === topicName);
    const card = el(`<div class="pick-card ${inPool?'':'taken'}" style="${inPool? `border-color:var(--gold-dim); background:rgba(212,168,87,0.10);`:''}">
      ${escapeAttr(topicName)}
      <span class="taken-by">${inPool ? '✓ مُختار' : 'اضغط للإضافة'}</span>
    </div>`);
    card.addEventListener('click', ()=>{
      if(inPool){
        state.pool = state.pool.filter(t => t.bankKey !== topicName);
      } else {
        state.pool.push(makeBankTopic(topicName));
      }
      render();
    });
    grid.appendChild(card);
  });
  wrap.appendChild(grid);

  const customTopics = state.pool.filter(t=>t.bankKey === null);
  if(customTopics.length){
    const customPanel = el(`<div class="panel"><div class="section-title" style="font-size:16px;">مواضيعك الخاصة</div></div>`);
    const list = customPanel.querySelector('.section-title');
    customTopics.forEach(t=>{
      const row = el(`<div style="display:flex; align-items:center; justify-content:space-between; padding:10px 4px; border-top:1px solid var(--line);">
        <span>${escapeAttr(t.name)}</span>
        <button class="remove-x" title="حذف">✕</button>
      </div>`);
      row.querySelector('.remove-x').addEventListener('click', ()=>{
        state.pool = state.pool.filter(x=>x.id!==t.id);
        render();
      });
      customPanel.appendChild(row);
    });
    wrap.appendChild(customPanel);
  }

  const addCustom = el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">أضف موضوع خاص</div>
    <div class="section-sub">تكتب اسم موضوعك، والأسئلة تكتبها بنفسك أثناء اللعب لحظة ما تفتح كل خانة.</div>
    <div style="display:flex; gap:10px;">
      <input type="text" id="custom-name" placeholder="مثال: نجوم كرة القدم العراقية"/>
      <button class="btn btn-gold btn-sm" id="add-custom" style="flex:none;">إضافة</button>
    </div>
  </div>`);
  addCustom.querySelector('#add-custom').addEventListener('click', ()=>{
    const input = addCustom.querySelector('#custom-name');
    const name = input.value.trim();
    if(!name) { input.focus(); return; }
    state.pool.push(makeCustomTopic(name));
    render();
  });
  wrap.appendChild(addCustom);

  const actions = el(`<div class="btn-row">
    <button class="btn btn-gold" id="to-teams">التالي: الفرق</button>
    <button class="btn btn-ghost" id="back-hub">رجوع</button>
  </div>`);
  actions.querySelector('#to-teams').disabled = state.pool.length < 6;
  actions.querySelector('#to-teams').addEventListener('click', ()=>{
    if(state.pool.length >= 6) goto('teams');
  });
  actions.querySelector('#back-hub').addEventListener('click', ()=> goto('hub'));
  wrap.appendChild(actions);

  if(state.pool.length < 6){
    wrap.appendChild(el(`<div class="section-sub" style="margin-top:-8px;">لازم يبقى عندك ٦ مواضيع على الأقل عشان تكمل.</div>`));
  }

  return wrap;
}

/* ============================ TEAMS / SETTINGS ============================ */
function renderTeams(){
  const wrap = el(`<div></div>`);

  const panel = el(`<div class="panel">
    <div class="section-title">الفرق</div>
    <div class="section-sub">سمّوا الفرق قبل ما تبدون</div>
    <div class="row2">
      <div class="team-card t0">
        <label>اسم الفريق الأول</label>
        <input type="text" id="t0name" value="${escapeAttr(state.teams[0].name)}"/>
      </div>
      <div class="team-card t1">
        <label>اسم الفريق الثاني</label>
        <input type="text" id="t1name" value="${escapeAttr(state.teams[1].name)}"/>
      </div>
    </div>
  </div>`);
  panel.querySelector('#t0name').addEventListener('input', e=> state.teams[0].name = e.target.value || 'الفريق الأول');
  panel.querySelector('#t1name').addEventListener('input', e=> state.teams[1].name = e.target.value || 'الفريق الثاني');
  wrap.appendChild(panel);

  const timerPanel = el(`<div class="panel">
    <div class="section-title">المؤقت</div>
    <div class="section-sub">اختر إذا بتلعبون بمؤقت زمني لكل سؤال أو بدون</div>
    <div class="toggle-row">
      <span>تفعيل المؤقت</span>
      <div class="switch ${state.timerEnabled?'on':''}" id="timer-switch"><div class="knob"></div></div>
    </div>
    <div class="field" style="margin-top:16px; ${state.timerEnabled?'':'display:none;'}" id="timer-duration-field">
      <label>مدة كل سؤال (بالثواني)</label>
      <input type="number" id="timer-seconds" min="10" max="180" value="${state.timerSeconds}"/>
    </div>
  </div>`);
  timerPanel.querySelector('#timer-switch').addEventListener('click', ()=>{
    state.timerEnabled = !state.timerEnabled;
    render();
  });
  const secInput = timerPanel.querySelector('#timer-seconds');
  if(secInput) secInput.addEventListener('input', e=>{
    state.timerSeconds = Math.max(5, parseInt(e.target.value||'30',10));
  });
  wrap.appendChild(timerPanel);

  const actions = el(`<div class="btn-row">
    <button class="btn btn-gold" id="to-select">التالي: اختيار الفئات</button>
    <button class="btn btn-ghost" id="back-editor">رجوع</button>
  </div>`);
  actions.querySelector('#to-select').addEventListener('click', ()=>{
    state.pool.forEach(t=>{ t.taken=false; t.takenBy=null; });
    state.selectedTopicIds = [];
    state.turn = 0;
    state.teams[0].score = 0;
    state.teams[1].score = 0;
    state.teams[0].helps = 3;
    state.teams[1].helps = 3;
    state.statsRecordedForThisGame = false;
    goto('select');
  });
  actions.querySelector('#back-editor').addEventListener('click', ()=> goto('editor'));
  wrap.appendChild(actions);

  return wrap;
}

/* ============================ SELECT TOPICS ============================ */
function renderSelect(){
  const wrap = el(`<div></div>`);
  const currentTeam = state.teams[state.turn];
  const pickedCount = state.selectedTopicIds.length;

  if(pickedCount >= 6){
    const done = el(`<div class="panel" style="text-align:center;">
      <div class="section-title">تم اختيار كل الفئات ✓</div>
      <div class="section-sub">جاهزين نبدأ اللعب</div>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="start-board">ابدأ اللعبة</button>
      </div>
    </div>`);
    done.querySelector('#start-board').addEventListener('click', ()=> goto('board'));
    wrap.appendChild(done);
    return wrap;
  }

  const banner = el(`<div class="turn-banner">دور <b>${currentTeam.name}</b> — يختار الفئة رقم ${pickedCount+1} من ٦ (${(pickedCount%3)+1} من ٣ لهذا الفريق)</div>`);
  wrap.appendChild(banner);

  const grid = el(`<div class="pick-grid"></div>`);
  state.pool.forEach(topic=>{
    const card = el(`<div class="pick-card ${topic.taken?'taken':''}">
      ${escapeAttr(topic.name)}
      ${topic.taken ? `<span class="taken-by">اختارها ${escapeAttr(state.teams[topic.takenBy].name)}</span>`:''}
    </div>`);
    if(!topic.taken){
      card.addEventListener('click', ()=>{
        topic.taken = true;
        topic.takenBy = state.turn;
        state.selectedTopicIds.push(topic.id);
        state.turn = state.turn === 0 ? 1 : 0;
        render();
      });
    }
    grid.appendChild(card);
  });
  wrap.appendChild(grid);
  return wrap;
}

/* ============================ BOARD ============================ */
function renderBoard(){
  const wrap = el(`<div></div>`);
  wrap.appendChild(renderScoreboard());

  const topics = state.selectedTopicIds.map(id => state.pool.find(t=>t.id===id));
  const board = el(`<div class="board" style="--cols:${topics.length}"></div>`);

  topics.forEach(t=>{
    board.appendChild(el(`<div class="topic-head">${escapeAttr(t.name)}</div>`));
  });

  const maxQ = Math.max(...topics.map(t=>t.questions.length));
  for(let r=0; r<maxQ; r++){
    topics.forEach(t=>{
      const q = t.questions[r];
      if(!q){ board.appendChild(el(`<div></div>`)); return; }
      const used = q.usedBy !== undefined;
      const cell = el(`<div class="cell ${used?'used':''}">${used?'':q.points}</div>`);
      if(!used){
        cell.addEventListener('click', ()=>{
          state.activeCell = { topicId:t.id, qId:q.id };
          state.helpHints = {0:null, 1:null};
          render();
          if(state.timerEnabled && q.text.trim()) startTimer();
        });
      }
      board.appendChild(cell);
    });
  }
  wrap.appendChild(board);

  const allUsed = topics.every(t => t.questions.every(q => q.usedBy !== undefined));
  if(allUsed){
    const finishBtn = el(`<div class="btn-row"><button class="btn btn-gold" id="finish">إنهاء اللعبة وعرض النتيجة</button></div>`);
    finishBtn.querySelector('#finish').addEventListener('click', ()=> goto('end'));
    wrap.appendChild(finishBtn);
  }

  return wrap;
}

function renderScoreboard(){
  return el(`<div class="scoreboard">
    <div class="score-card t0"><span class="name">${escapeAttr(state.teams[0].name)}</span><span class="pts">${state.teams[0].score}</span></div>
    <div class="score-card t1"><span class="name">${escapeAttr(state.teams[1].name)}</span><span class="pts">${state.teams[1].score}</span></div>
  </div>`);
}

/* ============================ QUESTION OVERLAY ============================ */
function renderHelpSection(topic, q){
  const ti = topic.takenBy;
  if(ti !== 0 && ti !== 1) return '';
  const team = state.teams[ti];
  const disabled = team.helps<=0;
  return `<div class="help-wrap">
    <div class="help-title">مساعدات ${escapeAttr(team.name)} — متبقي ${team.helps}</div>
    <div class="help-btns" style="justify-content:center;">
      <button class="btn btn-ghost btn-sm help-btn" data-team="${ti}" data-type="letter" ${disabled?'disabled':''}>أول حرف</button>
      <button class="btn btn-ghost btn-sm help-btn" data-team="${ti}" data-type="blanks" ${disabled?'disabled':''}>عدد الأحرف</button>
      ${topic.bankKey ? `
      <button class="btn btn-ghost btn-sm help-btn" data-team="${ti}" data-type="choices" ${disabled?'disabled':''}>خيارات</button>
      <button class="btn btn-ghost btn-sm help-btn" data-team="${ti}" data-type="swap" ${disabled?'disabled':''}>تبديل السؤال</button>
      ` : ''}
    </div>
    ${state.helpHints[ti] ? `<div class="help-result">${escapeAttr(state.helpHints[ti])}</div>` : ''}
  </div>`;
}

function wireHelpButtons(modal, topic, q){
  modal.querySelectorAll('.help-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const ti = parseInt(btn.dataset.team,10);
      const type = btn.dataset.type;
      const team = state.teams[ti];
      if(team.helps<=0) return;

      if(type==='swap'){
        if(topic.bankKey){
          const fresh = pickFromTier(CATEGORY_DATA[topic.bankKey][q.points], bankUsage[topic.bankKey][q.points], 1)[0];
          if(fresh){ q.text = fresh.text; q.answer = fresh.answer; q.image = fresh.image; }
        }
        team.helps--;
        state.helpHints = {0:null, 1:null};
        render();
        return;
      }

      let hint = '';
      if(type==='letter'){
        hint = 'أول حرف: ' + (q.answer.trim().charAt(0) || '؟');
      } else if(type==='blanks'){
        hint = 'عدد الأحرف: ' + q.answer.replace(/\s/g,'').length;
      } else if(type==='choices' && topic.bankKey){
        const bank = CATEGORY_DATA[topic.bankKey];
        const allAnswers = [].concat(bank[100]||[], bank[200]||[], bank[400]||[], bank[600]||[])
          .map(x=>x.answer).filter(a=> a && a !== q.answer);
        const decoys = shuffled(allAnswers).slice(0,2);
        const options = shuffled([q.answer, ...decoys]);
        hint = 'الخيارات: ' + options.join(' / ');
      }
      if(hint){
        team.helps--;
        state.helpHints[ti] = hint;
        render();
      }
    });
  });
}

function renderQuestionOverlay(){
  const { topicId, qId } = state.activeCell;
  const topic = state.pool.find(t=>t.id===topicId);
  const q = topic.questions.find(q=>q.id===qId);
  const revealed = !!q.revealed;
  const needsContent = !q.text.trim();

  const overlay = el(`<div class="overlay"></div>`);

  if(needsContent){
    const modal = el(`<div class="q-modal">
      <div class="q-topic">${escapeAttr(topic.name)}</div>
      <div class="q-points">سؤال بـ ${q.points} نقطة</div>
      <div class="field" style="text-align:right;">
        <label>اكتب السؤال الآن</label>
        <input type="text" id="live-text" placeholder="نص السؤال"/>
      </div>
      <div class="field" style="text-align:right;">
        <label>الإجابة الصحيحة (تظهر بعدين)</label>
        <input type="text" id="live-answer" placeholder="الإجابة"/>
      </div>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="live-submit">اطرح السؤال</button>
      </div>
    </div>`);
    const submit = ()=>{
      const t = modal.querySelector('#live-text').value.trim();
      const a = modal.querySelector('#live-answer').value.trim();
      if(!t) { modal.querySelector('#live-text').focus(); return; }
      q.text = t;
      q.answer = a || '—';
      render();
      if(state.timerEnabled) startTimer();
    };
    modal.querySelector('#live-submit').addEventListener('click', submit);
    overlay.appendChild(modal);
    return overlay;
  }

  const modal = el(`<div class="q-modal">
    <div class="q-topic">${escapeAttr(topic.name)}</div>
    <div class="q-points">${q.points} نقطة</div>
    ${q.image ? `<img src="https://flagcdn.com/w320/${q.image}.png" style="width:180px; max-width:70%; border-radius:8px; margin-bottom:14px; box-shadow:0 4px 14px rgba(0,0,0,0.4);" alt=""/>` : ''}
    <div class="q-text">${escapeAttr(q.text)}</div>
    ${state.timerEnabled ? `<div class="timer" id="timer-display">${state.timerLeft}</div>` : ''}
    ${!revealed ? renderHelpSection(topic, q) : ''}
    ${revealed ? `
      <div class="answer-box">
        <div class="label">الإجابة</div>
        <div class="val">${escapeAttr(q.answer)}</div>
      </div>
      <div class="award-row">
        <button class="btn btn-gold btn-sm" id="award-0">نقطة لـ ${escapeAttr(state.teams[0].name)}</button>
        <button class="btn btn-sm" style="background:var(--rose); color:#fff;" id="award-1">نقطة لـ ${escapeAttr(state.teams[1].name)}</button>
        <button class="btn btn-ghost btn-sm" id="award-none">بدون إجابة صحيحة</button>
      </div>
    ` : `
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-gold" id="reveal">إظهار الإجابة</button>
      </div>
    `}
  </div>`);

  if(!revealed){
    modal.querySelector('#reveal').addEventListener('click', ()=>{
      q.revealed = true;
      stopTimer();
      render();
    });
    wireHelpButtons(modal, topic, q);
  } else {
    modal.querySelector('#award-0').addEventListener('click', ()=> awardPoints(0, topic, q));
    modal.querySelector('#award-1').addEventListener('click', ()=> awardPoints(1, topic, q));
    modal.querySelector('#award-none').addEventListener('click', ()=> awardPoints(null, topic, q));
  }

  overlay.appendChild(modal);
  return overlay;
}

/* ============================ AUTH OVERLAY ============================ */
function renderAuthOverlay(){
  const overlay = el(`<div class="overlay"></div>`);
  const isSignup = state.authMode === 'signup';

  const modal = el(`<div class="q-modal" style="max-width:400px; text-align:right;">
    <div style="display:flex; gap:10px; justify-content:center; margin-bottom:22px;">
      <button class="btn ${!isSignup?'btn-gold':'btn-ghost'} btn-sm" id="tab-signin">دخول</button>
      <button class="btn ${isSignup?'btn-gold':'btn-ghost'} btn-sm" id="tab-signup">حساب جديد</button>
    </div>
    <div class="field">
      <label>الإيميل</label>
      <input type="text" id="auth-email" placeholder="example@email.com" dir="ltr" style="text-align:left;"/>
    </div>
    <div class="field">
      <label>الرمز السري</label>
      <input type="password" id="auth-password" placeholder="••••••••" dir="ltr" style="text-align:left;"/>
    </div>
    ${isSignup ? `<div class="field">
      <label>تأكيد الرمز السري</label>
      <input type="password" id="auth-password2" placeholder="••••••••" dir="ltr" style="text-align:left;"/>
    </div>` : ''}
    ${state.authError ? `<div style="color:var(--rose); font-size:13px; margin-bottom:14px;">${escapeAttr(state.authError)}</div>` : ''}
    <div class="btn-row" style="justify-content:center;">
      <button class="btn btn-gold" id="auth-submit" ${state.authBusy?'disabled':''}>${state.authBusy ? '...' : (isSignup ? 'إنشاء الحساب' : 'دخول')}</button>
      <button class="btn btn-ghost" id="auth-close">إلغاء</button>
    </div>
  </div>`);

  modal.querySelector('#tab-signin').addEventListener('click', ()=>{ state.authMode='signin'; state.authError=''; render(); });
  modal.querySelector('#tab-signup').addEventListener('click', ()=>{ state.authMode='signup'; state.authError=''; render(); });
  modal.querySelector('#auth-close').addEventListener('click', ()=>{ state.showAuthModal=false; state.authError=''; render(); });

  modal.querySelector('#auth-submit').addEventListener('click', async ()=>{
    const email = modal.querySelector('#auth-email').value.trim();
    const password = modal.querySelector('#auth-password').value;
    if(!email || !password){ state.authError = 'عبّي الإيميل والرمز السري.'; render(); return; }
    if(isSignup){
      const password2 = modal.querySelector('#auth-password2').value;
      if(password !== password2){ state.authError = 'الرمز السري وتأكيده غير متطابقين.'; render(); return; }
      if(password.length < 6){ state.authError = 'الرمز السري لازم يكون ٦ أحرف على الأقل.'; render(); return; }
    }
    state.authBusy = true; state.authError=''; render();
    try{
      if(isSignup){
        await signUpWithEmail(email, password);
        state.authBusy = false;
        state.authError = 'تم إنشاء الحساب. إذا يطلب تأكيد الإيميل، تحقق من صندوق بريدك، وإلا رجعلك تسجل دخولك مباشرة.';
        state.authMode = 'signin';
        render();
      } else {
        await signInWithEmail(email, password);
        state.authBusy = false;
        state.showAuthModal = false;
        render();
      }
    } catch(e){
      state.authBusy = false;
      state.authError = translateAuthError(e.message);
      render();
    }
  });

  return overlay.appendChild(modal), overlay;
}

function translateAuthError(msg){
  if(!msg) return 'صار خطأ غير متوقع.';
  const m = msg.toLowerCase();
  if(m.includes('invalid login credentials')) return 'الإيميل أو الرمز السري غلط.';
  if(m.includes('user already registered')) return 'هذا الإيميل مسجّل مسبقاً، جرب تسجل دخول.';
  if(m.includes('email not confirmed')) return 'لازم تأكد إيميلك أول (تحقق من صندوق بريدك).';
  if(m.includes('password should be at least')) return 'الرمز السري قصير، لازم ٦ أحرف على الأقل.';
  return msg;
}

function awardPoints(teamIdx, topic, q){
  if(teamIdx !== null){
    state.teams[teamIdx].score += q.points;
  }
  q.usedBy = teamIdx;
  state.activeCell = null;
  stopTimer();
  render();
}

/* ---------- timer ---------- */
function startTimer(){
  stopTimer();
  state.timerLeft = state.timerSeconds;
  state.timerHandle = setInterval(()=>{
    state.timerLeft -= 1;
    const disp = document.getElementById('timer-display');
    if(disp){
      disp.textContent = state.timerLeft;
      disp.classList.toggle('warn', state.timerLeft <= 5);
    }
    if(state.timerLeft <= 0){
      stopTimer();
    }
  }, 1000);
}
function stopTimer(){
  if(state.timerHandle){ clearInterval(state.timerHandle); state.timerHandle = null; }
}

/* ============================ END ============================ */
function renderEnd(){
  const [a,b] = state.teams;
  let headline, sub;
  if(a.score === b.score){
    headline = 'تعادل!';
    sub = `${a.name} و${b.name} تعادلوا بـ ${a.score} نقطة`;
  } else {
    const winner = a.score > b.score ? a : b;
    headline = `${winner.name} فاز 🏆`;
    sub = `بفارق ${Math.abs(a.score-b.score)} نقطة`;
  }

  if(state.user && !state.statsRecordedForThisGame){
    state.statsRecordedForThisGame = true;
    recordGameResult(a.score + b.score);
  }

  const wrap = el(`<div class="end-wrap">
    <div class="trophy">🏆</div>
    <h2>${headline}</h2>
    <p>${sub}</p>
    <div class="final-scores">
      <div class="score-card t0"><span class="name">${escapeAttr(a.name)}</span><span class="pts">${a.score}</span></div>
      <div class="score-card t1"><span class="name">${escapeAttr(b.name)}</span><span class="pts">${b.score}</span></div>
    </div>
    <div class="btn-row" style="justify-content:center;">
      <button class="btn btn-gold" id="new-round">جولة جديدة — أسئلة جديدة</button>
      <button class="btn btn-ghost" id="replay">إعادة نفس الأسئلة</button>
      <button class="btn btn-ghost" id="new-hub">رجوع للرئيسية</button>
    </div>
  </div>`);

  function resetRoundState(){
    state.pool.forEach(t=>{ t.taken=false; t.takenBy=null; });
    state.selectedTopicIds = [];
    state.turn = 0;
    state.teams[0].score = 0;
    state.teams[1].score = 0;
    state.teams[0].helps = 3;
    state.teams[1].helps = 3;
    state.statsRecordedForThisGame = false;
  }

  wrap.querySelector('#new-round').addEventListener('click', ()=>{
    state.pool.forEach(t=>{
      if(t.bankKey){
        t.questions = pickQuestionsForBankTopic(t.bankKey);
      } else {
        t.questions.forEach(q=>{ q.text=''; q.answer=''; delete q.usedBy; delete q.revealed; });
      }
    });
    resetRoundState();
    goto('select');
  });

  wrap.querySelector('#replay').addEventListener('click', ()=>{
    state.pool.forEach(t=>{
      t.questions.forEach(q=>{ delete q.usedBy; delete q.revealed; });
    });
    resetRoundState();
    goto('select');
  });

  wrap.querySelector('#new-hub').addEventListener('click', ()=> goto('hub'));

  return wrap;
}
