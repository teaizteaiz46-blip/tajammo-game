/* ============================ STATE ============================ */
const state = {
  screen: 'hub',
  history: [],
  timerEnabled: false,
  timerSeconds: 30,
  /* أي مساعدة تظهر باللعبة — تنضبط من شاشة الإعدادات قبل ما تبدي الجولة.
     «تبديل السؤال» تشتغل بمواضيع البنك بس (الفئات الخاصة ماكو منها بديل). */
  helpsEnabled: { letter:true, blanks:true, choices:true, swap:true },
  helpsPerTeam: 3,
  user: null,
  statsRecordedForThisGame: false,
  lastReward: null,          // نتيجة award_game_coins لآخر لعبة
  showAuthModal: false,
  authMode: 'signin',
  authError: '',
  authBusy: false,
  categoryDataLoaded: false,
  categoryDataError: '',

  // الفئات المخصصة (إنشاء / حفظ / مشاركة بكود)
  customDraft: null,
  customSaving: false,
  customError: '',
  customShareCode: '',
  myCustomTopics: [],
  myCustomLoading: false,
  importCode: '',
  importBusy: false,
  importError: '',
  importedNotice: '',

  // الإشراف على المحتوى (متطلبات سياسة Google للـ UGC)
  reportTopic: null,
  reportReason: '',
  reportNote: '',
  reportBusy: false,
  reportError: '',
  reportDone: false,
  showTermsModal: false,
  termsBusy: false,
  termsError: '',
  blockAuthorToo: false,     // يحظر الناشر مع إرسال البلاغ

  // شاشة الحساب (تسجيل خروج / حذف الحساب — متطلب App Store 5.1.1(v))
  showAccountModal: false,
  accountDeleteStep: false,
  accountDeleteTyped: '',
  accountBusy: false,
  accountError: '',

  teams: [
    { name: 'الفريق الأول', score: 0, helps: 3 },
    { name: 'الفريق الثاني', score: 0, helps: 3 }
  ],
  pool: [],
  selectedTopicIds: [],
  turn: 0,
  activeCell: null,
  helpHints: {0:null, 1:null},
  timerLeft: 0,
  timerHandle: null,

  whoamiPlayerCount: 5,
  whoamiPlayerNames: [],
  whoamiPlayers: [],
  whoamiRevealIndex: 0,
  whoamiRevealShown: false,
  whoamiTurn: 0,
  whoamiFinishOrder: [],
  whoamiTimerEnabled: false,
  whoamiTimerSeconds: 30,
  whoamiTimerLeft: 0,
  whoamiTimerHandle: null,
  whoamiLoading: false,
  whoamiError: '',

  shdPlayerCount: 6,
  shdPlayerNames: [],
  shdPlayers: [],
  shdDemonCount: 1,
  shdDoctorCount: 0,
  shdPoliceCount: 0,
  shdRevealIndex: 0,
  shdRevealShown: false,
  shdWinner: null,
  shdScores: {},

  // من الدخيل؟
  spyPlayerCount: 5,
  spyPlayerNames: [],
  spyPlayers: [],
  spySpyCount: 1,
  spyPlace: '',
  spyPool: [],
  spyRevealIndex: 0,
  spyRevealShown: false,
  spyMinutes: 6,
  spyTimerLeft: 0,
  spyTimerHandle: null,
  spyVotes: {},
  spyVoteIndex: 0,
  spyRoundResult: null,
  spyScores: {},
  spyLoading: false,
  spyError: '',

  // القنبلة الموقوتة
  bombPlayerCount: 5,
  bombPlayerNames: [],
  bombPlayers: [],
  bombKnockedOut: [],
  bombCategory: '',
  bombExamples: '',
  bombTurnSec: 8,     // ثواني كل لاعب بدوره
  bombFloorSec: 3,    // ما ينزل تحتها مهما طالت الجولة
  bombShrink: true,   // ينقص ثانية كل لفة — يمنع الجولة تدور للأبد
  bombLap: 0,
  bombPasses: 0,
  bombDeadline: 0,
  bombLastTickSec: -1,
  bombHandle: null,
  bombCurrent: 0,
  bombExploded: false,
  bombLoserIndex: null,
  bombWinner: null,
  bombLoading: false,
  bombError: ''
};

let uid = 1;
const nextId = () => 'id' + (uid++);

/* ============================ SUBSCRIPTION ============================ */
/* ماكو اشتراك ولا قفل: كل المواضيع وكل الألعاب مفتوحة للجميع،
   والدخل كله من الإعلانات. */

/* ============================ HELPERS ============================ */
function makeCustomTopic(name){
  return {
    id: nextId(),
    name: name,
    bankKey: null,
    taken:false, takenBy:null,
    expanded:false,
    questions:[
      { id: nextId(), text:'', answer:'', points:100 },
      { id: nextId(), text:'', answer:'', points:100 },
      { id: nextId(), text:'', answer:'', points:200 },
      { id: nextId(), text:'', answer:'', points:200 },
      { id: nextId(), text:'', answer:'', points:400 },
      { id: nextId(), text:'', answer:'', points:600 }
    ]
  };
}
function makeBankTopic(topicName){
  return {
    id: nextId(),
    name: topicName,
    bankKey: topicName,
    taken:false, takenBy:null,
    expanded:false,
    questions: pickQuestionsForBankTopic(topicName)
  };
}

function el(html){
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/* ================= حظر الناشرين (متطلب App Store 1.2) =================
   القائمة تنحفظ بالجهاز مو بالحساب، لأن الاستيراد بالكود يشتغل بلا تسجيل
   دخول — فلو ربطناها بالحساب يبقى غير المسجّلين بلا وسيلة حظر.
   author_key بصمة مجهولة للناشر ترجع من السيرفر، مو معرّفه الحقيقي. */
const BLOCKED_AUTHORS_KEY = 'tajammo.blockedAuthors.v1';

function loadBlockedAuthors(){
  try{
    const raw = localStorage.getItem(BLOCKED_AUTHORS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  }catch(e){ return []; }
}

function saveBlockedAuthors(list){
  try{ localStorage.setItem(BLOCKED_AUTHORS_KEY, JSON.stringify(list.slice(0, 500))); }
  catch(e){ /* ذاكرة الجهاز ممتلئة — الحظر يضل شغال لهذي الجلسة */ }
}

function isAuthorBlocked(key){
  if(!key) return false;
  return loadBlockedAuthors().some(a => a.key === key);
}

function blockAuthor(key, name){
  if(!key || isAuthorBlocked(key)) return;
  const list = loadBlockedAuthors();
  list.unshift({ key: key, name: name || 'ناشر', at: Date.now() });
  saveBlockedAuthors(list);
  // شيل فئاته الموجودة بالحوض هم — الحظر ما ينفع إذا فئته باقية قدامه
  state.pool = state.pool.filter(t => !(t.authorKey && t.authorKey === key));
}

function unblockAuthor(key){
  saveBlockedAuthors(loadBlockedAuthors().filter(a => a.key !== key));
}

/* ================= تنظيف حالة الحساب عند الخروج =================
   بلا هذا تضل «فئاتي المحفوظة» ظاهرة وأزرارها شغّالة بعد تسجيل الخروج،
   لأن الشاشة ترسم من state.myCustomTopics مو من state.user.
   الفئات المستوردة بكود من ناشر ثاني تبقى — الاستيراد ما يحتاج حساب. */
function clearUserScopedState(){
  const myCodes = (state.myCustomTopics || []).map(t => t.share_code).filter(Boolean);
  if(myCodes.length){
    state.pool = state.pool.filter(t => !(t.sharedCode && myCodes.indexOf(t.sharedCode) !== -1));
  }
  state.myCustomTopics = [];
  state.myCustomLoading = false;
  state.customDraft = null;
  state.customShareCode = '';
  state.customError = '';
  state.customSaving = false;
  state.showAccountModal = false;
  state.accountDeleteStep = false;
  state.accountDeleteTyped = '';
  state.accountError = '';
  state.accountBusy = false;
  state.lastReward = null;
  state.statsRecordedForThisGame = false;
}

    function goto(screen){ if(state.screen!==screen) state.history.push(state.screen); state.screen = screen; render(); window.scrollTo({top:0, behavior:'smooth'}); }
    function goBack(){ if(state.history.length){ state.screen = state.history.pop(); render(); window.scrollTo({top:0, behavior:'smooth'}); } }

function escapeAttr(s){
  return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}
