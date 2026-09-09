/* ============================ CATEGORY QUESTION BANK (Supabase) ============================ */
let CATEGORY_TOPICS = [];
let CATEGORY_DATA = {};
const bankUsage = {};

async function loadCategoryDatabase(){
  if(!sb) throw new Error('لا يوجد اتصال بالإنترنت');
  const { data, error } = await sb
    .from('category_questions')
    .select('topic, points, question, answer, image')
    .limit(2000);
  if(error) throw error;
  const grouped = {};
  data.forEach(row=>{
    if(!grouped[row.topic]) grouped[row.topic] = { 100:[], 200:[], 400:[], 600:[] };
    const tier = grouped[row.topic][row.points] ? row.points : 200;
    grouped[row.topic][tier].push({ text:row.question, answer:row.answer, image:row.image });
  });
  CATEGORY_DATA = grouped;
  CATEGORY_TOPICS = Object.keys(grouped);
}

function shuffled(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function pickFromTier(tier, usedSet, n){
  let avail = tier.map((_,i)=>i).filter(i=>!usedSet.has(i));
  if(avail.length < n){ usedSet.clear(); avail = tier.map((_,i)=>i); }
  const chosen = shuffled(avail).slice(0,n);
  chosen.forEach(i=>usedSet.add(i));
  return chosen.map(i=>tier[i]);
}
function pickQuestionsForBankTopic(topicName){
  if(!bankUsage[topicName]) bankUsage[topicName] = { 100:new Set(), 200:new Set(), 400:new Set(), 600:new Set() };
  const bank = CATEGORY_DATA[topicName];
  const counts = { 100:2, 200:2, 400:1, 600:1 };
  const result = [];
  [100,200,400,600].forEach(pts=>{
    const picked = pickFromTier(bank[pts], bankUsage[topicName][pts], counts[pts]);
    picked.forEach(q=> result.push({ id:nextId(), text:q.text, answer:q.answer, points:pts, image:q.image }));
  });
  return result;
}

/* ============================ SUPABASE (حسابات + إحصائيات) ============================ */
const SUPABASE_URL = "https://pajxormplmloivyankji.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhanhvcm1wbG1sb2l2eWFua2ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0ODQ3OTksImV4cCI6MjA3NjA2MDc5OX0.eEPB_Gt5HywU9oGNXLpSNc4IA7CTTL7CX-EMKDE3yec";

let sb = null;
try{
  if(typeof supabase !== 'undefined'){
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
}catch(e){ console.warn('تعذّر تهيئة Supabase (لا يوجد اتصال بالإنترنت على الأغلب)', e); }

async function signUpWithEmail(email, password){
  if(!sb) throw new Error('لا يوجد اتصال بالإنترنت');
  const { error } = await sb.auth.signUp({ email, password });
  if(error) throw error;
}

async function signInWithEmail(email, password){
  if(!sb) throw new Error('لا يوجد اتصال بالإنترنت');
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if(error) throw error;
}

function signOutUser(){
  if(!sb) return;
  sb.auth.signOut();
}

async function loadOrCreateProfile(authUser){
  let { data } = await sb.from('tajammo_profiles').select('*').eq('id', authUser.id).single();
  if(!data){
    const fresh = {
      id: authUser.id,
      name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || (authUser.email ? authUser.email.split('@')[0] : 'لاعب'),
      email: authUser.email || '',
      avatar_url: '',
      games_played: 0,
      total_points: 0
    };
    const { data: inserted, error: insertErr } = await sb.from('tajammo_profiles').insert(fresh).select().single();
    if(insertErr){
      console.warn('تعذّر إنشاء الملف الشخصي', insertErr);
      return { uid: authUser.id, name: fresh.name, photo: '', gamesPlayed: 0, totalPoints: 0 };
    }
    data = inserted;
  }
  return {
    uid: authUser.id,
    name: data.name,
    photo: data.avatar_url,
    gamesPlayed: data.games_played,
    totalPoints: data.total_points
  };
}

async function recordGameResult(totalPoints){
  if(!sb || !state.user) return;
  const newGamesPlayed = (state.user.gamesPlayed||0) + 1;
  const newTotalPoints = (state.user.totalPoints||0) + totalPoints;
  try{
    await sb.from('tajammo_profiles').update({
      games_played: newGamesPlayed,
      total_points: newTotalPoints,
      last_played_at: new Date().toISOString()
    }).eq('id', state.user.uid);
    state.user.gamesPlayed = newGamesPlayed;
    state.user.totalPoints = newTotalPoints;
  } catch(e){ console.warn('تعذّر حفظ الإحصائيات', e); }
}

if(sb){
  sb.auth.onAuthStateChange(async (event, session)=>{
    if(session && session.user){
      state.user = await loadOrCreateProfile(session.user);
    } else {
      state.user = null;
    }
    render();
  });
}
