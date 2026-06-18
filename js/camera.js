// CAMERA ENGINE
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// ZOOM CAMÉRA — Style iPhone
// ═══════════════════════════════════════════
let currentZoom=1;
let pinchStartDist=0;
let pinchStartZoom=1;
const ZOOM_MIN=0.5;
const ZOOM_MAX=10;

// ── ZOOM DIAL — Arc rotatif style iOS ───────────────────────────────
// Paramètres géométriques
const _DIAL_R   = 3;   // rayon = _DIAL_R * largeur canvas (arc quasi plat)
const _DIAL_DEG = 4;   // degrés par unité de zoom sur l'arc
let _dialDragX = null, _dialDragZoom = null;

// Conversion zoom → longueur focale équivalente (mm)
function zoomToMM(z) {
  if (z <= 0.5) return '13MM';
  if (z <= 1)   return Math.round(13 + (z-0.5)/0.5*11) + 'MM';
  if (z <= 2)   return Math.round(24 + (z-1)*24) + 'MM';
  if (z <= 3)   return Math.round(48 + (z-2)*29) + 'MM';
  return Math.round(77 + (z-3)*20) + 'MM';
}

function _dialUpdateLabel() {
  const lbl = document.getElementById('zoom-dial-label');
  const mm  = document.getElementById('zoom-dial-mm');
  const MAJOR = [0.5, 1, 2, 3];
  const snap  = MAJOR.reduce((a,b)=>Math.abs(b-currentZoom)<Math.abs(a-currentZoom)?b:a);
  const snapped = Math.abs(currentZoom-snap) < 0.08;
  if (lbl) lbl.textContent = snapped ? snap+'x' : currentZoom.toFixed(1)+'x';
  if (mm)  mm.textContent  = zoomToMM(currentZoom);
  // Sync highlight des chips
  document.querySelectorAll('.zoom-btn').forEach(b=>{
    const bz     = parseFloat(b.dataset.zoom);
    const active = snapped && bz===snap;
    b.classList.toggle('active-zoom', active);
    b.style.color      = active ? '#EDE4CF' : 'rgba(255,255,255,.6)';
    b.style.background = active ? 'rgba(0,0,0,.5)' : 'transparent';
    b.style.fontWeight = active ? '700' : '600';
    b.style.fontSize   = active ? '13px' : '12px';
  });
}

function drawZoomDial() {
  const canvas = document.getElementById('zoom-dial-canvas');
  if (!canvas) return;
  const dpr   = window.devicePixelRatio || 1;
  const dispW = canvas.offsetWidth;
  const dispH = canvas.offsetHeight;
  if (!dispW || !dispH) return;

  // Redimensionne la résolution pixel si besoin
  if (canvas.width  !== Math.round(dispW*dpr) ||
      canvas.height !== Math.round(dispH*dpr)) {
    canvas.width  = Math.round(dispW*dpr);
    canvas.height = Math.round(dispH*dpr);
  }

  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, dispW, dispH);

  const W = dispW, H = dispH;
  // Grand cercle dont le centre est très loin en-dessous → arc quasi plat
  const R  = W * _DIAL_R;
  const cx = W / 2;
  // BP = marge entre la ligne de base de l'arc et le bas du canvas
  // Choisie pour que même les positions latérales restent dans le canvas
  const BP = 18;
  const cy = H + R - BP;      // centre du cercle (hors canvas, en-dessous)
  const ARC_Y = H - BP;       // y de la ligne de base de l'arc au centre

  const RPU    = _DIAL_DEG * Math.PI / 180; // radians par unité de zoom
  const MAJORS = [0.5, 1, 2, 3];

  // ── Tracé des graduations ──────────────────────────────────────────
  for (let zi = 1; zi <= 100; zi++) {
    const z = Math.round(zi * 10) / 100; // 0.1 … 10.0

    const angOff = (z - currentZoom) * RPU;
    // Position sur le cercle : x = cx + R·sin(a), y = cy − R·cos(a)
    const px = cx + R * Math.sin(angOff);
    const py = cy - R * Math.cos(angOff);

    if (px < -4 || px > W+4) continue;  // hors canvas horizontalement
    if (py > H+4)            continue;  // trop bas

    const isMajor = MAJORS.some(m => Math.abs(m-z) < 0.05);
    const isMid   = !isMajor && (zi % 5 === 0); // tous les 0.5 zoom

    // Direction radiale sortante (pointe vers le haut car cy >> H)
    const nx = (px-cx) / R; // ≈ sin(angOff) — composante horizontale minime
    const ny = (py-cy) / R; // ≈ −1          — pointe vers le haut

    const tickLen = isMajor ? 14 : isMid ? 9 : 5;
    const tx2 = px + nx * tickLen;
    const ty2 = py + ny * tickLen;

    // Fondu vers les bords
    const fade  = Math.max(0, 1 - Math.abs(px-cx)/(W*0.5));
    const alpha = (isMajor ? 0.85 : isMid ? 0.5 : 0.28) * fade;

    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth   = isMajor ? 1.5 : 1;
    ctx.lineCap     = 'round';
    ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(tx2,ty2); ctx.stroke();

    // Labels des graduations majeures
    if (isMajor && fade > 0.08) {
      const lx = px + nx*(tickLen+18);
      const ly = py + ny*(tickLen+18);
      if (ly >= 2 && ly <= H-2) {
        const isActive = Math.abs(z-currentZoom) < 0.12;
        ctx.fillStyle    = isActive ? '#F5D76E' : `rgba(255,255,255,${(fade*0.82).toFixed(2)})`;
        ctx.font         = `${isActive?'700':'400'} ${isActive?13:11}px Montserrat,-apple-system,sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(z+'x', lx, ly);
      }
    }
  }

  // ── Ligne de base de l'arc (dégradé transparent→visible→transparent) ──
  const grad = ctx.createLinearGradient(0,0,W,0);
  grad.addColorStop(0,   'transparent');
  grad.addColorStop(0.15,'rgba(255,255,255,0.18)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.28)');
  grad.addColorStop(0.85,'rgba(255,255,255,0.18)');
  grad.addColorStop(1,   'transparent');
  ctx.strokeStyle = grad; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(0,ARC_Y); ctx.lineTo(W,ARC_Y); ctx.stroke();

  // ── Triangle indicateur central ▼ (pointe vers le bas = vers l'arc) ──
  ctx.fillStyle = 'rgba(245,215,110,0.92)';
  ctx.beginPath();
  ctx.moveTo(cx,  9);  // pointe basse
  ctx.lineTo(cx-5, 1);
  ctx.lineTo(cx+5, 1);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// Snap vers la graduation majeure la plus proche si écart < 0.22 unités
function _dialSnap() {
  _dialDragX = null;
  const MAJOR  = [0.5, 1, 2, 3];
  const snap   = MAJOR.reduce((a,b)=>Math.abs(b-currentZoom)<Math.abs(a-currentZoom)?b:a);
  if (Math.abs(currentZoom-snap) < 0.22) {
    currentZoom = snap;
    applyZoomToStream(snap);
    drawZoomDial();
    _dialUpdateLabel();
  }
}

function initZoomDial() {
  const canvas = document.getElementById('zoom-dial-canvas');
  if (!canvas || canvas._dialInit) return;
  canvas._dialInit = true;

  // Premier rendu après layout
  requestAnimationFrame(()=>{ drawZoomDial(); _dialUpdateLabel(); });

  // ── Drag tactile ─────────────────────────────────────────────────
  canvas.addEventListener('touchstart', e=>{
    if (e.touches.length!==1) return;
    _dialDragX    = e.touches[0].clientX;
    _dialDragZoom = currentZoom;
  },{passive:true});

  canvas.addEventListener('touchmove', e=>{
    if (e.touches.length!==1||_dialDragX===null) return;
    e.preventDefault();
    const dx        = e.touches[0].clientX - _dialDragX;
    const pxPerUnit = canvas.offsetWidth * _DIAL_R * Math.sin(_DIAL_DEG*Math.PI/180);
    currentZoom     = Math.max(0.5, Math.min(8, _dialDragZoom - dx/pxPerUnit));
    applyZoomToStream(currentZoom);
    drawZoomDial();
    _dialUpdateLabel();
  },{passive:false});

  canvas.addEventListener('touchend',    _dialSnap);
  canvas.addEventListener('touchcancel', _dialSnap);

  // ── Drag souris (test desktop) ────────────────────────────────────
  canvas.addEventListener('mousedown', e=>{
    _dialDragX    = e.clientX;
    _dialDragZoom = currentZoom;
    canvas.style.cursor = 'grabbing';
    const onMove = ev => {
      const dx        = ev.clientX - _dialDragX;
      const pxPerUnit = canvas.offsetWidth * _DIAL_R * Math.sin(_DIAL_DEG*Math.PI/180);
      currentZoom     = Math.max(0.5, Math.min(8, _dialDragZoom - dx/pxPerUnit));
      applyZoomToStream(currentZoom);
      drawZoomDial();
      _dialUpdateLabel();
    };
    const onUp = ()=>{
      canvas.style.cursor='grab';
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
      _dialSnap();
    };
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  });
}
// ─────────────────────────────────────────────────────────────────────

function _setCamTransform(zoom){
  const v=document.getElementById('cam-video');
  if(!v)return;
  const mirror=camFacing==='user'?'scaleX(-1) ':'';
  const scale=zoom<1?'scale(1)':`scale(${Math.min(ZOOM_MAX,zoom)})`;
  v.style.transform=mirror+scale;
  v.style.transformOrigin='center center';
}

async function setZoomLevel(zoom,_el){
  currentZoom=zoom;
  await applyZoomToStream(zoom);
  drawZoomDial();
  _dialUpdateLabel(); // met aussi à jour les chips
}

async function applyZoomToStream(zoom){
  const video=document.getElementById('cam-video');

  // ── 1. CSS transform — TOUJOURS appliqué pour feedback visuel immédiat ──
  if(video){
    _setCamTransform(zoom);
  }

  // ── 2. Zoom natif en parallèle (meilleure qualité sur Android) ──
  if(camStream){
    const track=camStream.getVideoTracks()[0];
    if(track){
      try{
        const cap=track.getCapabilities?.()??{};
        if(cap.zoom){
          const cz=Math.max(cap.zoom.min,Math.min(cap.zoom.max,zoom));
          await track.applyConstraints({advanced:[{zoom:cz}]});
        }
      }catch(e){}
    }
  }

  // ── 3. Pour 0.5x : tente de switcher sur le capteur ultra-grand-angle ──
  if(zoom<1&&camStream){
    try{
      const constraints={video:{facingMode:'environment',width:{ideal:1920},height:{ideal:1080}},audio:false};
      const newStream=await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack=newStream.getVideoTracks()[0];
      const newCap=newTrack.getCapabilities?.()??{};
      if(newCap.zoom&&newCap.zoom.min<1){
        // Ce capteur supporte le grand-angle natif
        camStream.getTracks().forEach(track=>track.stop());
        camStream=newStream;
        if(video){video.srcObject=newStream;await video.play().catch(()=>{});_setCamTransform(1);}
        await newTrack.applyConstraints({advanced:[{zoom:Math.max(newCap.zoom.min,0.5)}]});
      }else{
        newStream.getTracks().forEach(track=>track.stop());
        toast(t('wide_unavail'));
      }
    }catch(e){}
  }
}

function showZoomIndicator(zoom){
  // Le dial est toujours visible — pas besoin du pill indicateur
  _dialUpdateLabel();
}

function initPinchZoom(){
  const camUI=document.getElementById('camera-ui');
  if(!camUI)return;
  camUI.addEventListener('touchstart',e=>{
    if(e.touches.length===2){pinchStartDist=getPinchDist(e.touches);pinchStartZoom=currentZoom;e.preventDefault();}
  },{passive:false});
  camUI.addEventListener('touchmove',e=>{
    if(e.touches.length===2){
      const dist=getPinchDist(e.touches);
      const newZoom=Math.max(0.5,Math.min(8,pinchStartZoom*(dist/pinchStartDist)));
      currentZoom=newZoom;
      applyZoomToStream(newZoom);
      drawZoomDial();
      _dialUpdateLabel();
      e.preventDefault();
    }
  },{passive:false});
  camUI.addEventListener('touchend',e=>{
    if(e.touches.length<2)setTimeout(()=>{const ind=document.getElementById('zoom-indicator');if(ind)ind.style.display='none';},1500);
  });
}

function getPinchDist(touches){
  const dx=touches[0].clientX-touches[1].clientX;
  const dy=touches[0].clientY-touches[1].clientY;
  return Math.sqrt(dx*dx+dy*dy);
}

function updateZoomBtnHighlight(zoom){
  // Mise à jour du dial (les anciens boutons sont supprimés)
  drawZoomDial();
  _dialUpdateLabel();
}

let lastTapTime=0;
function initDoubleTapZoom(){
  const camUI=document.getElementById('camera-ui');
  if(!camUI)return;
  camUI.addEventListener('touchend',e=>{
    if(e.touches.length!==0)return;
    const now=Date.now();
    if(now-lastTapTime<300){
      const newZoom=currentZoom>=2?1:3;
      const btn=document.querySelector(`.zoom-btn[data-zoom="${newZoom}"]`);
      setZoomLevel(newZoom,btn);
    }
    lastTapTime=now;
  });
}

async function startCamera() {
  const video = document.getElementById('cam-video');
  const fallback = document.getElementById('cam-fallback');
  const msgEl = document.getElementById('cam-fallback-msg');

  // Cacher le fallback et partir sur fond noir pendant l'init
  if(fallback) fallback.style.display = 'none';

  // Stopper le stream précédent
  if(camStream){ camStream.getTracks().forEach(tk=>tk.stop()); camStream=null; }

  // Si l'API est absente, montrer l'écran de permission (pas d'abandon immédiat)
  if(!navigator.mediaDevices?.getUserMedia){
    _showCamPermissionScreen(fallback, msgEl, 'Pour créer un post, WearAura a besoin d\'accéder à ta caméra.');
    if(!window._pinchZoomInit){initPinchZoom();initDoubleTapZoom();window._pinchZoomInit=true;}
    return;
  }

  // Lister les caméras disponibles
  let deviceIds = [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    deviceIds = devices.filter(d=>d.kind==='videoinput').map(d=>d.deviceId).filter(Boolean);
  } catch(_){}

  // Stratégies en cascade (optimal → permissif → par deviceId)
  // width/height en portrait (1080×1920) pour éviter la rotation sur mobile
  const strategies = [
    { video:{ facingMode:{ideal:camFacing}, width:{ideal:1080}, height:{ideal:1920} }, audio:false },
    { video:{ facingMode:{ideal:camFacing}, aspectRatio:{ideal:9/16} }, audio:false },
    { video:{ facingMode:{ideal:camFacing} }, audio:false },
    { video:true, audio:false },
  ];
  deviceIds.forEach(id=>{ strategies.push({ video:{ deviceId:{exact:id} }, audio:false }); });

  let stream = null;
  let lastErr = null;
  for(const constraints of strategies){
    try{
      stream = await Promise.race([
        navigator.mediaDevices.getUserMedia(constraints),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),8000))
      ]);
      if(stream) break;
    }catch(err){
      lastErr = err;
    }
  }

  // Toutes les stratégies ont échoué — message contextuel
  if(!stream){
    let msg = t('cam_unavailable')||'Accès caméra non disponible';
    if(lastErr){
      if(lastErr.name==='NotAllowedError'||lastErr.name==='PermissionDeniedError')
        msg = t('cam_permission')||'Permission refusée — autorise la caméra dans les paramètres';
      else if(lastErr.name==='NotReadableError'||lastErr.name==='TrackStartError')
        msg = t('cam_busy')||'Caméra utilisée par une autre app — ferme Teams/Zoom/Skype puis réessaie';
      else if(lastErr.name==='NotFoundError'||lastErr.name==='DevicesNotFoundError')
        msg = t('cam_notfound')||'Aucune caméra détectée';
      else if(lastErr.message==='timeout')
        msg = t('cam_timeout')||'Délai dépassé — réessaie';
      else
        msg = lastErr.name + ' — ' + lastErr.message;
    }
    _showCamError(msg, fallback, msgEl);
    if(!window._pinchZoomInit){initPinchZoom();initDoubleTapZoom();window._pinchZoomInit=true;}
    currentZoom=1; _setCamTransform(1);
    return;
  }

  // Connecter le stream et attendre les métadonnées
  camStream = stream;
  video.style.opacity = '0';
  video.srcObject = stream;
  await new Promise(resolve=>{
    if(video.readyState>=1){ resolve(); return; }
    let tid;
    const onMeta=()=>{ clearTimeout(tid); video.removeEventListener('loadedmetadata',onMeta); resolve(); };
    video.addEventListener('loadedmetadata',onMeta);
    tid = setTimeout(()=>{ video.removeEventListener('loadedmetadata',onMeta); resolve(); }, 3000);
  });

  try{ await video.play(); }catch(_){}

  // Mirroring caméra frontale géré par _setCamTransform

  if(video.readyState >= 1){
    // Fade-in fluide de la vidéo
    video.style.transition = 'opacity .35s ease';
    video.style.opacity = '1';
    applyNightFilter();
  } else {
    _showCamError(t('cam_unavailable')||'Accès caméra non disponible', fallback, msgEl);
  }

  // Init contrôles zoom
  if(!window._pinchZoomInit){initPinchZoom();initDoubleTapZoom();window._pinchZoomInit=true;}
  currentZoom=1;
  _setCamTransform(1);
  initZoomDial();
  requestAnimationFrame(()=>{ drawZoomDial(); _dialUpdateLabel(); });

  // Pre-warm Edge Function Pixtral pendant que l'utilisateur compose sa photo
  if(typeof _warmupEdgeFunction === 'function') _warmupEdgeFunction();
}

function _showCamError(msg, fallback, msgEl) {
  if(msgEl) msgEl.textContent = msg;
  const sub = document.getElementById('cam-fallback-sub');
  if(sub) sub.style.display = (msg.includes('paramètres') || msg.includes('Paramètres') || msg.includes('settings') || msg.includes('Permission')) ? '' : 'none';
  if(fallback) fallback.style.display = 'flex';
}

function _showCamPermissionScreen(fallback, msgEl, msg) {
  if(msgEl) msgEl.textContent = msg || t('cam_fallback_msg');
  const sub = document.getElementById('cam-fallback-sub');
  if(sub){ sub.style.display='none'; }
  if(fallback) fallback.style.display = 'flex';
}

async function requestCamPermission() {
  const fallback = document.getElementById('cam-fallback');
  const msgEl = document.getElementById('cam-fallback-msg');
  const sub = document.getElementById('cam-fallback-sub');

  // Tenter getUserMedia même si l'API semble absente (HTTP local parfois autorisé)
  const gUM = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
    || navigator.getUserMedia?.bind(navigator)
    || navigator.webkitGetUserMedia?.bind(navigator)
    || navigator.mozGetUserMedia?.bind(navigator);

  if(!gUM){
    if(msgEl) msgEl.textContent = t('cam_unsupported');
    if(sub){ sub.textContent=t('cam_pick_gallery'); sub.style.display=''; }
    return;
  }

  try {
    // Demande minimale pour déclencher le dialog natif du navigateur
    const testStream = await new Promise((resolve, reject) => {
      const p = gUM({video:true, audio:false});
      if(p && p.then) p.then(resolve).catch(reject);
      else gUM({video:true, audio:false}, resolve, reject);
    });
    // Permission accordée — stopper le test et lancer la vraie caméra
    testStream.getTracks().forEach(t=>t.stop());
    if(fallback) fallback.style.display = 'none';
    startCamera();
  } catch(err) {
    if(err.name==='NotAllowedError'||err.name==='PermissionDeniedError'){
      if(msgEl) msgEl.textContent = t('cam_permission_denied');
      if(sub){ sub.textContent=t('cam_enable_hint'); sub.style.display=''; }
    } else if(err.name==='NotFoundError'){
      if(msgEl) msgEl.textContent = t('cam_notfound');
      if(sub){ sub.style.display='none'; }
    } else {
      if(msgEl) msgEl.textContent = t('cam_access_error') + err.message;
      if(sub){ sub.style.display='none'; }
    }
  }
}

function stopCamera() {
  if (camStream) { camStream.getTracks().forEach(track => track.stop()); camStream = null; }
  const v = document.getElementById('cam-video');
  if(v){ v.srcObject = null; v.style.opacity = '0'; v.style.transition = 'none'; }
}

function flipCamera() {
  camFacing = camFacing === 'environment' ? 'user' : 'environment';
  const btn = document.getElementById('btn-capture');
  if(btn) { btn.style.transform='scale(0.88)'; setTimeout(()=>btn.style.transform='scale(1)',150); }
  startCamera();
}

function toggleFlash() {
  flashOn = !flashOn;
  const btn = document.getElementById('btn-flash');
  if(btn) {
    btn.style.background = flashOn ? 'rgba(240,234,216,.7)' : 'rgba(0,0,0,.35)';
    btn.querySelector('svg').style.fill = flashOn ? '#07101E' : 'rgba(255,255,255,0.85)';
  }
  if (camStream) {
    const track = camStream.getVideoTracks()[0];
    if (track?.getCapabilities?.()?.torch) track.applyConstraints({ advanced: [{ torch: flashOn }] }).catch(()=>{});
  }
  toast(flashOn ? t('flash_on') : t('flash_off'));
}

function toggleNight() {
  nightMode = !nightMode;
  const btn = document.getElementById('btn-night');
  if(btn) { btn.style.background = nightMode ? 'rgba(240,234,216,.7)' : 'rgba(0,0,0,.45)'; }
  applyNightFilter();
  toast(nightMode ? t('night_on') : t('night_off'));
}

function applyNightFilter() {
  const video = document.getElementById('cam-video');
  if(video) video.style.filter = nightMode ? 'brightness(1.5) contrast(1.1) saturate(0.7)' : '';
}

function toggleTimer() {
  const steps = [0, 3, 10];
  timerSec = steps[(steps.indexOf(timerSec) + 1) % steps.length];
  const btn = document.getElementById('btn-timer');
  if(btn) btn.style.background = timerSec > 0 ? 'rgba(240,234,216,.7)' : 'rgba(0,0,0,.45)';
  toast(timerSec === 0 ? t('timer_off') : `${t('timer_label')} ${timerSec}s`);
}

function capturePhoto() {
  const btn = document.getElementById('btn-capture');
  if(btn) { btn.style.transform='scale(0.88)'; setTimeout(()=>btn.style.transform='scale(1)',150); }

  if (timerSec > 0) {
    const overlay = document.getElementById('countdown-overlay');
    const num = document.getElementById('countdown-num');
    if(overlay) { overlay.style.display = 'flex'; }
    let count = timerSec;
    if(num) num.textContent = count;
    const iv = setInterval(() => {
      count--;
      if(num) num.innerHTML = count > 0 ? count : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>';
      if (count <= 0) {
        clearInterval(iv);
        setTimeout(() => {
          if(overlay) overlay.style.display = 'none';
          doCapture();
        }, 300);
      }
    }, 1000);
  } else {
    doCapture();
  }
}

// ── Recadre n'importe quelle source en portrait 1080×1920 (center-crop) ──
function _toPortraitBlob(source, mirrorH, applyNight, callback) {
  const W = 1080, H = 1920;
  const oc = document.createElement('canvas');
  oc.width = W; oc.height = H;
  const ctx = oc.getContext('2d');
  const sw = source.videoWidth  || source.naturalWidth  || W;
  const sh = source.videoHeight || source.naturalHeight || H;
  // Scale to fill 1080×1920 — center crop (comme object-fit:cover)
  const scale = Math.max(W / sw, H / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;
  if (mirrorH)    { ctx.translate(W, 0); ctx.scale(-1, 1); }
  if (applyNight) ctx.filter = 'brightness(1.5) contrast(1.1) saturate(0.7)';
  ctx.drawImage(source, dx, dy, dw, dh);
  oc.toBlob(blob => {
    callback(blob, blob ? URL.createObjectURL(blob) : null);
  }, 'image/jpeg', 0.92);
}

function doCapture() {
  const video   = document.getElementById('cam-video');
  const overlay = document.getElementById('flash-overlay');

  // Flash visuel
  if(overlay) {
    overlay.style.transition = 'none';
    overlay.style.opacity = '0.9';
    setTimeout(() => { overlay.style.transition = 'opacity .15s'; overlay.style.opacity = '0'; }, 60);
  }

  if (camStream && video && video.readyState >= 2) {
    _toPortraitBlob(video, camFacing === 'user', !!nightMode, (blob, url) => {
      if (!blob) { document.getElementById('file-in').click(); return; }

      selFile = new File([blob], 'wearaura_' + Date.now() + '.jpg', { type: 'image/jpeg' });
      const thumb = document.getElementById('gallery-thumb');
      if(thumb) thumb.innerHTML = `<img src="${url}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`;
      document.getElementById('prev-img').src = url;
      stopCamera();
      goStepCreate(2);
      _maybeAutoDetect(url);
    });
  } else {
    document.getElementById('file-in').click();
  }
}



// ═══════════════════════════════════════════
// RETOUCHE — Bouton flottant Step 2
// ═══════════════════════════════════════════
const RETOUCHE_FILTERS=[
  {name:'Original',filter:''},
  {name:'Lumière', filter:'brightness(1.15) contrast(1.05)'},
  {name:'Doux',    filter:'brightness(1.1) saturate(0.85) contrast(0.95)'},
  {name:'Vif',     filter:'saturate(1.4) contrast(1.1)'},
  {name:'Froid',   filter:'brightness(1.05) hue-rotate(15deg) saturate(0.9)'},
  {name:'Chaud',   filter:'sepia(0.3) saturate(1.2) brightness(1.05)'},
  {name:'Fade',    filter:'brightness(1.1) contrast(0.85) saturate(0.7)'},
  {name:'Noir&B',  filter:'grayscale(1) contrast(1.1)'},
  {name:'Vintage', filter:'sepia(0.5) contrast(0.9) brightness(1.05)'},
  {name:'Drama',   filter:'contrast(1.3) brightness(0.9) saturate(1.2)'},
];
let rtActivePreset='';
let rtCurrentFilter='';

function openRetoucheSheet(){
  const srcImg=document.getElementById('prev-img');
  const preview=document.getElementById('retouche-preview');
  if(srcImg&&preview){
    preview.src=srcImg.src;
    preview.style.filter=rtCurrentFilter||'';
  }
  buildRetoucheFilterPreviews(srcImg?.src||'');
  // Toujours ouvrir sur l'onglet Ajustements
  rtActiveTab='adjust';
  document.getElementById('rt-section-adjust').style.display='';
  document.getElementById('rt-section-crop').style.display='none';
  document.getElementById('rt-tab-btn-adjust').classList.add('active');
  document.getElementById('rt-tab-btn-crop').classList.remove('active');
  document.getElementById('overlay').classList.add('show');
  document.getElementById('retouche-sheet').classList.add('show');
}

function buildRetoucheFilterPreviews(imageUrl){
  const container=document.getElementById('retouche-filters-scroll');
  container.innerHTML=RETOUCHE_FILTERS.map((f,i)=>`
    <div class="filter-card ${rtActivePreset===f.filter&&i===0&&!rtActivePreset?'active':rtActivePreset===f.filter?'active':i===0&&!rtActivePreset?'active':''}"
      onclick="applyRetouchePreset(${i},this)">
      <div class="filter-preview">
        <img src="${imageUrl}" alt="" style="filter:${f.filter||'none'};width:100%;height:100%;object-fit:cover">
      </div>
      <div class="filter-name">${f.name}</div>
    </div>`).join('');
}

function applyRetouchePreset(idx,el){
  document.querySelectorAll('#retouche-filters-scroll .filter-card').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  rtActivePreset=RETOUCHE_FILTERS[idx].filter;
  const label=document.getElementById('retouche-filter-label');
  if(RETOUCHE_FILTERS[idx].name!=='Original'){
    label.textContent=RETOUCHE_FILTERS[idx].name;label.style.display='block';
    setTimeout(()=>{label.style.display='none';},1500);
  }else{label.style.display='none';}
  applyRetoucheFilters();
}

function applyRetoucheFilters(){
  const brightness=parseInt(document.getElementById('rt-brightness').value);
  const contrast=parseInt(document.getElementById('rt-contrast').value);
  const saturation=parseInt(document.getElementById('rt-saturation').value);
  const sharpen=parseInt(document.getElementById('rt-sharpen').value);
  document.getElementById('rt-val-brightness').textContent=brightness>0?`+${brightness}`:brightness;
  document.getElementById('rt-val-contrast').textContent=contrast>0?`+${contrast}`:contrast;
  document.getElementById('rt-val-saturation').textContent=saturation>0?`+${saturation}`:saturation;
  document.getElementById('rt-val-sharpen').textContent=sharpen;
  const bv=1+brightness/100;
  const cv=1+contrast/100;
  const sv=1+saturation/100;
  const sharp=sharpen>0?`contrast(${1+sharpen/100}) saturate(${1+sharpen/150})`:'';
  const manualFilter=`brightness(${bv}) contrast(${cv}) saturate(${sv}) ${sharp}`;
  const fullFilter=rtActivePreset?`${rtActivePreset} ${manualFilter}`:manualFilter;
  const preview=document.getElementById('retouche-preview');
  if(preview)preview.style.filter=fullFilter;
  rtCurrentFilter=fullFilter;
}

function resetRetouche(){
  ['rt-brightness','rt-contrast','rt-saturation','rt-sharpen'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=0;});
  ['rt-val-brightness','rt-val-contrast','rt-val-saturation','rt-val-sharpen'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='0';});
  rtActivePreset='';rtCurrentFilter='';
  document.querySelectorAll('#retouche-filters-scroll .filter-card').forEach((c,i)=>c.classList.toggle('active',i===0));
  const preview=document.getElementById('retouche-preview');
  if(preview)preview.style.filter='';
}

function _syncPostAspectRatio(){
  const map={'1:1':'1/1','4:5':'4/5','9:16':'9/16','16:9':'16/9'};
  let ar=map[cropRatio];
  if(!ar){ar=(cropWrapW&&cropWrapH)?`${cropWrapW}/${cropWrapH}`:'9/16';}
  const hspot=document.getElementById('hspot-canvas');
  const s3=document.getElementById('step3-canvas');
  if(hspot)hspot.style.aspectRatio=ar;
  if(s3)s3.style.aspectRatio=ar;
}

async function confirmRetouche(){
  // Onglet ROGNER
  if(rtActiveTab==='crop'){
    await applyCropToImage();
    _syncPostAspectRatio();
    toast(t('crop_applied'));
    closeRetoucheSheet();
    return;
  }
  const filter=rtCurrentFilter;
  const isNeutral=!filter||/^brightness\(1\) contrast\(1\) saturate\(1\)\s*$/.test(filter);
  if(isNeutral){closeRetoucheSheet();return;}
  const srcImg=document.getElementById('prev-img');
  const img=new Image();
  img.crossOrigin='anonymous';
  img.onload=()=>{
    const canvas=document.createElement('canvas');
    canvas.width=img.naturalWidth||1080;
    canvas.height=img.naturalHeight||1350;
    const ctx=canvas.getContext('2d');
    // Applique le filtre CSS sur le canvas (supporté Chrome/Android)
    try{ctx.filter=filter;}catch(e){}
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    canvas.toBlob(blob=>{
      if(!blob){
        // Fallback : applique juste le filtre CSS sur prev-img
        srcImg.style.filter=filter;
        toast(t('filter_applied'));
        closeRetoucheSheet();
        return;
      }
      selFile=new File([blob],`wearaura_retouche_${Date.now()}.jpg`,{type:'image/jpeg'});
      const url=URL.createObjectURL(blob);
      srcImg.src=url;
      srcImg.style.filter='';
      toast(t('retouche_applied'));
      closeRetoucheSheet();
    },'image/jpeg',0.92);
  };
  img.onerror=()=>{
    // Image non chargeable via canvas (CORS blob) → filtre CSS direct
    srcImg.style.filter=filter;
    toast(t('filter_applied'));
    closeRetoucheSheet();
  };
  img.src=srcImg.src;
}

function closeRetoucheSheet(){
  document.getElementById('retouche-sheet').classList.remove('show');
  document.getElementById('overlay').classList.remove('show');
}

// ── TABS RETOUCHE ──
let rtActiveTab='adjust';
function switchRetoucheTab(tab){
  rtActiveTab=tab;
  document.getElementById('rt-section-adjust').style.display=tab==='adjust'?'':'none';
  document.getElementById('rt-section-crop').style.display=tab==='crop'?'':'none';
  document.getElementById('rt-tab-btn-adjust').classList.toggle('active',tab==='adjust');
  document.getElementById('rt-tab-btn-crop').classList.toggle('active',tab==='crop');
  if(tab==='crop') initCrop();
}

// ── ROGNAGE ──
let cropPan={x:0,y:0};
let cropUserScale=1;
let cropNaturalW=0,cropNaturalH=0;
let cropWrapW=0,cropWrapH=0;
let cropRatio='9:16';
let cropDrag=null;

function applyCropTransform(){
  const img=document.getElementById('crop-img');
  const wrap=document.getElementById('crop-wrap');
  if(!img||!wrap||!cropNaturalW||!cropNaturalH)return;
  cropWrapW=wrap.offsetWidth;cropWrapH=wrap.offsetHeight;
  const coverScale=Math.max(cropWrapW/cropNaturalW,cropWrapH/cropNaturalH);
  const totalScale=coverScale*cropUserScale;
  const imgW=cropNaturalW*totalScale,imgH=cropNaturalH*totalScale;
  const maxPanX=Math.max(0,(imgW-cropWrapW)/2);
  const maxPanY=Math.max(0,(imgH-cropWrapH)/2);
  cropPan.x=Math.max(-maxPanX,Math.min(maxPanX,cropPan.x));
  cropPan.y=Math.max(-maxPanY,Math.min(maxPanY,cropPan.y));
  const left=(cropWrapW-imgW)/2+cropPan.x;
  const top=(cropWrapH-imgH)/2+cropPan.y;
  img.style.width=imgW+'px';img.style.height=imgH+'px';
  img.style.left=left+'px';img.style.top=top+'px';
}

function onCropZoomChange(val){
  cropUserScale=parseInt(val)/100;
  const valEl=document.getElementById('rt-val-zoom');
  if(valEl)valEl.textContent=val+'%';
  applyCropTransform();
}

function initCrop(){
  cropPan={x:0,y:0};cropUserScale=1;
  const zs=document.getElementById('rt-crop-zoom');if(zs)zs.value=100;
  const zv=document.getElementById('rt-val-zoom');if(zv)zv.textContent='100%';
  const wrap=document.getElementById('crop-wrap');
  if(wrap)wrap.style.aspectRatio='9/16';
  cropRatio='9:16';
  document.querySelectorAll('.crop-ratio-btn').forEach(b=>b.classList.toggle('active',b.dataset.r==='9:16'));
  const src=document.getElementById('retouche-preview').src||document.getElementById('prev-img').src;
  const img=document.getElementById('crop-img');
  if(!img)return;
  const afterLoad=()=>{
    cropNaturalW=img.naturalWidth;cropNaturalH=img.naturalHeight;
    setTimeout(()=>{applyCropTransform();},60);
  };
  if(img.src===src&&img.complete&&img.naturalWidth){afterLoad();}
  else{img.onload=afterLoad;img.src=src;}
}

function setCropRatio(r){
  cropRatio=r;
  document.querySelectorAll('.crop-ratio-btn').forEach(b=>b.classList.toggle('active',b.dataset.r===r));
  const wrap=document.getElementById('crop-wrap');
  if(wrap){
    if(r==='free'&&cropNaturalW&&cropNaturalH){wrap.style.aspectRatio=`${cropNaturalW}/${cropNaturalH}`;}
    else{const map={'1:1':'1/1','4:5':'4/5','9:16':'9/16','16:9':'16/9'};wrap.style.aspectRatio=map[r]||'9/16';}
  }
  cropPan={x:0,y:0};
  setTimeout(()=>{applyCropTransform();},30);
}

function startCropPanTouch(e){
  e.preventDefault();
  const t=e.touches[0];
  cropDrag={sx:t.clientX,sy:t.clientY,px:cropPan.x,py:cropPan.y};
  document.addEventListener('touchmove',_onCropPanMoveTouch,{passive:false});
  document.addEventListener('touchend',_onCropPanEndTouch);
}
function startCropPanMouse(e){
  e.preventDefault();
  cropDrag={sx:e.clientX,sy:e.clientY,px:cropPan.x,py:cropPan.y};
  document.addEventListener('mousemove',_onCropPanMoveMouse);
  document.addEventListener('mouseup',_onCropPanEndMouse);
}
function _onCropPanMoveTouch(e){e.preventDefault();const t=e.touches[0];_applyPan(t.clientX,t.clientY);}
function _onCropPanMoveMouse(e){_applyPan(e.clientX,e.clientY);}
function _onCropPanEndTouch(){cropDrag=null;document.removeEventListener('touchmove',_onCropPanMoveTouch);document.removeEventListener('touchend',_onCropPanEndTouch);}
function _onCropPanEndMouse(){cropDrag=null;document.removeEventListener('mousemove',_onCropPanMoveMouse);document.removeEventListener('mouseup',_onCropPanEndMouse);}
function _applyPan(cx,cy){
  if(!cropDrag)return;
  cropPan.x=cropDrag.px+(cx-cropDrag.sx);
  cropPan.y=cropDrag.py+(cy-cropDrag.sy);
  applyCropTransform();
}

async function applyCropToImage(){
  return new Promise(resolve=>{
    const srcImg=document.getElementById('prev-img');
    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=()=>{
      const natW=img.naturalWidth,natH=img.naturalHeight;
      const wrap=document.getElementById('crop-wrap');
      const wW=wrap?wrap.offsetWidth:cropWrapW;
      const wH=wrap?wrap.offsetHeight:cropWrapH;
      const coverScale=Math.max(wW/natW,wH/natH);
      const totalScale=coverScale*cropUserScale;
      const imgW=natW*totalScale,imgH=natH*totalScale;
      const maxPanX=Math.max(0,(imgW-wW)/2);
      const maxPanY=Math.max(0,(imgH-wH)/2);
      const panX=Math.max(-maxPanX,Math.min(maxPanX,cropPan.x));
      const panY=Math.max(-maxPanY,Math.min(maxPanY,cropPan.y));
      const left=(wW-imgW)/2+panX;
      const top=(wH-imgH)/2+panY;
      // Output: fixed 1080px wide, same aspect ratio as the crop frame
      const outW=1080,outH=Math.round(outW*(wH/wW));
      const scaleOut=outW/wW;
      const canvas=document.createElement('canvas');
      canvas.width=outW;canvas.height=outH;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#07101E';
      ctx.fillRect(0,0,outW,outH);
      if(rtCurrentFilter)try{ctx.filter=rtCurrentFilter;}catch(e){}
      // drawImage from full source, positioned/scaled to match what's visible in the frame
      ctx.drawImage(img,0,0,natW,natH,left*scaleOut,top*scaleOut,imgW*scaleOut,imgH*scaleOut);
      canvas.toBlob(blob=>{
        if(!blob){resolve(null);return;}
        selFile=new File([blob],`wearaura_crop_${Date.now()}.jpg`,{type:'image/jpeg'});
        const url=URL.createObjectURL(blob);
        srcImg.src=url;srcImg.style.filter='';
        resolve(url);
      },'image/jpeg',0.92);
    };
    img.onerror=()=>resolve(null);
    img.src=srcImg.src;
  });
}

// ═══════════════════════════════════════════
