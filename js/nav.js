// ONBOARDING
// ═══════════════════════════════════════════
let obCurrentSlide=1;

function showOnboarding(){
  if(localStorage.getItem('wa_onboarded'))return;
  obCurrentSlide=1;
  for(let i=1;i<=3;i++){
    const s=document.getElementById('ob-slide-'+i);
    if(s)s.style.display=(i===1?'block':'none');
    const d=document.getElementById('ob-dot-'+i);
    if(d)d.style.cssText=(i===1?'width:20px':'width:8px')+';height:4px;border-radius:2px;background:var('+(i===1?'--gold':'--gold-b')+');transition:width 220ms cubic-bezier(0.23,1,0.32,1),background-color 220ms cubic-bezier(0.23,1,0.32,1)';
  }
  const btn=document.getElementById('ob-btn');
  if(btn)btn.textContent=t('suivant');
  document.getElementById('sc-onboarding').style.display='flex';
}

function obNext(){
  if(obCurrentSlide<3){
    document.getElementById('ob-slide-'+obCurrentSlide).style.display='none';
    document.getElementById('ob-dot-'+obCurrentSlide).style.cssText='width:8px;height:4px;border-radius:2px;background:var(--gold-b);transition:width 220ms cubic-bezier(0.23,1,0.32,1),background-color 220ms cubic-bezier(0.23,1,0.32,1)';
    obCurrentSlide++;
    document.getElementById('ob-slide-'+obCurrentSlide).style.display='block';
    document.getElementById('ob-dot-'+obCurrentSlide).style.cssText='width:20px;height:4px;border-radius:2px;background:var(--gold);transition:width 220ms cubic-bezier(0.23,1,0.32,1),background-color 220ms cubic-bezier(0.23,1,0.32,1)';
    if(obCurrentSlide===3)document.getElementById('ob-btn').textContent=t('cest_parti');
  }else{
    obSkip();
  }
}

// ── Préférences (inscription) ──
let _prefData={budget:null,sizes:[],styles:[]};
function selPrefSingle(el,cat){
  el.parentElement.querySelectorAll('.pref-card').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  _prefData[cat]=el.dataset.val;
}
function togglePrefChip(el,cat,max){
  const val=el.dataset.val;
  const list=_prefData[cat]||[];
  const idx=list.indexOf(val);
  if(idx>=0){list.splice(idx,1);el.classList.remove('selected');}
  else{
    if(max&&list.length>=max){toast(`Maximum ${max} sélection${max>1?'s':''}`);return;}
    list.push(val);el.classList.add('selected');
  }
  _prefData[cat]=list;
}
// ── Éditer prefs depuis Settings ──
let _epData={budget:null,sizes:[],styles:[]};
function selEpPrefSingle(el,cat){
  el.parentElement.querySelectorAll('.pref-card').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  _epData[cat]=el.dataset.val;
}
function toggleEpChip(el,cat,max){
  const val=el.dataset.val;
  const list=_epData[cat]||[];
  const idx=list.indexOf(val);
  if(idx>=0){list.splice(idx,1);el.classList.remove('selected');}
  else{
    if(max&&list.length>=max){toast(`Maximum ${max}`);return;}
    list.push(val);el.classList.add('selected');
  }
  _epData[cat]=list;
}
async function openEditPreferences(){
  const form=document.getElementById('edit-prefs-form');
  if(form.style.display!=='none'){form.style.display='none';return;}
  // Reset visuel
  document.querySelectorAll('#edit-prefs-form .pref-card,#edit-prefs-form .pref-chip').forEach(el=>el.classList.remove('selected'));
  _epData={budget:null,sizes:[],styles:[]};
  // Charger les prefs actuelles
  const prefs=await getUserPrefs();
  if(prefs?.budget){
    const b=document.querySelector(`#ep-budget-list .pref-card[data-val="${prefs.budget}"]`);
    if(b){b.classList.add('selected');_epData.budget=prefs.budget;}
  }
  if(Array.isArray(prefs?.sizes)){
    prefs.sizes.forEach(s=>{
      const el=document.querySelector(`#ep-sizes-list .pref-chip[data-val="${s}"]`);
      if(el){el.classList.add('selected');_epData.sizes.push(s);}
    });
  }
  if(Array.isArray(prefs?.styles)){
    prefs.styles.forEach(s=>{
      const el=document.querySelector(`#ep-styles-list .pref-chip[data-val="${s}"]`);
      if(el){el.classList.add('selected');_epData.styles.push(s);}
    });
  }
  form.style.display='block';
}
async function saveEditedPreferences(){
  if(!_epData.budget){toast(t('toast_pick_budget'));return;}
  if(me){
    const{error}=await safeRun(sb.from('profiles').update({preferences:_epData}).eq('id',me.id),{friendly:t('err_save_prefs'),context:'savePrefs'});
    if(error)return;
    invalidateUserPrefsCache();
    toast(t('toast_prefs_updated'));
    document.getElementById('edit-prefs-form').style.display='none';
  }
}

function showPreferencesScreen(){
  _prefData={budget:null,sizes:[],styles:[]};
  document.querySelectorAll('#sc-preferences .pref-card,#sc-preferences .pref-chip').forEach(el=>el.classList.remove('selected'));
  document.getElementById('sc-preferences').style.display='flex';
}
async function savePreferences(){
  if(!_prefData.budget){toast(t('toast_pick_budget'));return;}
  if(me){
    try{await sb.from('profiles').update({preferences:_prefData}).eq('id',me.id);}catch(e){console.warn('Save prefs failed',e);}
  }
  invalidateUserPrefsCache();
  localStorage.setItem('wa_preferences_set','1');
  document.getElementById('sc-preferences').style.display='none';
  setTimeout(()=>showOnboarding(),200);
}
function skipPreferences(){
  localStorage.setItem('wa_preferences_set','1');
  document.getElementById('sc-preferences').style.display='none';
  setTimeout(()=>showOnboarding(),200);
}

function obSkip(){
  localStorage.setItem('wa_onboarded','1');
  document.getElementById('sc-onboarding').style.display='none';
  // Visite guidée (coach marks) — remplace l'ancien pulse "+" et
  // l'overlay hotspots, intégrés comme étapes du parcours (coach.js).
  if(!localStorage.getItem('wa_coach_done')){
    localStorage.removeItem('wa_hotspot_onboard_pending');
    setTimeout(()=>{
      if(typeof startCoachMarks==='function') startCoachMarks();
    },600);
  }
}
function dismissPlusHint(){
  localStorage.setItem('wa_plus_hinted','1');
  document.querySelectorAll('.ni-center.hint-pulse').forEach(el=>el.classList.remove('hint-pulse'));
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
async function init() {
  initLang();
  const hardTimeout = setTimeout(() => { goS('sc-auth'); }, 6000);
  try {
    const sessionResult = await Promise.race([
      sb.auth.getSession(),
      new Promise(r => setTimeout(() => r({data:{session:null}}), 3000))
    ]);
    const session = sessionResult?.data?.session;
    if (session) me = session.user;
    // Vérif DB avec timeout — attend le résultat avant de naviguer
    await Promise.race([
      sb.from('posts').select('id').limit(1).then(({error}) => {
        dbOk = !error || error.code !== '42P01';
      }).catch(() => { dbOk = false; }),
      new Promise(r => setTimeout(r, 2000)) // max 2s pour la vérif DB
    ]);
  } catch(e) {
    _DBG.err('init()', e);
  }
  clearTimeout(hardTimeout);
  if (me) {
    _armBack();
    // Présence : horodatage de dernière visite (ciblage du push de ré-engagement)
    sb.from('profiles').update({last_seen:new Date().toISOString(),lang:(typeof currentLang!=='undefined'?currentLang:'fr')}).eq('id',me.id).then(()=>{},()=>{});
    startGlobalRealtime(); loadFeed(); goS('sc-feed');
    setTimeout(()=>{const a=document.querySelector('#feed-tabs-pill .ft.active');if(a)moveFtSlider(a);},250);
    handleDeepLink();
    // Visite guidée pour les utilisateurs existants (déjà onboardés
    // mais qui n'ont jamais vu les coach marks)
    if(!localStorage.getItem('wa_coach_done')&&localStorage.getItem('wa_onboarded')){
      setTimeout(()=>{
        if(typeof startCoachMarks==='function') startCoachMarks();
      },1500);
    }
  }
  else {
    // Mémorise le post cible pour l'ouvrir après login
    const _pid=new URLSearchParams(location.search).get('post');
    if(_pid) sessionStorage.setItem('wa_pending_post',_pid);
    goS('sc-auth');
  }
}

// ── Deep Link — ouvre un post partagé via ?post=<id> ─────────────────────
function handleDeepLink(){
  const postId=new URLSearchParams(location.search).get('post')
    ||sessionStorage.getItem('wa_pending_post');
  if(!postId) return;
  sessionStorage.removeItem('wa_pending_post');
  // Nettoie l'URL sans recharger la page (en préservant la sentinelle du bouton retour)
  history.replaceState(history.state,'',location.pathname);
  // Attend que le feed soit rendu avant d'ouvrir le post
  setTimeout(()=>openPostView(postId),500);
}

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
var _track = null;
var _TRACK_TABS = ['feed','notif','boutique','profile'];
function _trackEl(){ return _track || (_track = document.getElementById('screens-track')); }

function updateNavActive(tab) {
  var nav = document.getElementById('shared-bnav');
  if (!nav) return;
  nav.querySelectorAll('.ni').forEach(function(el, i) {
    el.classList.toggle('active', _TRACK_TABS[i] === tab);
  });
}

function goS(id) {
  // Track screens are always displayed inside the scroll container — skip them
  document.querySelectorAll('.screen:not(.track-screen)').forEach(s => s.classList.remove('active'));
  if (id) {
    var el = document.getElementById(id);
    if (el && !el.classList.contains('track-screen')) el.classList.add('active');
  }
  // Navbar : cachée sur les écrans hors-app (auth, forgot…), visible sinon
  var bnav = document.getElementById('shared-bnav');
  if (bnav) {
    var hideOnScreens = ['sc-auth', 'sc-forgot', 'sc-reset-pw'];
    bnav.style.display = hideOnScreens.includes(id) ? 'none' : '';
    bnav.style.transform = '';
  }
}

function goTab(tab) {
  cancelBackConfirm();
  _armBack();
  track('tab_view',{tab});
  if (tab !== 'create') { stopCamera(); }
  if (tab !== 'notif') onLeaveMessagesTab();
  if (tab==='explore') { openSearch(); return; }
  if (tab==='feed') { loadFeed(); resetFeedTabs(); setTimeout(()=>{const a=document.querySelector('#feed-tabs-pill .ft.active');if(a)moveFtSlider(a);},200); }
  if (tab==='profile') loadProfile();
  if (tab==='notif') { if(typeof _closeMsgSubScreens==='function') _closeMsgSubScreens(); loadNotifs(); }
  if (tab==='boutique') loadBoutique();
  if (tab==='create') {
    resetCreate(); setTimeout(() => startCamera(), 150);
    goS('sc-create');
    var bnav=document.getElementById('shared-bnav');
    if(bnav) bnav.style.display='none';
    return;
  }
  var bnav=document.getElementById('shared-bnav');
  if(bnav){ bnav.style.display=''; bnav.style.transform=''; }
  // Track tabs: hide all overlay screens, scroll to position
  document.querySelectorAll('.screen:not(.track-screen)').forEach(s => s.classList.remove('active'));
  var idx = _TRACK_TABS.indexOf(tab);
  if (idx >= 0) {
    var t = _trackEl();
    if (t) t.scrollTo({ left: idx * t.clientWidth, behavior: prefersReducedMotion()?'auto':'smooth' });
  }
  updateNavActive(tab);
}

function resetFeedTabs() {
  document.querySelectorAll('.ft').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.ft').forEach(el => { if (el.getAttribute('data-i18n')==='for_you') el.classList.add('active'); });
  setTimeout(()=>{const active=document.querySelector('#feed-tabs-pill .ft.active');if(active)moveFtSlider(active);},200);
  const hdr = document.querySelector('.feed-header');
  if (hdr) hdr.classList.remove('explorer-mode');
  const fs = document.getElementById('feed-scroll');
  const fe = document.getElementById('feed-explorer');
  const fc = document.getElementById('feed-country-chips');
  if (fs) fs.style.display = 'block';
  if (fe) fe.style.display = 'none';
  if (fc) fc.style.display = 'none';
}

function moveFtSlider(el){
  const slider=document.getElementById('ft-slider');
  const pill=document.getElementById('feed-tabs-pill');
  if(!slider||!pill)return;
  const pillRect=pill.getBoundingClientRect();
  const elRect=el.getBoundingClientRect();
  // Si le pill n'est pas encore rendu, réessayer
  if(pillRect.width===0){
    setTimeout(()=>moveFtSlider(el),100);
    return;
  }
  slider.style.transform='translateX('+(elRect.left-pillRect.left)+'px)';
  slider.style.width=elRect.width+'px';
  slider.style.opacity='1';
}
// ═══════════════════════════════════════════
// BOUTON RETOUR SYSTÈME (Android / geste navigateur)
// Pattern sentinelle : une entrée d'historique reste armée en permanence.
// Un retour système ferme l'overlay le plus haut au lieu de quitter l'app,
// puis ré-arme la sentinelle. Sur le feed sans overlay : toast + sortie au
// retour suivant (comportement natif Android).
// ═══════════════════════════════════════════
// iOS en PWA installée : depuis iOS 16, le geste « swipe-retour » natif au bord
// de l'écran navigue dans l'historique et révèle l'état précédent (le feed) sous
// l'écran courant — c'est l'effet « cassé » signalé (boutique/conversation qui
// glissent et laissent voir le feed). Comme iOS standalone n'a PAS de bouton retour
// matériel, la sentinelle ne sert à rien là ; on ne l'arme donc pas. Sans entrée
// arrière dans l'historique, le geste natif n'a rien à révéler. Android la garde.
var _IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
var _IS_STANDALONE = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
var _IOS_PWA = _IS_IOS && _IS_STANDALONE;
function _armBack(){
  if(!me)return;
  if(_IOS_PWA)return;
  if(!history.state||!history.state.wa)history.pushState({wa:1},'');
}
function _bkShow(id){const el=document.getElementById(id);return !!el&&el.classList.contains('show');}
function _bkDisp(id){const el=document.getElementById(id);return !!el&&getComputedStyle(el).display!=='none';}
function _bkScreen(id){const el=document.getElementById(id);return !!el&&el.classList.contains('active');}
// Du plus haut (fermé en premier) au plus bas. Chaque entrée : [test, fermeture].
const _BACK_CHECKS=[
  [()=>_bkDisp('msg-ctx-menu'),()=>closeMsgCtx()],
  [()=>_bkDisp('post-opts-sheet'),()=>closePostOptions()],
  [()=>_bkDisp('bq-ctx-sheet'),()=>closeBqCtx()],
  [()=>_bkDisp('sv-views-panel'),()=>closeStoryViewsPanel()],
  [()=>_bkDisp('music-picker-sheet'),()=>closeMusicPicker()],
  [()=>_bkDisp('story-cam-overlay'),()=>closeStoryCam()],
  [()=>_bkDisp('story-create-overlay'),()=>closeStoryCreate()],
  [()=>_bkDisp('story-viewer'),()=>closeStoryViewer()],
  [()=>['sheet-comments','prod-sheet','alt-sheet','sheet-share','retouche-sheet'].some(_bkShow),()=>closeAll()],
  [()=>_bkShow('filter-overlay'),()=>closeFilterSheet()],
  [()=>_bkDisp('group-info-sheet'),()=>closeGroupInfo()],
  [()=>_bkDisp('flw-sheet'),()=>closeFollowList()],
  [()=>_bkDisp('sc-new-dm'),()=>closeNewDM()],
  [()=>_bkDisp('sc-new-group'),()=>closeNewGroup()],
  [()=>_bkDisp('sc-conversation'),()=>closeConversationScreen()],
  [()=>{const p=document.getElementById('settings-panel');return !!p&&p.style.right==='0px';},()=>closeSettings()],
  [()=>_bkScreen('sc-postview'),()=>goS(prevScreen)],
  [()=>_bkScreen('sc-vprofile'),()=>goS(prevScreen)],
  [()=>_bkScreen('sc-search'),()=>closeSearch()],
  [()=>_bkScreen('sc-scan'),()=>closeScan()],
  [()=>_bkScreen('sc-create'),()=>goTab('feed')],
];
window.addEventListener('popstate',()=>{
  if(!me)return;
  for(const[test,close]of _BACK_CHECKS){
    let open=false;
    try{open=test();}catch(_){}
    if(open){
      try{close();}catch(e){_DBG&&_DBG.err&&_DBG.err('backHandler',e);}
      _armBack();
      return;
    }
  }
  // Aucun overlay : si on n'est pas sur le feed, y revenir
  const nav=document.getElementById('shared-bnav');
  const activeIdx=nav?[...nav.querySelectorAll('.ni')].findIndex(el=>el.classList.contains('active')):-1;
  if(activeIdx>0){
    goTab('feed');
    _armBack();
    return;
  }
  // Sur le feed, rien d'ouvert : prévenir, le retour suivant quitte l'app
  try{toast(typeof currentLang!=='undefined'&&currentLang==='en'?'Press back again to exit':'Appuie encore pour quitter');}catch(_){}
});

// ═══════════════════════════════════════════
// GESTE « RETOUR » UNIFIÉ — glisser vers la droite pour fermer
// Jumeau gestuel du bouton retour ci-dessus. UN SEUL handler pour TOUS les écrans
// plein écran (conversation, recherche, postview, vprofile, new-dm/group), au lieu
// d'un handler dupliqué par écran (sources de l'effet « fond navy qui apparaît »).
// Règles : verrou de direction h/v au 1er mouvement ; on suit le doigt sur l'écran
// du dessus ; au-delà du seuil → on appelle SA fonction de fermeture. En navigateur
// (non-standalone) on laisse le bord gauche au geste retour natif. On ignore les
// scrollers horizontaux internes (carrousels) pour ne pas voler leur glissement.
// ═══════════════════════════════════════════
(function initEdgeSwipeBack(){
  const EDGE=30, THRESHOLD=70, MIN=8;
  const standalone=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||window.navigator.standalone===true;
  // kind : 'act' = classe .active ; 'disp' = style.display.
  // anim : true  = la fonction de fermeture anime DÉJÀ sa sortie (translateX 100%)
  //               → on la laisse continuer le glissement depuis la position du doigt.
  //        false = fermeture instantanée → c'est NOTRE handler qui anime la sortie.
  const SCREENS=[
    ['sc-conversation','disp', ()=>closeConversationScreen(), true ],
    ['sc-new-group',   'disp', ()=>closeNewGroup(),           false],
    ['sc-new-dm',      'disp', ()=>closeNewDM(),              true ],
    ['sc-search',      'act',  ()=>closeSearch(),             true ],
    ['sc-scan',        'act',  ()=>closeScan(),               false],
    ['sc-postview',    'act',  ()=>goS(prevScreen),           false],
    ['sc-vprofile',    'act',  ()=>goS(prevScreen),           false],
  ];
  function topScreen(){
    for(const[id,kind,close,anim]of SCREENS){
      const el=document.getElementById(id);if(!el)continue;
      const open=kind==='act'?el.classList.contains('active'):getComputedStyle(el).display!=='none';
      if(open)return{el,close,anim};
    }
    return null;
  }
  // On ne saute QUE les vrais carrousels horizontaux explicites. La détection
  // générique via overflowX était trop large : les conteneurs à scroll vertical
  // (recherche, scan) ont souvent un léger débord horizontal → faux positif qui
  // bloquait le swipe-retour sur ces écrans.
  function insideHScroll(el){
    while(el&&el!==document.body){
      const c=el.classList;
      if(c&&(c.contains('bq-carousel')||c.contains('bq-sm-scroll')||c.contains('pv-carousel')||c.contains('story-carousel')))return true;
      el=el.parentElement;
    }
    return false;
  }
  let tg=null,sx=0,sy=0,dir=null; // dir: null|'h'|'v'|'skip'
  document.addEventListener('touchstart',e=>{
    tg=null;dir=null;
    if(e.touches.length!==1)return;
    const t=topScreen();if(!t)return;                 // rien d'ouvert → no-op (ex: feed)
    if(insideHScroll(e.target))return;                // carrousel interne → on laisse
    sx=e.touches[0].clientX;sy=e.touches[0].clientY;tg=t;
    dir=(!standalone&&sx<=EDGE)?'skip':null;          // bord laissé au navigateur
    if(dir!=='skip')tg.el.style.transition='none';
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!tg||dir==='skip'||e.touches.length!==1)return;
    const dx=e.touches[0].clientX-sx, dy=e.touches[0].clientY-sy;
    if(dir===null){
      if(Math.abs(dx)<MIN&&Math.abs(dy)<MIN)return;
      dir=Math.abs(dx)>Math.abs(dy)?'h':'v';          // décision unique
    }
    if(dir==='h'&&dx>0)tg.el.style.transform=`translateX(${dx}px)`;
  },{passive:true});
  document.addEventListener('touchend',e=>{
    if(!tg){dir=null;return;}
    const cur=tg;tg=null;
    if(dir==='skip'||dir==='v'){dir=null;return;}
    const dx=(e.changedTouches[0]?e.changedTouches[0].clientX:sx)-sx;
    if(dir==='h'&&dx>=THRESHOLD){
      if(cur.anim){
        // Sa fonction de fermeture anime déjà la sortie : on la laisse continuer
        // le glissement depuis la position du doigt. On enlève le transition:none
        // (posé pendant le drag) et on force un reflow pour que SA transition prenne.
        cur.el.style.transition='';
        void cur.el.offsetWidth;
        try{cur.close();}catch(err){_DBG&&_DBG.err&&_DBG.err('edgeSwipeBack',err);}
      }else{
        // Fermeture instantanée : on fait glisser la sortie nous-mêmes, puis on ferme.
        // Le reflow (offsetWidth) est indispensable : sans lui, passer de transition:none
        // à une transition dans la même frame ne s'anime pas → l'écran « saute ».
        const el=cur.el, close=cur.close;
        el.style.transition='transform .22s cubic-bezier(0.23,1,0.32,1)';
        void el.offsetWidth;
        el.style.transform='translateX(100%)';
        setTimeout(()=>{
          try{close();}catch(err){_DBG&&_DBG.err&&_DBG.err('edgeSwipeBack',err);}
          el.style.transition='';el.style.transform='';
        },220);
      }
    }else{
      cur.el.style.transition='transform .2s cubic-bezier(0.23,1,0.32,1)';
      cur.el.style.transform='';
      setTimeout(()=>{cur.el.style.transition='';},200);
    }
    dir=null;
  },{passive:true});
  document.addEventListener('touchcancel',()=>{
    if(tg){tg.el.style.transition='';tg.el.style.transform='';}
    tg=null;dir=null;
  },{passive:true});
})();

function ftSelect(el, tab) {
  document.querySelectorAll('.ft').forEach(ftEl => {ftEl.classList.remove('active');ftEl.setAttribute('aria-selected','false');ftEl.setAttribute('tabindex','-1');});
  el.classList.add('active');el.setAttribute('aria-selected','true');el.setAttribute('tabindex','0');
  moveFtSlider(el);
  const scroll = document.getElementById('feed-scroll');
  const expGrid = document.getElementById('feed-explorer');
  const countryChips = document.getElementById('feed-country-chips');
  const hdr = document.querySelector('.feed-header');
  if (tab==='explorer') {
    hdr.classList.add('explorer-mode');
    countryChips.style.display = 'block';
    scroll.style.display = 'none';
    expGrid.style.display = 'block';
    requestAnimationFrame(() => { expGrid.style.paddingTop = (hdr.offsetHeight + 4) + 'px'; });
    loadFeedExplorerGrid('','');
  } else {
    hdr.classList.remove('explorer-mode');
    scroll.style.display = 'block';
    expGrid.style.display = 'none';
    countryChips.style.display = 'none';
    if (tab==='suivis') loadFeedSuivis(); else loadFeed();
  }
}

// ═══════════════════════════════════════════
