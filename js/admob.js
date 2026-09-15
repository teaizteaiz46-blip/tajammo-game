/* ============================ ADMOB (إعلانات) ============================ */
/* يشتغل بس داخل التطبيق المُثبّت (Capacitor) — على الموقع بالمتصفح ما يسوي شي. */

/* معرّفات الإعلانات تختلف بين أندرويد وiOS — نفس المعرّف ما يخدم المنصتين.
   بدّل معرّفات iOS من AdMob بعد ما تسوي تطبيق iOS هناك. */
const ADMOB_IDS_ANDROID = {
  banner: 'ca-app-pub-4662085630111714/7304234310',
  interstitial: 'ca-app-pub-4662085630111714/4127406637'
};
const ADMOB_IDS_IOS = {
  banner: 'ca-app-pub-4662085630111714/7001331037',
  interstitial: 'ca-app-pub-4662085630111714/1563715255'
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

async function initAdMob(){
  if(!isNativeApp()) return;
  if(!adIdsReady()){ console.warn('معرّفات الإعلانات لهذي المنصة ما انبدّلت — الإعلانات مطفية'); return; }
  try{
    const { AdMob } = window.Capacitor.Plugins;
    if(!AdMob) return;

    /* iOS 14+: آبل تشترط نطلب إذن التتبع قبل ما تشتغل الإعلانات المخصصة.
       لو رفض المستخدم، AdMob يعرض إعلانات غير مخصصة — الإعلانات تبقى شغالة.
       النص اللي يطلع بالنافذة موجود بـ Info.plist (NSUserTrackingUsageDescription). */
    if(currentPlatform() === 'ios' && typeof AdMob.requestTrackingAuthorization === 'function'){
      try{ await AdMob.requestTrackingAuthorization(); }
      catch(e){ console.warn('إذن التتبع', e); }
    }

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
