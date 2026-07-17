// ═══════════════════════════════════════════
// WEARSCAN — Analyse IA de tenue (Mistral Pixtral)
// ═══════════════════════════════════════════
//
// Supabase setup requis :
//   CREATE TABLE scan_history (
//     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//     user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
//     image_url text,
//     detected_pieces jsonb DEFAULT '[]',
//     created_at timestamptz DEFAULT now()
//   );
//   ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "own_scans" ON scan_history FOR ALL USING (auth.uid() = user_id);
//
//   Storage : créer un bucket public "scan-images"
// ═══════════════════════════════════════════

let _scan = {
  tab: 'scan',
  image: null,
  pieces: [],
  history: [],
  editMode: false
};

// ── OPEN / CLOSE ──────────────────────────
function openScan() {
  goS('sc-scan');
  const bnav = document.getElementById('shared-bnav');
  if (bnav) bnav.style.display = 'none';
  _scanResetPanel();
}

function closeScan() {
  const bnav = document.getElementById('shared-bnav');
  if (bnav) bnav.style.display = '';
  goTab('feed');
}

function _scanResetPanel() {
  closeScanEditPanel();
  _scan.image = null;
  _scan.pieces = [];
  const empty  = document.getElementById('scan-empty');
  const result = document.getElementById('scan-result-wrap');
  if (empty)  empty.style.display  = 'flex';
  if (result) result.style.display = 'none';
  const loading = document.getElementById('scan-loading');
  const noRes   = document.getElementById('scan-no-result');
  if (loading) loading.style.display = 'none';
  if (noRes)   noRes.style.display   = 'none';
}

// ── TABS ──────────────────────────────────
function switchScanTab(tab) {
  _scan.tab = tab;
  document.querySelectorAll('.scan-tab').forEach((el, i) => {
    const active = (i === 0 && tab === 'scan') || (i === 1 && tab === 'history');
    el.classList.toggle('active', active);
    el.setAttribute('aria-selected', active ? 'true' : 'false');
    el.setAttribute('tabindex', active ? '0' : '-1');
  });
  const scanBody = document.getElementById('scan-body');
  const histBody = document.getElementById('scan-hist-body');
  if (scanBody) scanBody.style.display = tab === 'scan'    ? 'flex' : 'none';
  if (histBody) histBody.style.display = tab === 'history' ? 'flex' : 'none';
  if (tab === 'history') loadScanHistory();
}

// ── INPUT ──────────────────────────────────
// getUserMedia direct dans sc-scan → aucune sauvegarde en galerie
let _scanCamStream = null;
let _scanCamFacing = 'environment';

function scanFromCamera() {
  _openScanCam();
}

async function _openScanCam() {
  const overlay = document.getElementById('scan-cam-overlay');
  if (!overlay) { scanFromGallery(); return; }
  const errEl   = document.getElementById('scan-cam-error');
  const video   = document.getElementById('scan-cam-video');
  if (errEl)  errEl.style.display  = 'none';
  if (video)  video.style.opacity  = '0';
  overlay.style.display = 'block';
  _scanCamFacing = 'environment';
  await _startScanCamStream();
}

async function _startScanCamStream() {
  const video  = document.getElementById('scan-cam-video');
  const errEl  = document.getElementById('scan-cam-error');
  const errMsg = document.getElementById('scan-cam-error-msg');
  if (!video) return;

  if (_scanCamStream) { _scanCamStream.getTracks().forEach(t => t.stop()); _scanCamStream = null; }

  if (!navigator.mediaDevices?.getUserMedia) {
    if (errMsg) errMsg.textContent = t('cam_unsupported');
    if (errEl)  errEl.style.display = 'flex';
    return;
  }

  const strategies = [
    { video: { facingMode: { ideal: _scanCamFacing }, width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: false },
    { video: { facingMode: { ideal: _scanCamFacing } }, audio: false },
    { video: true, audio: false },
  ];

  let stream = null, lastErr = null;
  for (const c of strategies) {
    try { stream = await navigator.mediaDevices.getUserMedia(c); if (stream) break; }
    catch(e) { lastErr = e; }
  }

  if (!stream) {
    let msg = t('cam_unavailable');
    if (lastErr?.name === 'NotAllowedError' || lastErr?.name === 'PermissionDeniedError')
      msg = t('cam_permission');
    else if (lastErr?.name === 'NotFoundError')
      msg = t('cam_notfound');
    if (errMsg) errMsg.textContent = msg;
    if (errEl)  errEl.style.display = 'flex';
    return;
  }

  _scanCamStream = stream;
  video.srcObject = stream;
  await video.play().catch(() => {});
  if (video.readyState >= 1) {
    video.style.transition = 'opacity .3s ease';
    video.style.opacity = '1';
  }
}

function closeScanCam() {
  if (_scanCamStream) { _scanCamStream.getTracks().forEach(t => t.stop()); _scanCamStream = null; }
  const overlay = document.getElementById('scan-cam-overlay');
  if (overlay) overlay.style.display = 'none';
  const video = document.getElementById('scan-cam-video');
  if (video) { video.srcObject = null; video.style.opacity = '0'; }
}

function flipScanCam() {
  _scanCamFacing = _scanCamFacing === 'environment' ? 'user' : 'environment';
  const btn = document.getElementById('scan-cam-flip-btn');
  if (btn) { btn.style.transform = 'scale(0.82)'; setTimeout(() => btn.style.transform = '', 160); }
  _startScanCamStream();
}

function captureScanPhoto() {
  const video   = document.getElementById('scan-cam-video');
  const flashEl = document.getElementById('scan-cam-flash-overlay');
  const btn     = document.getElementById('scan-capture-btn');

  // Feedback visuel
  if (flashEl) { flashEl.style.transition = 'none'; flashEl.style.opacity = '0.9'; setTimeout(() => { flashEl.style.transition = 'opacity .15s'; flashEl.style.opacity = '0'; }, 60); }
  if (btn)     { btn.style.transform = 'scale(0.88)'; setTimeout(() => btn.style.transform = 'scale(1)', 150); }

  if (!_scanCamStream || !video || video.readyState < 2) {
    closeScanCam();
    scanFromGallery();
    return;
  }

  _toPortraitBlob(video, _scanCamFacing === 'user', false, (blob, url) => {
    if (!blob) { closeScanCam(); scanFromGallery(); return; }
    closeScanCam();
    _processScan(url);
  });
}

function scanFromGallery() {
  const input = document.getElementById('scan-file-input');
  input.removeAttribute('capture');
  input.click();
}

async function handleScanFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = '';
  const reader = new FileReader();
  reader.onload = async ev => {
    const resized = await _scanResize(ev.target.result, 1024);
    await _processScan(resized);
  };
  reader.readAsDataURL(file);
}

async function _scanResize(dataUrl, maxPx) {
  const img = new Image();
  img.src = dataUrl;
  // img.decode() garantit un décodage COMPLET avant de dessiner. Sans ça, Safari iOS peut
  // dessiner une image partiellement décodée (sombre/floue) au 1er passage après ouverture
  // de l'app → Pixtral reçoit une image dégradée → détection pauvre. Le 2e essai manuel
  // marchait car l'image était alors dans le cache de décodage.
  try { await img.decode(); }
  catch(e) { await new Promise(r => { img.onload = r; img.onerror = r; }); }

  let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('image non décodée');
  if (w > maxPx || h > maxPx) {
    if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
    else       { w = Math.round(w * maxPx / h); h = maxPx; }
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.88);
}

// ── HISTORIQUE LOCAL (localStorage — fonctionne sans Supabase) ──
const _SCAN_HIST_KEY = 'wa_scan_local_hist';
const _SCAN_HIST_MAX = 30;

function _saveLocalScan(dataUrl, pieces) {
  // Génère une miniature 240px pour économiser la place dans localStorage
  const img = new Image();
  img.onload = () => {
    const W = 240;
    const H = img.width > 0 ? Math.round(W * img.height / img.width) : W;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    c.getContext('2d').drawImage(img, 0, 0, W, H);
    const thumb = c.toDataURL('image/jpeg', 0.65);
    try {
      const hist = _getLocalScans();
      hist.unshift({
        id:               Date.now().toString(),
        image_url:        thumb,
        detected_pieces:  pieces,
        created_at:       new Date().toISOString()
      });
      localStorage.setItem(_SCAN_HIST_KEY, JSON.stringify(hist.slice(0, _SCAN_HIST_MAX)));
    } catch(e) { _DBG.err('saveLocalScan', e); }
  };
  img.src = dataUrl;
}

function _getLocalScans() {
  try { return JSON.parse(localStorage.getItem(_SCAN_HIST_KEY) || '[]'); }
  catch(e) { return []; }
}

// ── TRAITEMENT ────────────────────────────
async function _processScan(dataUrl) {
  _scan.image = dataUrl;
  track('scan_used');

  document.getElementById('scan-empty').style.display        = 'none';
  document.getElementById('scan-result-wrap').style.display  = 'flex';
  document.getElementById('scan-loading').style.display      = 'flex';
  document.getElementById('scan-no-result').style.display    = 'none';
  document.getElementById('scan-photo').src                  = dataUrl;
  document.getElementById('scan-dots').innerHTML             = '';
  document.getElementById('scan-pieces-bar').innerHTML       = '';

  // Deux tentatives : cold start Edge Function ou réponse instable de Mistral
  let pieces = null;
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt === 1) {
        const loadTxt = document.querySelector('#scan-loading span, #scan-loading p');
        if (loadTxt) loadTxt.textContent = t('scan_retrying');
        await new Promise(r => setTimeout(r, 1800));
      }
      pieces = await _callPixtral(dataUrl);
      lastErr = null;
      break;
    } catch(e) {
      lastErr = e;
    }
  }

  document.getElementById('scan-loading').style.display = 'none';

  if (lastErr || !pieces) {
    document.getElementById('scan-no-result').style.display = 'flex';
    return;
  }

  _scan.pieces = pieces;
  _renderScanResult(pieces);
  _saveLocalScan(dataUrl, pieces);           // ← toujours sauvegarder localement
  if (me) _saveScanHistory(dataUrl, pieces); // ← Supabase si connecté + configuré
}

// ── MISTRAL PIXTRAL — via Edge Function Supabase (clé jamais exposée) ──
async function _callPixtral(dataUrl, timeoutMs = null) {
  // Prompt dans la langue de l'app → l'IA génère les noms/couleurs/matières dans cette langue.
  // Les clés JSON restent identiques (le code lit p.piece/couleur/matiere/style) ; seules
  // les VALEURS changent de langue. detectTypeFromKeywords + _matKey sont déjà bilingues.
  const _en = (typeof currentLang !== 'undefined' && currentLang === 'en');
  const prompt = _en
    ? `You are a fashion expert. Identify ALL visible clothing items in this photo. There is always at least one garment. For each item:
- "piece": precise name in English (e.g. "checked flannel jacket")
- "couleur": main color, in English
- "matiere": apparent material in English (cotton, denim, leather, wool…)
- "style": cut (slim, oversized, regular, cropped…)
- "x" / "y": position of the CENTER of the item on the body in % (x=left→right, y=top→bottom)

Maximum 5 items. Each item MUST be a complete object with its 6 fields. Always give your best concrete estimate: NEVER use "unidentifiable", "unclear" or "blurry". If unsure, pick the most likely garment type (e.g. "t-shirt", "sweater", "jacket"). Reply ONLY with the raw JSON array, no markdown, no surrounding text.
Example: [{"piece":"blue slim jeans","couleur":"indigo blue","matiere":"denim","style":"slim","x":50,"y":72}]`
    : `Tu es un expert mode. Identifie TOUTES les pièces vestimentaires visibles sur cette photo. Il y a forcément au moins un vêtement. Pour chaque pièce :
- "piece" : nom précis en français (ex: "veste en flanelle à carreaux")
- "couleur" : couleur principale
- "matiere" : matière apparente (coton, denim, cuir, laine…)
- "style" : coupe (slim, oversized, regular, cropped…)
- "x" / "y" : position du CENTRE de la pièce sur le corps en % (x=gauche→droite, y=haut→bas)

Maximum 5 pièces. Chaque pièce DOIT être un objet complet avec ses 6 champs. Donne toujours ton meilleur estimé concret : n'utilise JAMAIS "non identifiable", "indéterminé", "inconnu" ou "flou". Si tu hésites, choisis le type de vêtement le plus probable (ex: "t-shirt", "pull", "veste"). Réponds UNIQUEMENT avec le tableau JSON brut, sans markdown, sans texte autour.
Exemple : [{"piece":"jean slim bleu","couleur":"bleu indigo","matiere":"denim","style":"slim","x":50,"y":72}]`;

  // Appel via Edge Function — la clé Mistral reste côté serveur
  // Timeout 12s : évite d'attendre indéfiniment sur mobile si réseau ou Mistral accroche
  const invokePromise = sb.functions.invoke('smooth-responder', { body: { dataUrl, prompt } });
  // Pas de timeout sur le 1er appel (cold start peut prendre 20-30s) — on attend autant que nécessaire
  const { data, error } = timeoutMs
    ? await Promise.race([invokePromise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))])
    : await invokePromise;

  if (error) throw new Error(error.message || 'Erreur Edge Function');

  const raw = (data?.choices?.[0]?.message?.content || '').trim();
  if (!raw) throw new Error('Réponse vide');

  // Extraction robuste : cherche le premier tableau JSON dans la réponse,
  // même si Pixtral ajoute du texte autour ou utilise des blocs markdown
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Pas de JSON dans la réponse');
  const parsed = JSON.parse(match[0]);

  // Filtre les réponses "molles" de Pixtral (cold start / image sombre) : il renvoie parfois
  // des pièces nommées "non identifiable", "indéterminé"… On les rejette pour forcer un retry
  // qui obtiendra des noms concrets, plutôt que d'afficher un hotspot inutile à l'utilisateur.
  const _JUNK = /non identifiable|indétermin|inconnu|non précis|impossible|flou|n\/?a\b/i;
  const cleaned = (Array.isArray(parsed) ? parsed : []).filter(
    p => p && p.piece && !_JUNK.test(p.piece)
  );
  return cleaned;
}

// ── ZONES CORPORELLES — placement fiable par type de vêtement ──
const _BODY_ZONES = [
  // Tête
  { keys:['chapeau','casquette','bonnet','bob','béret'],        x:50, y:7  },
  { keys:['lunettes','loupe'],                                   x:50, y:14 },
  { keys:['écharpe','foulard','collier','chaîne'],              x:50, y:22 },
  // Haut du corps
  { keys:['manteau','pardessus','trench'],                       x:45, y:42 },
  { keys:['veste','blazer','blouson','parka','doudoune','gilet','bomber','flanelle','carreaux'],
                                                                  x:45, y:38 },
  { keys:['chemise','chemisette'],                               x:50, y:40 },
  { keys:['sweat','hoodie','pull','pullover','maille'],          x:50, y:40 },
  { keys:['t-shirt','tshirt','débardeur','top','brassière','body','tunique'],
                                                                  x:50, y:40 },
  { keys:['costume','smoking'],                                   x:45, y:38 },
  // Accessoires portés sur le corps
  { keys:['ceinture'],                                           x:50, y:55 },
  { keys:['sac','sacoche','pochette','banane'],                  x:28, y:55 },
  // Bas du corps
  { keys:['jean','pantalon','jogging','legging','cargo'],        x:50, y:67 },
  { keys:['short','bermuda'],                                    x:50, y:60 },
  { keys:['jupe','robe'],                                        x:50, y:62 },
  // Chaussures
  { keys:['sneaker','basket','chaussure','tennis','running','adidas','nike'],
                                                                  x:48, y:90 },
  { keys:['botte','bottine','chelsea'],                          x:48, y:87 },
  { keys:['sandale','tong','mocassin','derby'],                  x:48, y:90 },
];

function _bodyZoneCoords(pieceName) {
  const n = (pieceName || '').toLowerCase();
  for (const zone of _BODY_ZONES) {
    if (zone.keys.some(k => n.includes(k))) return { x: zone.x, y: zone.y };
  }
  return { x: 50, y: 45 }; // fallback : centre du corps
}

// ── RENDER RÉSULTAT ───────────────────────
function _renderScanResult(pieces) {
  if (!pieces || pieces.length === 0) {
    document.getElementById('scan-no-result').style.display = 'flex';
    return;
  }

  // Pas de dots sur la photo WearScan — navigation via les chips uniquement
  document.getElementById('scan-dots').innerHTML = '';

  const bar = document.getElementById('scan-pieces-bar');
  bar.innerHTML = '';
  pieces.forEach((p, i) => {
    const chip = document.createElement('div');
    chip.className = 'scan-piece-chip';
    chip.setAttribute('data-index', i);
    _renderChip(chip, p, i);
    bar.appendChild(chip);
  });

  document.getElementById('scan-pieces-label').style.display = 'block';
}

function _renderChip(chip, p, i) {
  chip.innerHTML = `
    <span class="scan-chip-color" style="background:${_scanColorToCss(p.couleur)}"></span>
    <span class="scan-chip-label">${p.piece}</span>`;
  chip.onclick = () => selectScanPiece(p, i);
}

// ── DOTS SUR LA PHOTO ─────────────────────
function _renderDots(pieces) {
  const dotsEl = document.getElementById('scan-dots');
  if (!dotsEl) return;
  dotsEl.innerHTML = '';
  pieces.forEach((p, i) => {
    // Utilise les coords Pixtral, ou fallback _bodyZoneCoords
    const coords = _bodyZoneCoords(p.piece);
    p.x = (p.x != null) ? p.x : coords.x;
    p.y = (p.y != null) ? p.y : coords.y;

    const dot = document.createElement('div');
    dot.className = 'scan-dot';
    dot.setAttribute('data-index', i);
    dot.setAttribute('role', 'button');
    dot.setAttribute('aria-label', p.piece || 'Pièce ' + (i + 1));
    dot.style.left = p.x + '%';
    dot.style.top  = p.y + '%';
    _makeDotDraggable(dot, i);
    dotsEl.appendChild(dot);
  });
}

function _makeDotDraggable(dot, index) {
  var startX, startY, startL, startT, moved = false, active = false;

  dot.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) return;
    e.stopPropagation();
    var t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
    startL = parseFloat(dot.style.left);
    startT = parseFloat(dot.style.top);
    moved = false; active = true;
    dot.classList.add('dragging');
  }, { passive: true });

  dot.addEventListener('touchmove', function(e) {
    if (!active) return;
    e.stopPropagation();
    e.preventDefault();
    var t = e.touches[0];
    var wrap = document.getElementById('scan-photo-wrap');
    var rect = wrap.getBoundingClientRect();
    var dx = ((t.clientX - startX) / rect.width)  * 100;
    var dy = ((t.clientY - startY) / rect.height) * 100;
    if (Math.abs(dx) > 1.5 || Math.abs(dy) > 1.5) moved = true;
    var newL = Math.max(3, Math.min(97, startL + dx));
    var newT = Math.max(3, Math.min(97, startT + dy));
    dot.style.left = newL + '%';
    dot.style.top  = newT + '%';
    _scan.pieces[index].x = newL;
    _scan.pieces[index].y = newT;
  }, { passive: false });

  dot.addEventListener('touchend', function(e) {
    if (!active) return;
    e.stopPropagation();
    active = false;
    dot.classList.remove('dragging');
    if (!moved) openScanEditPanel(index);
  }, { passive: true });

  // Souris (desktop)
  dot.addEventListener('mousedown', function(e) {
    e.stopPropagation();
    startX = e.clientX; startY = e.clientY;
    startL = parseFloat(dot.style.left);
    startT = parseFloat(dot.style.top);
    moved = false; active = true;
    dot.classList.add('dragging');
    var onMove = function(ev) {
      var wrap = document.getElementById('scan-photo-wrap');
      var rect = wrap.getBoundingClientRect();
      var dx = ((ev.clientX - startX) / rect.width)  * 100;
      var dy = ((ev.clientY - startY) / rect.height) * 100;
      if (Math.abs(dx) > 1.5 || Math.abs(dy) > 1.5) moved = true;
      dot.style.left = Math.max(3, Math.min(97, startL + dx)) + '%';
      dot.style.top  = Math.max(3, Math.min(97, startT + dy)) + '%';
      _scan.pieces[index].x = parseFloat(dot.style.left);
      _scan.pieces[index].y = parseFloat(dot.style.top);
    };
    var onUp = function() {
      active = false;
      dot.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!moved) openScanEditPanel(index);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ── PANEL ÉDITION ─────────────────────────
var _editingIndex = -1;

function openScanEditPanel(index) {
  var p = _scan.pieces[index];
  if (!p) return;
  _editingIndex = index;

  // Activer dot + chip correspondants
  document.querySelectorAll('.scan-dot').forEach(function(d, i) { d.classList.toggle('active', i === index); });
  document.querySelectorAll('.scan-piece-chip').forEach(function(c, i) { c.classList.toggle('active', i === index); });

  // Scroller le chip dans la vue
  var chip = document.querySelector('.scan-piece-chip[data-index="' + index + '"]');
  if (chip) chip.scrollIntoView({ behavior: prefersReducedMotion()?'auto':'smooth', inline: 'center', block: 'nearest' });

  // Remplir les champs
  document.getElementById('sep-piece').value   = p.piece   || '';
  document.getElementById('sep-couleur').value = p.couleur || '';
  document.getElementById('sep-matiere').value = p.matiere || '';
  document.getElementById('sep-style').value   = p.style   || '';

  // Pastille couleur + titre
  var colorDot = document.getElementById('sep-color-dot');
  if (colorDot) colorDot.style.background = _scanColorToCss(p.couleur);
  var titleEl = document.getElementById('sep-hdr-title');
  if (titleEl) titleEl.textContent = p.piece || 'Corriger la pièce';

  document.getElementById('scan-edit-panel').classList.add('open');
}

function closeScanEditPanel() {
  document.getElementById('scan-edit-panel').classList.remove('open');
  _editingIndex = -1;
  document.querySelectorAll('.scan-dot').forEach(function(d) { d.classList.remove('active'); });
  document.querySelectorAll('.scan-piece-chip').forEach(function(c) { c.classList.remove('active'); });
}

function confirmScanEdit() {
  if (_editingIndex < 0) return;
  var p = _scan.pieces[_editingIndex];
  if (!p) return;
  var newPiece   = document.getElementById('sep-piece').value.trim();
  var newCouleur = document.getElementById('sep-couleur').value.trim();
  var newMatiere = document.getElementById('sep-matiere').value.trim();
  var newStyle   = document.getElementById('sep-style').value.trim();
  if (newPiece)   p.piece   = newPiece;
  if (newCouleur) p.couleur = newCouleur;
  if (newMatiere) p.matiere = newMatiere;
  if (newStyle)   p.style   = newStyle;
  // Mettre à jour chip + couleur dot
  var chip = document.querySelector('.scan-piece-chip[data-index="' + _editingIndex + '"]');
  if (chip) _renderChip(chip, p, _editingIndex);
  var dot = document.querySelector('.scan-dot[data-index="' + _editingIndex + '"]');
  if (dot) dot.setAttribute('aria-label', p.piece);
  closeScanEditPanel();
}

function openAltFromEdit() {
  if (_editingIndex < 0) return;
  var idx = _editingIndex;
  confirmScanEdit(); // sauvegarde d'abord
  var p = _scan.pieces[idx];
  if (p) selectScanPiece(p, idx);
}

function _scanColorToCss(couleur) {
  const map = {
    'noir':'#1a1a1a', 'blanc':'#f5f0e8', 'beige':'#d4c5a9', 'camel':'#c19a6b',
    'crème':'#f0ead8', 'marron':'#8b5e3c', 'rouge':'#c0392b', 'bleu':'#2980b9',
    'vert':'#27ae60', 'kaki':'#78866b', 'jaune':'#f39c12', 'orange':'#e67e22',
    'rose':'#e91e8c', 'violet':'#8e44ad', 'gris':'#7f8c8d', 'denim':'#5b7fa6',
    'cognac':'#a0522d', 'taupe':'#8b7d6b', 'écru':'#f0ead8'
  };
  const c = (couleur || '').toLowerCase();
  for (const [k, v] of Object.entries(map)) { if (c.includes(k)) return v; }
  return 'var(--gold-muted)';
}

// ── SELECT PIÈCE → ALT SHEET ──────────────
function selectScanPiece(piece, index) {
  closeScanEditPanel();
  document.querySelectorAll('.scan-piece-chip, .scan-dot').forEach(function(el) {
    el.classList.toggle('active', Number(el.dataset.index) === index);
  });
  if (typeof openAlt === 'function') {
    openAlt({
      name:    [piece.piece, piece.couleur, piece.style].filter(Boolean).join(' '),
      matiere: piece.matiere,
      type:    piece.piece,
      emoji:   '👗',
      brand:   '—',
      price:   '—',
      eco:     3
    });
  }
}

// ── HISTORIQUE ────────────────────────────
async function _saveScanHistory(dataUrl, pieces) {
  try {
    const filename = `${me.id}/${Date.now()}.jpg`;
    const blob = await (await fetch(dataUrl)).blob();
    const { error: upErr } = await sb.storage
      .from('scan-images')
      .upload(filename, blob, { contentType: 'image/jpeg' });
    if (upErr) throw upErr;
    const { data: urlData } = sb.storage.from('scan-images').getPublicUrl(filename);
    await sb.from('scan_history').insert({
      user_id: me.id,
      image_url: urlData.publicUrl,
      detected_pieces: pieces
    });
  } catch (e) {
    _DBG.err('saveScanHistory', e); // Non-bloquant
  }
}

async function loadScanHistory() {
  const grid = document.getElementById('scan-hist-grid');

  // ── 1. Historique local — toujours disponible immédiatement ──────────
  const localItems = _getLocalScans();

  // Affichage rapide des scans locaux (pas d'attente réseau)
  if (localItems.length > 0) {
    _scan.history = localItems;
    _renderScanHistory(localItems);
  }

  // ── 2. Si connecté, essayer Supabase en arrière-plan ────────────────
  if (!me) {
    if (localItems.length === 0) {
      grid.innerHTML = `<div class="scan-hist-empty">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--wd)" stroke-width="1.5" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
        <p>${t('scan_hist_empty_title')}</p>
        <span>${t('scan_empty_cta')}</span>
      </div>`;
    }
    return;
  }

  // Si Supabase renvoie des données, on les préfère (synchronisées entre appareils)
  const { data } = await safeRun(
    sb.from('scan_history').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(24),
    { silent: true, fallback: null }
  );

  if (data && data.length > 0) {
    _scan.history = data;
    _renderScanHistory(data);
  } else if (localItems.length === 0) {
    // Rien nulle part
    _renderScanHistory([]);
  }
  // Sinon on garde l'affichage local déjà rendu
}

function _renderScanHistory(items) {
  const grid = document.getElementById('scan-hist-grid');
  if (!items.length) {
    _scan.editMode = false;
    _syncHistEditBtn();
    grid.innerHTML = `<div class="scan-hist-empty">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--wd)" stroke-width="1.5" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
      <p>${t('scan_hist_empty_title')}</p>
      <span>${t('scan_empty_cta')}</span>
    </div>`;
    return;
  }
  const em = _scan.editMode;
  grid.innerHTML = items.map((item, i) => {
    const date  = new Date(item.created_at).toLocaleDateString('fr', { day: 'numeric', month: 'short' });
    const count = (item.detected_pieces || []).length;
    const delBtn = em
      ? `<button class="scan-hist-del-btn" onclick="deleteScanItem('${item.id}',event)" aria-label="${t('aria_delete')}">
           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
         </button>`
      : '';
    return `<div class="scan-hist-item${em ? ' edit-mode' : ''}" ${em ? '' : `onclick="openHistoryScan(${i})"`}>
      <div class="scan-hist-thumb">
        <img src="${escapeHtml(item.image_url)}" alt="Scan du ${date}" loading="lazy" onerror="this.style.display='none'">
        <div class="scan-hist-badge">${count} pièce${count > 1 ? 's' : ''}</div>
        ${delBtn}
      </div>
      <div class="scan-hist-date">${date}</div>
    </div>`;
  }).join('');
}

function _syncHistEditBtn() {
  const btn = document.getElementById('scan-hist-edit-btn');
  if (!btn) return;
  const key = _scan.editMode ? 'hist_done' : 'hist_edit';
  btn.setAttribute('data-i18n', key);
  btn.textContent = t(key);
  btn.style.borderColor = _scan.editMode ? 'var(--gold-b)' : 'rgba(240,234,216,0.2)';
  btn.style.color       = _scan.editMode ? 'var(--gold)'   : 'var(--wd)';
}

function toggleHistoryEdit() {
  _scan.editMode = !_scan.editMode;
  _syncHistEditBtn();
  _renderScanHistory(_scan.history);
}

function deleteScanItem(itemId, event) {
  event.stopPropagation();
  _scan.history = _scan.history.filter(item => String(item.id) !== String(itemId));
  // Supprimer du localStorage
  try {
    const local = _getLocalScans().filter(item => String(item.id) !== String(itemId));
    localStorage.setItem(_SCAN_HIST_KEY, JSON.stringify(local));
  } catch(e) {}
  // Supprimer de Supabase (non-bloquant)
  // Le query builder Supabase est un « thenable », pas une vraie Promise → pas de .catch().
  // On utilise .then(ok, err) comme partout ailleurs (le 2e arg ignore l'erreur, non-bloquant).
  if (me) sb.from('scan_history').delete().eq('id', itemId).eq('user_id', me.id).then(() => {}, () => {});
  _renderScanHistory(_scan.history);
}

function openHistoryScan(index) {
  const item = _scan.history[index];
  if (!item) return;
  switchScanTab('scan');
  _scan.image  = item.image_url;
  _scan.pieces = item.detected_pieces || [];
  document.getElementById('scan-empty').style.display       = 'none';
  document.getElementById('scan-result-wrap').style.display = 'flex';
  document.getElementById('scan-loading').style.display     = 'none';
  document.getElementById('scan-no-result').style.display   = 'none';
  document.getElementById('scan-dots').innerHTML            = '';
  document.getElementById('scan-pieces-bar').innerHTML      = '';
  const photoEl = document.getElementById('scan-photo');
  photoEl.src = item.image_url;
  const _render = () => { _renderScanResult(_scan.pieces); photoEl.removeEventListener('load', _render); };
  if (photoEl.complete && photoEl.naturalWidth) _renderScanResult(_scan.pieces);
  else photoEl.addEventListener('load', _render);
}

// ═══════════════════════════════════════════
// AUTO-HOTSPOTS — Intégration dans le flow Create
// ═══════════════════════════════════════════

// ── Pre-warm Edge Function (cold start Supabase) ──────────────
// Envoyer un ping dès que l'utilisateur ouvre la caméra ou la galerie,
// avant qu'il prenne/choisisse sa photo. Réduit le délai du 1er appel Pixtral.
let _edgeFunctionLastWarm = 0;
function _warmupEdgeFunction(force = false) {
  if (!sb?.functions) return;
  const now = Date.now();
  if (!force && now - _edgeFunctionLastWarm < 5 * 60 * 1000) return; // déjà chaud (<5 min)
  _edgeFunctionLastWarm = now;
  // Envoyer une vraie requête valide (1×1px) plutôt que {warmup:true} qui crashe smooth-responder
  // sans dataUrl. Coût Mistral : ~10 tokens (négligeable). Garantit que le container reste chaud.
  const c = document.createElement('canvas');
  c.width = 1; c.height = 1;
  const tinyImg = c.toDataURL('image/jpeg', 0.5);
  sb.functions.invoke('smooth-responder', {
    body: { dataUrl: tinyImg, prompt: 'Décris cette image en un mot.' }
  }).catch(() => {});
}

// Warmup dès que l'app revient au premier plan — avant même que l'utilisateur navigue vers Créer
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') _warmupEdgeFunction();
});

// Maintenir la fonction chaude tant que l'app est ouverte (ping toutes les 4 min)
// Coût : ~10 800 invocations/mois → gratuit sur Supabase Free (quota 500K)
// Mistral : warmup sans dataUrl = erreur avant inference → 0 token consommé
setInterval(() => {
  _edgeFunctionLastWarm = 0; // bypass TTL pour forcer le ping périodique
  _warmupEdgeFunction();
}, 4 * 60 * 1000);

// Source de la dernière détection — permet au bouton "Relancer" de re-détecter
// sans que l'utilisateur ait à sortir et re-choisir sa photo
let _lastDetectSrc = null;

// ═══════════════════════════════════════════
// CONSENTEMENT IA — analyse opt-in (sobriété + RGPD)
// La photo ne part chez Mistral que si l'utilisateur a explicitement accepté.
// localStorage wa_ai_auto : '1' = analyse auto ON · '0' = IA coupée · absent = pas encore choisi
// ═══════════════════════════════════════════
let _aiPendingUrl = null;

// Affiche/masque les boutons IA de l'étape 2 selon la préférence
function _applyAiUiState() {
  const off = localStorage.getItem('wa_ai_auto') === '0';
  const pill = document.getElementById('redetect-btn');
  const icon = document.getElementById('redetect-btn-2');
  if (pill) pill.style.display = off ? 'none' : 'flex';
  if (icon) icon.style.display = off ? 'none' : 'flex';
}

// Point d'entrée appelé à la place de autoDetectHspots() après une photo
function _maybeAutoDetect(url) {
  const pref = localStorage.getItem('wa_ai_auto');
  _lastDetectSrc = url;             // mémorise la photo pour une analyse ultérieure
  _applyAiUiState();
  if (pref === '1') { autoDetectHspots(url); return; }   // auto accepté
  if (pref === '0') { return; }                           // IA coupée → placement manuel
  _aiPendingUrl = url;              // pas encore choisi → demande le consentement
  _showAiConsent();
}

function _showAiConsent() {
  const el = document.getElementById('ai-consent');
  if (el) el.style.display = 'flex';
}
function _hideAiConsent() {
  const el = document.getElementById('ai-consent');
  if (el) el.style.display = 'none';
}

// Choix dans l'écran de consentement (true = activer l'analyse auto)
function aiConsentChoose(enable) {
  localStorage.setItem('wa_ai_auto', enable ? '1' : '0');
  if (typeof applyToggleUI === 'function') applyToggleUI('toggle-ai-auto', enable);
  _hideAiConsent();
  _applyAiUiState();
  if (enable && _aiPendingUrl) autoDetectHspots(_aiPendingUrl);
  _aiPendingUrl = null;
}

// Interrupteur dans les réglages
function toggleAiAuto() {
  const enable = localStorage.getItem('wa_ai_auto') !== '1';
  localStorage.setItem('wa_ai_auto', enable ? '1' : '0');
  if (typeof applyToggleUI === 'function') applyToggleUI('toggle-ai-auto', enable);
  if (typeof toast === 'function') toast(enable ? t('ai_toast_on') : t('ai_toast_off'));
  _applyAiUiState();
  // Active alors qu'une photo est déjà à l'écran sans hotspots → lance l'analyse
  if (enable && typeof currentStep !== 'undefined' && currentStep === 2 && (!hspots || hspots.length === 0)) {
    const src = _lastDetectSrc || (document.getElementById('prev-img') || {}).src;
    if (src) autoDetectHspots(src);
  }
}

// Init de l'UI du toggle (à l'ouverture des réglages)
function initAiAutoToggleUI() {
  if (typeof applyToggleUI === 'function') applyToggleUI('toggle-ai-auto', localStorage.getItem('wa_ai_auto') === '1');
}

// Masque les boutons "Relancer" pendant une détection active — un double
// lancement ferait deux appels Pixtral concurrents sur la même photo
let _detectInProgress = false;
function _setDetectRunning(running) {
  _detectInProgress = running;
  const pill = document.getElementById('redetect-btn');
  const icon = document.getElementById('redetect-btn-2');
  if (pill) pill.style.display = running ? 'none' : 'flex';
  if (icon) icon.style.display = running ? 'none' : 'flex';
}

// Relance complète : efface les hotspots auto et re-détecte depuis la photo d'origine.
// Le resize est refait de zéro (image désormais bien décodée) → qualité du "2e essai manuel".
function redetectHspots() {
  if (_detectInProgress) return;
  if (!_lastDetectSrc) { toast(t('toast_no_photo'), 2500); return; }
  if (typeof clearHspots === 'function') clearHspots();
  else if (hspots) hspots.length = 0;
  if (typeof renderHspotsEditor === 'function') renderHspotsEditor();
  autoDetectHspots(_lastDetectSrc);
}

async function autoDetectHspots(dataUrl) {
  if (!sb?.functions) return;
  if (hspots && hspots.length > 0) return;

  // Réveille la fonction Edge IMMÉDIATEMENT (sans attendre le throttle) : le 1er appel
  // après ouverture de l'app tombe souvent sur un container froid. Ce ping lance le boot
  // en parallèle pendant qu'on resize l'image, pour que le 1er vrai appel arrive sur du chaud.
  _warmupEdgeFunction(true);

  const indicator = document.getElementById('auto-hspot-hint');
  const indicatorText = indicator?.querySelector('span, .scan-hint-text') || indicator;
  if (indicatorText) indicatorText.textContent = t('scan_detecting');
  if (indicator) indicator.style.display = 'flex';
  _setDetectRunning(true);

  // Mémorise la source pour le bouton "Relancer la détection"
  _lastDetectSrc = dataUrl;

  // Snapshot du step au moment du lancement — guard contre la race condition :
  // si l'utilisateur avance à step 3 pendant la détection, on abandonne sans écraser ses hotspots
  const stepAtLaunch = typeof currentStep !== 'undefined' ? currentStep : 2;

  // Stratégie "best-of" : le 1er appel après ouverture tombe sur un container qui vient
  // de chauffer → Pixtral renvoie souvent un résultat pauvre (1-2 pièces, parfois fausses).
  // Le 2e appel, fonction pleinement chaude, est nettement plus riche. On exploite ça :
  //   - résultat riche (≥3 pièces) → on s'arrête tout de suite (rapide, cas fonction déjà chaude)
  //   - résultat pauvre (1-2 pièces) → on relance pour obtenir mieux, et on garde le plus riche
  //   - réponse vide / erreur HTML (cold start) → on réessaie après une pause
  let pieces = null;
  let best = null;
  let weakTries = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      if (attempt >= 1) {
        if (indicatorText) indicatorText.textContent = t('scan_retrying');
        // Pause longue seulement si on attend le cold start (pas encore de résultat).
        // Si on a déjà un résultat et qu'on cherche mieux, la fonction est chaude → pause courte.
        await new Promise(r => setTimeout(r, best ? 800 : (attempt === 1 ? 6000 : 4000)));
      }
      // Resize refait à CHAQUE tentative : si le 1er passage a capturé une image partiellement
      // décodée (Safari iOS), les suivants partent d'une image propre — c'est ce qui rendait
      // le "2e essai manuel" supérieur, on le reproduit ici automatiquement.
      const resized = await _scanResize(dataUrl, 800);
      // Pas de timeout — Pixtral peut prendre 15-25s, un timeout couperait trop tôt.
      const got = await _callPixtral(resized, null);
      if (!got || got.length === 0) throw new Error('empty_response'); // cold start → retry

      // On garde le résultat le plus riche rencontré
      if (!best || got.length > best.length) best = got;

      if (best.length >= 3) break;        // assez riche → on s'arrête
      weakTries++;
      if (weakTries >= 2) break;          // déjà tenté d'améliorer une fois → on garde le meilleur
      // sinon : on reboucle pour tenter un résultat plus complet
    } catch(e) {
      _DBG.err(`autoDetectHspots attempt ${attempt + 1}`, e);
      if (attempt === 4 && !best) {
        if (indicator) indicator.style.display = 'none';
        _setDetectRunning(false);
        toast(t('toast_detection_failed'), 3500);
        return;
      }
    }
  }

  pieces = best;
  if (indicator) indicator.style.display = 'none';
  _setDetectRunning(false);
  if (!pieces || pieces.length === 0) return;

  // Guard race condition
  if (typeof currentStep !== 'undefined' && currentStep !== stepAtLaunch) return;
  // Guard hspots manuels
  if (hspots && hspots.length > 0) return;

  if (typeof clearHspots === 'function') clearHspots();

  pieces.forEach(p => {
    const id = 'ah_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    // Mapper le nom complet Pixtral ("jean slim bleu") vers le type chip ("jean")
    const mappedType = (typeof detectTypeFromKeywords === 'function')
      ? (detectTypeFromKeywords(p.piece) || null)
      : null;
    hspots.push({
      id,
      x:       Math.max(5, Math.min(95, p.x)),
      y:       Math.max(5, Math.min(95, p.y)),
      size:    30,
      name:    p.piece   || '',
      brand:   '',
      price:   '',
      type:    mappedType,
      colors:  p.couleur ? [{ hex: _scanColorToCss(p.couleur), name: p.couleur, confirmed: true }] : [],
      matiere: p.matiere || null
    });
  });

  if (typeof renderHspotsEditor === 'function') renderHspotsEditor();
  toast(t('scan_n_detected').replace('{n}', pieces.length).replace(/\{s\}/g, pieces.length > 1 ? 's' : ''), 3500, { type: 'success' });
}
