/* ============================ الفئات المخصصة (إنشاء + حفظ + مشاركة بكود) ============================
 *
 * الفكرة: الكروب يسوي فئة أسئلة عن نفسه، يحفظها بحسابه، ويطلع له كود قصير
 * ينقله بالواتساب لكروب ثاني فيلعبها. الاستيراد ما يحتاج حساب أبداً — هذا مقصود،
 * لأن هذي الميزة هي محرك الانتشار مو مصدر ربح.
 *
 * توزيع النقاط ثابت حتى يضل اللوح متوازن مع فئات البنك.
 */

const CUSTOM_POINTS_LAYOUT = [100, 100, 200, 200, 400, 600];
const CUSTOM_MAX_NAME = 60;

function newCustomDraft() {
  return {
    name: '',
    questions: CUSTOM_POINTS_LAYOUT.map(points => ({ question: '', answer: '', points }))
  };
}

/* يبني موضوعاً جاهزاً للّوح من بيانات فئة (مستوردة أو مسودّة) */
function makeCustomTopicFromData(name, questions, shareCode) {
  return {
    id: nextId(),
    name: name,
    bankKey: null,
    // sharedCode موجود يعني الفئة منشورة ويمكن التبليغ عنها
    sharedCode: shareCode || null,
    taken: false,
    takenBy: null,
    expanded: false,
    questions: questions.map(q => ({
      id: nextId(),
      text: q.question || q.text || '',
      answer: q.answer || '',
      points: q.points
    }))
  };
}

function customDraftFilledCount() {
  return state.customDraft.questions.filter(
    q => q.question.trim() && q.answer.trim()
  ).length;
}

function customDraftIsComplete() {
  return state.customDraft.name.trim().length > 0 && customDraftFilledCount() === 6;
}

/* ============================ حفظ ============================ */

async function saveCustomTopicToCloud() {
  if (!sb) { state.customError = 'تحتاج اتصال إنترنت حتى تحفظ الفئة.'; render(); return; }
  if (!state.user) {
    state.showAuthModal = true;
    state.authMode = 'signin';
    state.authError = '';
    state.customError = 'سجّل دخول حتى تحفظ فئتك ويطلع لك كود مشاركة.';
    render();
    return;
  }
  if (!customDraftIsComplete()) {
    state.customError = 'عبّي اسم الفئة وكل الأسئلة الستة مع أجوبتها.';
    render();
    return;
  }
  // سياسة Google: موافقة صريحة على الشروط قبل نشر أي محتوى
  if (needsTermsAcceptance()) {
    state.showTermsModal = true;
    state.termsError = '';
    render();
    return;
  }

  state.customSaving = true;
  state.customError = '';
  render();

  try {
    const payload = state.customDraft.questions.map(q => ({
      question: q.question.trim(),
      answer: q.answer.trim(),
      points: q.points
    }));

    const { data, error } = await sb.rpc('save_custom_topic', {
      p_name: state.customDraft.name.trim(),
      p_questions: payload
    });
    if (error) throw error;

    state.customShareCode = data.share_code;
    state.customSaving = false;

    // ضيفها للّوح فوراً حتى يقدر يلعبها بنفس الجلسة
    const already = state.pool.find(
      t => t.bankKey === null && t.name === state.customDraft.name.trim()
    );
    if (!already) {
      state.pool.push(makeCustomTopicFromData(state.customDraft.name.trim(), state.customDraft.questions, data.share_code));
    }

    state.myCustomTopics = [];   // أبطل الكاش حتى تظهر بالقائمة
    render();
  } catch (e) {
    state.customSaving = false;
    state.customError = translateCustomError(e);
    render();
  }
}

function translateCustomError(e) {
  const msg = (e && (e.message || e.error_description || e.hint)) || '';
  if (msg.includes('SIGNIN_REQUIRED')) return 'سجّل دخول أول حتى تحفظ الفئة.';
  if (msg.includes('SIX_QUESTIONS_REQUIRED')) return 'لازم ٦ أسئلة بالضبط.';
  if (msg.includes('custom_topics_name_check')) return 'اسم الفئة لازم يكون بين حرف و٦٠ حرف.';
  if (msg.toLowerCase().includes('failed to fetch')) return 'ما أكو اتصال إنترنت.';
  return msg || 'صار خطأ غير متوقع.';
}

/* ============================ استيراد بالكود ============================ */

async function importCustomTopicByCode(rawCode) {
  const code = (rawCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 4) { state.importError = 'الكود قصير — تأكد منه.'; render(); return; }
  if (!sb) { state.importError = 'تحتاج اتصال إنترنت حتى تجيب فئة بالكود.'; render(); return; }

  state.importBusy = true;
  state.importError = '';
  render();

  try {
    const { data, error } = await sb.rpc('get_custom_topic_by_code', { p_code: code });
    if (error) throw error;

    if (!data) {
      state.importBusy = false;
      state.importError = 'ما لقيت فئة بهذا الكود. تأكد من الحروف.';
      render();
      return;
    }
    if (data.hidden) {
      state.importBusy = false;
      state.importError = 'هذي الفئة مخفية بسبب بلاغات، وقيد المراجعة.';
      render();
      return;
    }
    if (!data.questions || data.questions.length === 0) {
      state.importBusy = false;
      state.importError = 'هذي الفئة فاضية — صاحبها ما كمّل أسئلتها.';
      render();
      return;
    }

    const exists = state.pool.find(t => t.bankKey === null && t.name === data.name);
    if (exists) {
      state.importBusy = false;
      state.importError = 'فئة "' + data.name + '" مضافة عندك أصلاً.';
      render();
      return;
    }

    state.pool.push(makeCustomTopicFromData(data.name, data.questions, code));
    state.importBusy = false;
    state.importCode = '';
    state.importedNotice = 'تمت إضافة فئة "' + data.name + '"' +
      (data.author_name ? ' من ' + data.author_name : '') + ' ✓';
    render();
  } catch (e) {
    state.importBusy = false;
    state.importError = translateCustomError(e);
    render();
  }
}

/* ============================ فئاتي المحفوظة ============================ */

async function loadMyCustomTopics() {
  if (!sb || !state.user) return;
  state.myCustomLoading = true;
  render();
  try {
    const { data, error } = await sb
      .from('custom_topics')
      .select('id, name, share_code, plays_count, custom_topic_questions(question, answer, points, sort_order)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    state.myCustomTopics = data || [];
  } catch (e) {
    state.customError = translateCustomError(e);
  }
  state.myCustomLoading = false;
  render();
}

async function deleteMyCustomTopic(id) {
  if (!sb || !state.user) return;
  try {
    const { error } = await sb.from('custom_topics').delete().eq('id', id);
    if (error) throw error;
    state.myCustomTopics = state.myCustomTopics.filter(t => t.id !== id);
    render();
  } catch (e) {
    state.customError = translateCustomError(e);
    render();
  }
}

function addSavedTopicToPool(saved) {
  const qs = (saved.custom_topic_questions || [])
    .slice()
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  if (!qs.length) return;
  if (state.pool.find(t => t.bankKey === null && t.name === saved.name)) return;
  state.pool.push(makeCustomTopicFromData(saved.name, qs, saved.share_code));
  render();
}

/* ============================ نسخ الكود ============================ */

function copyTextToClipboard(text, btn) {
  const done = () => {
    if (!btn) return;
    const old = btn.textContent;
    btn.textContent = 'تم النسخ ✓';
    setTimeout(() => { btn.textContent = old; }, 1600);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallback());
  } else {
    fallback();
  }
  function fallback() {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch (e) { /* المستخدم يقدر ينسخه بيده، الكود ظاهر قدامه */ }
  }
}

/* ============================ شاشة إنشاء الفئة ============================ */

function renderCustomEditor() {
  if (!state.customDraft) state.customDraft = newCustomDraft();
  const wrap = el(`<div></div>`);

  const head = el(`<div class="panel">
    <div class="section-title">سوّي فئة خاصة بكروبك</div>
    <div class="section-sub">
      ٦ أسئلة بنقاط متفاوتة، وتكتب الجواب وياها. بعد ما تحفظها يطلع لك
      <b style="color:var(--gold);">كود قصير</b> تنقله لأي كروب ثاني فيلعب نفس فئتك.
    </div>
    <div class="field">
      <input type="text" id="cd-name" maxlength="${CUSTOM_MAX_NAME}"
             placeholder="اسم الفئة — مثال: أسئلة عن شباب الصف"
             value="${escapeAttr(state.customDraft.name)}"/>
    </div>
    <div class="pool-counter">مكمّل <b>${customDraftFilledCount()}</b> من ٦ أسئلة</div>
  </div>`);
  head.querySelector('#cd-name').addEventListener('input', e => {
    state.customDraft.name = e.target.value;
  });
  wrap.appendChild(head);

  const block = el(`<div class="topic-block"><div class="q-grid"></div></div>`);
  const grid = block.querySelector('.q-grid');

  state.customDraft.questions.forEach((q, i) => {
    const row = el(`<div class="q-row" style="flex-direction:column; align-items:stretch; gap:8px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-family:'Changa'; color:var(--gold); font-size:14px; min-width:58px;">${q.points} نقطة</span>
        <input type="text" class="cd-q" data-i="${i}" placeholder="السؤال ${i + 1}"
               value="${escapeAttr(q.question)}" style="flex:1;"/>
      </div>
      <input type="text" class="cd-a" data-i="${i}" placeholder="الجواب الصحيح"
             value="${escapeAttr(q.answer)}"/>
    </div>`);
    row.querySelector('.cd-q').addEventListener('input', e => {
      state.customDraft.questions[i].question = e.target.value;
    });
    row.querySelector('.cd-a').addEventListener('input', e => {
      state.customDraft.questions[i].answer = e.target.value;
    });
    grid.appendChild(row);
  });
  wrap.appendChild(block);

  if (state.customError) {
    wrap.appendChild(el(`<div class="panel" style="border-color:var(--rose-dim); color:var(--rose);">
      ${escapeAttr(state.customError)}
    </div>`));
  }

  const actions = el(`<div class="btn-row">
    <button class="btn btn-gold" id="cd-save">${state.customSaving ? '...جاري الحفظ' : 'احفظ واطلع لي كود'}</button>
    <button class="btn btn-ghost" id="cd-session">استخدمها بهذي الجلسة بس</button>
    <button class="btn btn-ghost" id="cd-back">رجوع</button>
  </div>`);
  actions.querySelector('#cd-save').disabled = state.customSaving;
  actions.querySelector('#cd-save').addEventListener('click', saveCustomTopicToCloud);

  // مسار بلا حساب: يلعبها هسه وتضيع بعد اللعبة — حتى ما نسد الطريق على أحد
  actions.querySelector('#cd-session').addEventListener('click', () => {
    if (!state.customDraft.name.trim()) {
      state.customError = 'اكتب اسم الفئة أول.';
      render();
      return;
    }
    if (customDraftFilledCount() === 0) {
      state.customError = 'اكتب سؤال واحد على الأقل.';
      render();
      return;
    }
    state.pool.push(makeCustomTopicFromData(
      state.customDraft.name.trim(),
      state.customDraft.questions
    ));
    state.customDraft = newCustomDraft();
    state.customError = '';
    goto('editor');
  });
  actions.querySelector('#cd-back').addEventListener('click', () => {
    state.customError = '';
    goBack();
  });
  wrap.appendChild(actions);

  return wrap;
}

/* ============================ لوحة الفئات المخصصة داخل شاشة المواضيع ============================ */

function renderCustomTopicsPanel() {
  const wrap = el(`<div></div>`);

  const actions = el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">الفئات المخصصة</div>
    <div class="section-sub">سوّي فئة عن كروبك وشاركها بكود — مجاناً للكل.</div>
    <div class="btn-row" style="margin-top:0;">
      <button class="btn btn-gold btn-sm" id="ct-new">✏️ سوّي فئة جديدة</button>
      ${state.user ? `<button class="btn btn-ghost btn-sm" id="ct-mine">📁 فئاتي المحفوظة</button>` : ''}
    </div>
  </div>`);
  actions.querySelector('#ct-new').addEventListener('click', () => {
    state.customDraft = newCustomDraft();
    state.customError = '';
    goto('custom-editor');
  });
  if (state.user) {
    actions.querySelector('#ct-mine').addEventListener('click', loadMyCustomTopics);
  }
  wrap.appendChild(actions);

  /* استيراد بالكود */
  const imp = el(`<div class="panel">
    <div class="section-title" style="font-size:16px;">وصلك كود فئة؟</div>
    <div class="section-sub">اكتب الكود اللي وصلك من كروب ثاني — ما يحتاج حساب.</div>
    <div style="display:flex; gap:10px;">
      <input type="text" id="ct-code" placeholder="مثال: K7M2QP" maxlength="8"
             dir="ltr" style="text-align:center; letter-spacing:3px; font-family:'Changa'; text-transform:uppercase;"
             value="${escapeAttr(state.importCode || '')}"/>
      <button class="btn btn-gold btn-sm" id="ct-import" style="flex:none;">
        ${state.importBusy ? '...' : 'جيبها'}
      </button>
    </div>
    ${state.importError ? `<div style="color:var(--rose); font-size:13px; margin-top:10px;">${escapeAttr(state.importError)}</div>` : ''}
    ${state.importedNotice ? `<div style="color:var(--sage); font-size:13px; margin-top:10px;">${escapeAttr(state.importedNotice)}</div>` : ''}
  </div>`);
  const codeInput = imp.querySelector('#ct-code');
  codeInput.addEventListener('input', e => { state.importCode = e.target.value; });
  codeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') importCustomTopicByCode(state.importCode);
  });
  imp.querySelector('#ct-import').disabled = state.importBusy;
  imp.querySelector('#ct-import').addEventListener('click', () => importCustomTopicByCode(state.importCode));
  wrap.appendChild(imp);

  /* قائمة فئاتي المحفوظة */
  if (state.myCustomLoading) {
    wrap.appendChild(el(`<div class="panel"><div class="section-sub" style="margin:0;">...جاري تحميل فئاتك</div></div>`));
  } else if (state.myCustomTopics && state.myCustomTopics.length) {
    const panel = el(`<div class="panel">
      <div class="section-title" style="font-size:16px;">فئاتي المحفوظة</div>
    </div>`);
    state.myCustomTopics.forEach(t => {
      const inPool = !!state.pool.find(p => p.bankKey === null && p.name === t.name);
      const row = el(`<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 4px; border-top:1px solid var(--line); flex-wrap:wrap;">
        <div style="flex:1; min-width:150px;">
          <div style="color:var(--ivory); font-size:14px;">${escapeAttr(t.name)}</div>
          <div style="color:var(--muted); font-size:12px; margin-top:3px;">
            الكود <b style="color:var(--gold); letter-spacing:2px;" dir="ltr">${escapeAttr(t.share_code)}</b>
            · لُعبت ${t.plays_count || 0} مرة
          </div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn btn-ghost btn-sm ct-copy">انسخ الكود</button>
          <button class="btn btn-gold btn-sm ct-add" ${inPool ? 'disabled' : ''}>${inPool ? 'مضافة ✓' : 'أضفها'}</button>
          <button class="remove-x ct-del" title="حذف">✕</button>
        </div>
      </div>`);
      row.querySelector('.ct-copy').addEventListener('click', e => copyTextToClipboard(t.share_code, e.target));
      row.querySelector('.ct-add').addEventListener('click', () => addSavedTopicToPool(t));
      row.querySelector('.ct-del').addEventListener('click', () => {
        if (confirm('تحذف فئة "' + t.name + '"؟ الكود راح يبطل عند كل من عنده.')) {
          deleteMyCustomTopic(t.id);
        }
      });
      panel.appendChild(row);
    });
    wrap.appendChild(panel);
  }

  return wrap;
}

/* ============================ نافذة الكود بعد الحفظ ============================ */

function renderShareCodeOverlay() {
  const code = state.customShareCode;
  const shareText = 'العبوا فئتي بلعبة تجمّع — الكود: ' + code;
  const overlay = el(`<div class="overlay"></div>`);
  const modal = el(`<div class="q-modal" style="max-width:420px; text-align:center;">
    <div style="font-size:40px; margin-bottom:6px;">🔗</div>
    <div class="section-title" style="justify-content:center;">انحفظت فئتك</div>
    <p style="color:var(--muted); font-size:14px; margin-bottom:16px;">
      انقل هذا الكود لأي كروب — يدخلونه ويلعبون نفس فئتك بلا حساب.
    </p>
    <div style="font-family:'Changa'; font-size:38px; font-weight:800; color:var(--gold);
                letter-spacing:8px; padding:14px; border:1px dashed var(--gold-dim);
                border-radius:12px; margin-bottom:18px;" dir="ltr">${escapeAttr(code)}</div>
    <div class="btn-row" style="justify-content:center; margin-top:0;">
      <button class="btn btn-gold" id="sc-copy">انسخ الكود</button>
      <a class="btn btn-ghost" id="sc-wa" target="_blank" rel="noopener"
         href="https://wa.me/?text=${encodeURIComponent(shareText)}">شارك بالواتساب</a>
      <button class="btn btn-ghost" id="sc-close">تم</button>
    </div>
  </div>`);
  modal.querySelector('#sc-copy').addEventListener('click', e => copyTextToClipboard(code, e.target));
  modal.querySelector('#sc-close').addEventListener('click', () => {
    state.customShareCode = '';
    state.customDraft = newCustomDraft();
    goto('editor');
  });
  overlay.appendChild(modal);
  return overlay;
}

/* ============================ الإشراف على المحتوى ============================
 *
 * سياسة Google للمحتوى الذي ينشئه المستخدم تفرض ثلاثة أشياء على أي تطبيق
 * يخلي مستخدميه ينشرون محتوى لبعض:
 *   ١) تبليغ داخل التطبيق متاح لكل من يشوف المحتوى (حتى بلا حساب)
 *   ٢) إشراف فعلي — عندنا: إخفاء تلقائي بعد ٣ بلاغات + مراجعة يدوية
 *   ٣) موافقة على الشروط قبل نشر أي محتوى
 */

const TERMS_VERSION = '1.0';
const TERMS_URL = 'terms.html';

const REPORT_REASONS = [
  ['offensive', 'محتوى مسيء أو بذيء'],
  ['sexual',    'محتوى جنسي'],
  ['violence',  'عنف أو تهديد'],
  ['hate',      'كراهية أو تمييز أو إساءة لفئة'],
  ['spam',      'إعلان أو سبام'],
  ['wrong',     'معلومات غلط أو أجوبة خاطئة'],
  ['other',     'سبب ثاني']
];

function openReportModal(topic){
  state.reportTopic = topic;
  state.reportReason = '';
  state.reportNote = '';
  state.reportError = '';
  state.reportDone = false;
  render();
}

function closeReportModal(){
  state.reportTopic = null;
  state.reportDone = false;
  render();
}

async function submitReport(){
  if(!state.reportReason){
    state.reportError = 'اختار سبب البلاغ.';
    render();
    return;
  }
  const code = state.reportTopic && state.reportTopic.sharedCode;
  if(!code){
    state.reportError = 'هذي فئة محلية — ما تنشرت حتى تنبلّغ.';
    render();
    return;
  }
  if(!sb){
    state.reportError = 'تحتاج اتصال إنترنت حتى ترسل البلاغ.';
    render();
    return;
  }

  state.reportBusy = true;
  state.reportError = '';
  render();

  try{
    const { data, error } = await sb.rpc('report_custom_topic', {
      p_code: code,
      p_reason: state.reportReason,
      p_note: state.reportNote || null
    });
    if(error) throw error;

    state.reportBusy = false;
    if(data && data.ok === false){
      state.reportError = 'ما لقيت هذي الفئة.';
    } else {
      state.reportDone = true;
    }
    render();
  }catch(e){
    state.reportBusy = false;
    state.reportError = translateCustomError(e);
    render();
  }
}

function renderReportOverlay(){
  const t = state.reportTopic;
  const overlay = el(`<div class="overlay"></div>`);

  if(state.reportDone){
    const done = el(`<div class="q-modal" style="max-width:400px; text-align:center;">
      <div style="font-size:38px; margin-bottom:8px;">✓</div>
      <div class="section-title" style="justify-content:center;">وصلنا بلاغك</div>
      <p style="color:var(--muted); font-size:14px; margin-bottom:18px;">
        راح تُراجع الفئة. إذا وصلتها بلاغات كافية تنخفي فوراً عن الجميع
        لحد ما تنتهي المراجعة.
      </p>
      <div class="btn-row" style="justify-content:center; margin-top:0;">
        <button class="btn btn-gold" id="rep-close">تم</button>
      </div>
    </div>`);
    done.querySelector('#rep-close').addEventListener('click', closeReportModal);
    overlay.appendChild(done);
    return overlay;
  }

  const modal = el(`<div class="q-modal" style="max-width:440px; text-align:right;">
    <div class="section-title">بلّغ عن فئة</div>
    <div class="section-sub">
      «${escapeAttr(t ? t.name : '')}» — شنو المشكلة بيها؟
    </div>
    <div id="rep-reasons" style="display:flex; flex-direction:column; gap:7px; margin-bottom:14px;"></div>
    <div class="field">
      <input type="text" id="rep-note" maxlength="500"
             placeholder="تفاصيل إضافية (اختياري)" value="${escapeAttr(state.reportNote || '')}"/>
    </div>
    ${state.reportError ? `<div style="color:var(--rose); font-size:13px; margin-bottom:10px;">${escapeAttr(state.reportError)}</div>` : ''}
    <div class="btn-row" style="justify-content:center; margin-top:6px;">
      <button class="btn btn-gold" id="rep-send">${state.reportBusy ? '...' : 'أرسل البلاغ'}</button>
      <button class="btn btn-ghost" id="rep-cancel">إلغاء</button>
    </div>
  </div>`);

  const box = modal.querySelector('#rep-reasons');
  REPORT_REASONS.forEach(([key, label])=>{
    const on = state.reportReason === key;
    const b = el(`<button class="btn ${on ? 'btn-gold' : 'btn-ghost'} btn-sm"
                    style="text-align:right; justify-content:flex-start;">${escapeAttr(label)}</button>`);
    b.addEventListener('click', ()=>{ state.reportReason = key; state.reportError=''; render(); });
    box.appendChild(b);
  });

  modal.querySelector('#rep-note').addEventListener('input', e=>{ state.reportNote = e.target.value; });
  modal.querySelector('#rep-send').disabled = state.reportBusy;
  modal.querySelector('#rep-send').addEventListener('click', submitReport);
  modal.querySelector('#rep-cancel').addEventListener('click', closeReportModal);

  overlay.appendChild(modal);
  return overlay;
}

/* ============================ الموافقة على الشروط ============================ */

function needsTermsAcceptance(){
  return !!(state.user && !state.user.termsAcceptedAt);
}

async function acceptTerms(){
  if(!sb || !state.user) return false;
  try{
    const now = new Date().toISOString();
    const { error } = await sb.from('tajammo_profiles').update({
      terms_accepted_at: now,
      terms_accepted_version: TERMS_VERSION
    }).eq('id', state.user.uid);
    if(error) throw error;
    state.user.termsAcceptedAt = now;
    return true;
  }catch(e){
    state.customError = translateCustomError(e);
    return false;
  }
}

function renderTermsOverlay(){
  const overlay = el(`<div class="overlay"></div>`);
  const modal = el(`<div class="q-modal" style="max-width:460px; text-align:right;">
    <div class="section-title">قبل ما تنشر فئتك</div>
    <div class="section-sub" style="margin-bottom:14px;">
      فئتك راح تكون متاحة لأي شخص يوصله الكود. بالنشر إنت توافق على:
    </div>
    <div class="panel" style="text-align:right; margin-bottom:16px;">
      <div style="color:var(--muted); font-size:13.5px; line-height:2.1;">
        • ما تنشر محتوى مسيء، جنسي، عنيف، أو يحرّض على الكراهية<br>
        • ما تنشر معلومات شخصية عن أحد بلا إذنه<br>
        • ما تنشر إعلانات أو سبام<br>
        • تتحمل مسؤولية المحتوى اللي تكتبه<br>
        • المحتوى المخالف ينحذف، والحساب المتكرر ينحظر
      </div>
    </div>
    <div style="margin-bottom:16px;">
      <a href="${TERMS_URL}" target="_blank" rel="noopener"
         style="color:var(--gold); font-size:13px;">اقرأ شروط الاستخدام وسياسة الخصوصية ↗</a>
    </div>
    ${state.termsError ? `<div style="color:var(--rose); font-size:13px; margin-bottom:10px;">${escapeAttr(state.termsError)}</div>` : ''}
    <div class="btn-row" style="justify-content:center; margin-top:0;">
      <button class="btn btn-gold" id="terms-ok">${state.termsBusy ? '...' : 'أوافق وانشر'}</button>
      <button class="btn btn-ghost" id="terms-no">رجوع</button>
    </div>
  </div>`);

  modal.querySelector('#terms-ok').disabled = state.termsBusy;
  modal.querySelector('#terms-ok').addEventListener('click', async ()=>{
    state.termsBusy = true; state.termsError = ''; render();
    const ok = await acceptTerms();
    state.termsBusy = false;
    if(ok){
      state.showTermsModal = false;
      render();
      saveCustomTopicToCloud();     // نكمل الحفظ اللي وقفناه
    } else {
      state.termsError = 'تعذّر حفظ الموافقة — جرب مرة ثانية.';
      render();
    }
  });
  modal.querySelector('#terms-no').addEventListener('click', ()=>{
    state.showTermsModal = false;
    render();
  });

  overlay.appendChild(modal);
  return overlay;
}
