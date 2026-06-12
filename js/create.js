// CREATE
// ═══════════════════════════════════════════
function resetCreate() {
  selFile = null;
  hspots = []; selHspot = null;
  document.getElementById('c-step1').style.display = 'flex';
  document.getElementById('c-step2').style.display = 'none';
  document.getElementById('c-step3').style.display = 'none';
  document.getElementById('create-hdr').style.display = 'none';
  // Step 1 = caméra plein écran — pas de scroll, pas de padding
  const cb = document.getElementById('create-body');
  if(cb){ cb.style.paddingBottom = '0'; cb.style.overflowY = 'hidden'; }
  currentStep=1;
  // Reset animation classes
  ['c-step1','c-step2','c-step3'].forEach(id=>{const e=document.getElementById(id);if(e)e.classList.remove('step-anim-right','step-anim-left');});
  ['cs1','cs2','cs3'].forEach(s=>document.getElementById(s).classList.remove('active'));
  resetLeanTags();
}

let currentStep=1;

// ── Aperçu feed en step 3 ─────────────────────
function _updateStep3Preview(){
  // Caption en temps réel
  const captEl = document.getElementById('p3-caption');
  const caption = document.getElementById('c-caption')?.value || '';
  if(captEl) captEl.textContent = caption;

  // Username + avatar (lus depuis le profil déjà chargé dans le DOM)
  const handleEl = document.getElementById('my-handle');
  const usernameEl = document.getElementById('p3-username');
  if(usernameEl && handleEl){
    const h = handleEl.textContent?.trim();
    if(h && h !== '—') usernameEl.textContent = h;
  }
  const avWrap = document.getElementById('p3-av');
  const srcImg = document.getElementById('my-avatar')?.querySelector('img');
  if(avWrap && srcImg?.src && !avWrap.querySelector('img')){
    avWrap.innerHTML = `<img src="${srcImg.src}" alt="" style="width:100%;height:100%;object-fit:cover">`;
  }

  // Musique (variable définie dans stories.js, chargé après create.js)
  const row  = document.getElementById('p3-music-row');
  const name = document.getElementById('p3-music-name');
  if(row && name){
    const title = (typeof _postMusicTitle !== 'undefined') ? _postMusicTitle : null;
    if(title){ row.style.display = 'flex'; name.textContent = title; }
    else      { row.style.display = 'none'; name.textContent = ''; }
  }
}

function goStepCreate(n){
  const prev=currentStep;
  currentStep=n;
  const forward=n>prev;
  const inClass=forward?'step-anim-right':'step-anim-left';
  [['c-step1','flex'],['c-step2','block'],['c-step3','block']].forEach(([id,disp],i)=>{
    const el=document.getElementById(id);
    if(!el)return;
    const show=(i+1===n);
    el.style.display=show?disp:'none';
    if(show){
      el.classList.remove('step-anim-right','step-anim-left');
      // Force reflow pour que l'animation repart bien
      void el.offsetWidth;
      el.classList.add(inClass);
    }
  });
  document.getElementById('create-hdr').style.display='flex';
  const cb = document.getElementById('create-body');
  if(cb){ cb.style.paddingBottom='calc(24px + var(--sab,0px))'; cb.style.overflowY = n===1?'hidden':'auto'; }
  updateStepDots(n);
  updateBackBtn(n);
  if(n===1){
    const hspot=document.getElementById('hspot-canvas');const s3=document.getElementById('step3-canvas');
    if(hspot)hspot.style.aspectRatio='9/16';if(s3)s3.style.aspectRatio='9/16';
  }
  // loadMobileNet() retiré — MobileNet n'est plus utilisé dans autoDetectType
  // (autoDetectType mots-clés uniquement). Economise 7 MB réseau + WebGL sur iPhone.
  if(n===3){
    const p3img=document.getElementById('step3-preview');
    const p2img=document.getElementById('prev-img');
    if(p3img&&p2img&&p2img.src)p3img.src=p2img.src;
    _updateStep3Preview();
    setTimeout(()=>autoDetectColor(),350);
  }
}

function goStep(n){goStepCreate(n);}

function updateStepDots(current){
  [1,2,3].forEach(i=>{
    const dot=document.getElementById(`cs${i}`);
    if(!dot)return;
    dot.classList.toggle('active',i===current);
    if(i<current){dot.style.background='rgba(240,234,216,0.5)';dot.style.width='6px';}
    else if(i===current){dot.style.background='var(--gold)';dot.style.width='18px';}
    else{dot.style.background='var(--gold-b)';dot.style.width='6px';}
  });
}

function updateBackBtn(step){
  const btn=document.getElementById('btn-step-back');
  if(!btn)return;
  btn.style.opacity='1';
  btn.style.pointerEvents='auto';
}

function goStepBack(){
  if(currentStep===3){goStepCreate(2);}
  else if(currentStep===2){confirmGoBack();}
}

function goStepFromDot(n){
  if(n>=currentStep)return;
  if(n===1){confirmGoBack();}
  else{goStepCreate(n);}
}

function showBackConfirm(){
  // Annule le timer auto-hide de toast() pour que les boutons restent cliquables
  if(toastTimer){clearTimeout(toastTimer);toastTimer=null;}
  const toastEl=document.getElementById('toast-el');
  toastEl.innerHTML=`
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:4px 0">
      <div style="font-size:12px;color:var(--white)">${t('back_to_cam')}</div>
      <div style="font-size:12px;color:var(--wd)">${t('photo_lost')}</div>
      <div style="display:flex;gap:8px;margin-top:2px">
        <div onclick="cancelBackConfirm()" style="padding:6px 16px;border:1px solid var(--gold-b);border-radius:50px;font-size:12px;color:var(--wd);cursor:pointer">${t('annuler')}</div>
        <div onclick="confirmGoBack()" style="padding:6px 16px;background:var(--gold);border-radius:50px;font-size:12px;color:var(--black);font-weight:600;cursor:pointer">${t('retour')}</div>
      </div>
    </div>`;
  const sab=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab'))||0;
  toastEl.style.bottom=(120+sab)+'px';
  toastEl.style.borderRadius='16px';
  toastEl.style.padding='14px 20px';
  toastEl.classList.add('show');
}

function cancelBackConfirm(){
  const toastEl=document.getElementById('toast-el');
  toastEl.classList.remove('show');
  setTimeout(()=>{
    toastEl.innerHTML='';
    toastEl.style.borderRadius='50px';
    toastEl.style.padding='10px 20px';
    toastEl.style.bottom='';
  },300);
}

function confirmGoBack(){
  cancelBackConfirm();
  resetCreate();
  setTimeout(()=>startCamera(), 80);
}

function onFileSelect(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const rawUrl = ev.target.result;
    selFile = file;
    // Pre-resize iPhone/Android photos (> 1080px) avant d'alimenter preview + detect.
    // Evite de décoder 12 MP (48 MB) en mémoire deux fois de suite → crash Safari mobile.
    _createPreviewUrl(rawUrl, 1080, (url) => {
      const thumb = document.getElementById('gallery-thumb');
      if(thumb) thumb.innerHTML = `<img src="${url}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`;
      const previewImg = document.getElementById('prev-img');
      previewImg.src = url;
      previewImg.onload = () => {
        if(previewImg.naturalWidth >= previewImg.naturalHeight){
          setTimeout(() => _showCropHint(), 600);
        }
        previewImg.onload = null;
      };
      stopCamera();
      goStepCreate(2);
      autoDetectHspots(url); // reçoit déjà l'image à ≤ 1080px
    });
  };
  reader.readAsDataURL(file);
}

// ── Resize utilitaire (galerie iPhone) ─────────────────────────
// Réduit à maxPx si nécessaire, sinon retourne rawUrl tel quel (pas de dégradation).
function _createPreviewUrl(rawUrl, maxPx, cb) {
  const img = new Image();
  img.onload = () => {
    const w = img.naturalWidth, h = img.naturalHeight;
    if (w <= maxPx && h <= maxPx) { cb(rawUrl); return; }
    const scale = maxPx / Math.max(w, h);
    const c = document.createElement('canvas');
    c.width  = Math.round(w * scale);
    c.height = Math.round(h * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    cb(c.toDataURL('image/jpeg', 0.88));
  };
  img.onerror = () => cb(rawUrl); // fallback si le decode rate
  img.src = rawUrl;
}

// ── Suggestion recadrage pour images non-portrait ──────────────
function _showCropHint(){
  const hint = document.getElementById('crop-hint-bar');
  if(!hint) return;
  hint.style.display = 'flex';
  clearTimeout(hint._t);
  hint._t = setTimeout(() => { hint.style.display = 'none'; }, 5000);
}
function _hideCropHint(){
  const hint = document.getElementById('crop-hint-bar');
  if(hint) hint.style.display = 'none';
}

// ── LEAN VISION STATE ───────────────────────
// Détection via mots-clés (detectTypeFromKeywords dans i18n.js)
// + Pixtral pour les hotspots auto (autoDetectHspots dans scan.js)
const leanTags = { type: null, matiere: null, style: null };

function selectChip(el, category, value) {
  el.parentElement.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  leanTags[category] = value;
}

// Extraction couleur dominante via Canvas — zéro IA, zéro serveur
function extractDominantColor(imgElement) {
  try {
    const canvas = document.createElement('canvas');
    const size = 50;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 16) { r += data[i]; g += data[i+1]; b += data[i+2]; count++; }
    r = Math.round(r/count); g = Math.round(g/count); b = Math.round(b/count);
    const palette = [
      {name:'noir',   r:30,  g:30,  b:30 },{name:'blanc',  r:230,g:230,b:220},
      {name:'beige',  r:210,g:190, b:160 },{name:'camel',  r:190,g:140,b:90 },
      {name:'kaki',   r:130,g:140, b:90  },{name:'bleu',   r:60, g:100,b:180},
      {name:'marine', r:30, g:50,  b:100 },{name:'rouge',  r:190,g:50, b:60 },
      {name:'rose',   r:220,g:150, b:160 },{name:'vert',   r:80, g:150,b:90 },
      {name:'gris',   r:150,g:150, b:150 },{name:'marron', r:130,g:80, b:50 },
      {name:'violet', r:130,g:80,  b:160 },{name:'orange', r:220,g:130,b:60 },
    ];
    let best = palette[0], minDist = Infinity;
    palette.forEach(c => {
      const d = Math.sqrt((r-c.r)**2+(g-c.g)**2+(b-c.b)**2);
      if (d < minDist) { minDist = d; best = c; }
    });
    return best.name;
  } catch(e) { return null; }
}

function autoDetectColor() {
  // La couleur est maintenant gérée par hotspot via autoDetectColorForHotspot()
  // Cette fonction est conservée pour compatibilité mais ne fait plus rien à l'étape 3
}

function resetLeanTags() {
  Object.keys(leanTags).forEach(k => leanTags[k] = null);
  document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('selected'));
  const lbl = document.getElementById('color-auto-label');
  if (lbl) lbl.style.display = 'none';
}

async function doPublish(){
  if(!me)return toast(t('login_publish'));
  const caption=document.getElementById('c-caption').value.trim();
  const city=document.getElementById('c-city').value.trim();
  const country=document.getElementById('c-country').value.trim();
  const btn=document.getElementById('btn-pub');
  btn.disabled=true;btn.textContent=t('publishing');
  let imageUrl=null;
  if(selFile){
    // Compression avant upload : WebP ≤1920px (repli JPEG/original dans le helper).
    // Indispensable pour le chemin galerie où selFile est la photo d'origine (12 MP possibles).
    const upFile=await compressImageForUpload(selFile);
    const ext=upFile.name.split('.').pop();
    const path=`${me.id}/${Date.now()}.${ext}`;
    const {error:upErr}=await sb.storage.from('posts').upload(path,upFile,{contentType:upFile.type||'image/jpeg'});
    if(upErr){
      btn.disabled=false;btn.textContent=t('publish');
      return toast('❌ '+t('upload_conn_error'));
    }
    const {data:u}=sb.storage.from('posts').getPublicUrl(path);
    imageUrl=u.publicUrl;
  }
  btn.textContent=t('saving');
  const _postData={
    user_id:me.id,caption,image_url:imageUrl,likes_count:0,
    city:city||null,country:country||null,
    hotspots:hspots,tags:{style:leanTags.style||null},alternatives:{}
  };
  // N'ajoute music_url/music_title que si renseignés (évite 400 si colonnes absentes)
  if(typeof _postMusicUrl!=='undefined'&&_postMusicUrl){
    _postData.music_url=_postMusicUrl;
    _postData.music_title=_postMusicTitle||null;
    _postData.music_start=typeof _postMusicStart!=='undefined'?(_postMusicStart||0):0;
    if(typeof _postMusicEnd!=='undefined'&&_postMusicEnd!=null) _postData.music_end=_postMusicEnd;
  }
  const {error}=await sb.from('posts').insert(_postData);
  btn.disabled=false;btn.textContent=t('publish');
  if(error)return toast(`❌ ${t('toast_error')}: ${error.message}`);
  if(_postMusicUrl&&typeof _addMusicRecent==='function') _addMusicRecent(_postMusicUrl, _postMusicTitle);
  toast(t('toast_published'));
  resetLeanTags();
  if(typeof clearPostMusic==='function')clearPostMusic();
  setTimeout(()=>{resetCreate();loadFeed();goTab('feed');},1200);
}

// ── HOTSPOTS ────────────────────────────────
function addHspot(){
  const id='hs-'+Date.now();
  hspots.push({id,x:50,y:50,size:30,name:'',brand:'',price:'',type:null,colors:[],matiere:null});
  renderHspotsEditor();selectHspot(id);
  // Pas de détection automatique au placement — uniquement via aiHspotScheduleSuggestion
  aiHspotScheduleSuggestion(id);
}

// ── IA on-device : suggestion de type pour un hotspot (avec debounce) ──
let _aiHspotCurrentId=null;
let _aiHspotCurrentSuggestion=null;
let _aiHspotTimer=null;
let _aiHspotInProgress=false;

function aiHspotScheduleSuggestion(hsId){
  // Annule le timer précédent — recommence à zéro à chaque mouvement
  if(_aiHspotTimer){clearTimeout(_aiHspotTimer);_aiHspotTimer=null;}
  // Délai de 1500ms : si l'utilisateur bouge le hotspot pendant ce temps, le timer reset
  _aiHspotTimer=setTimeout(()=>{
    _aiHspotTimer=null;
    aiHspotSuggestType(hsId);
  },1500);
}
function aiHspotCancelSuggestion(){
  if(_aiHspotTimer){clearTimeout(_aiHspotTimer);_aiHspotTimer=null;}
}

async function aiHspotSuggestType(hsId){
  if(!window.detectFashionOnDevice)return;
  const h=hspots.find(x=>x.id===hsId);
  if(!h)return;
  const imgEl=document.getElementById('prev-img');
  if(!imgEl||!imgEl.src||!imgEl.naturalWidth)return;
  _aiHspotCurrentId=hsId;
  // Crop autour du hotspot
  try{
    const w=imgEl.naturalWidth,h_=imgEl.naturalHeight;
    const cropPct=15; // 15% : crop plus serré pour éviter de capturer les vêtements voisins
    const cropSize=Math.round(Math.min(w,h_)*(cropPct/100));
    const cx=Math.round(w*h.x/100),cy=Math.round(h_*h.y/100);
    const sx=Math.max(0,cx-cropSize/2),sy=Math.max(0,cy-cropSize/2);
    const sw=Math.min(cropSize,w-sx),sh=Math.min(cropSize,h_-sy);
    const canvas=document.createElement('canvas');
    canvas.width=224;canvas.height=224;
    canvas.getContext('2d').drawImage(imgEl,sx,sy,sw,sh,0,0,224,224);
    const cropUrl=canvas.toDataURL('image/jpeg',0.9);
    const detection=await window.detectFashionOnDevice(cropUrl);
    if(detection.error||!detection.type)return;
    // Ne montre la suggestion QUE si encore sur le même hotspot et nom encore vide
    if(_aiHspotCurrentId!==hsId)return;
    if(document.getElementById('hs-name').value.trim())return;
    // Seuil de confiance : en dessous, on ne montre pas (pour éviter du bruit)
    const MIN_CONFIDENCE=5;
    if(!detection.confidence||detection.confidence<MIN_CONFIDENCE){
      console.log(`[WA-AI hspot] Confiance ${detection.confidence}% trop basse, suggestion cachée`);
      return;
    }
    _aiHspotCurrentSuggestion=detection;
    document.getElementById('ai-hspot-chip').textContent=detection.type;
    document.getElementById('ai-hspot-confidence').textContent=detection.confidence?`${detection.confidence}%`:'';
    document.getElementById('ai-hspot-suggestion').style.display='flex';
  }catch(e){console.warn('[WA-AI hspot]',e);}
}
function aiHspotApplySuggestion(){
  if(!_aiHspotCurrentSuggestion)return;
  const input=document.getElementById('hs-name');
  input.value=_aiHspotCurrentSuggestion.type;
  updateHspot();
  scheduleTypeDetect();
  aiHspotHideSuggestion();
}
function aiHspotHideSuggestion(forceDismiss){
  const el=document.getElementById('ai-hspot-suggestion');
  if(el)el.style.display='none';
  if(forceDismiss)_aiHspotCurrentSuggestion=null;
}
// ── Calcule la zone image réelle dans un conteneur (object-fit:contain) ──
function _imgArea(containerEl, imgEl){
  const cW=containerEl.offsetWidth, cH=containerEl.offsetHeight;
  const nW=imgEl.naturalWidth||cW, nH=imgEl.naturalHeight||cH;
  const scale=Math.min(cW/nW, cH/nH);
  const iW=nW*scale, iH=nH*scale;
  return {iL:(cW-iW)/2, iT:(cH-iH)/2, iW, iH, cW, cH};
}

// ── Cover uniquement pour les images 9:16 (r≥1.7) — tous les autres ratios : contain ──
// Photos caméra (1080×1920, r=1.778) → cover. Rognages 4:5, 1:1, 16:9 → contain.
function _autoFit(imgEl){
  if(!imgEl.naturalWidth||!imgEl.naturalHeight) return;
  const r=imgEl.naturalHeight/imgEl.naturalWidth;
  if(r>=1.7) imgEl.style.objectFit='cover';
}

// ── Repositionne le hzone du feed pour qu'il colle à l'image réelle ──
function _fitHzone(imgEl, pid){
  const slide=imgEl.closest('.feed-slide');
  // Cherche le hzone dans le même slide (évite getElementById qui retourne
  // le premier trouvé dans le document — bug quand feed-scroll + pv-scroll
  // contiennent le même post avec des IDs identiques)
  const hzone=slide?.querySelector('[id="hzone-'+pid+'"]')
    ||document.getElementById('hzone-'+pid);
  if(!slide||!hzone) return;
  const cW=slide.offsetWidth, cH=slide.offsetHeight;
  const nW=imgEl.naturalWidth, nH=imgEl.naturalHeight;
  if(!nW||!nH) return;
  const r=nH/nW;
  // cover pour images portrait 9:16, contain pour les autres
  const scale = r>=1.7 ? Math.max(cW/nW, cH/nH) : Math.min(cW/nW, cH/nH);
  const iW=nW*scale, iH=nH*scale;
  const imgL=(cW-iW)/2, imgT=(cH-iH)/2;

  // hzone = zone visible de l'image (clampée aux bords du slide)
  // En mode cover : l'image déborde → imgL<0 → on clip à 0
  const hL=Math.max(0,imgL), hT=Math.max(0,imgT);
  const hW=Math.min(cW, imgL+iW)-hL;
  const hH=Math.min(cH, imgT+iH)-hT;
  hzone.style.left=hL+'px';
  hzone.style.top=hT+'px';
  hzone.style.width=hW+'px';
  hzone.style.height=hH+'px';
  hzone.style.right='auto';

  // Recalcule la position de chaque dot dans l'espace slide
  // data-x/data-y = % de l'image complète (stockés dans renderSlides)
  const hdots=slide.querySelector('#hdots-'+pid);
  if(hdots){
    hdots.querySelectorAll('.slide-hotspot').forEach(dot=>{
      const ox=parseFloat(dot.dataset.x);
      const oy=parseFloat(dot.dataset.y);
      if(isNaN(ox)||isNaN(oy)) return;
      // Position du point dans la zone visible
      const px=ox/100*iW+imgL-hL;
      const py=oy/100*iH+imgT-hT;
      dot.style.left=Math.max(0,Math.min(100,px/hW*100))+'%';
      dot.style.top =Math.max(0,Math.min(100,py/hH*100))+'%';
    });
  }
}

function renderHspotsEditor(){
  const canvas=document.getElementById('hspot-canvas');
  const img=document.getElementById('prev-img');
  canvas.querySelectorAll('.hs-dot').forEach(e=>e.remove());
  // Calcul de la zone image (object-fit:contain dans le canvas)
  const {iL, iT, iW, iH, cW, cH}=_imgArea(canvas, img);
  hspots.forEach(h=>{
    // Convertit les % image → % conteneur pour le positionnement CSS
    const left=(iL + h.x/100*iW)/cW*100;
    const top=(iT + h.y/100*iH)/cH*100;
    const dot=document.createElement('div');
    dot.className='hs-dot';dot.id=h.id;
    dot.style.cssText=`position:absolute;width:${h.size}px;height:${h.size}px;border-radius:50%;border:1.5px solid rgba(240,234,216,0.7);background:rgba(240,234,216,0.12);display:flex;align-items:center;justify-content:center;cursor:grab;left:${left}%;top:${top}%;transform:translate(-50%,-50%);z-index:10;box-shadow:${h.id===selHspot?'0 0 0 3px rgba(240,234,216,.4)':'none'};transition:box-shadow .2s;touch-action:none;user-select:none;`;
    dot.innerHTML=`<span style="color:rgba(240,234,216,0.8);font-size:${h.size*0.5}px;font-weight:300;line-height:1">+</span>`;
    dot.addEventListener('pointerdown',e=>startDragHspot(e,h.id));
    dot.addEventListener('click',e=>{e.stopPropagation();selectHspot(h.id);});
    canvas.appendChild(dot);
  });
}
function onHspotSizeChange(value){
  const size=parseInt(value);
  // Label dynamique
  const label=document.getElementById('hs-size-label');
  let labelText='Normale';
  if(size<=24)labelText=t('hs_secondary');
  else if(size<=32)labelText=t('hs_normal');
  else if(size<=40)labelText=t('hs_primary');
  else labelText=t('hs_star');
  if(label)label.textContent=labelText;
  // ARIA value + gradient remplissage du slider
  const slider=document.getElementById('hs-size-slider');
  if(slider){
    slider.setAttribute('aria-valuenow',size);
    slider.setAttribute('aria-valuetext',labelText);
    const pct=((size-20)/(48-20))*100;
    slider.style.background=`linear-gradient(to right, var(--gold) 0%, var(--gold) ${pct}%, var(--gold-b) ${pct}%, var(--gold-b) 100%)`;
  }
  // Mise à jour temps réel du hotspot sélectionné
  const h=hspots.find(h=>h.id===selHspot);
  if(h){
    h.size=size;
    renderHspotsEditor();
    // Maintenir l'éditeur visible après re-render
    const editEl=document.getElementById('hspot-edit');
    if(editEl)editEl.style.display='block';
  }
}
function selectHspot(id){
  selHspot=id;
  _showTrashBtn();
  aiHspotHideSuggestion(true);
  const h=hspots.find(h=>h.id===id);if(!h)return;
  document.getElementById('hspot-edit').style.display='block';
  document.getElementById('hs-name').value=h.name||'';
  document.getElementById('hs-brand').value=h.brand||'';
  // Si le hotspot n'a pas encore de nom, propose une suggestion
  if(!h.name)aiHspotScheduleSuggestion(id);
  // Sync slider sur la taille actuelle du hotspot
  const slider=document.getElementById('hs-size-slider');
  const size=h.size||30;
  if(slider){slider.value=size;onHspotSizeChange(size);}
  loadHsChips(h);
  renderHspotsEditor();
  if(h.name&&!h.type)autoDetectTypeForHotspot(h);
  // Sync couleurs
  renderColorsList();
  if((h.colors||[]).length>0) openCouleurSection();
  else{
    couleurSectionOpen=false;
    const body=document.getElementById('couleur-section-body');
    const chev=document.getElementById('couleur-chevron');
    if(body)body.style.display='none';
    if(chev)chev.style.transform='rotate(0deg)';
  }
}
function updateHspot(){
  const h=hspots.find(h=>h.id===selHspot);if(!h)return;
  h.name=document.getElementById('hs-name').value;
  h.brand=document.getElementById('hs-brand').value;
  // type, couleur, matiere sont mis à jour par selectHsChip()
}
// ── Chips Lean Vision dans l'éditeur hotspot ──
function selectHsChipUnknown(el){
  selectHsChip(el,'matiere','inconnu');
  const hint=document.getElementById('hs-unknown-hint');
  if(hint)hint.style.display='block';
}

function selectHsChip(el,field,value){
  const container=el.parentElement;
  const h=hspots.find(h=>h.id===selHspot);
  // Type, matière, style : sélection unique
  container.querySelectorAll('.hs-chip').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  if(h)h[field]=value;
  // Révèle la section matière dès qu'un type est choisi
  if(field==='type'){
    const matSection=document.getElementById('hs-section-matiere');
    if(matSection)matSection.classList.add('visible');
  }
  // Masquer le hint communautaire si une vraie matière est choisie
  if(field==='matiere'&&value!=='inconnu'){
    const hint=document.getElementById('hs-unknown-hint');
    if(hint)hint.style.display='none';
  }
}
function loadHsChips(h){
  ['type','matiere'].forEach(field=>{
    const container=document.getElementById('hs-chips-'+field);
    if(!container)return;
    // Normalise via mots-clés si la valeur est un nom complet ("jean slim bleu" → "jean")
    const raw=(h[field]||'').toLowerCase();
    const resolved=(field==='type'&&typeof detectTypeFromKeywords==='function')
      ?(detectTypeFromKeywords(raw)||raw)
      :raw;
    container.querySelectorAll('.hs-chip').forEach(chip=>{
      const chipVal=chip.textContent.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
      chip.classList.toggle('selected', chipVal===resolved);
    });
  });
  // Affiche la section matière seulement si un type est déjà sélectionné
  const matSection=document.getElementById('hs-section-matiere');
  if(matSection)matSection.classList.toggle('visible',!!(h.type));
  const lbl=document.getElementById('hs-color-auto');
  if(lbl)lbl.style.display='none';
}
async function autoDetectTypeForHotspot(h){
  const img=document.getElementById('prev-img');
  const typeAuto=document.getElementById('hs-type-auto');
  // Indicateur de chargement
  if(typeAuto){typeAuto.style.display='inline';typeAuto.textContent=t('detecting');}
  const result=await autoDetectType(h.name,img);
  if(!result){
    if(typeAuto)typeAuto.style.display='none';
    return;
  }
  document.querySelectorAll('#hs-chips-type .hs-chip').forEach(chip=>{
    const chipVal=chip.textContent.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    if(chipVal===result.type||chipVal===result.type.replace('-',' ')){
      chip.classList.add('selected');h.type=result.type;
    }
  });
  if(typeAuto){
    typeAuto.style.display='inline';
    typeAuto.textContent=result.source==='keywords'?t('detected_name'):t('detected_visual');
  }
}

let _typeDetectTimer=null;
function scheduleTypeDetect(){
  clearTimeout(_typeDetectTimer);
  _typeDetectTimer=setTimeout(()=>{
    const h=hspots.find(h=>h.id===selHspot);
    if(h&&h.name&&!h.type)autoDetectTypeForHotspot(h);
  },600);
}

// ═══════════════════════════════════════════
// COULEURS MULTI-CAPTURE HOTSPOT
// ═══════════════════════════════════════════
const MAX_COLORS=3;
let ccActive=false;
let ccSourceCtx=null;
let ccImgW=0;
let ccImgH=0;
let ccEditIndex=null;
let couleurSectionOpen=false;

function toggleCouleurSection(){
  couleurSectionOpen=!couleurSectionOpen;
  const body=document.getElementById('couleur-section-body');
  const chevron=document.getElementById('couleur-chevron');
  const hdr=document.getElementById('couleur-section-header');
  if(body)body.style.display=couleurSectionOpen?'block':'none';
  if(chevron)chevron.style.transform=couleurSectionOpen?'rotate(180deg)':'rotate(0deg)';
  if(hdr)hdr.setAttribute('aria-expanded',couleurSectionOpen?'true':'false');
}

function openCouleurSection(){
  if(!couleurSectionOpen){
    couleurSectionOpen=true;
    const body=document.getElementById('couleur-section-body');
    const chevron=document.getElementById('couleur-chevron');
    const hdr=document.getElementById('couleur-section-header');
    if(body)body.style.display='block';
    if(chevron)chevron.style.transform='rotate(180deg)';
    if(hdr)hdr.setAttribute('aria-expanded','true');
  }
}

function renderColorsList(){
  const h=hspots.find(h=>h.id===selHspot);
  const list=document.getElementById('hs-colors-list');
  const addBtn=document.getElementById('btn-add-color');
  const summary=document.getElementById('couleur-pills-summary');
  if(!list)return;
  if(!h){list.innerHTML='';if(addBtn)addBtn.style.display='flex';return;}
  // Normalise les couleurs : string legacy → objet {hex, name, confirmed}
  const colors=(h.colors||[]).map(c=>{
    if(typeof c==='string') return{hex:typeof _scanColorToCss==='function'?_scanColorToCss(c):'#888',name:c,confirmed:true};
    return c;
  });
  h.colors=colors; // met à jour le hotspot pour les prochains accès
  list.innerHTML=colors.map((c,i)=>`
    <div class="color-item ${c.confirmed?'':'pending'}" id="color-item-${i}">
      <div class="color-swatch" style="background:${c.hex||'#888'}"></div>
      <div class="color-info">
        <div class="color-name">${c.name||''}</div>
        <div class="color-hex">${(c.hex||'').toUpperCase()}</div>
      </div>
      <div class="color-actions">
        ${!c.confirmed?`<button class="color-confirm-btn" onclick="confirmColor(${i})">✓ OK</button>`:`
        <div class="color-action-btn" onclick="startColorCapture(${i})" title="Modifier">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </div>`}
        <div class="color-action-btn" onclick="removeColor(${i})" title="Supprimer">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,80,80,.7)" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </div>
      </div>
    </div>`).join('');
  const hasPending=colors.some(c=>!c.confirmed);
  const atMax=colors.length>=MAX_COLORS;
  if(addBtn)addBtn.style.display=(hasPending||atMax)?'none':'flex';
  if(summary)summary.innerHTML=colors.filter(c=>c.confirmed).map(c=>`<div style="width:10px;height:10px;border-radius:50%;background:${c.hex};border:1px solid rgba(255,255,255,.2)"></div>`).join('');
}

function confirmColor(index){
  const h=hspots.find(h=>h.id===selHspot);
  if(!h||!h.colors[index])return;
  h.colors[index].confirmed=true;
  renderColorsList();
  toast(`✓ ${h.colors[index].name}`);
}

function removeColor(index){
  const h=hspots.find(h=>h.id===selHspot);
  if(!h)return;
  h.colors.splice(index,1);
  renderColorsList();
}

function startColorCapture(editIndex=null){
  if(!selHspot)return;
  const h=hspots.find(h=>h.id===selHspot);
  if(!h)return;
  if(editIndex===null&&(h.colors||[]).length>=MAX_COLORS){toast(`Maximum ${MAX_COLORS} ${t('colors_per_item')}`);return;}
  ccEditIndex=editIndex;
  ccActive=true;
  const img=document.getElementById('prev-img');
  const canvas=document.createElement('canvas');
  canvas.width=img.naturalWidth||800;
  canvas.height=img.naturalHeight||1000;
  const ctx=canvas.getContext('2d');
  try{
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    ccSourceCtx=ctx;ccImgW=canvas.width;ccImgH=canvas.height;
  }catch(e){toast(t('toast_pixels_error'));return;}
  const overlay=document.getElementById('color-capture-overlay');
  overlay.style.display='block';
  document.getElementById('color-capture-hint').style.display='block';
  overlay.addEventListener('touchstart',onCCStart,{passive:false});
  overlay.addEventListener('touchmove',onCCMove,{passive:false});
  overlay.addEventListener('touchend',onCCEnd,{passive:false});
  overlay.addEventListener('mousedown',onCCStart);
  overlay.addEventListener('mousemove',onCCMove);
  overlay.addEventListener('mouseup',onCCEnd);
}

function cancelColorCapture(){
  ccActive=false;
  const overlay=document.getElementById('color-capture-overlay');
  if(!overlay)return;
  overlay.style.display='none';
  document.getElementById('cc-loupe').style.display='none';
  document.getElementById('cc-bubble').style.display='none';
  document.getElementById('color-capture-hint').style.display='none';
  overlay.removeEventListener('touchstart',onCCStart);
  overlay.removeEventListener('touchmove',onCCMove);
  overlay.removeEventListener('touchend',onCCEnd);
  overlay.removeEventListener('mousedown',onCCStart);
  overlay.removeEventListener('mousemove',onCCMove);
  overlay.removeEventListener('mouseup',onCCEnd);
}

function getCCPos(e){
  if(e.touches?.length>0)return{x:e.touches[0].clientX,y:e.touches[0].clientY};
  return{x:e.clientX,y:e.clientY};
}

function onCCStart(e){
  e.preventDefault();
  document.getElementById('cc-loupe').style.display='block';
  document.getElementById('cc-bubble').style.display='block';
  onCCMove(e);
}

function onCCMove(e){
  e.preventDefault();
  if(!ccActive||!ccSourceCtx)return;
  const pos=getCCPos(e);
  const canvas=document.getElementById('hspot-canvas');
  const rect=canvas.getBoundingClientRect();
  const relX=Math.max(0,Math.min(1,(pos.x-rect.left)/rect.width));
  const relY=Math.max(0,Math.min(1,(pos.y-rect.top)/rect.height));
  const px=Math.floor(relX*ccImgW);
  const py=Math.floor(relY*ccImgH);
  const pixel=ccSourceCtx.getImageData(Math.max(0,Math.min(ccImgW-1,px)),Math.max(0,Math.min(ccImgH-1,py)),1,1).data;
  const hex=rgbToHex(pixel[0],pixel[1],pixel[2]);
  const name=getColorName(pixel[0],pixel[1],pixel[2]);
  // Loupe
  const lx=pos.x-rect.left;
  const ly=pos.y-rect.top;
  const loupe=document.getElementById('cc-loupe');
  loupe.style.left=lx+'px';loupe.style.top=Math.max(50,ly)+'px';
  const loupeCtx=document.getElementById('cc-loupe-canvas').getContext('2d');
  const zoom=8;const sw=70/zoom;const sh=70/zoom;
  loupeCtx.imageSmoothingEnabled=false;
  loupeCtx.clearRect(0,0,70,70);
  try{loupeCtx.drawImage(ccSourceCtx.canvas,Math.max(0,px-sw/2),Math.max(0,py-sh/2),sw,sh,0,0,70,70);}catch(e){}
  // Bulle
  const bubble=document.getElementById('cc-bubble');
  bubble.style.left=lx+'px';bubble.style.top=Math.max(40,ly-10)+'px';
  document.getElementById('cc-bubble-swatch').style.background=hex;
  document.getElementById('cc-bubble-name').textContent=name;
  window._ccTempHex=hex;window._ccTempName=name;
}

function onCCEnd(e){
  e.preventDefault();
  if(!ccActive||!window._ccTempHex)return;
  const hex=window._ccTempHex;const name=window._ccTempName;
  const h=hspots.find(h=>h.id===selHspot);
  if(!h){cancelColorCapture();return;}
  if(!h.colors)h.colors=[];
  if(ccEditIndex!==null){h.colors[ccEditIndex]={hex,name,confirmed:false};}
  else{h.colors.push({hex,name,confirmed:false});}
  cancelColorCapture();
  openCouleurSection();
  renderColorsList();
}

function autoCaptureColorAtPos(h){
  const img=document.getElementById('prev-img');
  const canvas=document.createElement('canvas');
  canvas.width=img.naturalWidth||800;
  canvas.height=img.naturalHeight||1000;
  const ctx=canvas.getContext('2d');
  try{
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const cx=Math.floor((h.x/100)*canvas.width);
    const cy=Math.floor((h.y/100)*canvas.height);
    const canvasEl=document.getElementById('hspot-canvas');
    const scaleX=canvas.width/(canvasEl?.offsetWidth||350);
    const scaleY=canvas.height/(canvasEl?.offsetHeight||440);
    const zoneW=Math.max(16,(h.size||30)*scaleX*0.7);
    const zoneH=Math.max(16,(h.size||30)*scaleY*0.7);
    const sx=Math.max(0,Math.round(cx-zoneW/2));
    const sy=Math.max(0,Math.round(cy-zoneH/2));
    const sw=Math.min(zoneW,canvas.width-sx);
    const sh=Math.min(zoneH,canvas.height-sy);

    const canvasColors=extractDominantColors(ctx,sx,sy,Math.round(sw),Math.round(sh),2);

    // Garder les couleurs confirmées (Pixtral ou validées manuellement)
    const confirmed=(h.colors||[]).filter(c=>c.confirmed);

    // Ajouter les couleurs canvas non encore présentes (distance hex > 60)
    const toAdd=canvasColors.filter(cc=>{
      const [cr,cg,cb]=hexToRgb(cc.hex);
      return !confirmed.some(ec=>{
        const [er,eg,eb]=hexToRgb(ec.hex);
        return Math.sqrt((cr-er)**2+(cg-eg)**2+(cb-eb)**2)<60;
      });
    }).map(c=>({hex:c.hex,name:c.name,confirmed:false}));

    // Fusionner : confirmées d'abord, canvas en complément, max MAX_COLORS
    h.colors=[...confirmed,...toAdd].slice(0,MAX_COLORS);
  }catch(e){console.warn('Auto-capture couleur:',e.message);}
}

// Convertit un hex en [r,g,b]
function hexToRgb(hex){
  const r=parseInt(hex.slice(1,3),16)||0;
  const g=parseInt(hex.slice(3,5),16)||0;
  const b=parseInt(hex.slice(5,7),16)||0;
  return[r,g,b];
}

function extractDominantColors(ctx,sx,sy,sw,sh,maxColors=2){
  const W=Math.max(1,sw);
  const H=Math.max(1,sh);
  const imgData=ctx.getImageData(sx,sy,W,H);
  const pixels=imgData.data;
  const buckets={};

  for(let py=0;py<H;py++){
    for(let px=0;px<W;px++){
      const i=(py*W+px)*4;
      const a=pixels[i+3];
      if(a<128)continue;
      // Ignore les 20% extérieurs de la zone (bords = fond/peau)
      const rx=px/W, ry=py/H;
      if(rx<0.2||rx>0.8||ry<0.2||ry>0.8)continue;
      // Buckets de 16 (précision double vs 32)
      const r=Math.round(pixels[i]/16)*16;
      const g=Math.round(pixels[i+1]/16)*16;
      const b=Math.round(pixels[i+2]/16)*16;
      const key=`${r},${g},${b}`;
      buckets[key]=(buckets[key]||0)+1;
    }
  }

  const sorted=Object.entries(buckets).sort((a,b)=>b[1]-a[1]);
  const result=[];
  for(const[key]of sorted){
    if(result.length>=maxColors)break;
    const[r,g,b]=key.split(',').map(Number);
    // Distance min augmentée à 80 pour vraiment séparer les couleurs distinctes
    const tooClose=result.some(c=>Math.sqrt((c.r-r)**2+(c.g-g)**2+(c.b-b)**2)<80);
    if(tooClose)continue;
    result.push({r,g,b,hex:rgbToHex(r,g,b),name:getColorName(r,g,b)});
  }
  return result;
}

function rgbToHex(r,g,b){return'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');}

function getColorName(r,g,b){
  const h=rgbToHue(r,g,b),s=rgbToSat(r,g,b),l=rgbToLum(r,g,b);
  if(l<15)return'Noir';if(l>88)return'Blanc';
  if(s<12)return l<40?'Gris foncé':l<65?'Gris':'Gris clair';
  if(h<15||h>=345)return l<40?'Rouge foncé':'Rouge';
  if(h<30)return l<35?'Marron':l<50?'Brun':'Orange';
  if(h<50)return l<50?'Camel':'Jaune';
  if(h<80)return l<50?'Kaki':'Jaune-vert';
  if(h<150)return l<40?'Vert foncé':'Vert';
  if(h<175)return'Turquoise';
  if(h<195)return l<40?'Bleu canard':'Cyan';
  if(h<240)return l<35?'Bleu marine':s>60?'Bleu royal':'Bleu';
  if(h<260)return l<40?'Indigo':'Lavande';
  if(h<290)return l<40?'Violet foncé':'Violet';
  if(h<320)return l<35?'Bordeaux':'Rose';
  return'Framboise';
}

function rgbToHue(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b);
  if(max===min)return 0;
  const d=max-min;let h;
  if(max===r)h=((g-b)/d+(g<b?6:0))/6;
  else if(max===g)h=((b-r)/d+2)/6;
  else h=((r-g)/d+4)/6;
  return Math.round(h*360);
}
function rgbToSat(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;
  if(max===min)return 0;
  const d=max-min;
  return Math.round((l>0.5?d/(2-max-min):d/(max+min))*100);
}
function rgbToLum(r,g,b){return Math.round((0.299*r+0.587*g+0.114*b)/255*100);}

function clearHsChips(){
  ['type','matiere'].forEach(field=>{
    const c=document.getElementById('hs-chips-'+field);
    if(c)c.querySelectorAll('.hs-chip').forEach(ch=>ch.classList.remove('selected'));
  });
  const tlbl=document.getElementById('hs-type-auto');if(tlbl)tlbl.style.display='none';
  const hint=document.getElementById('hs-unknown-hint');if(hint)hint.style.display='none';
  const matSection=document.getElementById('hs-section-matiere');
  if(matSection)matSection.classList.remove('visible');
}
function deleteHspot(){clearHsChips();hspots=hspots.filter(h=>h.id!==selHspot);selHspot=null;document.getElementById('hspot-edit').style.display='none';_hideTrashBtn();renderHspotsEditor();}
function clearHspots(){clearHsChips();hspots=[];selHspot=null;document.getElementById('hspot-edit').style.display='none';_hideTrashBtn();renderHspotsEditor();}

// ── Poubelle ──────────────────────────────
function _showTrashBtn(){
  const t=document.getElementById('hspot-trash-btn');
  if(t){t.style.opacity='1';t.style.pointerEvents='auto';t.style.background='rgba(255,80,80,0.08)';}
}
function _hideTrashBtn(){
  const t=document.getElementById('hspot-trash-btn');
  if(t){t.style.opacity='0';t.style.pointerEvents='none';t.style.background='transparent';}
}

function startDragHspot(e,id){
  e.preventDefault();
  e.stopPropagation();
  selHspot=id;selectHspot(id);
  const canvas=document.getElementById('hspot-canvas');
  const img=document.getElementById('prev-img');
  const rect=canvas.getBoundingClientRect();
  let colorThrottle=null;

  // Bloque le scroll du conteneur pendant le drag
  const scrollBody=document.getElementById('create-body');
  const prevOverflow=scrollBody?scrollBody.style.overflowY:'';
  if(scrollBody) scrollBody.style.overflowY='hidden';

  function onMove(ev){
    ev.preventDefault();
    const cx=ev.touches?ev.touches[0].clientX:ev.clientX;
    const cy=ev.touches?ev.touches[0].clientY:ev.clientY;
    const {iL,iT,iW,iH}=_imgArea(canvas,img);
    const x=Math.max(0,Math.min(100,(cx-rect.left-iL)/iW*100));
    const y=Math.max(0,Math.min(100,(cy-rect.top-iT)/iH*100));
    const h=hspots.find(h=>h.id===id);if(h){h.x=x;h.y=y;}
    renderHspotsEditor();
    aiHspotHideSuggestion();
    aiHspotScheduleSuggestion(id);
    if(!colorThrottle){
      colorThrottle=setTimeout(()=>{
        colorThrottle=null;
        const h=hspots.find(h=>h.id===id);
        if(h){
          autoCaptureColorAtPos(h);
          renderColorsList();
          if((h.colors||[]).length>0) openCouleurSection();
        }
      },80);
    }
  }
  function onUp(){
    document.removeEventListener('pointermove',onMove);
    document.removeEventListener('pointerup',onUp);
    document.removeEventListener('pointercancel',onUp);
    // Restaure le scroll
    if(scrollBody) scrollBody.style.overflowY=prevOverflow;
    clearTimeout(colorThrottle);
    const h=hspots.find(h=>h.id===id);
    if(h){
      autoCaptureColorAtPos(h);
      renderColorsList();
      if((h.colors||[]).length>0) openCouleurSection();
    }
  }
  document.addEventListener('pointermove',onMove,{passive:false});
  document.addEventListener('pointerup',onUp);
  document.addEventListener('pointercancel',onUp);
}

// ═══════════════════════════════════════════
