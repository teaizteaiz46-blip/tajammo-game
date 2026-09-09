/* ============================ ADMOB (إعلانات) ============================ */
/* يشتغل بس داخل التطبيق المُثبّت (Capacitor) — على الموقع بالمتصفح ما يسوي شي. */

const ADMOB_IDS = {
  banner: 'ca-app-pub-4662085630111714/7304234310',
  interstitial: 'ca-app-pub-4662085630111714/4127406637',
  rewarded: 'ca-app-pub-4662085630111714/9804802390'
};

let admobReady = false;

function isNativeApp(){
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

async function initAdMob(){
  if(!isNativeApp()) return;
  try{
    const { AdMob } = window.Capacitor.Plugins;
    if(!AdMob) return;
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
      adId: ADMOB_IDS.banner,
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
    await AdMob.prepareInterstitial({ adId: ADMOB_IDS.interstitial });
    await AdMob.showInterstitial();
  }catch(e){ console.warn('تعذّر عرض الإعلان البيني', e); }
}

/* onDone(true) = شاف الإعلان كامل ويستحق المكافأة. onDone(false) = طلعنا قبل يكمل أو صار خطأ. */
function showRewardedAd(onDone){
  const done = (ok)=>{ if(onDone) onDone(ok); };
  if(!admobReady){ done(false); return; }
  const { AdMob } = window.Capacitor.Plugins;
  if(!AdMob){ done(false); return; }
  AdMob.prepareRewardVideoAd({ adId: ADMOB_IDS.rewarded })
    .then(()=> AdMob.showRewardVideoAd())
    .then(()=> done(true))
    .catch(e=>{ console.warn('تعذّر عرض إعلان المكافأة', e); done(false); });
}
