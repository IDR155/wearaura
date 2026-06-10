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
  if(!_epData.budget){toast('Choisis au moins un budget');return;}
  if(me){
    const{error}=await safeRun(sb.from('profiles').update({preferences:_epData}).eq('id',me.id),{friendly:"Impossible de sauvegarder tes préférences.",context:'savePrefs'});
    if(error)return;
    invalidateUserPrefsCache();
    toast('Préférences mises à jour');
    document.getElementById('edit-prefs-form').style.display='none';
  }
}

function showPreferencesScreen(){
  _prefData={budget:null,sizes:[],styles:[]};
  document.querySelectorAll('#sc-preferences .pref-card,#sc-preferences .pref-chip').forEach(el=>el.classList.remove('selected'));
  document.getElementById('sc-preferences').style.display='flex';
}
async function savePreferences(){
  if(!_prefData.budget){toast('Choisis au moins un budget');return;}
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
  // Pulse sur le bouton + de la nav pour indiquer où poster
  if(!localStorage.getItem('wa_plus_hinted')){
    setTimeout(()=>{
      document.querySelectorAll('.ni-center').forEach(el=>{el.setAttribute('data-hint',t('hint_post_first'));el.classList.add('hint-pulse');});
    },400);
  }
  // Overlay hotspot — déclenché ici, après que l'utilisateur a
  // vraiment terminé l'onboarding et atterri sur le feed.
  // Le flag loadFeed() s'exécute trop tôt (pendant prefs/onboarding)
  // donc on appelle _showHotspotOnboard() directement depuis ici.
  if(!localStorage.getItem('wa_hotspots_hinted')){
    // Nettoyer l'ancien flag (consommé à tort par loadFeed trop tôt)
    localStorage.removeItem('wa_hotspot_onboard_pending');
    setTimeout(()=>{
      if(typeof _showHotspotOnboard==='function') _showHotspotOnboard();
    },1000);
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
  if (me) { startGlobalRealtime(); loadFeed(); goS('sc-feed'); setTimeout(()=>{const a=document.querySelector('#feed-tabs-pill .ft.active');if(a)moveFtSlider(a);},250); handleDeepLink(); }
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
  // Nettoie l'URL sans recharger la page
  history.replaceState(null,'',location.pathname);
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
    if (t) t.scrollTo({ left: idx * t.clientWidth, behavior: 'smooth' });
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
