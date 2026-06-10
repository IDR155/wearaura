// UTILS
// ═══════════════════════════════════════════

/**
 * initSwipeDismiss — glisser-vers-le-bas pour fermer un bottom sheet.
 *
 * @param {HTMLElement} el                The sheet element
 * @param {Function}    closeFn           Appelé quand la fermeture est confirmée
 * @param {string}      [scrollSelector]  Sélecteur de la zone scrollable interne (la liste)
 * @param {boolean}     [listNeverDismiss] Si true, un geste démarré DANS la liste ne ferme
 *                                          jamais (défilement pur). Sinon la fermeture n'est
 *                                          permise que si la liste est déjà tout en haut.
 *
 * Modèle d'interaction :
 * - Doigt sur le HAUT (poignée / header / tabs, hors liste) → glisser bas = fermer.
 * - Doigt dans la LISTE → défilement natif (jamais de fermeture si listNeverDismiss).
 * - Geste horizontal dominant → abandonné (laisse passer le swipe de tabs).
 * - Geste vers le haut → pas de fermeture.
 * Seuils : fermeture si deltaY ≥ 80px OU vélocité > 0.45 px/ms.
 */
function initSwipeDismiss(el, closeFn, scrollSelector, listNeverDismiss) {
  var startY=0, startX=0, startT=0, deltaY=0, lastY=0, lastT=0, touchId=null, active=false, dir=0, savedTr='';
  var EASE='cubic-bezier(0.22,1,0.36,1)'; // ease-out-quint : doux, sans rebond
  var DISMISS_PX=70, DISMISS_V=0.35;

  function _reset(){ active=false; touchId=null; dir=0; deltaY=0; el.style.willChange=''; }

  function _settle(){ // ressort : revient en place
    el.style.willChange='transform';
    el.style.animation='none';
    el.style.transition='transform 320ms '+EASE;
    void el.offsetHeight; // reflow → garantit le départ de la transition
    el.style.transform='translate3d(0,0,0)';
    var done=false;
    var fin=function(){ if(done)return; done=true; el.removeEventListener('transitionend',fin); el.style.transition=savedTr; el.style.willChange=''; el.style.animation=''; };
    el.addEventListener('transitionend',fin);
    setTimeout(fin,360); // filet : iOS ne fire pas toujours transitionend (compositor froid)
  }

  function _dismiss(vel){
    el.style.willChange='transform';
    el.style.animation='none';
    // Durée adaptée à la vélocité : un flick rapide sort plus vite (feel naturel)
    var dur = vel>1 ? 170 : vel>0.5 ? 210 : 260;
    el.style.transition='transform '+dur+'ms '+EASE;
    void el.offsetHeight; // reflow → garantit le départ de la transition
    el.style.transform='translate3d(0,110%,0)';
    var done=false;
    var fin=function(){
      if(done)return; done=true;
      el.removeEventListener('transitionend',fin);
      el.style.transition='none';
      el.style.transform='';
      el.style.willChange='';
      el.style.animation=''; // restaure l'animation CSS pour la prochaine ouverture
      closeFn();
      requestAnimationFrame(function(){ el.style.transition=savedTr; });
    };
    el.addEventListener('transitionend',fin);
    setTimeout(fin,dur+40); // filet : si transitionend ne fire pas, on ferme quand même
  }

  el.addEventListener('touchstart', function(e) {
    if(active||e.touches.length!==1) return;
    var t=e.touches[0];
    // Détection de zone par GÉOMÉTRIE (la Y du doigt), PAS par e.target : sur iOS la hit-region
    // du scroller est sur-étendue au 1er rendu et fausse e.target vers la liste. La géométrie
    // est fiable dès le départ → le header répond du premier coup.
    var sc=scrollSelector?el.querySelector(scrollSelector):null;
    if(sc){
      var r=sc.getBoundingClientRect();
      if(t.clientY>=r.top && (listNeverDismiss||sc.scrollTop>2)) return; // dans la liste → défilement pur
    }
    active=true; touchId=t.identifier;
    startY=lastY=t.clientY; startX=t.clientX; startT=lastT=Date.now();
    deltaY=0; dir=0;
    savedTr=el.style.transition||'';
    el.style.willChange='transform'; // pré-promeut le layer GPU → 1er mouvement sans retard
  }, {passive:true});

  el.addEventListener('touchmove', function(e) {
    if(!active) return;
    var t=null;
    for(var i=0;i<e.touches.length;i++){if(e.touches[i].identifier===touchId){t=e.touches[i];break;}}
    if(!t){ _reset(); return; }
    var dy=t.clientY-startY, dx=t.clientX-startX;
    // Verrou de direction au premier mouvement franc (>10px)
    if(dir===0){
      if(Math.abs(dx)>10||Math.abs(dy)>10){
        dir = Math.abs(dx)>Math.abs(dy) ? -1 : 1; // -1 = horizontal (abandon), 1 = vertical
        if(dir===-1){ _reset(); return; }
        el.style.animation='none';  // CRUCIAL : l'animation slideUp (fill:both) override sinon
        el.style.transition='none'; // le transform inline → le sheet resterait figé pendant le drag
      } else return;
    }
    if(dy<0){ el.style.transform='translate3d(0,0,0)'; deltaY=0; return; } // vers le haut → rien
    deltaY=dy;
    lastY=t.clientY; lastT=Date.now();
    el.style.transform='translate3d(0,'+dy+'px,0)'; // translate3d → composité GPU, suivi 1:1 sans latence
    e.preventDefault();
  }, {passive:false});

  el.addEventListener('touchend', function(e) {
    if(!active) return;
    if(dir!==1){ _reset(); return; } // jamais devenu un drag vertical
    // Vélocité instantanée (derniers ms du geste) → bien plus naturelle que la moyenne globale
    var now=Date.now();
    var instV = (e.changedTouches&&e.changedTouches[0])
      ? (e.changedTouches[0].clientY-lastY)/Math.max(1,now-lastT) : 0;
    var avgV = deltaY/Math.max(1,now-startT);
    var vel = Math.max(instV, avgV);
    var go = deltaY>=DISMISS_PX || vel>DISMISS_V;
    _reset();
    if(go) _dismiss(vel); else _settle();
  }, {passive:true});

  el.addEventListener('touchcancel', function() {
    if(!active) return;
    var wasDrag=dir===1;
    _reset();
    if(wasDrag) _settle();
  }, {passive:true});
}
function fmtN(n){return n>=1000?(n/1000).toFixed(1)+'k':n;}
function timeAgo(ts){
  const d=Math.floor((Date.now()-new Date(ts))/1000);
  if(d<60)return d+'s';if(d<3600)return Math.floor(d/60)+'min';
  if(d<86400)return Math.floor(d/3600)+'h';return Math.floor(d/86400)+t('day_suffix');
}
// ── Toast queue ─────────────────────────────────
// Guarantees every message is seen, one at a time.
// Deduplicates identical consecutive messages.
// Supports optional type: 'info'|'error'|'success'
const _toastQ=[];
let _toastBusy=false;

function toast(msg,duration=2600,{type='info'}={}){
  const el=document.getElementById('toast-el');
  if(!el)return;
  // Skip exact duplicate already queued
  if(_toastQ.some(t=>t.msg===msg))return;
  // Skip if same message currently visible
  if(_toastBusy&&el.textContent===msg&&el.classList.contains('show'))return;
  _toastQ.push({msg,duration,type});
  if(!_toastBusy)_toastFlush();
}

function _toastFlush(){
  if(!_toastQ.length){_toastBusy=false;return;}
  _toastBusy=true;
  const {msg,duration,type}=_toastQ.shift();
  const el=document.getElementById('toast-el');
  if(el.classList.contains('show')){
    el.classList.add('toast--out');
    el.addEventListener('transitionend',()=>{
      el.classList.remove('show','toast--out','toast--error','toast--success');
      requestAnimationFrame(()=>_toastShow(el,msg,duration,type));
    },{once:true});
  } else {
    _toastShow(el,msg,duration,type);
  }
}

// ── Animation trigger helper ──────────────────────
// Supprime la classe, force un reflow, la remet — garantit que l'animation
// rejoue même si elle était déjà active (double-tap rapide, etc.)
function _triggerAnim(el, cls){
  if(!el)return;
  el.classList.remove(cls);
  void el.offsetWidth; // reflow intentionnel
  el.classList.add(cls);
  el.addEventListener('animationend',()=>el.classList.remove(cls),{once:true});
}

// ── Skeleton HTML generators ─────────────────────
// skFeed(n)     : n posts fake dans le feed principal
// skRows(n)     : n lignes avec avatar + 2 lignes de texte (messages, notifs)
// skGrid(n)     : grille 3-col de n cellules carrées (profil, explore)
// skComments(n) : n lignes de commentaires (avatar + 2 lignes)
function skFeed(n=2){
  const post=()=>`<div class="sk-feed-post"><div class="sk-feed-header"><div class="sk-box sk-av"></div><div class="sk-feed-lines"><div class="sk-box sk-ln sk-ln-md"></div><div class="sk-box sk-ln sk-ln-sm"></div></div></div><div class="sk-box sk-feed-img"></div><div class="sk-feed-bar"><div class="sk-box sk-feed-btn"></div><div class="sk-box sk-feed-btn"></div><div class="sk-box sk-feed-btn"></div></div></div>`;
  return `<div class="sk-feed">${Array.from({length:n},post).join('')}</div>`;
}
function skRows(n=4){
  const row=()=>`<div class="sk-row-item"><div class="sk-box sk-av-lg"></div><div class="sk-row-lines"><div class="sk-box sk-ln sk-ln-md"></div><div class="sk-box sk-ln sk-ln-sm"></div></div></div>`;
  return `<div class="sk-rows">${Array.from({length:n},row).join('')}</div>`;
}
function skGrid(n=9){
  return `<div class="sk-grid-3">${Array.from({length:n},()=>`<div class="sk-box sk-grid-cell"></div>`).join('')}</div>`;
}
function skComments(n=3){
  const row=()=>`<div class="sk-row-item"><div class="sk-box sk-av"></div><div class="sk-row-lines"><div class="sk-box sk-ln sk-ln-lg"></div><div class="sk-box sk-ln sk-ln-md"></div></div></div>`;
  return `<div class="sk-rows">${Array.from({length:n},row).join('')}</div>`;
}

// ── Pull-to-refresh (générique) ──────────────────
// attachPullToRefresh(scrollEl, reloadFn, parentEl)
// scrollEl  : l'élément scrollable (conteneur)
// reloadFn  : fonction appelée quand l'utilisateur tire → retourne une Promise
// parentEl  : l'écran parent (position:absolute/relative) qui reçoit l'indicateur
function attachPullToRefresh(scrollEl, reloadFn, parentEl) {
  if (!scrollEl || scrollEl._ptrBound) return;
  scrollEl._ptrBound = true;
  const THRESHOLD = 72, MAX_PULL = 110;
  let _startY = 0, _touchId = null, _pulling = false, _loading = false, _top = null;

  // ── Indicateur visuel ──
  const ind = document.createElement('div');
  ind.className = 'ptr-ind';
  ind.innerHTML = `<div class="ptr-icon">
    <svg class="ptr-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    <svg class="ptr-spin" style="display:none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a10 10 0 1 0 10 10"/></svg>
  </div>`;
  (parentEl || scrollEl.parentElement).appendChild(ind);
  const arr = ind.querySelector('.ptr-arrow');
  const sp  = ind.querySelector('.ptr-spin');

  // Calcule le top une seule fois (DOM doit être rendu)
  function _getTop() {
    if (_top !== null) return _top;
    _top = scrollEl.offsetTop + 4;
    ind.style.top = _top + 'px';
    return _top;
  }
  function _setProgress(dy) {
    const top = _getTop();
    const clamped = Math.min(dy, MAX_PULL);
    const t = (clamped * 0.45) - 28;
    const op = Math.min(dy / THRESHOLD, 1);
    ind.style.cssText = `top:${top}px;opacity:${op};transform:translateX(-50%) translateY(${t}px)`;
    arr.style.transform = `rotate(${Math.min((dy / THRESHOLD) * 180, 180)}deg)`;
  }
  function _showSpinner() {
    arr.style.display = 'none';
    sp.style.display = 'block';
    ind.style.cssText = `top:${_getTop()}px;opacity:1;transform:translateX(-50%) translateY(8px);transition:transform 200ms cubic-bezier(0.23,1,0.32,1)`;
  }
  function _hide() {
    ind.style.transition = 'opacity 280ms,transform 280ms cubic-bezier(0.32,0.72,0,1)';
    ind.style.opacity = '0';
    ind.style.transform = 'translateX(-50%) translateY(-28px)';
    setTimeout(() => {
      ind.style.transition = '';
      arr.style.display = 'block';
      arr.style.transform = '';
      sp.style.display = 'none';
    }, 300);
  }

  scrollEl.addEventListener('touchstart', (e) => {
    if (_loading || scrollEl.scrollTop > 0 || e.touches.length !== 1) return;
    _startY = e.touches[0].clientY;
    _touchId = e.touches[0].identifier;
    _pulling = false;
    _getTop(); // cache le top au premier touch
  }, {passive: true});

  scrollEl.addEventListener('touchmove', (e) => {
    if (_touchId === null || _loading) return;
    let touch = null;
    for (let i = 0; i < e.touches.length; i++) { if (e.touches[i].identifier === _touchId) { touch = e.touches[i]; break; } }
    if (!touch || scrollEl.scrollTop > 0) { _touchId = null; return; }
    const dy = touch.clientY - _startY;
    if (dy <= 0) { _touchId = null; return; }
    _pulling = true;
    _setProgress(dy);
  }, {passive: true});

  scrollEl.addEventListener('touchend', (e) => {
    if (!_pulling || _loading) { _touchId = null; _pulling = false; return; }
    let touch = null;
    for (let i = 0; i < e.changedTouches.length; i++) { if (e.changedTouches[i].identifier === _touchId) { touch = e.changedTouches[i]; break; } }
    const dy = touch ? touch.clientY - _startY : 0;
    _touchId = null; _pulling = false;
    if (dy >= THRESHOLD) {
      _loading = true;
      _showSpinner();
      navigator.vibrate?.(12);
      Promise.resolve(reloadFn()).finally(() => { _loading = false; _hide(); });
    } else {
      _hide();
    }
  }, {passive: true});

  scrollEl.addEventListener('touchcancel', () => {
    _touchId = null; _pulling = false;
    if (!_loading) _hide();
  }, {passive: true});
}

// ── Lazy image loading ────────────────────────────
// Utilisation : mettre data-src="url" sur les <img> au lieu de src="url"
// puis appeler observeLazy(container) après chaque rendu HTML.
// L'observer charge l'image dès qu'elle entre dans le viewport (marge 200px).
let _lazyObs=null;
function _getLazyObs(){
  if(_lazyObs)return _lazyObs;
  _lazyObs=new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting)return;
      const img=entry.target;
      const src=img.dataset.src;
      if(!src){_lazyObs.unobserve(img);return;}
      img.src=src;
      img.removeAttribute('data-src');
      img.addEventListener('load',()=>img.classList.add('img-lazy--in'),{once:true});
      _lazyObs.unobserve(img);
    });
  },{rootMargin:'200px'});
  return _lazyObs;
}
function observeLazy(root){
  const obs=_getLazyObs();
  (root||document).querySelectorAll('img[data-src]').forEach(img=>obs.observe(img));
}

// ── Compression image avant upload ────────────────
// Redimensionne (côté long ≤ maxPx) puis encode en WebP q0.85.
// Replis : JPEG q0.88 si le navigateur ne sait pas encoder le WebP
// (Safari < 17 renvoie un PNG énorme), original si le décodage échoue
// ou si le résultat n'est pas plus léger.
// Une photo galerie 12 MP (~4-6 Mo) descend à ~150-400 Ko.
function compressImageForUpload(file, maxPx = 1920) {
  return new Promise(resolve => {
    let url;
    const giveUp = () => { if (url) URL.revokeObjectURL(url); resolve(file); };
    try { url = URL.createObjectURL(file); } catch (e) { resolve(file); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        const scale = Math.min(1, maxPx / Math.max(w, h));
        const c = document.createElement('canvas');
        c.width  = Math.round(w * scale);
        c.height = Math.round(h * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        const keep = b => b && (b.size < file.size || scale < 1);
        c.toBlob(blob => {
          if (blob && blob.type === 'image/webp' && keep(blob)) {
            resolve(new File([blob], `wearaura_${Date.now()}.webp`, { type: 'image/webp' }));
            return;
          }
          c.toBlob(b => {
            if (keep(b)) resolve(new File([b], `wearaura_${Date.now()}.jpg`, { type: 'image/jpeg' }));
            else resolve(file);
          }, 'image/jpeg', 0.88);
        }, 'image/webp', 0.85);
      } catch (e) { giveUp(); }
    };
    img.onerror = giveUp;
    img.src = url;
  });
}

function _toastShow(el,msg,duration,type){
  el.textContent=msg;
  el.className='toast show'+(type==='error'?' toast--error':type==='success'?' toast--success':'');
  setTimeout(()=>{
    el.classList.add('toast--out');
    el.addEventListener('transitionend',()=>{
      el.classList.remove('show','toast--out','toast--error','toast--success');
      setTimeout(_toastFlush,80); // breathing gap between toasts
    },{once:true});
  },duration);
}

