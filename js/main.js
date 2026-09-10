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

render();
initAdMob();
if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App){ window.Capacitor.Plugins.App.addListener('backButton', ()=>{ if(state.history && state.history.length){ goBack(); } else if(state.screen !== 'hub'){ goto('hub'); } else { window.Capacitor.Plugins.App.exitApp(); } }); }
document.addEventListener('click', function(e){ alert('ضغطت على: ' + e.target.tagName + ' id=' + e.target.id + ' class=' + e.target.className); if(e.target.closest('#back-arrow')){ stopTimer(); stopWhoamiTimer(); goBack(); } });
