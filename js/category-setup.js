/* ============================ تجهيز لعبة الفئات (شاشة وحدة) ============================
 *
 * قبل چانت ثلاث شاشات: «اختر المواضيع» (تشيل وتضيف من كل الفئات)، ثم
 * «الفرق والإعدادات»، ثم «اختيار الفئات» بالتناوب. هسه كلها بشاشة وحدة:
 *   - اسم الفريقين، وتحت كل فريق ٣ خانات لفئاته.
 *   - الاختيار حر: تضغط على فريق وتختارله، بأي ترتيب. أي خانة مليانة تنضغط
 *     فتفرغ — مو بس آخر اختيار.
 *   - بحث (يتجاهل فروق الكتابة: الانكليزي/الإنكليزي) وأقسام من قاعدة البيانات
 *     (CATEGORY_SECTIONS). الفئة بلا قسم تطلع تحت «منوعات».
 *   - المؤقت والمساعدات بلوحة تنفتح وتنسد بنفس الشاشة.
 *
 * أسئلة فئة البنك ما تنسحب إلا لمن تبدي اللعبة (startCategoryGame). قبل
 * چانت تنسحب لكل الفئات أول ما تنفتح الشاشة، فتنحسب «طالعة» بذاكرة عدم
 * التكرار حتى الفئات اللي ما انلعبت — وتخلص الأسئلة الجديدة بسرعة.
 * ───────────────────────────────────────────────────────────────────── */

const SETUP_FALLBACK_SECTION = 'منوعات';
const SETUP_CUSTOM_SECTION = '__mine__';
const TEAM_SLOTS = 3;

function topicSectionName(topicName){
  return (CATEGORY_SECTIONS.byTopic && CATEGORY_SECTIONS.byTopic[topicName]) || SETUP_FALLBACK_SECTION;
}

/* الأقسام اللي بيها فئات فعلاً، بترتيب قاعدة البيانات. «منوعات» دائماً
   موجود للفئات بلا قسم، حتى لو القائمة ما وصلت (أوفلاين أول مرة). */
function setupSections(){
  const counts = {};
  CATEGORY_TOPICS.forEach(t => { const s = topicSectionName(t); counts[s] = (counts[s] || 0) + 1; });
  const list = (CATEGORY_SECTIONS.list || []).slice();
  if(!list.some(s => s.name === SETUP_FALLBACK_SECTION)){
    list.push({ name: SETUP_FALLBACK_SECTION, emoji: '🛍️', sort_order: 9999 });
  }
  return list.filter(s => counts[s.name]).map(s => ({ name: s.name, emoji: s.emoji || '', count: counts[s.name] }));
}

function teamPicks(ti){
  return state.selectedTopicIds
    .map(id => state.pool.find(t => t.id === id))
    .filter(t => t && t.taken && t.takenBy === ti);
}

function setupReady(){
  return teamPicks(0).length === TEAM_SLOTS && teamPicks(1).length === TEAM_SLOTS;
}

function pickedBankTopic(name){
  return state.pool.find(t => t.bankKey === name && t.taken) || null;
}

/* فئة بنك تنضاف للحوض بس لمن تنختار، وبلا أسئلة لحد ما تبدي اللعبة */
function makeLazyBankTopic(name){
  return { id: nextId(), name: name, bankKey: name, taken: false, takenBy: null, expanded: false, questions: null };
}

function assignTopic(topic){
  let ti = state.setupActiveTeam === 1 ? 1 : 0;
  if(teamPicks(ti).length >= TEAM_SLOTS){
    const other = ti ? 0 : 1;
    if(teamPicks(other).length >= TEAM_SLOTS) return false;     // الكل مليان
    ti = other;
  }
  if(topic.bankKey && !state.pool.includes(topic)) state.pool.push(topic);
  topic.taken = true;
  topic.takenBy = ti;
  state.selectedTopicIds.push(topic.id);
  /* الفريق كمّل ٣؟ ننقل الاختيار للثاني حتى ما يحتاج ضغطة زايدة */
  if(teamPicks(ti).length >= TEAM_SLOTS && teamPicks(ti ? 0 : 1).length < TEAM_SLOTS){
    state.setupActiveTeam = ti ? 0 : 1;
  } else {
    state.setupActiveTeam = ti;
  }
  return true;
}

function unassignTopic(topic){
  const ti = topic.takenBy;
  topic.taken = false;
  topic.takenBy = null;
  state.selectedTopicIds = state.selectedTopicIds.filter(id => id !== topic.id);
  if(topic.bankKey) state.pool = state.pool.filter(t => t.id !== topic.id);
  if(ti === 0 || ti === 1) state.setupActiveTeam = ti;           // الخانة اللي فرغت تنتظر بديل
}

function toggleBankTopic(name){
  const picked = pickedBankTopic(name);
  if(picked) unassignTopic(picked);
  else assignTopic(makeLazyBankTopic(name));
  render();
}

function toggleCustomTopic(topic){
  if(topic.taken) unassignTopic(topic);
  else assignTopic(topic);
  render();
}

/* تبدي اللعبة: تسحب أسئلة الفئات المختارة بس، وتصفّر الجولة */
function startCategoryGame(){
  if(!setupReady()) return;
  state.selectedTopicIds.forEach(id => {
    const t = state.pool.find(x => x.id === id);
    if(t && t.bankKey && !t.questions) t.questions = pickQuestionsForBankTopic(t.bankKey);
  });
  state.turn = 0;
  /* سؤال مفتوح من لعبة سابقة (طلعوا منها وهو مفتوح) يأشّر على فئة ما
     موجودة باللعبة الجديدة — لو بقى، اللوح ينكسر أول ما يترسم */
  state.activeCell = null;
  state.helpHints = {0:null, 1:null};
  state.teams[0].score = 0;
  state.teams[1].score = 0;
  resetTeamHelps();                // كل مساعدة ترجع متاحة مرة وحدة للعبة الجديدة
  state.statsRecordedForThisGame = false;
  startTeamScoreRun();
  resetAdGates();
  showBreakAd('start');
  goto('board');
}

/* ---------- الرسم ---------- */

function renderSetupTeam(ti){
  const team = state.teams[ti];
  const picks = teamPicks(ti);
  const active = state.setupActiveTeam === ti;
  const box = el(`<div class="setup-team t${ti} ${active ? 'active' : ''}">
    <div class="setup-team-head">
      <input type="text" class="setup-team-name" id="t${ti}name" maxlength="30"
             value="${escapeAttr(team.name)}" aria-label="اسم الفريق"/>
      <button class="btn btn-ghost btn-sm setup-choose" type="button">${active ? '✓ دوره يختار' : 'اختار له'}</button>
    </div>
    <div class="setup-slots"></div>
  </div>`);
  const slots = box.querySelector('.setup-slots');
  for(let i = 0; i < TEAM_SLOTS; i++){
    const t = picks[i];
    const slot = el(t
      ? `<button class="setup-slot filled" type="button" title="اضغط حتى تشيلها">
           <span class="setup-slot-name">${escapeAttr(t.name)}</span><span class="setup-slot-x">✕</span>
         </button>`
      : `<button class="setup-slot" type="button">＋</button>`);
    slot.addEventListener('click', ()=>{
      if(t) unassignTopic(t); else state.setupActiveTeam = ti;
      render();
    });
    slots.appendChild(slot);
  }
  box.querySelector('.setup-choose').addEventListener('click', ()=>{ state.setupActiveTeam = ti; render(); });
  box.querySelector('.setup-team-name').addEventListener('input', e=>{
    state.teams[ti].name = e.target.value || (ti ? 'الفريق الثاني' : 'الفريق الأول');
  });
  return box;
}

function renderGameSettingsPanel(){
  const box = el(`<div class="setup-settings"></div>`);

  const timer = el(`<div>
    <div class="toggle-row">
      <span>⏱️ مؤقت لكل سؤال</span>
      <div class="switch ${state.timerEnabled?'on':''}" id="timer-switch"><div class="knob"></div></div>
    </div>
    <div class="field" style="margin-top:12px; ${state.timerEnabled?'':'display:none;'}" id="timer-duration-field">
      <label>مدة كل سؤال (بالثواني)</label>
      <input type="number" id="timer-seconds" min="10" max="180" value="${state.timerSeconds}"/>
    </div>
  </div>`);
  timer.querySelector('#timer-switch').addEventListener('click', ()=>{ state.timerEnabled = !state.timerEnabled; render(); });
  const sec = timer.querySelector('#timer-seconds');
  if(sec) sec.addEventListener('input', e=>{ state.timerSeconds = Math.max(5, parseInt(e.target.value||'30',10)); });
  box.appendChild(timer);

  /* المساعدات: أي وحدة تظهر. كل وحدة مرة لكل فريق باللعبة */
  const anyOn = HELP_TYPES.some(h => helpIsOn(h.key));
  const helps = el(`<div style="margin-top:14px;">
    <div class="section-sub" style="margin-bottom:6px;">المساعدات — كل فريق يستخدم كل مساعدة مرة وحدة باللعبة</div>
    <div id="helps-toggles"></div>
    ${anyOn ? '' : '<div class="section-sub" style="margin-top:10px; color:var(--rose);">كل المساعدات مطفّاة — ما راح يظهر صندوق المساعدات.</div>'}
  </div>`);
  const toggles = helps.querySelector('#helps-toggles');
  HELP_TYPES.forEach(h=>{
    const on = helpIsOn(h.key);
    const row = el(`<div class="toggle-row">
      <span>${h.label}${h.bankOnly ? ' <small style="color:var(--muted);">(مواضيع البنك فقط)</small>' : ''}</span>
      <div class="switch ${on?'on':''}" data-help="${h.key}"><div class="knob"></div></div>
    </div>`);
    row.querySelector('.switch').addEventListener('click', ()=>{ state.helpsEnabled[h.key] = !helpIsOn(h.key); render(); });
    toggles.appendChild(row);
  });
  box.appendChild(helps);
  return box;
}

function setupTopicCard(name, topic){
  const taken = topic && topic.taken;
  const card = el(`<button type="button" class="pick-card setup-card ${taken ? 'picked t' + topic.takenBy : ''}">
    <span class="setup-card-name">${escapeAttr(name)}</span>
    ${taken ? `<span class="taken-by">✓ ${escapeAttr(state.teams[topic.takenBy].name)}</span>` : ''}
  </button>`);
  return card;
}

/* قائمة الفئات تنرسم لحالها، حتى الكتابة بالبحث ما تعيد رسم الشاشة كلها
   وتضيّع المؤشر من خانة البحث */
function fillSetupList(container){
  container.innerHTML = '';
  const q = normalizeArabic(state.setupSearch || '');
  const matches = name => !q || normalizeArabic(name).indexOf(q) !== -1;
  const customs = state.pool.filter(t => t.bankKey === null);
  const sec = state.setupSection;

  const addGrid = (title, items) => {
    if(!items.length) return;
    if(title) container.appendChild(el(`<div class="setup-section-head">${title}</div>`));
    const grid = el(`<div class="pick-grid"></div>`);
    items.forEach(it => grid.appendChild(it));
    container.appendChild(grid);
  };

  /* بطاقة الفئة الخاصة بيها أداتين: ⚑ بلاغ (للمنشورة بس — Apple 1.2 /
     سياسة Google للمحتوى اللي يكتبه المستخدمين) و✕ تشيلها من القائمة */
  const customCards = () => customs.filter(t => matches(t.name)).map(t => {
    const c = el(`<div class="pick-card setup-card setup-custom ${t.taken ? 'picked t' + t.takenBy : ''}" role="button" tabindex="0">
      <span class="setup-card-name">${escapeAttr(t.name)}</span>
      ${t.taken ? `<span class="taken-by">✓ ${escapeAttr(state.teams[t.takenBy].name)}</span>` : ''}
      <span class="setup-card-tools">
        ${t.sharedCode ? `<button class="btn btn-ghost btn-sm report-btn" type="button" title="بلّغ عن محتوى مسيء">⚑ بلّغ</button>` : ''}
        <button class="remove-x" type="button" title="شيلها من القائمة">✕</button>
      </span>
    </div>`);
    c.addEventListener('click', ()=> toggleCustomTopic(t));
    const rep = c.querySelector('.report-btn');
    if(rep) rep.addEventListener('click', e=>{ e.stopPropagation(); openReportModal(t); });
    c.querySelector('.remove-x').addEventListener('click', e=>{
      e.stopPropagation();
      if(t.taken) unassignTopic(t);
      state.pool = state.pool.filter(x => x.id !== t.id);
      render();
    });
    return c;
  });
  const bankCards = names => names.filter(matches).map(n => {
    const c = setupTopicCard(n, pickedBankTopic(n));
    c.addEventListener('click', ()=> toggleBankTopic(n));
    return c;
  });

  if(sec === SETUP_CUSTOM_SECTION){
    addGrid('', customCards());
  } else if(q){
    /* البحث يدوّر بكل الأقسام، ويّا فئاتك */
    addGrid(customs.length ? '⭐ فئاتك' : '', customCards());
    setupSections().forEach(s => {
      addGrid(`${s.emoji} ${escapeAttr(s.name)}`, bankCards(CATEGORY_TOPICS.filter(t => topicSectionName(t) === s.name)));
    });
  } else if(sec && sec !== 'all'){
    addGrid('', bankCards(CATEGORY_TOPICS.filter(t => topicSectionName(t) === sec)));
  } else {
    addGrid(customs.length ? '⭐ فئاتك' : '', customCards());
    setupSections().forEach(s => {
      addGrid(`${s.emoji} ${escapeAttr(s.name)} <small>(${s.count})</small>`,
              bankCards(CATEGORY_TOPICS.filter(t => topicSectionName(t) === s.name)));
    });
  }

  if(!container.children.length){
    container.appendChild(el(`<div class="section-sub" style="text-align:center; padding:18px 0;">
      ما لقيت فئة بهذا الاسم${q ? ' — جرّب كلمة ثانية' : ''}</div>`));
  }
}

function renderCategorySetup(){
  const wrap = el(`<div class="setup-wrap"></div>`);
  const aName = escapeAttr(state.teams[state.setupActiveTeam === 1 ? 1 : 0].name);
  const aCount = teamPicks(state.setupActiveTeam === 1 ? 1 : 0).length;
  const ready = setupReady();

  const top = el(`<div class="panel">
    <div class="section-title">جهّزوا اللعبة</div>
    <div class="section-sub">كل فريق يختار ٣ فئات. اضغط «اختار له» جنب الفريق، وبعدها اختار من القائمة — وأي فئة مختارة تنضغط فتنشال.</div>
    <div class="setup-teams"></div>
    <div class="setup-hint">${ready ? '✓ الفئات كاملة — جاهزين نبدي' : `هسه تختار لـ <b>${aName}</b> (${aCount} من ${TEAM_SLOTS})`}</div>
    <button class="btn btn-ghost btn-sm setup-settings-toggle" type="button" id="setup-settings-btn">
      ⚙️ المؤقت والمساعدات ${state.setupShowSettings ? '▴' : '▾'}</button>
  </div>`);
  const teams = top.querySelector('.setup-teams');
  teams.appendChild(renderSetupTeam(0));
  teams.appendChild(renderSetupTeam(1));
  top.querySelector('#setup-settings-btn').addEventListener('click', ()=>{
    state.setupShowSettings = !state.setupShowSettings; render();
  });
  if(state.setupShowSettings) top.appendChild(renderGameSettingsPanel());
  wrap.appendChild(top);

  /* بحث + أقسام */
  const customs = state.pool.filter(t => t.bankKey === null);
  const chipsHtml = [{ key:'all', label:'الكل' }]
    .concat(customs.length ? [{ key: SETUP_CUSTOM_SECTION, label: '⭐ فئاتك' }] : [])
    .concat(setupSections().map(s => ({ key: s.name, label: `${s.emoji} ${s.name}` })))
    .map(c => `<button type="button" class="setup-chip ${state.setupSection === c.key ? 'on' : ''}"
                 data-sec="${escapeAttr(c.key)}">${escapeAttr(c.label)}</button>`).join('');
  const browse = el(`<div class="panel">
    <input type="search" id="setup-search" class="setup-search" placeholder="🔍 دوّر على فئة…"
           value="${escapeAttr(state.setupSearch || '')}" autocomplete="off"/>
    <div class="setup-chips">${chipsHtml}</div>
    <div id="setup-list"></div>
  </div>`);
  const list = browse.querySelector('#setup-list');
  fillSetupList(list);
  browse.querySelector('#setup-search').addEventListener('input', e=>{
    state.setupSearch = e.target.value;
    fillSetupList(list);
  });
  browse.querySelectorAll('.setup-chip').forEach(b => b.addEventListener('click', ()=>{
    state.setupSection = b.dataset.sec;
    render();
  }));
  wrap.appendChild(browse);

  /* فئات خاصة: سوّي فئة، استورد بكود، فئاتي المحفوظة */
  wrap.appendChild(renderCustomTopicsPanel());

  const actions = el(`<div class="btn-row setup-actions">
    <button class="btn btn-gold" id="setup-start" ${ready ? '' : 'disabled'}>ابدأ اللعبة</button>
    <button class="btn btn-ghost" id="setup-back">رجوع</button>
  </div>`);
  actions.querySelector('#setup-start').addEventListener('click', startCategoryGame);
  actions.querySelector('#setup-back').addEventListener('click', ()=> goto('hub'));
  wrap.appendChild(actions);

  return wrap;
}
