/* ============================ STATE ============================ */
const state = {
  screen: 'hub',
  history: [],
  timerEnabled: false,
  timerSeconds: 30,
  user: null,
  statsRecordedForThisGame: false,
  showAuthModal: false,
  authMode: 'signin',
  authError: '',
  authBusy: false,
  showUpsellModal: false,
  upsellMessage: '',
  categoryDataLoaded: false,
  categoryDataError: '',
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
  shdScores: {}
};

let uid = 1;
const nextId = () => 'id' + (uid++);

/* ============================ SUBSCRIPTION ============================ */
const FREE_TOPICS = ['جغرافيا','تاريخ','علوم','رياضة','سينما وتلفزيون','الأعلام'];

function isSubscribed(){
  return !!(state.user && state.user.isSubscribed);
}

function openUpsell(message){
  state.upsellMessage = message;
  state.showUpsellModal = true;
  render();
}

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

    function goto(screen){ if(state.screen!==screen) state.history.push(state.screen); state.screen = screen; render(); window.scrollTo({top:0, behavior:'smooth'}); }
    function goBack(){ if(state.history.length){ state.screen = state.history.pop(); render(); window.scrollTo({top:0, behavior:'smooth'}); } }

function escapeAttr(s){
  return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}
