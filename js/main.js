if(sb){
  sb.auth.onAuthStateChange(async (event, session)=>{
    if(session && session.user){
      state.user = await loadOrCreateProfile(session.user);
    } else {
      state.user = null;
      clearUserScopedState();
    }
    render();
  });
}

render();
initAdMob();
/* بنك الأسئلة ينزل بالخلفية من هسه، بينما اللاعب على الشاشة الرئيسية،
   حتى لمن يضغط «لعبة الفئات» ما ينتظر ولا ثانية. */
prefetchCategoryDatabase();
/* كلمات «من الدخيل؟» و«القنبلة»: تنقرأ من نسخة الجهاز فوراً، ويتحدث
   المخزون بالخلفية من Supabase — الاستبدال كامل، فالمحذوف يختفي. */
prefetchPartyItems();
if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App){ window.Capacitor.Plugins.App.addListener('backButton', ()=>{ if(state.history && state.history.length){ goBack(); } else if(state.screen !== 'hub'){ goto('hub'); } else { window.Capacitor.Plugins.App.exitApp(); } }); }
document.addEventListener('click', function(e){ if(e.target.closest('#back-arrow')){ stopTimer(); stopSpyTimer(); stopBombTicker(); goBack(); } });
