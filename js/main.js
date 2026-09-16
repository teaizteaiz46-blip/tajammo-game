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
if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App){ window.Capacitor.Plugins.App.addListener('backButton', ()=>{ if(state.history && state.history.length){ goBack(); } else if(state.screen !== 'hub'){ goto('hub'); } else { window.Capacitor.Plugins.App.exitApp(); } }); }
document.addEventListener('click', function(e){ if(e.target.closest('#back-arrow')){ stopTimer(); goBack(); } });
