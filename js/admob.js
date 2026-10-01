/* ============================ ADMOB (إعلانات) ============================ */
/* يشتغل بس داخل التطبيق المُثبّت (Capacitor) — على الموقع بالمتصفح ما يسوي شي. */

/* معرّفات الإعلانات تختلف بين أندرويد وiOS — نفس المعرّف ما يخدم المنصتين.
   بدّل معرّفات iOS من AdMob بعد ما تسوي تطبيق iOS هناك. */
/* rewarded: وحدة «إعلان بمكافأة» — لازم تكون مفعّل بيها التحقق من السيرفر
   (SSV) على رابط دالة admob-ssv، وإلا الكوينز ما توصل. لمن تبقى _HERE
   أزرار الإعلان ما تطلع، والمتجر يشتغل بكوينات اللعب بس. */
const ADMOB_IDS_ANDROID = {
  banner: 'ca-app-pub-4662085630111714/7304234310',
  interstitial: 'ca-app-pub-4662085630111714/4127406637',
  rewarded: 'ca-app-pub-4662085630111714/4116153564'
};
const ADMOB_IDS_IOS = {
  banner: 'ca-app-pub-4662085630111714/7001331037',
  interstitial: 'ca-app-pub-4662085630111714/1563715255',
  rewarded: 'ca-app-pub-4662085630111714/4850650739'
};

function currentPlatform(){
  try{ return (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || 'web'; }
  catch(e){ return 'web'; }
}
function adIds(){
  return currentPlatform() === 'ios' ? ADMOB_IDS_IOS : ADMOB_IDS_ANDROID;
}
/* لو معرّفات iOS لسه ما انبدّلت، نطفّي الإعلانات بدل ما نطلع خطأ بكل فتح */
function adIdsReady(){
  const ids = adIds();
  return !!(ids.banner && ids.interstitial && !ids.banner.includes('_HERE'));
}

let admobReady = false;

function isNativeApp(){
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

/* ─────────────────────────────────────────────────────────────────────
   إذن التتبع (ATT) على iOS

   نافذة الإذن ما تطلع أبداً إذا انطلبت والتطبيق لسه مو «فعّال»
   (UIApplicationStateActive). النظام يرجّع الحالة الحالية بصمت بلا
   ما يعرض شي، وتبقى notDetermined. وهذا اللي صار برفض آبل بنسخة
   1.8 (12): كان يُنادى أول ما تتحمّل الصفحة، يعني قبل ما يصير
   التطبيق فعّال، فالمراجع ما شاف ولا طلب.

   فهسه ننتظر التطبيق يصير فعّال، وننطي الواجهة لحظة تظهر، وبعدها
   نطلب — وقبل initialize، لأن آبل تشترط الإذن قبل أي جمع بيانات.
   ───────────────────────────────────────────────────────────────────── */
function waitUntilAppActive(){
  return new Promise(resolve=>{
    const App = (window.Capacitor && window.Capacitor.Plugins)
                ? window.Capacitor.Plugins.App : null;
    let settled = false;
    /* نصف ثانية بعد ما يصير فعّال: النافذة تطلع فوق واجهة ظاهرة مو شاشة بيضة */
    const done = ()=>{ if(settled) return; settled = true; setTimeout(resolve, 500); };

    if(!App || !App.getState){ setTimeout(done, 800); return; }

    App.getState().then(s=>{ if(s && s.isActive) done(); }).catch(()=> done());
    try{ App.addListener('appStateChange', s=>{ if(s && s.isActive) done(); }); }
    catch(e){ /* ما يهم — أكو صمام أمان تحت */ }

    setTimeout(done, 5000);              // ما ننتظر للأبد لو ما وصلنا إشعار
  });
}

async function requestTrackingPermission(){
  if(currentPlatform() !== 'ios') return;
  const { AdMob } = window.Capacitor.Plugins;
  if(!AdMob || typeof AdMob.requestTrackingAuthorization !== 'function') return;
  try{
    /* لو اللاعب قرر قبل (وافق أو رفض)، النظام ما يعيد النافذة — ما نزعجه */
    if(typeof AdMob.trackingAuthorizationStatus === 'function'){
      const r = await AdMob.trackingAuthorizationStatus();
      if(r && r.status && r.status !== 'notDetermined') return;
    }
    await AdMob.requestTrackingAuthorization();
  }catch(e){ console.warn('إذن التتبع', e); }
}

/* شبكة أمان: لو المحاولة الأولى ما عرضت شي (الإضافة تنادي ATT بلا ما
   تضمن الخيط الرئيسي، والنظام يتجاهل الطلب بصمت بحالات معيّنة)، نعيد
   المحاولة أول ما يرجع التطبيق فعّال. النظام ما يعرض النافذة إلا مرة
   وحدة بالعمر، فلو انعرضت فعلاً الحالة ما تبقى notDetermined ونوقف. */
function watchTrackingPermission(){
  if(currentPlatform() !== 'ios') return;
  const App = (window.Capacitor && window.Capacitor.Plugins)
              ? window.Capacitor.Plugins.App : null;
  if(!App || !App.addListener) return;
  let tries = 0;
  try{
    App.addListener('appStateChange', s=>{
      if(!s || !s.isActive) return;
      if(tries++ >= 3) return;
      setTimeout(()=> requestTrackingPermission(), 700);
    });
  }catch(e){ /* بلا شبكة أمان — المحاولة الأولى تبقى شغالة */ }
}

async function initAdMob(){
  if(!isNativeApp()) return;
  if(!adIdsReady()){ console.warn('معرّفات الإعلانات لهذي المنصة ما انبدّلت — الإعلانات مطفية'); return; }
  try{
    const { AdMob } = window.Capacitor.Plugins;
    if(!AdMob) return;

    /* النص اللي يطلع بالنافذة موجود بـ Info.plist (NSUserTrackingUsageDescription).
       لو رفض اللاعب، AdMob يعرض إعلانات غير مخصصة — الإعلانات تبقى شغالة. */
    await waitUntilAppActive();
    await requestTrackingPermission();
    watchTrackingPermission();

    await AdMob.initialize({});
    admobReady = true;
    showBannerAd();
  }catch(e){ console.warn('تعذّر تشغيل الإعلانات', e); }
}

async function showBannerAd(){
  if(!admobReady) return;
  try{
    const { AdMob, BannerAdPosition, BannerAdSize } = window.Capacitor.Plugins;
    await AdMob.showBanner({
      adId: adIds().banner,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0
    });
  }catch(e){ console.warn('تعذّر عرض إعلان البانر', e); }
}

async function showInterstitialAd(){
  if(!admobReady) return;
  try{
    const { AdMob } = window.Capacitor.Plugins;
    await AdMob.prepareInterstitial({ adId: adIds().interstitial });
    await AdMob.showInterstitial();
  }catch(e){ console.warn('تعذّر عرض الإعلان البيني', e); }
}

/* ─────────────────────────────────────────────────────────────────────
   إعلان بمكافأة — دائماً باختيار اللاعب (شروط AdMob)

   الكوينز ما تنضاف من هنا. التطبيق يمرر «تذكرة» (رقم عشوائي من
   start_ad_reward) لكوكل، وكوكل يرجّعها لدالة admob-ssv بعد ما الإعلان
   يكمل، وهي تضيف الكوينز. فلو أحد عبث بالكود، ما ياخذ شي بلا إعلان.

   showRewardVideoAd ما يرد أبداً إذا اللاعب سكّر الإعلان قبل ما يخلص،
   فنراقب الإغلاق بنفسنا. النتيجة: 'ok' | 'closed' | 'nofill'
   ───────────────────────────────────────────────────────────────────── */
function rewardedAdsReady(){
  const id = adIds().rewarded;
  return isNativeApp() && admobReady && !!id && !id.includes('_HERE');
}

function showRewardedAd(token){
  return new Promise(async resolve=>{
    const { AdMob } = window.Capacitor.Plugins;
    const handles = [];
    let rewarded = false, done = false;
    const finish = result=>{
      if(done) return;
      done = true;
      handles.forEach(h=>{ try{ h && h.remove && h.remove(); }catch(e){} });
      resolve(result);
    };
    try{
      handles.push(await AdMob.addListener('onRewardedVideoAdReward', ()=>{ rewarded = true; }));
      /* المكافأة توصل قبل الإغلاق عادةً — نطي لحظة حتى ما نسبقها */
      handles.push(await AdMob.addListener('onRewardedVideoAdDismissed', ()=>{
        setTimeout(()=> finish(rewarded ? 'ok' : 'closed'), 400);
      }));
      handles.push(await AdMob.addListener('onRewardedVideoAdFailedToShow', ()=> finish('nofill')));
      await AdMob.prepareRewardVideoAd({ adId: adIds().rewarded, ssv: { customData: token } });
      AdMob.showRewardVideoAd().then(()=>{ rewarded = true; }).catch(()=> finish('nofill'));
    }catch(e){
      console.warn('تعذّر تحميل إعلان المكافأة', e);
      finish('nofill');
    }
  });
}

/* ─────────────────────────────────────────────────────────────────────
   إعلانات الفواصل

   الإعلان ما يطلع بنص الدور أبداً. اللعبة جماعية بغرفة وحدة — فيديو
   ٣٠ ثانية والمؤقت ماشي و٨ أشخاص ناطرين يقتل جو الجلسة. فبس بثلاث
   لحظات الناس أصلاً قاعدة تحچي بيهن: البداية، النص، والنهاية.

   كل لحظة مرة وحدة باللعبة — المفاتيح تنصفّر بـresetAdGates() لما
   تبدي جولة جديدة.
   ───────────────────────────────────────────────────────────────────── */
const adShown = { start:false, mid:false, end:false };

function resetAdGates(){
  adShown.start = false;
  adShown.mid = false;
  adShown.end = false;
}

/* slot = 'start' | 'mid' | 'end' */
function showBreakAd(slot){
  if(!isNativeApp() || !admobReady) return;
  if(adShown[slot]) return;
  adShown[slot] = true;
  showInterstitialAd();
}

/* عدد أسئلة اللوح المستهلكة — نستخدمه حتى نعرف وصلنا نص اللعبة لو لا */
function usedQuestionCount(){
  let n = 0;
  (state.pool||[]).forEach(t=>{
    if(!t.taken) return;
    (t.questions||[]).forEach(q=>{ if(q.usedBy !== undefined) n++; });
  });
  return n;
}
