// STORIES
// ═══════════════════════════════════════════
let _storiesData   = {};
let _storyViewerUid = null;
let _storyViewerIdx = 0;
let _storyTimer     = null;
let _storyTouchStartY = 0;
const STORY_DURATION = 5000;

let _scVisibility = 'everyone';
let _scMusicUrl      = null;
let _scMusicTitle    = null;
let _scMusicStart    = 0;
let _postMusicUrl    = null;
let _postMusicTitle  = null;
let _postMusicStart  = 0;
let _postMusicEnd    = null;
let _musicPreview    = null;
let _svAudio         = null;
let _musicPickerTarget = 'story'; // 'story' | 'post'

// ── Jamendo API v3 ────────────────────────────────────────────────────
let _musicSearchTimer = null;
let _musicCurrentCat  = 'ambient';

const _jamendoCatTags = {
  ambient:    'ambient',
  electronic: 'electronic',
  acoustic:   'acoustic',
  jazz:       'jazz',
  pop:        'pop',
  lofi:       'chillout',
};

async function _fetchJamendoTracks(query = '', tag = 'ambient') {
  const list = document.getElementById('music-track-list');
  if (list) list.innerHTML = skRows(4);
  try {
    const params = new URLSearchParams({
      client_id:      'fd86bffe',
      format:         'json',
      limit:          '30',
      audioformat:    'mp31',
      audiodlformat:  'mp31',
      imagesize:      '100',
      boost:          'popularity_total',
    });
    if (query.trim()) {
      params.set('namesearch', query.trim());
    } else {
      params.set('tags', _jamendoCatTags[tag] || tag);
    }
    const res  = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params}`);
    const data = await res.json();
    _renderMusicList((data.results || []).filter(t => t.audio || t.audiodownload));
  } catch(e) {
    if (list) list.innerHTML = `<div style="padding:40px 20px;text-align:center;color:var(--wd);font-size:13px">Connexion impossible</div>`;
  }
}

// ── Range selector (début + fin) ─────────────
let _rafScrub  = null;
let _rangeDrag = null; // {which:'start'|'end', pointerId}
const _MUSIC_MAX_CLIP = 90;

function _startScrubLoop(){
  if(_rafScrub) return;
  (function loop(){
    if(!_musicPreview||_musicPreview.paused){_rafScrub=null;return;}
    if(_previewTrackData){
      const end=_previewTrackData.endTime??(_musicPreview.duration||99);
      if(_musicPreview.currentTime>=end){
        _musicPreview.currentTime=_previewTrackData.startTime||0;
      }
    }
    _rafScrub=requestAnimationFrame(loop);
  })();
}
function _stopScrubLoop(){if(_rafScrub){cancelAnimationFrame(_rafScrub);_rafScrub=null;}}

function _fmtTime(s){s=Math.round(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}

function _syncRangeUI(){
  if(!_previewTrackData||!_musicPreview) return;
  const dur=_musicPreview.duration||30;
  const s=_previewTrackData.startTime||0;
  const e=_previewTrackData.endTime??Math.min(dur,s+30);
  const sPct=(s/dur)*100, ePct=(e/dur)*100;
  const fill=document.getElementById('music-range-fill');
  const hs=document.getElementById('music-handle-start');
  const he=document.getElementById('music-handle-end');
  if(fill){fill.style.left=sPct+'%';fill.style.width=(ePct-sPct)+'%';}
  if(hs) hs.style.left=sPct+'%';
  if(he) he.style.left=ePct+'%';
  const ls=document.getElementById('music-lbl-start');
  const le=document.getElementById('music-lbl-end');
  const ld=document.getElementById('music-lbl-dur');
  if(ls) ls.textContent=_fmtTime(s);
  if(le) le.textContent=_fmtTime(e);
  if(ld) ld.textContent=Math.round(e-s)+'s';
}

function _getRangeTrackT(e){
  const track=document.getElementById('music-range-track');
  if(!track) return 0;
  const rect=track.getBoundingClientRect();
  const pad=8,usable=rect.width-pad*2;
  const x=Math.max(0,Math.min(usable,e.clientX-rect.left-pad));
  return(x/usable)*(_musicPreview?.duration||30);
}
function _startRangeDrag(e,drag){
  e.preventDefault();e.stopPropagation();
  _rangeDrag=drag;
  (e.currentTarget||document.getElementById('music-range-track')).setPointerCapture?.(e.pointerId);
  document.addEventListener('pointermove',_rangeHandleMove);
  document.addEventListener('pointerup',_rangeHandleUp);
}
function _rangeHandleDown(e,which){_startRangeDrag(e,{which});}

function _trackDown(e){
  if(!_musicPreview||!_previewTrackData) return;
  const t=_getRangeTrackT(e);
  const dur=_musicPreview.duration||30;
  const s=_previewTrackData.startTime||0;
  const end=_previewTrackData.endTime??Math.min(dur,s+30);
  let drag;
  if(t<=s){
    drag={which:'start'};
    _previewTrackData.startTime=Math.max(0,Math.min(end-3,t));
    _musicPreview.currentTime=_previewTrackData.startTime;
  } else if(t>=end){
    drag={which:'end'};
    _previewTrackData.endTime=Math.max(s+3,Math.min(dur,t));
  } else {
    // Dans la sélection → glisse toute la plage
    drag={which:'both',sOff:t-s,eOff:end-t};
  }
  _syncRangeUI();_updateMusicConfirmBtn();
  _startRangeDrag(e,drag);
}

function _rangeHandleMove(e){
  if(!_rangeDrag||!_musicPreview||!_previewTrackData) return;
  const t=_getRangeTrackT(e);
  const dur=_musicPreview.duration||30;
  const minGap=3;
  if(_rangeDrag.which==='start'){
    const max=(_previewTrackData.endTime??dur)-minGap;
    _previewTrackData.startTime=Math.max(0,Math.min(max,t));
    _musicPreview.currentTime=_previewTrackData.startTime;
  } else if(_rangeDrag.which==='end'){
    const min=(_previewTrackData.startTime||0)+minGap;
    const max=Math.min(dur,(_previewTrackData.startTime||0)+_MUSIC_MAX_CLIP);
    _previewTrackData.endTime=Math.max(min,Math.min(max,t));
  } else {
    const clipDur=(_previewTrackData.endTime??dur)-(_previewTrackData.startTime||0);
    const newS=Math.max(0,Math.min(dur-clipDur,t-(_rangeDrag.sOff||0)));
    _previewTrackData.startTime=newS;
    _previewTrackData.endTime=newS+clipDur;
    _musicPreview.currentTime=newS;
  }
  _syncRangeUI();_updateMusicConfirmBtn();
}
function _rangeHandleUp(){
  _rangeDrag=null;
  document.removeEventListener('pointermove',_rangeHandleMove);
  document.removeEventListener('pointerup',_rangeHandleUp);
}

let _previewTrackData = null; // { url, title, artist, idx, startTime }

function _renderMusicList(tracks) {
  const list = document.getElementById('music-track-list');
  if (!list) return;
  if (!tracks.length) {
    list.innerHTML = `<div class="empty-state"><img src="mascote_ivory/the_musician.png" alt=""><div>Aucun résultat<div class="es-hint">Essaie un autre mot-clé.</div></div></div>`;
    _updateMusicConfirmBtn();
    return;
  }
  const confirmedUrl = _musicPickerTarget === 'post' ? _postMusicUrl : _scMusicUrl;
  list.innerHTML = tracks.map((tr, i) => {
    // Champs Jamendo
    const url    = tr.audiodownload || tr.audio;
    const title  = tr.name        || '';
    const artist = tr.artist_name || '';
    const artUrl = tr.image       || '';
    const dur    = tr.duration    || 0;
    const durStr = dur ? `${Math.floor(dur/60)}:${String(dur%60).padStart(2,'0')}` : '–';
    const art    = artUrl
      ? `<img data-src="${escapeHtml(artUrl)}" alt="" style="width:100%;height:100%;object-fit:cover">`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.4)" stroke-width="1.5" stroke-linecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
    const isConfirmed = confirmedUrl === url;
    return `<div class="music-track-item${isConfirmed ? ' music-track-item--active' : ''}"
      data-url="${escapeHtml(url)}"
      data-title="${escapeHtml(title)}"
      data-artist="${escapeHtml(artist)}"
      data-idx="${i}"
      onclick="_previewTrack(this)">
      <div class="music-track-art">${art}</div>
      <div style="flex:1;overflow:hidden;min-width:0">
        <div class="music-track-title">${escapeHtml(title)}</div>
        <div class="music-track-artist">${escapeHtml(artist)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
        ${isConfirmed ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
        <span class="music-track-dur">${durStr}</span>
        <span data-fav-url="${escapeHtml(url)}" onclick="event.stopPropagation();_toggleFavorite('${escapeHtml(url)}','${escapeHtml(title)}','${escapeHtml(artist)}','${escapeHtml(artUrl)}',${dur})" style="font-size:16px;cursor:pointer;color:${_isFavorite(url)?'var(--gold)':'rgba(240,234,216,0.25)'};transition:color .2s">${_isFavorite(url)?'★':'☆'}</span>
        <div class="music-play-btn" id="mplay-${i}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--wd)" stroke="none"><polygon points="5,3 19,12 5,21"/></svg>
        </div>
      </div>
    </div>`;
  }).join('');
  observeLazy(list);
  _updateMusicConfirmBtn();
}

function _previewTrack(el) {
  const url    = el.dataset.url;
  const title  = el.dataset.title;
  const artist = el.dataset.artist;
  const idx    = el.dataset.idx;
  if (!url) return;

  // Même piste — toggle play/pause
  if (_previewTrackData && _previewTrackData.url === url && _musicPreview) {
    if (_musicPreview.paused) {
      _musicPreview.play().catch(() => {});
      _setPlayIcon(idx, 'play');
    } else {
      _musicPreview.pause();
      _setPlayIcon(idx, 'pause');
    }
    return;
  }

  // Nouvelle piste — réinitialise tout
  if (_musicPreview) { _musicPreview.pause(); _musicPreview = null; }
  document.querySelectorAll('.music-track-item').forEach(it => it.classList.remove('music-track-item--playing'));
  document.querySelectorAll('[id^="mplay-"]').forEach(btn => _setPlayIcon(btn.id.replace('mplay-',''), 'pause'));

  _previewTrackData = { url, title, artist, idx, startTime:0, endTime:null };
  el.classList.add('music-track-item--playing');
  _setPlayIcon(idx, 'loading');
  _updateMusicConfirmBtn();

  const audio = new Audio();
  _musicPreview = audio;

  // Timeout si le CDN ne répond pas
  const _failTimer = setTimeout(() => {
    if (_musicPreview !== audio) return;
    _onTrackFail(el, idx, 'Piste indisponible — essaie une autre');
  }, 15000);

  audio.onerror = () => {
    clearTimeout(_failTimer);
    if (_musicPreview !== audio) return;
    _onTrackFail(el, idx, 'Piste indisponible — essaie une autre');
  };

  audio.oncanplay = () => {
    clearTimeout(_failTimer);
    if (_musicPreview !== audio) return;
    // Initialise la plage sur la durée réelle
    if(_previewTrackData.endTime==null){
      const start=_previewTrackData.startTime||0;
      _previewTrackData.endTime=Math.min(audio.duration,start+30);
      audio.currentTime=start;
    }
    _setPlayIcon(idx, 'play');
    _syncRangeUI();
    _updateMusicConfirmBtn();
    _startScrubLoop();
  };

  audio.onended = () => {
    if (_musicPreview !== audio) return;
    _setPlayIcon(idx, 'pause');
    _stopScrubLoop();
  };

  audio.volume = 0.5;
  audio.src = url;
  audio.load();
  // play() appelé ici dans le contexte du geste utilisateur (click)
  audio.play().catch(() => {});
}

function _onTrackFail(el, idx, msg) {
  toast(msg);
  _stopScrubLoop();
  if (_musicPreview) { _musicPreview.src = ''; _musicPreview = null; }
  el.classList.remove('music-track-item--playing');
  _setPlayIcon(idx, 'pause');
  _previewTrackData = null;
  _updateMusicConfirmBtn();
}

function _setPlayIcon(idx, state) {
  const btn = document.getElementById('mplay-' + idx);
  if (!btn) return;
  if (state === 'loading') {
    btn.innerHTML = `<span style="font-size:9px;color:var(--gold);display:block;animation:spin .8s linear infinite">↻</span>`;
    btn.style.borderColor = 'rgba(240,234,216,0.35)';
  } else if (state === 'play') {
    btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="var(--gold)" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
    btn.style.borderColor = 'var(--gold)';
  } else {
    btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="var(--wd)" stroke="none"><polygon points="5,3 19,12 5,21"/></svg>`;
    btn.style.borderColor = 'rgba(240,234,216,0.2)';
  }
}

function _updateMusicConfirmBtn() {
  const bar   = document.getElementById('music-confirm-bar');
  const label = document.getElementById('music-confirm-label');
  if (!bar) return;
  if (_previewTrackData) {
    bar.style.display = 'block';
    const short = _previewTrackData.title.length > 20
      ? _previewTrackData.title.slice(0, 20) + '…'
      : _previewTrackData.title;
    const s = Math.floor(_previewTrackData.startTime || 0);
    const timeStr = s > 0 ? ` · ${_fmtTime(s)}` : '';
    const dur = _previewTrackData.endTime!=null
      ? Math.round(_previewTrackData.endTime - (_previewTrackData.startTime||0))
      : 30;
    if (label) label.textContent = `Ajouter · ${short}${timeStr} · ${dur}s`;
    _syncRangeUI();
  } else {
    bar.style.display = 'none';
  }
}

function _confirmMusicSelection() {
  if (!_previewTrackData) return;
  selectStoryMusic(_previewTrackData.title, _previewTrackData.artist, _previewTrackData.url, _previewTrackData.startTime||0, _previewTrackData.endTime??null);
  _previewTrackData = null;
}

function openMusicPicker(target = 'story') {
  _musicPickerTarget = target;
  const sheet = document.getElementById('music-picker-sheet');
  if (!sheet) return;
  sheet.style.display = 'flex';
  // Reset au tab Populaire + filtre favoris
  _favFilter = 'all';
  document.querySelectorAll('[id^="fchip-"]').forEach(c => c.classList.toggle('active', c.id === 'fchip-all'));
  openMusicTab('popular');
  _resetRecording();
  _closeMusicOverlay();
  // Reset menu +
  _musicAddMenuOpen = false;
  const menu = document.getElementById('music-add-menu');
  const addBtn = document.getElementById('music-add-btn');
  if (menu) menu.style.display = 'none';
  if (addBtn) addBtn.style.transform = 'rotate(0deg)';
  // Reset search
  const inp = document.getElementById('music-search-input');
  if (inp) inp.value = '';
  const clr = document.getElementById('music-search-clear');
  if (clr) clr.style.display = 'none';
  // Reset upload
  const wrap = document.getElementById('music-upload-preview-wrap');
  if (wrap) wrap.style.display = 'none';
  const fi = document.getElementById('music-file-input');
  if (fi) fi.value = '';
  _uploadedAudioFile = null;
  _fetchJamendoTracks('', _musicCurrentCat);
}

function closeMusicPicker() {
  _stopScrubLoop();
  if (_musicPreview) { _musicPreview.pause(); _musicPreview = null; }
  _previewTrackData = null;
  // Stop enregistrement en cours si on ferme
  if (_recState === 'recording') _stopRecording();
  _stopWaveform();
  // Reset tab sur Populaire pour la prochaine ouverture
  _currentMusicTab = 'popular';
  _closeMusicOverlay();
  const bar = document.getElementById('music-confirm-bar');
  if (bar) bar.style.display = 'none';
  const sheet = document.getElementById('music-picker-sheet');
  if (sheet) sheet.style.display = 'none';
}

function debounceMusicSearch(val) {
  const clr = document.getElementById('music-search-clear');
  if (clr) clr.style.display = val ? 'block' : 'none';
  clearTimeout(_musicSearchTimer);
  _musicSearchTimer = setTimeout(() => _fetchJamendoTracks(val, _musicCurrentCat), 500);
}

function clearMusicSearch() {
  const inp = document.getElementById('music-search-input');
  const clr = document.getElementById('music-search-clear');
  if (inp) inp.value = '';
  if (clr) clr.style.display = 'none';
  _fetchJamendoTracks('', _musicCurrentCat);
}

function musicCatSelect(el, tag) {
  _musicCurrentCat = tag;
  document.querySelectorAll('.music-cat-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  const inp = document.getElementById('music-search-input');
  if (inp && inp.value) return; // ne pas écraser une recherche en cours
  _fetchJamendoTracks('', tag);
}

function selectStoryMusic(title, artist, url, startTime=0, endTime=null) {
  if (_musicPreview) { _musicPreview.pause(); _musicPreview = null; }
  _stopScrubLoop();
  const fullTitle = `${title} — ${artist}`;
  if (_musicPickerTarget === 'post') {
    _postMusicUrl   = url;
    _postMusicTitle = fullTitle;
    _postMusicStart = startTime;
    _postMusicEnd   = endTime;
    const btn  = document.getElementById('post-music-btn');
    const icon = document.getElementById('post-music-icon');
    if (btn)  btn.style.borderColor = 'var(--gold)';
    if (icon) icon.setAttribute('stroke', 'var(--gold)');
    // Synchronise l'aperçu feed
    const pr = document.getElementById('p3-music-row');
    const pn = document.getElementById('p3-music-name');
    if (pr && pn) { pr.style.display = 'flex'; pn.textContent = fullTitle; }
  } else {
    _scMusicUrl   = url;
    _scMusicTitle = fullTitle;
    _scMusicStart = startTime;
    const label = document.getElementById('story-music-label');
    const clear = document.getElementById('story-music-clear');
    const btn   = document.getElementById('story-music-btn');
    if (label) { label.textContent = '♪ ' + title; label.style.color = 'var(--gold)'; }
    if (clear) clear.style.display = 'block';
    if (btn)   btn.style.borderColor = 'var(--gold)';
  }
  closeMusicPicker();
}

function clearStoryMusic() {
  _scMusicUrl = null; _scMusicTitle = null; _scMusicStart = 0;
  if (_musicPreview) { _musicPreview.pause(); _musicPreview = null; }
  const label = document.getElementById('story-music-label');
  const clear = document.getElementById('story-music-clear');
  const btn   = document.getElementById('story-music-btn');
  if (label) { label.textContent = 'Ajouter une musique'; label.style.color = 'var(--wd)'; }
  if (clear) clear.style.display = 'none';
  if (btn)   btn.style.borderColor = 'rgba(240,234,216,0.12)';
}

function clearPostMusic() {
  _postMusicUrl = null; _postMusicTitle = null; _postMusicStart = 0; _postMusicEnd = null;
  if (_musicPreview) { _musicPreview.pause(); _musicPreview = null; }
  const btn  = document.getElementById('post-music-btn');
  const icon = document.getElementById('post-music-icon');
  if (btn)  btn.style.borderColor = 'rgba(240,234,216,0.2)';
  if (icon) icon.setAttribute('stroke', 'rgba(240,234,216,0.6)');
  // Vide le row musique dans l'aperçu feed
  const pr = document.getElementById('p3-music-row');
  const pn = document.getElementById('p3-music-name');
  if (pr) pr.style.display = 'none';
  if (pn) pn.textContent = '';
}

function setStoryVisibility(v, el) {
  _scVisibility = v;
  document.querySelectorAll('.story-aud-chip').forEach(c => c.classList.remove('story-aud-chip--active'));
  if (el) el.classList.add('story-aud-chip--active');
}

// ── Barre de stories ─────────────────────────
async function loadStories() {
  const bar = document.getElementById('stories-bar');
  if (!bar) return;
  bar.innerHTML = `<div class="story-item" role="button" tabindex="0" aria-label="Ajouter une story" onclick="openStoryCam()" onkeydown="if(event.key==='Enter'||event.key===' ')openStoryCam()">
    ${_myStoryBubble(null)}<div class="story-label">Ma story</div></div>`;
  if (!dbOk || !me) return;

  const { data: follows } = await sb.from('follows').select('following_id').eq('follower_id', me.id);
  const uids = [me.id, ...(follows || []).map(f => f.following_id)];

  // Requête sans join (évite l'erreur 400 liée à l'absence de FK déclarée dans Supabase)
  const { data: stories, error: storiesErr } = await sb.from('stories')
    .select('*')
    .in('user_id', uids)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (storiesErr || !stories?.length) return;

  // Profils récupérés séparément
  const uniqueUids = [...new Set(stories.map(s => s.user_id))];
  const profs = await getProfiles(uniqueUids);
  const profMap = {};
  profs.forEach(p => profMap[p.id] = p);
  stories.forEach(s => { s.profiles = profMap[s.user_id] || null; });

  // Stories déjà vues (table story_views — ignoré si absente)
  let viewedIds = new Set();
  const { data: viewed } = await sb.from('story_views')
    .select('story_id').eq('viewer_id', me.id)
    .in('story_id', stories.map(s => s.id));
  (viewed || []).forEach(v => viewedIds.add(v.story_id));

  _storiesData = {};
  stories.forEach(s => {
    if (s.visibility === 'close_friends' && s.user_id !== me.id) return;
    if (!_storiesData[s.user_id]) _storiesData[s.user_id] = { profile: s.profiles, items: [], hasUnseen: false };
    const seen = viewedIds.has(s.id);
    _storiesData[s.user_id].items.push({ ...s, viewed: seen });
    if (!seen) _storiesData[s.user_id].hasUnseen = true;
  });

  const myData = _storiesData[me.id] || null;
  const myAction = myData ? `openStoryViewer('${me.id}')` : 'openStoryCam()';
  const myLabel = myData ? 'Voir ma story' : 'Ajouter une story';
  let html = `<div class="story-item" role="button" tabindex="0" aria-label="${myLabel}" onclick="${myAction}" onkeydown="if(event.key==='Enter'||event.key===' ')${myAction}">
    ${_myStoryBubble(myData)}<div class="story-label">Ma story</div></div>`;

  Object.entries(_storiesData)
    .filter(([uid]) => uid !== me.id)
    .sort(([, a], [, b]) => (b.hasUnseen ? 1 : 0) - (a.hasUnseen ? 1 : 0))
    .forEach(([uid, data]) => {
      const av = data.profile?.avatar_url
        ? `<img data-src="${data.profile.avatar_url}" alt="">`
        : `<span style="font-size:16px;font-weight:700;color:var(--gold)">${(data.profile?.username || '?')[0].toUpperCase()}</span>`;
      const uname = escapeHtml((data.profile?.username || 'user').slice(0, 10));
      const storyLabel = data.hasUnseen ? `Nouvelle story de ${uname}` : `Story de ${uname}`;
      html += `<div class="story-item" role="button" tabindex="0" aria-label="${storyLabel}" onclick="openStoryViewer('${uid}')" onkeydown="if(event.key==='Enter'||event.key===' ')openStoryViewer('${uid}')">
        <div class="story-bubble ${data.hasUnseen ? 'story-bubble--unseen' : 'story-bubble--seen'}">${av}</div>
        <div class="story-label">${uname}</div></div>`;
    });

  bar.innerHTML = html;
  observeLazy(bar);
}

function _myStoryBubble(data) {
  if (data?.items?.[0]?.image_url) {
    const isVid = _isVideoUrl(data.items[0].image_url);
    const preview = isVid
      ? `<video src="${data.items[0].image_url}" muted autoplay loop playsinline style="width:100%;height:100%;object-fit:cover"></video>`
      : `<img data-src="${data.items[0].image_url}" alt="" style="width:100%;height:100%;object-fit:cover">`;
    return `<div class="story-bubble story-bubble--mine">${preview}<div class="story-add-badge">+</div></div>`;
  }
  return `<div class="story-bubble story-bubble--add">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  </div>`;
}

function _isVideoUrl(url) {
  return /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url || '');
}

// ── Viewer ────────────────────────────────────
function openStoryViewer(uid) {
  const data = _storiesData[uid];
  if (!data?.items?.length) return;
  _storyViewerUid = uid;
  _storyViewerIdx = 0;
  _renderStoryViewer();
}

function _renderStoryViewer() {
  const data = _storiesData[_storyViewerUid];
  if (!data) return closeStoryViewer();
  const story = data.items[_storyViewerIdx];
  if (!story) return closeStoryViewer();

  document.getElementById('story-viewer').style.display = 'flex';

  document.getElementById('sv-bars').innerHTML = Array.from({ length: data.items.length }, (_, i) =>
    `<div class="sv-bar-track"><div class="sv-bar-fill ${i < _storyViewerIdx ? 'sv-done' : i === _storyViewerIdx ? 'sv-active' : ''}"></div></div>`
  ).join('');

  const isVid = _isVideoUrl(story.image_url);
  const img   = document.getElementById('sv-img');
  const vid   = document.getElementById('sv-video');
  if (isVid) {
    img.style.display = 'none';
    vid.src = story.image_url; vid.style.display = 'block';
    vid.muted = false; vid.loop = false;
    vid.play().catch(() => {});
    vid.onended = _storyNext;
  } else {
    vid.pause(); vid.src = ''; vid.style.display = 'none';
    img.src = story.image_url; img.alt = (story.username||'') + ' — story'; img.style.display = 'block';
  }

  document.getElementById('sv-username').textContent = data.profile?.username || 'user';
  const av = document.getElementById('sv-avatar');
  av.innerHTML = data.profile?.avatar_url
    ? `<img src="${data.profile.avatar_url}" alt="" style="width:100%;height:100%;object-fit:cover">`
    : `<span style="font-size:15px;font-weight:700;color:var(--gold)">${(data.profile?.username || '?')[0].toUpperCase()}</span>`;
  document.getElementById('sv-time').textContent = timeAgo(story.created_at);
  document.getElementById('sv-caption').textContent = story.caption || '';
  const delBtn = document.getElementById('sv-delete');
  const isOwnStory = me && story.user_id === me.id;
  if (delBtn) delBtn.style.display = isOwnStory ? 'flex' : 'none';

  // Barre de réactions — visible uniquement sur les stories des autres
  const reactBar = document.getElementById('sv-reactions-bar');
  const replyInput = document.getElementById('sv-reply-input');
  if (reactBar) reactBar.style.display = isOwnStory ? 'none' : 'block';
  if (replyInput) {
    const author = data.profile?.username || 'user';
    replyInput.placeholder = `Répondre à ${author}…`;
    replyInput.value = '';
  }

  // Icône vues (propre story) vs masquée
  const eyeBtn = document.getElementById('sv-eye-btn');
  if (eyeBtn) eyeBtn.style.display = isOwnStory ? 'flex' : 'none';

  if (isOwnStory) {
    // Réinitialiser immédiatement puis charger
    const eyeCountEl = document.getElementById('sv-eye-count');
    if (eyeCountEl) eyeCountEl.textContent = '…';
    _loadStoryViewCount(story.id);
  } else if (me) {
    // Enregistrer la vue — INSERT simple, ignore si déjà vu (code 23505)
    (async () => {
      try {
        await sb.from('story_views').insert({ story_id: story.id, viewer_id: me.id });
      } catch(e) {
        if (e?.code !== '23505') console.warn('[story_view]', e);
      }
    })();
  }

  _startStoryTimer(isVid ? null : STORY_DURATION);

  // ── Musique ──
  const svMusic = document.getElementById('sv-music');
  const svMusicLabel = document.getElementById('sv-music-label');
  const svMusicText  = document.getElementById('sv-music-text');
  if (svMusic) {
    svMusic.pause(); svMusic.src = '';
    if (story.music_url) {
      svMusic.src = story.music_url;
      svMusic.volume = 0.5;
      svMusic.oncanplay = () => {
        if (story.music_start > 0) svMusic.currentTime = story.music_start;
        svMusic.oncanplay = null;
      };
      svMusic.play().catch(() => {});
    }
  }
  if (svMusicLabel && svMusicText) {
    if (story.music_title) {
      svMusicText.textContent = '♪ ' + story.music_title;
      svMusicLabel.style.display = 'flex';
    } else {
      svMusicLabel.style.display = 'none';
    }
  }

  if (me && story.user_id !== me.id && !story.viewed) {
    story.viewed = true;
    if (data.items.every(s => s.viewed)) data.hasUnseen = false;
  }
}

function _startStoryTimer(ms) {
  _clearStoryTimer();
  if (!ms) return; // vidéo : c'est onended qui avance
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const fill = document.querySelector('.sv-bar-fill.sv-active');
    if (fill) { fill.style.transition = `width ${ms}ms linear`; fill.style.width = '100%'; }
  }));
  _storyTimer = setTimeout(_storyNext, ms);
}

function _clearStoryTimer() {
  if (_storyTimer) { clearTimeout(_storyTimer); _storyTimer = null; }
}

function _storyNext() {
  _clearStoryTimer();
  const data = _storiesData[_storyViewerUid];
  if (!data) return closeStoryViewer();
  _storyViewerIdx++;
  if (_storyViewerIdx >= data.items.length) {
    const others = Object.keys(_storiesData).filter(u => u !== me?.id);
    const ci = others.indexOf(_storyViewerUid);
    if (ci >= 0 && ci < others.length - 1) {
      _storyViewerUid = others[ci + 1]; _storyViewerIdx = 0; _renderStoryViewer();
    } else { closeStoryViewer(); }
    return;
  }
  _renderStoryViewer();
}

function _storyPrev() {
  _clearStoryTimer();
  if (_storyViewerIdx > 0) { _storyViewerIdx--; _renderStoryViewer(); }
}

function storyTap(e) {
  if (e.target.closest('button,[id="sv-delete"],[id="sv-bars"]')) return;
  const ov = document.getElementById('story-viewer');
  const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
  if (x < ov.offsetWidth * 0.35) _storyPrev(); else _storyNext();
}

function storyTouchStart(e) { _storyTouchStartY = e.touches?.[0]?.clientY ?? 0; }
function storyTouchEnd(e) {
  if ((e.changedTouches?.[0]?.clientY ?? 0) - _storyTouchStartY > 80) closeStoryViewer();
}

function closeStoryViewer() {
  _clearStoryTimer();
  const vid = document.getElementById('sv-video');
  if (vid) { vid.pause(); vid.src = ''; vid.onended = null; }
  const svMusic = document.getElementById('sv-music');
  if (svMusic) { svMusic.pause(); svMusic.src = ''; }
  const ov = document.getElementById('story-viewer');
  if (ov) ov.style.display = 'none';
  _storyViewerUid = null; _storyViewerIdx = 0;
}

async function deleteStory() {
  const data = _storiesData[_storyViewerUid];
  if (!data || !me) return;
  const story = data.items[_storyViewerIdx];
  if (!story || story.user_id !== me.id) return;
  const { error } = await sb.from('stories').delete().eq('id', story.id).eq('user_id', me.id);
  if (error) return toast('Erreur suppression');
  data.items.splice(_storyViewerIdx, 1);
  if (!data.items.length) { delete _storiesData[_storyViewerUid]; closeStoryViewer(); }
  else { _storyViewerIdx = Math.min(_storyViewerIdx, data.items.length - 1); _renderStoryViewer(); }
  loadStories(); toast('Story supprimée');
}

// ── STORY CAMERA ──────────────────────────────
let _scStream      = null;
let _scFacing      = 'environment';
let _scMode        = 'photo';   // 'photo' | 'video'
let _scRecorder    = null;
let _scChunks      = [];
let _scRecording   = false;
let _scRecordTimer = null;
let _scBlob        = null;
let _scMediaType   = 'image';
const SC_MAX_DUR   = 30000;

async function openStoryCam() {
  if (!me) return toast(t('login_required') || 'Connecte-toi');
  const ov = document.getElementById('story-cam-overlay');
  ov.style.display = 'flex';
  _scMode = 'photo';
  _scUpdateMode();
  await _scStart();
}

function closeStoryCam() {
  _scStop();
  document.getElementById('story-cam-overlay').style.display = 'none';
}

async function _scStart() {
  _scStop(false);
  const video = document.getElementById('sc-video');
  if (!video) return;
  const tries = [
    { video: { facingMode: { ideal: _scFacing }, width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: true },
    { video: { facingMode: { ideal: _scFacing } }, audio: true },
    { video: true, audio: true },
    { video: true, audio: false },
  ];
  let stream = null;
  for (const c of tries) {
    try { stream = await navigator.mediaDevices.getUserMedia(c); if (stream) break; } catch(_) {}
  }
  if (!stream) { toast('Caméra non disponible'); closeStoryCam(); return; }
  _scStream = stream;
  video.srcObject = stream;
  video.style.opacity = '0';
  await video.play().catch(() => {});
  video.style.transition = 'opacity .3s';
  video.style.opacity = '1';
}

function _scStop(clearOverlay = true) {
  if (_scRecording) _scStopRecord();
  if (_scStream) { _scStream.getTracks().forEach(t => t.stop()); _scStream = null; }
  const v = document.getElementById('sc-video');
  if (v) { v.srcObject = null; v.style.opacity = '0'; }
}

function scFlip() {
  _scFacing = _scFacing === 'environment' ? 'user' : 'environment';
  _scStart();
}

function scSetMode(mode) { _scMode = mode; _scUpdateMode(); }

function _scUpdateMode() {
  document.getElementById('scp-photo')?.classList.toggle('scp-mode--active', _scMode === 'photo');
  document.getElementById('scp-video')?.classList.toggle('scp-mode--active', _scMode === 'video');
  const inner = document.getElementById('scp-inner');
  if (!inner) return;
  if (_scMode === 'video') {
    inner.style.borderRadius = '8px';
    inner.style.width = '34px';
    inner.style.height = '34px';
    inner.style.background = '#e53935';
  } else {
    inner.style.borderRadius = '50%';
    inner.style.width = '62px';
    inner.style.height = '62px';
    inner.style.background = 'white';
  }
}

function scCaptureTap() {
  if (_scMode === 'photo') _scCapturePhoto();
  else _scRecording ? _scStopRecord() : _scStartRecord();
}

function _scCapturePhoto() {
  const video = document.getElementById('sc-video');
  if (!video || !_scStream) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1080;
  canvas.height = video.videoHeight || 1920;
  const ctx = canvas.getContext('2d');
  if (_scFacing === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(blob => {
    if (!blob) return;
    closeStoryCam();
    _scOpenPreview(blob, 'image');
  }, 'image/jpeg', 0.92);
}

function _scStartRecord() {
  if (!_scStream) return;
  _scChunks = [];
  const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  const mime  = types.find(m => MediaRecorder.isTypeSupported(m)) || '';
  try {
    _scRecorder = new MediaRecorder(_scStream, mime ? { mimeType: mime } : undefined);
    _scRecorder.ondataavailable = e => { if (e.data?.size > 0) _scChunks.push(e.data); };
    _scRecorder.onstop = () => {
      const blob = new Blob(_scChunks, { type: mime || 'video/webm' });
      _scChunks = [];
      closeStoryCam();
      _scOpenPreview(blob, 'video');
    };
    _scRecorder.start(100);
    _scRecording = true;
    _scSetRecordingUI(true);
    _scRecordTimer = setTimeout(_scStopRecord, SC_MAX_DUR);
  } catch(e) {
    toast('Enregistrement non supporté sur cet appareil');
  }
}

function _scStopRecord() {
  if (!_scRecording) return;
  _scRecording = false;
  clearTimeout(_scRecordTimer);
  _scSetRecordingUI(false);
  if (_scRecorder?.state !== 'inactive') _scRecorder?.stop();
}

function _scSetRecordingUI(on) {
  const btn  = document.getElementById('scp-btn');
  const ring = document.getElementById('scp-ring');
  const inner = document.getElementById('scp-inner');
  if (!btn) return;
  if (on) {
    btn.style.borderColor = '#e53935';
    if (ring) { ring.style.opacity = '1'; ring.style.animation = `scpRing ${SC_MAX_DUR}ms linear forwards`; }
    if (inner) { inner.style.borderRadius = '6px'; inner.style.width = '28px'; inner.style.height = '28px'; inner.style.background = '#e53935'; }
  } else {
    btn.style.borderColor = 'white';
    if (ring) { ring.style.opacity = '0'; ring.style.animation = 'none'; ring.style.strokeDashoffset = '251'; }
    if (inner) { inner.style.borderRadius = '6px'; inner.style.width = '34px'; inner.style.height = '34px'; inner.style.background = '#e53935'; }
  }
}

// ── Prévisualisation / légende ────────────────
function _scOpenPreview(blob, type) {
  _scBlob = blob;
  _scMediaType = type;
  const url = URL.createObjectURL(blob);
  const img  = document.getElementById('story-preview-img');
  const vid  = document.getElementById('story-preview-video');
  const hint = document.getElementById('story-pick-hint');
  if (hint) hint.style.display = 'none';
  if (type === 'video') {
    if (img) img.style.display = 'none';
    if (vid) { vid.src = url; vid.style.display = 'block'; vid.loop = true; vid.muted = true; vid.play().catch(() => {}); }
  } else {
    if (vid) { vid.pause(); vid.src = ''; vid.style.display = 'none'; }
    if (img) { img.src = url; img.style.display = 'block'; }
  }
  document.getElementById('story-caption-input').value = '';
  const btn = document.getElementById('story-publish-btn');
  btn.disabled = false; btn.textContent = 'Publier';
  document.getElementById('story-create-overlay').style.display = 'flex';
  // Afficher le bouton save uniquement pour les images
  const saveBtn = document.getElementById('story-save-btn');
  if (saveBtn) saveBtn.style.display = type === 'image' ? 'flex' : 'none';
}

// Galerie (fallback)
function scPickGallery() { document.getElementById('story-file-input').click(); }

function storyFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  const isVid = file.type.startsWith('video/');
  if (!file.type.startsWith('image/') && !isVid) return toast('Sélectionne une image ou vidéo');
  _scBlob = file; _scMediaType = isVid ? 'video' : 'image';
  const reader = new FileReader();
  reader.onload = e => {
    const img  = document.getElementById('story-preview-img');
    const vid  = document.getElementById('story-preview-video');
    const hint = document.getElementById('story-pick-hint');
    if (hint) hint.style.display = 'none';
    if (isVid) {
      if (img) img.style.display = 'none';
      if (vid) { vid.src = e.target.result; vid.style.display = 'block'; vid.loop = true; vid.muted = true; vid.play().catch(() => {}); }
    } else {
      if (vid) { vid.pause(); vid.src = ''; vid.style.display = 'none'; }
      if (img) { img.src = e.target.result; img.style.display = 'block'; }
    }
    document.getElementById('story-publish-btn').disabled = false;
    document.getElementById('story-create-overlay').style.display = 'flex';
    const saveBtn = document.getElementById('story-save-btn');
    if (saveBtn) saveBtn.style.display = isVid ? 'none' : 'flex';
  };
  reader.readAsDataURL(file);
  input.value = '';
}

async function saveStoryImage() {
  if (!_scBlob) return;
  const ext = _scBlob.type.includes('png') ? 'png' : 'jpg';
  const filename = `wearaura_story_${Date.now()}.${ext}`;
  const file = new File([_scBlob], filename, { type: _scBlob.type });

  // iOS Safari / Android Chrome : feuille native → "Enregistrer dans Photos"
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Story WearAura' }); }
    catch (e) { if (e.name !== 'AbortError') toast('Erreur — réessaie'); }
    return;
  }

  // Fallback : plein écran + appui long
  if (typeof _showSaveOverlay === 'function') {
    _showSaveOverlay(URL.createObjectURL(_scBlob));
  }
}

// ── Story reactions & reply ──────────────────────────────────────────────────

let _svReplyPaused = false;

function svPickEmoji(input) {
  const val = input.value.trim();
  input.value = '';
  if (!val) return;
  // Prend le premier caractère/emoji saisi
  const emoji = [...val][0];
  if (emoji) sendStoryReaction(emoji);
}

function svPauseForReply() {
  if (_svReplyPaused) return;
  _svReplyPaused = true;
  _clearStoryTimer();
  // Figer la barre de progression
  const fill = document.querySelector('.sv-bar-fill.sv-active');
  if (fill) { fill._pausedWidth = fill.getBoundingClientRect().width; fill.style.transition = 'none'; fill.style.width = fill._pausedWidth + 'px'; }
}

function svResumeAfterReply() {
  if (!_svReplyPaused) return;
  _svReplyPaused = false;
  // Relancer le timer avec le temps restant (~STORY_DURATION)
  _startStoryTimer(STORY_DURATION);
}

async function _loadStoryViewCount(storyId) {
  try {
    const { count } = await sb.from('story_views').select('*', { count: 'exact', head: true }).eq('story_id', storyId);
    const eyeCount = document.getElementById('sv-eye-count');
    if (eyeCount) eyeCount.textContent = count || 0;
  } catch(e) {}
}

async function openStoryViewsPanel() {
  const data = _storiesData[_storyViewerUid];
  const story = data?.items[_storyViewerIdx];
  if (!story) return;

  _clearStoryTimer();

  const panel = document.getElementById('sv-views-panel');
  const list  = document.getElementById('sv-views-list');
  if (!panel || !list) return;

  list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--wd);font-size:13px">Chargement…</div>';
  panel.style.display = 'flex';

  try {
    // Vues
    const { data: views } = await sb.from('story_views')
      .select('viewer_id, viewed_at')
      .eq('story_id', story.id)
      .order('viewed_at', { ascending: false });

    // Réactions
    const { data: reactions } = await sb.from('story_reactions')
      .select('user_id, emoji')
      .eq('story_id', story.id);

    const reactionMap = {};
    (reactions || []).forEach(r => { reactionMap[r.user_id] = r.emoji; });

    const total = views?.length || 0;
    const eyeCount = document.getElementById('sv-eye-count');
    if (eyeCount) eyeCount.textContent = total;
    const panelCount = document.getElementById('sv-views-count');
    if (panelCount) panelCount.textContent = total + ' vue' + (total !== 1 ? 's' : '');

    if (!total) {
      list.innerHTML = '<div style="text-align:center;padding:32px 20px;color:var(--wd);font-size:13px">Aucune vue pour l\'instant</div>';
      return;
    }

    // Charger les profils séparément
    const viewerIds = views.map(v => v.viewer_id);
    const { data: profiles } = await sb.from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', viewerIds);
    const profMap = {};
    (profiles || []).forEach(p => { profMap[p.id] = p; });

    list.innerHTML = views.map(v => {
      const p = profMap[v.viewer_id] || {};
      const name = p.full_name || p.username || 'Utilisateur';
      const handle = p.username ? '@' + p.username : '';
      const av = p.avatar_url
        ? `<img src="${p.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : `<span style="font-size:14px;font-weight:700;color:var(--gold);text-transform:uppercase">${(p.username||'?')[0]}</span>`;
      const emoji = reactionMap[v.viewer_id] || '';
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 20px">
        <div style="width:42px;height:42px;border-radius:50%;background:var(--black-3);border:1.5px solid var(--gold-b);overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0">${av}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--white);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(name)}</div>
          <div style="font-size:11px;color:var(--wd)">${escapeHtml(handle)}</div>
        </div>
        ${emoji ? `<div style="font-size:24px">${emoji}</div>` : ''}
      </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--wd)">Erreur de chargement</div>';
  }
}

function closeStoryViewsPanel() {
  const panel = document.getElementById('sv-views-panel');
  if (panel) panel.style.display = 'none';
  // Relancer le timer
  const data = _storiesData[_storyViewerUid];
  const story = data?.items[_storyViewerIdx];
  if (story && !_isVideoUrl(story.image_url)) _startStoryTimer(STORY_DURATION);
}

async function sendStoryReaction(emoji) {
  if (!me) return toast(t('login_required'));
  const data = _storiesData[_storyViewerUid];
  const story = data?.items[_storyViewerIdx];
  if (!story) return;
  const toUid = story.user_id;
  if (toUid === me.id) return;

  // Animation emoji flottant
  const btn = event?.target?.closest?.('.sv-emoji-btn') || document.body;
  const rect = btn.getBoundingClientRect?.() || { left: window.innerWidth/2, top: window.innerHeight/2 };
  const floater = document.createElement('div');
  floater.className = 'sv-emoji-float';
  floater.textContent = emoji;
  floater.style.left = (rect.left + (rect.width||0)/2 - 21) + 'px';
  floater.style.top  = (rect.top - 10) + 'px';
  document.body.appendChild(floater);
  setTimeout(() => floater.remove(), 950);

  try {
    // Supprimer l'ancienne réaction si elle existe, puis insérer la nouvelle
    await sb.from('story_reactions').delete().eq('story_id', story.id).eq('user_id', me.id);
    await sb.from('story_reactions').insert({ story_id: story.id, user_id: me.id, emoji });
    toast(emoji + ' Réaction envoyée !', 1800);
    // Notification pour le propriétaire de la story
    try {
      await sb.from('notifications').insert({
        user_id: toUid,
        from_user_id: me.id,
        type: 'story_reaction',
        comment_text: emoji,
        read: false
      });
    } catch(e) { /* silencieux */ }
  } catch(e) {
    console.warn('[story reaction]', e);
  }
}

async function sendStoryReply() {
  const input = document.getElementById('sv-reply-input');
  const text = input?.value?.trim();
  if (!text) return;
  if (!me) return toast(t('login_required'));
  const data = _storiesData[_storyViewerUid];
  const story = data?.items[_storyViewerIdx];
  if (!story) return;
  const toUid = story.user_id;
  if (toUid === me.id) return;

  input.value = '';
  input.blur();
  try {
    await _sendStoryDM(toUid, text);
    toast('💬 Message envoyé !', 1800);
  } catch(e) {
    console.warn('[story reply]', e);
    toast('Erreur — réessaie');
  }
}

async function _sendStoryDM(toUid, content) {
  // Chercher une conversation existante
  const { data: existing } = await sb.from('conversations')
    .select('id')
    .or(`and(participant_1.eq.${me.id},participant_2.eq.${toUid}),and(participant_1.eq.${toUid},participant_2.eq.${me.id})`)
    .eq('is_group', false)
    .maybeSingle();

  let convId = existing?.id;

  // Créer la conversation si elle n'existe pas
  if (!convId) {
    const { data: newConv } = await sb.from('conversations')
      .insert({ participant_1: me.id, participant_2: toUid, is_group: false, participants: [me.id, toUid] })
      .select().single();
    convId = newConv?.id;
    // Notification message_request
    await sb.from('notifications').insert({ user_id: toUid, from_user_id: me.id, type: 'message_request', read: false }).catch(()=>{});
  }

  if (!convId) throw new Error('no conv');

  // Envoyer le message
  await sb.from('messages').insert({
    conversation_id: convId,
    sender_id: me.id,
    receiver_id: toUid,
    content
  });
  await sb.from('conversations').update({ last_message: content, last_message_at: new Date().toISOString() }).eq('id', convId);
}

function closeStoryCreate() {
  document.getElementById('story-create-overlay').style.display = 'none';
  const vid = document.getElementById('story-preview-video');
  if (vid) { vid.pause(); vid.src = ''; }
  _scBlob = null;
  _scVisibility = 'everyone';
  document.querySelectorAll('.story-aud-chip').forEach((c, i) => {
    c.classList.toggle('story-aud-chip--active', i === 0);
  });
  clearStoryMusic();
  if (_musicPreview) { _musicPreview.pause(); _musicPreview = null; }
}

// ── Publication ───────────────────────────────
async function publishStory() {
  if (!_scBlob || !me) return;
  const btn = document.getElementById('story-publish-btn');
  btn.disabled = true; btn.textContent = '…';
  try {
    const isVid = _scMediaType === 'video';
    const ext   = isVid ? 'webm' : 'jpg';
    const path  = `${me.id}/story_${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from('posts').upload(path, _scBlob, { upsert: true, contentType: isVid ? 'video/webm' : 'image/jpeg' });
    if (upErr) throw upErr;
    const { data: urlData } = sb.storage.from('posts').getPublicUrl(path);
    const caption = document.getElementById('story-caption-input').value.trim();
    const { error: insErr } = await sb.from('stories').insert({ user_id: me.id, image_url: urlData.publicUrl, caption, visibility: _scVisibility, music_url: _scMusicUrl || null, music_title: _scMusicTitle || null, music_start: _scMusicStart || 0 });
    if (insErr) throw insErr;
    if (_scMusicUrl) _addMusicRecent(_scMusicUrl, _scMusicTitle);
    toast('Story publiée ✓');
    closeStoryCreate();
    loadStories();
  } catch(e) {
    toast('Erreur : ' + (e.message || 'inconnue'));
    btn.disabled = false; btn.textContent = 'Publier';
  }
}

// ═══════════════════════════════════════════════════════════════
// MUSIC PICKER — Onglets + Enregistrement + Import
// ═══════════════════════════════════════════════════════════════

// ── Tab switcher (Populaire / Favoris) ───────────────────────
let _currentMusicTab = 'popular';

function openMusicTab(tab) {
  _currentMusicTab = tab;
  ['popular','favoris'].forEach(t => {
    const el = document.getElementById('mtab-' + t);
    if (el) el.classList.toggle('active', t === tab);
  });
  const pop = document.getElementById('mpanel-popular');
  const fav = document.getElementById('mpanel-favoris');
  if (pop) pop.style.display = tab === 'popular' ? 'flex' : 'none';
  if (fav) fav.style.display = tab === 'favoris' ? 'flex' : 'none';
  // Confirm bar visible seulement en Populaire si une piste est sélectionnée
  const bar  = document.getElementById('music-confirm-bar');
  const note = document.getElementById('music-source-note');
  if (bar)  bar.style.display  = tab === 'popular' && _previewTrackData ? 'block' : 'none';
  if (note) note.style.display = tab === 'popular' ? 'flex' : 'none';
  if (tab === 'favoris') { if (_musicPreview) _musicPreview.pause(); _renderFavoris(); }
}

// ── Bouton + flottant ────────────────────────────────────────
let _musicAddMenuOpen = false;

function _toggleMusicAddMenu() {
  _musicAddMenuOpen = !_musicAddMenuOpen;
  const menu = document.getElementById('music-add-menu');
  const icon = document.getElementById('music-add-icon');
  const btn  = document.getElementById('music-add-btn');
  if (menu) menu.style.display = _musicAddMenuOpen ? 'block' : 'none';
  if (btn)  btn.style.transform = _musicAddMenuOpen ? 'rotate(45deg)' : 'rotate(0deg)';
}

function _openMusicOverlay(type) {
  // Fermer le menu +
  _musicAddMenuOpen = false;
  const menu = document.getElementById('music-add-menu');
  const btn  = document.getElementById('music-add-btn');
  if (menu) menu.style.display = 'none';
  if (btn)  btn.style.transform = 'rotate(0deg)';
  // Ouvrir l'overlay
  const rec = document.getElementById('mpanel-record');
  const upl = document.getElementById('mpanel-upload');
  if (type === 'record') { _resetRecording(); if (rec) rec.style.display = 'flex'; }
  if (type === 'upload') { if (upl) upl.style.display = 'flex'; }
}

function _closeMusicOverlay() {
  const rec = document.getElementById('mpanel-record');
  const upl = document.getElementById('mpanel-upload');
  if (rec) rec.style.display = 'none';
  if (upl) upl.style.display = 'none';
  if (_recState === 'recording') _stopRecording();
}

// ── Persistance musique (localStorage) ───────────────────────
const _FAV_KEY    = 'wa_music_favs';
const _CUSTOM_KEY = 'wa_music_custom';
const _RECENT_KEY = 'wa_music_recent';

function _getFavoris()  { try { return JSON.parse(localStorage.getItem(_FAV_KEY)    || '[]'); } catch { return []; } }
function _getCustom()   { try { return JSON.parse(localStorage.getItem(_CUSTOM_KEY) || '[]'); } catch { return []; } }
function _getRecent()   { try { return JSON.parse(localStorage.getItem(_RECENT_KEY) || '[]'); } catch { return []; } }

function _saveFavoris(list) { localStorage.setItem(_FAV_KEY,    JSON.stringify(list.slice(0,50))); }
function _saveCustom(list)  { localStorage.setItem(_CUSTOM_KEY, JSON.stringify(list.slice(0,20))); }
function _saveRecent(list)  { localStorage.setItem(_RECENT_KEY, JSON.stringify(list.slice(0,10))); }

// Enregistre un son custom (enregistré ou importé)
function _saveCustomSound(url, title, type) {
  if (!url) return;
  let list = _getCustom();
  list = list.filter(r => r.url !== url);
  list.unshift({ url, title, type, ts: Date.now() }); // type: 'record'|'upload'
  _saveCustom(list);
}

// Enregistre un son récemment utilisé (appelé après publication)
function _addMusicRecent(url, title) {
  if (!url) return;
  let list = _getRecent();
  list = list.filter(r => r.url !== url);
  list.unshift({ url, title: title || 'Son', ts: Date.now() });
  _saveRecent(list);
}

function _isFavorite(url) {
  return _getFavoris().some(f => f.url === url);
}

function _toggleFavorite(url, title, artist, art, duration) {
  let list = _getFavoris();
  const idx = list.findIndex(f => f.url === url);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.unshift({ url, title, artist, art, duration });
  }
  _saveFavoris(list);
  // Refresh étoile dans la liste Populaire
  document.querySelectorAll(`[data-fav-url]`).forEach(el => {
    if (el.dataset.favUrl === url) {
      el.textContent = idx >= 0 ? '☆' : '★';
      el.style.color = idx >= 0 ? 'rgba(240,234,216,0.3)' : 'var(--gold)';
    }
  });
  if (_currentMusicTab === 'favoris') _renderFavoris();
  toast(idx >= 0 ? 'Retiré des favoris' : '★ Ajouté aux favoris', 1600);
}

// ── Render Favoris — liste filtrée ───────────────────────────
let _favFilter = 'all';

function setFavFilter(el, filter) {
  _favFilter = filter;
  document.querySelectorAll('[id^="fchip-"]').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  _renderFavoris();
}

function _renderFavoris() {
  const list = document.getElementById('music-fav-list');
  if (!list) return;

  const custom  = _getCustom();
  const favs    = _getFavoris();
  const recents = _getRecent();
  const confirmedUrl = _musicPickerTarget === 'post' ? _postMusicUrl : _scMusicUrl;

  // Construire la liste selon le filtre
  let items = [];
  if (_favFilter === 'all' || _favFilter === 'custom')  items.push(...custom.map(i => ({...i, _src:'custom'})));
  if (_favFilter === 'all' || _favFilter === 'favs')    items.push(...favs.map(i => ({...i, _src:'favs'})));
  if (_favFilter === 'all' || _favFilter === 'recent')  items.push(...recents.map(i => ({...i, _src:'recent'})));

  if (!items.length) {
    const hints = {
      all:    'Enregistre un vocal, importe un son ou ★ une piste Populaire.',
      custom: 'Enregistre un vocal ou importe un fichier avec le bouton +.',
      favs:   'Appuie sur ★ dans Populaire pour sauvegarder une piste.',
      recent: 'Les sons de tes posts et stories apparaîtront ici.',
    };
    list.innerHTML = `<div class="empty-state"><img src="mascote_ivory/the_musician2.png" alt=""><div>Rien ici<div class="es-hint">${hints[_favFilter]||''}</div></div></div>`;
    return;
  }

  const iconFor = item =>
    item._src === 'custom' ? (item.type === 'record' ? '🎙' : '⬆') :
    item._src === 'favs'   ? '★' : '🕐';

  list.innerHTML = items.map((item, i) => {
    const isActive = item.url === confirmedUrl;
    const icon = iconFor(item);
    const art = item.art
      ? `<img data-src="${escapeHtml(item.art)}" alt="" style="width:100%;height:100%;object-fit:cover">`
      : `<span style="font-size:18px">${icon}</span>`;
    const subtitle = item._src === 'custom'
      ? (item.type === 'record' ? 'Vocal enregistré' : 'Fichier importé')
      : item._src === 'recent' ? 'Utilisé récemment'
      : (item.artist || 'Favori');
    return `<div class="music-track-item${isActive ? ' music-track-item--active' : ''}"
      data-url="${escapeHtml(item.url)}" data-title="${escapeHtml(item.title||'Son')}"
      data-artist="${escapeHtml(item.artist||'')}" data-idx="fv${i}"
      onclick="_useChipSound('${escapeHtml(item.url)}','${escapeHtml(item.title||'Son')}')">
      <div class="music-track-art">${art}</div>
      <div style="flex:1;overflow:hidden;min-width:0">
        <div class="music-track-title">${escapeHtml(item.title||'Son')}</div>
        <div class="music-track-artist">${escapeHtml(subtitle)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
        ${isActive ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
        ${item._src === 'favs' ? `<span data-fav-url="${escapeHtml(item.url)}" onclick="event.stopPropagation();_toggleFavorite('${escapeHtml(item.url)}','${escapeHtml(item.title||'')}','${escapeHtml(item.artist||'')}','${escapeHtml(item.art||'')}',0)" style="font-size:16px;cursor:pointer;color:var(--gold)">★</span>` : ''}
      </div>
    </div>`;
  }).join('');
  observeLazy(list);
}

function _useChipSound(url, title) {
  _useCustomAudio(url, title);
}

// ── Helper commun : confirmer un son custom ───────────────────
function _useCustomAudio(url, title) {
  if (_musicPickerTarget === 'post') {
    _postMusicUrl   = url;
    _postMusicTitle = title;
    _postMusicStart = 0;
    _postMusicEnd   = null;
    const btn  = document.getElementById('post-music-btn');
    const icon = document.getElementById('post-music-icon');
    if (btn)  btn.style.borderColor = 'var(--gold)';
    if (icon) icon.setAttribute('stroke', 'var(--gold)');
    const pr = document.getElementById('p3-music-row');
    const pn = document.getElementById('p3-music-name');
    if (pr && pn) { pr.style.display = 'flex'; pn.textContent = title; }
  } else {
    _scMusicUrl   = url;
    _scMusicTitle = title;
    _scMusicStart = 0;
    const label = document.getElementById('story-music-label');
    const clear = document.getElementById('story-music-clear');
    const btn   = document.getElementById('story-music-btn');
    if (label) { label.textContent = '🎙 ' + title; label.style.color = 'var(--gold)'; }
    if (clear) clear.style.display = 'block';
    if (btn)   btn.style.borderColor = 'var(--gold)';
  }
  closeMusicPicker();
}

// ─────────────────────────────────────────────────────────────
// ENREGISTREMENT VOCAL (MediaRecorder)
// ─────────────────────────────────────────────────────────────
let _mediaRecorder  = null;
let _recChunks      = [];
let _recTimer       = null;
let _recSeconds     = 0;
let _recBlob        = null;
let _recAudioCtx    = null;
let _recWaveFrame   = null;
let _recState       = 'idle'; // 'idle' | 'recording' | 'done'

function _toggleRecording() {
  if (_recState === 'recording') _stopRecording();
  else if (_recState === 'idle')  _startRecording();
}

async function _startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    _recChunks  = [];
    _recSeconds = 0;
    _recState   = 'recording';

    // Choix du mimeType supporté
    const mime = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg','audio/mp4']
      .find(m => MediaRecorder.isTypeSupported(m)) || '';
    _mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    _mediaRecorder.ondataavailable = e => { if (e.data.size > 0) _recChunks.push(e.data); };
    _mediaRecorder.onstop = _onRecordingStop;
    _mediaRecorder.start(200);

    // UI
    const btn    = document.getElementById('mrec-btn');
    const status = document.getElementById('mrec-status');
    const timer  = document.getElementById('mrec-timer');
    const acts   = document.getElementById('mrec-actions');
    if (btn)    btn.classList.add('mrec-btn--active');
    if (btn)    btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(255,90,90,.95)" stroke="none"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>`;
    if (status) status.textContent = 'Enregistrement… (max 2 min)';
    if (acts)   acts.style.display = 'none';
    if (timer)  timer.textContent  = '0:00';

    // Timer 1s
    _recTimer = setInterval(() => {
      _recSeconds++;
      const m = Math.floor(_recSeconds / 60);
      const s = _recSeconds % 60;
      if (timer) timer.textContent = `${m}:${s.toString().padStart(2,'0')}`;
      if (_recSeconds >= 120) _stopRecording(); // limit 2 min
    }, 1000);

    // Waveform
    _startWaveform(stream);

  } catch(e) {
    _recState = 'idle';
    const msg = e.name === 'NotAllowedError'
      ? 'Autorise l\'accès au microphone dans les réglages'
      : 'Microphone indisponible';
    toast(msg, 3200, { type: 'error' });
  }
}

function _stopRecording() {
  clearInterval(_recTimer);
  if (_mediaRecorder && _mediaRecorder.state !== 'inactive') {
    _mediaRecorder.stop();
    _mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }
  _stopWaveform();
  const btn    = document.getElementById('mrec-btn');
  const status = document.getElementById('mrec-status');
  if (btn)    { btn.classList.remove('mrec-btn--active'); btn.innerHTML = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgba(255,100,100,0.9)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8"/></svg>`; }
  if (status) status.textContent = 'Traitement…';
  _recState = 'done';
}

function _onRecordingStop() {
  const mimeType = _mediaRecorder?.mimeType || 'audio/webm';
  _recBlob = new Blob(_recChunks, { type: mimeType });
  const url = URL.createObjectURL(_recBlob);
  const preview = document.getElementById('mrec-preview');
  const acts    = document.getElementById('mrec-actions');
  const status  = document.getElementById('mrec-status');
  const useBtn  = document.getElementById('mrec-use-btn');
  if (preview) preview.src = url;
  if (acts)    acts.style.display = 'flex';
  if (status)  status.textContent = 'Écoute et valide ton vocal';
  if (useBtn)  { useBtn.textContent = 'UTILISER CE VOCAL'; useBtn.disabled = false; }
}

function _resetRecording() {
  _recState   = 'idle';
  _recBlob    = null;
  _recSeconds = 0;
  const timer   = document.getElementById('mrec-timer');
  const status  = document.getElementById('mrec-status');
  const acts    = document.getElementById('mrec-actions');
  const preview = document.getElementById('mrec-preview');
  if (timer)   timer.textContent   = '0:00';
  if (status)  status.textContent  = 'Appuie pour enregistrer';
  if (acts)    acts.style.display  = 'none';
  if (preview) preview.src         = '';
  // Remet l'icône micro
  const btn = document.getElementById('mrec-btn');
  if (btn) btn.innerHTML = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgba(255,100,100,0.9)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8"/></svg>`;
}

async function _useRecording() {
  if (!_recBlob || !me) return;
  const useBtn = document.getElementById('mrec-use-btn');
  if (useBtn) { useBtn.textContent = 'Envoi…'; useBtn.disabled = true; }
  try {
    const ext  = _recBlob.type.includes('ogg') ? 'ogg' : _recBlob.type.includes('mp4') ? 'm4a' : 'webm';
    const path = `sounds/${me.id}_${Date.now()}.${ext}`;
    const { error } = await sb.storage.from('posts').upload(path, _recBlob, { contentType: _recBlob.type });
    if (error) throw error;
    const { data: { publicUrl } } = sb.storage.from('posts').getPublicUrl(path);
    _saveCustomSound(publicUrl, 'Mon vocal', 'record');
    _useCustomAudio(publicUrl, 'Mon vocal 🎙');
    toast('Vocal ajouté ✓', 2000, { type: 'success' });
    _resetRecording();
  } catch(e) {
    toast('Erreur upload — réessaie', 2600, { type: 'error' });
    if (useBtn) { useBtn.textContent = 'UTILISER CE VOCAL'; useBtn.disabled = false; }
  }
}

// ── Visualiseur waveform (canvas) ─────────────────────────────
function _startWaveform(stream) {
  const canvas = document.getElementById('mrec-wave');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  try {
    _recAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = _recAudioCtx.createAnalyser();
    analyser.fftSize = 128;
    const source = _recAudioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    const bufLen  = analyser.frequencyBinCount;
    const dataArr = new Uint8Array(bufLen);
    const W = canvas.width, H = canvas.height;
    const barW = W / bufLen * 2;

    function draw() {
      _recWaveFrame = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArr);
      ctx.clearRect(0, 0, W, H);
      let x = 0;
      for (let i = 0; i < bufLen; i++) {
        const v = dataArr[i] / 255;
        const h = Math.max(3, v * H);
        const alpha = 0.25 + v * 0.75;
        ctx.fillStyle = `rgba(212,182,105,${alpha})`;
        const y = (H - h) / 2;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, barW - 1, h, 2) : ctx.rect(x, y, barW - 1, h);
        ctx.fill();
        x += barW;
      }
    }
    draw();
  } catch(e) { /* AudioContext unavailable — no visualizer */ }
}

function _stopWaveform() {
  if (_recWaveFrame) { cancelAnimationFrame(_recWaveFrame); _recWaveFrame = null; }
  if (_recAudioCtx)  { _recAudioCtx.close().catch(()=>{}); _recAudioCtx = null; }
  const canvas = document.getElementById('mrec-wave');
  if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
}

// ─────────────────────────────────────────────────────────────
// IMPORT FICHIER AUDIO
// ─────────────────────────────────────────────────────────────
let _uploadedAudioFile = null;

function _handleAudioUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const maxMB = 15;
  if (file.size > maxMB * 1024 * 1024) {
    toast(`Fichier trop lourd (max ${maxMB} Mo)`, 3000, { type: 'error' });
    input.value = '';
    return;
  }
  _uploadedAudioFile = file;
  const url      = URL.createObjectURL(file);
  const audio    = document.getElementById('music-upload-audio');
  const wrap     = document.getElementById('music-upload-preview-wrap');
  const nameEl   = document.getElementById('music-upload-filename');
  const uploadBtn = document.getElementById('music-upload-btn');
  if (audio)    audio.src     = url;
  if (nameEl)   nameEl.textContent = '♪ ' + file.name.replace(/\.[^.]+$/, '');
  if (uploadBtn){ uploadBtn.textContent = 'UTILISER CE SON'; uploadBtn.disabled = false; }
  if (wrap)     wrap.style.display = 'flex';
}

async function _confirmAudioUpload() {
  if (!_uploadedAudioFile || !me) return;
  const btn = document.getElementById('music-upload-btn');
  if (btn) { btn.textContent = 'Envoi…'; btn.disabled = true; }
  try {
    const ext  = _uploadedAudioFile.name.split('.').pop().toLowerCase();
    const path = `sounds/${me.id}_${Date.now()}.${ext}`;
    const { error } = await sb.storage.from('posts').upload(path, _uploadedAudioFile, { contentType: _uploadedAudioFile.type });
    if (error) throw error;
    const { data: { publicUrl } } = sb.storage.from('posts').getPublicUrl(path);
    const title = _uploadedAudioFile.name.replace(/\.[^.]+$/, '');
    _saveCustomSound(publicUrl, title, 'upload');
    _useCustomAudio(publicUrl, title);
    toast('Son ajouté ✓', 2000, { type: 'success' });
    // Reset
    _uploadedAudioFile = null;
    const wrap = document.getElementById('music-upload-preview-wrap');
    if (wrap) wrap.style.display = 'none';
    const inp = document.getElementById('music-file-input');
    if (inp) inp.value = '';
  } catch(e) {
    toast('Erreur upload — réessaie', 2600, { type: 'error' });
    if (btn) { btn.textContent = 'UTILISER CE SON'; btn.disabled = false; }
  }
}
