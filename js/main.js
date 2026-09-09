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
