/* ============================ «لاحظت غلط؟» — ملاحظات اللاعبين على الأسئلة ============================ */
/* زر صغير بنافذة كل سؤال من البنك: اللاعب يختار شنو الغلط ويكتب ملاحظة إذا يريد،
   والبلاغ يوصل لتبويب «ملاحظات اللاعبين» بلوحة الإدارة. نسخة السؤال (الفئة،
   النص، الجواب، الخيارات) ياخذها السيرفر من قاعدة البيانات وقت البلاغ.

   وأول مرة يبدون لعبة فئات على هذا الموبايل تطلع ملاحظة تعرّفهم بالزر. */

const FEEDBACK_INTRO_KEY = 'tajammo.feedbackIntroSeen';
const FEEDBACK_REASONS = [
  { key: 'wrong_answer',     label: 'الجواب غلط' },
  { key: 'unclear_question', label: 'السؤال غلط أو مو واضح' },
  { key: 'wrong_choices',    label: 'الخيارات غلط' },
  { key: 'media',            label: 'المقطع أو الصورة ما تشتغل' },
  { key: 'other',            label: 'اقتراح أو شي ثاني' }
];
const FEEDBACK_NOTE_MAX = 300;

function feedbackIntroSeen(){
  try{ return localStorage.getItem(FEEDBACK_INTRO_KEY) === '1'; }catch(e){ return true; }
}

/* زر «ابدأ اللعبة» بشاشة التجهيز: أول مرة الملاحظة، بعدها اللعبة مباشرة */
function startCategoryGameWithIntro(){
  if(!setupReady()) return;
  if(feedbackIntroSeen()) return startCategoryGame();
  state.showFeedbackIntro = true;
  render();
}

function renderFeedbackIntro(){
  const overlay = el(`<div class="overlay"></div>`);
  const modal = el(`<div class="q-modal fb-intro">
    <div class="fb-intro-icon">💛</div>
    <div class="section-title" style="justify-content:center;">ساعدنا نطوّر اللعبة</div>
    <p>نريد نخليها تصير أحلى. على كل سؤال راح تلگى زر
      <b class="fb-chip">✏️ لاحظت غلط؟</b>
      — إذا شفت سؤال أو جواب غلط، أو عندك فكرة تحسّنه، اضغطه وگلّنا.</p>
    <p class="fb-thanks">شكراً إلك 🙏</p>
    <button class="btn btn-gold" id="fb-intro-go" style="width:100%;">يلا نلعب</button>
  </div>`);
  modal.querySelector('#fb-intro-go').addEventListener('click', ()=>{
    try{ localStorage.setItem(FEEDBACK_INTRO_KEY, '1'); }catch(e){}
    state.showFeedbackIntro = false;
    render();
    startCategoryGame();
  });
  overlay.appendChild(modal);
  return overlay;
}

function openQuestionFeedback(topic, q){
  if(typeof stopTimer === 'function') stopTimer();
  state.feedbackQ = { id: q.bankId, topic: topic.name, text: q.text, answer: q.answer };
  state.feedbackReason = '';
  state.feedbackNote = '';
  state.feedbackError = '';
  state.feedbackDone = false;
  state.feedbackBusy = false;
  render();
}

function closeQuestionFeedback(){
  state.feedbackQ = null;
  render();
}

async function submitQuestionFeedback(){
  const f = state.feedbackQ;
  if(!f || state.feedbackBusy) return;
  if(!state.feedbackReason){ state.feedbackError = 'اختار شنو الغلط أول.'; render(); return; }
  state.feedbackBusy = true;
  state.feedbackError = '';
  render();
  try{
    if(!sb) throw new Error('offline');
    const { error } = await sb.rpc('submit_question_feedback', {
      p_question_id: f.id,
      p_reason: state.feedbackReason,
      p_note: (state.feedbackNote || '').trim().slice(0, FEEDBACK_NOTE_MAX),
      p_platform: typeof currentPlatform === 'function' ? currentPlatform() : 'web'
    });
    if(error) throw error;
    state.feedbackDone = true;
  }catch(e){
    const m = String((e && e.message) || e || '');
    state.feedbackError = m.includes('TOO_MANY')
      ? 'وصلتنا ملاحظات كثيرة منك اليوم — شكراً! جرّب باچر.'
      : m.includes('NO_QUESTION')
        ? 'هذا السؤال انعدّل أو انشال من قبل — شكراً إلك.'
        : 'ما وصلت — تأكد من الإنترنت وجرّب مرة ثانية.';
  }finally{
    state.feedbackBusy = false;
    render();
  }
}

function renderQuestionFeedbackOverlay(){
  const f = state.feedbackQ;
  const overlay = el(`<div class="overlay"></div>`);
  if(state.feedbackDone){
    const done = el(`<div class="q-modal fb-modal" style="text-align:center;">
      <div class="fb-intro-icon">💛</div>
      <div class="section-title" style="justify-content:center;">شكراً إلك!</div>
      <p class="section-sub">وصلتنا ملاحظتك، وراح نراجع السؤال ونصلّحه.</p>
      <button class="btn btn-gold" id="fb-close" style="width:100%;">رجوع للسؤال</button>
    </div>`);
    done.querySelector('#fb-close').addEventListener('click', closeQuestionFeedback);
    overlay.appendChild(done);
    return overlay;
  }
  const modal = el(`<div class="q-modal fb-modal" style="text-align:right;">
    <div class="section-title">✏️ ساعدنا نصحّح السؤال</div>
    <div class="fb-q">
      <div class="fb-q-topic">${escapeAttr(f.topic)}</div>
      <div>${escapeAttr(f.text)}</div>
      <div class="fb-q-a">الجواب: ${escapeAttr(f.answer)}</div>
    </div>
    <div class="section-sub" style="margin:0 0 8px;">شنو الغلط؟</div>
    <div class="fb-reasons">${FEEDBACK_REASONS.map(r =>
      `<button type="button" class="setup-chip ${state.feedbackReason === r.key ? 'on' : ''}" data-r="${r.key}">${r.label}</button>`).join('')}</div>
    <div class="field" style="margin-top:12px;">
      <textarea id="fb-note" maxlength="${FEEDBACK_NOTE_MAX}" rows="3"
        placeholder="اكتب الصح أو فكرتك (اختياري)">${escapeAttr(state.feedbackNote || '')}</textarea>
    </div>
    ${state.feedbackError ? `<div style="color:var(--rose); font-size:13px; margin-bottom:10px;">${escapeAttr(state.feedbackError)}</div>` : ''}
    <div class="btn-row" style="justify-content:center;">
      <button class="btn btn-gold" id="fb-send" ${state.feedbackBusy ? 'disabled' : ''}>${state.feedbackBusy ? '...' : 'أرسل'}</button>
      <button class="btn btn-ghost" id="fb-back">رجوع</button>
    </div>
  </div>`);
  modal.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', ()=>{
    state.feedbackReason = b.dataset.r;
    state.feedbackError = '';
    render();
  }));
  modal.querySelector('#fb-note').addEventListener('input', e => { state.feedbackNote = e.target.value; });
  modal.querySelector('#fb-send').addEventListener('click', submitQuestionFeedback);
  modal.querySelector('#fb-back').addEventListener('click', closeQuestionFeedback);
  overlay.appendChild(modal);
  return overlay;
}
