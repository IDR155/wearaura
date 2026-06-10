// ═══════════════════════════════════════════
// WearAura — Coach marks (visite guidée)
// Spotlight séquentiel sur les éléments clés au premier
// lancement. Remplace l'ancien pulse "+" et l'overlay
// hotspots, intégrés comme étapes du parcours.
// Flag : wa_coach_done (localStorage)
// ═══════════════════════════════════════════

const _COACH_STEPS = [
  { sel:'#feed-tabs-pill', title:'coach_t1', body:'coach_b1', pad:8 },
  { sel:'.ft-scan',        title:'coach_t2', body:'coach_b2', pad:8, round:true },
  { sel:'.ni-center',      title:'coach_t3', body:'coach_b3', pad:8, round:true },
  { sel:'#ni-shop',        title:'coach_t4', body:'coach_b4', pad:6 },
  // Révèle les points dorés du premier post visible et en encadre un ;
  // carte centrée en secours si aucun post avec hotspots n'est à l'écran
  { getTarget:'hotspots',  title:'hint_onboard_title', body:'hint_onboard_body', pad:14, round:true, centerFallback:true },
  // Pointe le « voir plus » du premier post visible ; carte centrée
  // en secours si aucun post avec look n'est à l'écran
  { sel:'.slide-voir-plus', title:'coach_t5', body:'coach_b5', pad:10, centerFallback:true },
];

// Premier élément correspondant ET entièrement visible à l'écran
function _coachFindTarget(sel){
  const vh = window.innerHeight, vw = window.innerWidth;
  for (const el of document.querySelectorAll(sel)){
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw) return el;
  }
  return null;
}

// Cible « hotspots » : affiche les points dorés du post au centre de
// l'écran (masqués par défaut dans le feed) et retourne le premier point
function _coachHotspotTarget(){
  const vh = window.innerHeight;
  for (const z of document.querySelectorAll('[id^="hzone-"]')){
    const r = z.getBoundingClientRect();
    if (r.height > 0 && r.top < vh/2 && r.bottom > vh/2){
      const dots = document.getElementById('hdots-' + z.id.slice(6));
      const dot = dots?.querySelector('.slide-hotspot');
      if (!dot) continue;
      dots.style.display = 'block';
      _coach.shownDots = dots;
      return dot;
    }
  }
  return null;
}

// Remasque les points révélés pour l'étape hotspots
function _coachHotspotRestore(){
  if (_coach.shownDots){ _coach.shownDots.style.display = 'none'; _coach.shownDots = null; }
}

const _coach = { idx:0, ov:null, spot:null, card:null, shownDots:null };

function startCoachMarks(){
  if (localStorage.getItem('wa_coach_done')) return;
  if (document.getElementById('wa-coach')) return;
  // Uniquement sur le feed — sinon les ancres n'existent pas à l'écran
  if (!document.getElementById('sc-feed')?.classList.contains('active')) return;

  const ov = document.createElement('div');
  ov.id = 'wa-coach';
  ov.setAttribute('role','dialog');
  ov.setAttribute('aria-modal','true');
  ov.setAttribute('aria-label','Visite guidée');
  ov.style.cssText = 'position:fixed;inset:0;z-index:400;opacity:0;transition:opacity .3s';
  ov.onclick = () => _coachNext();

  const spot = document.createElement('div');
  spot.style.cssText = 'position:absolute;box-shadow:0 0 0 9999px rgba(5,14,34,0.84);border:1.5px solid rgba(240,234,216,0.45);transition:top .35s cubic-bezier(.22,1,.36,1),left .35s cubic-bezier(.22,1,.36,1),width .35s cubic-bezier(.22,1,.36,1),height .35s cubic-bezier(.22,1,.36,1),border-radius .35s';

  const card = document.createElement('div');
  card.onclick = e => e.stopPropagation();
  card.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);width:min(320px,calc(100vw - 32px));background:rgba(7,16,30,0.97);border:1px solid var(--gold-b);border-radius:20px;padding:20px;transition:opacity .25s;opacity:0';

  ov.appendChild(spot); ov.appendChild(card);
  document.body.appendChild(ov);
  _coach.idx = 0; _coach.ov = ov; _coach.spot = spot; _coach.card = card;
  window.addEventListener('resize', _coachReposition);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ ov.style.opacity='1'; _coachStep(0); }));
}

function _coachStep(i){
  const steps = _COACH_STEPS;
  _coachHotspotRestore();
  // Saute les étapes dont la cible est absente (sauf si secours centré)
  while (i < steps.length && steps[i].sel && !steps[i].centerFallback && !_coachFindTarget(steps[i].sel)) i++;
  if (i >= steps.length) return _coachFinish();
  _coach.idx = i;
  const st = steps[i];
  const el = st.getTarget === 'hotspots' ? _coachHotspotTarget()
           : st.sel ? _coachFindTarget(st.sel) : null;
  const { spot, card } = _coach;
  const vh = window.innerHeight;

  card.style.opacity = '0';

  if (el) {
    const r = el.getBoundingClientRect();
    const pad = st.pad || 6;
    spot.style.top    = (r.top - pad) + 'px';
    spot.style.left   = (r.left - pad) + 'px';
    spot.style.width  = (r.width + pad*2) + 'px';
    spot.style.height = (r.height + pad*2) + 'px';
    spot.style.borderRadius = st.round ? '50%' : '16px';
    spot.style.borderWidth = '1.5px';
  } else {
    // Étape centrée (pas de cible ou cible hors écran) :
    // spotlight réduit à un point, l'ombre couvre tout
    spot.style.top = (vh/2) + 'px';
    spot.style.left = '50%';
    spot.style.width = '0px';
    spot.style.height = '0px';
    spot.style.borderWidth = '0';
  }

  const isLast = i === steps.length - 1;
  const dots = steps.map((_,k) =>
    `<span style="width:6px;height:6px;border-radius:50%;background:${k===i?'var(--gold)':'rgba(240,234,216,0.25)'};display:inline-block"></span>`
  ).join('');

  card.innerHTML =
    `<div style="display:flex;gap:5px;justify-content:center;margin-bottom:14px">${dots}</div>
     <div style="font:700 11px var(--fb);letter-spacing:2.5px;color:var(--gold);text-transform:uppercase;text-align:center;margin-bottom:10px">${t(_COACH_STEPS[i].title)}</div>
     <div style="font:15px/1.6 var(--fd);color:var(--wd);text-align:center;margin-bottom:18px">${t(_COACH_STEPS[i].body)}</div>
     <div style="display:flex;align-items:center;gap:12px">
       <button onclick="_coachFinish()" style="background:none;border:none;color:rgba(237,228,207,0.45);font:600 10px var(--fb);letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;padding:10px 4px">${t('coach_skip')}</button>
       <button onclick="_coachNext()" style="flex:1;background:var(--gold);color:var(--black);border:none;border-radius:50px;padding:11px 0;font:700 10px var(--fb);letter-spacing:2px;text-transform:uppercase;cursor:pointer">${isLast ? t('coach_finish') : t('coach_next')}</button>
     </div>`;

  // Position de la carte : sous la cible si elle est en haut, au-dessus sinon
  requestAnimationFrame(() => {
    const ch = card.offsetHeight;
    if (!el) {
      card.style.top = Math.max(16, (vh - ch) / 2) + 'px';
    } else {
      const r = el.getBoundingClientRect();
      const below = r.bottom + 16 + ch < vh - 16;
      card.style.top = below ? (r.bottom + 16) + 'px' : Math.max(16, r.top - ch - 16) + 'px';
    }
    card.style.opacity = '1';
  });
}

function _coachNext(){
  if (_coach.idx >= _COACH_STEPS.length - 1) return _coachFinish();
  _coachStep(_coach.idx + 1);
}

function _coachReposition(){
  if (_coach.ov) _coachStep(_coach.idx);
}

function _coachFinish(){
  // Pose aussi les anciens flags : le parcours couvre le pulse "+"
  // (étape 3) et l'overlay hotspots (étape 5)
  localStorage.setItem('wa_coach_done','1');
  localStorage.setItem('wa_plus_hinted','1');
  localStorage.setItem('wa_hotspots_hinted','1');
  _coachHotspotRestore();
  window.removeEventListener('resize', _coachReposition);
  const ov = _coach.ov;
  if (ov) { ov.style.opacity = '0'; setTimeout(() => ov.remove(), 320); }
  _coach.ov = _coach.spot = _coach.card = null;
}
