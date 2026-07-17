// RECHERCHE GLOBALE
// ═══════════════════════════════════════════
let srchCurrentTab = 'all';
let srchDebounceTimer = null;

function openSearch() {
  goS('sc-search');
  const input = document.getElementById('srch-input');
  input.value = '';
  document.getElementById('srch-clear').style.display = 'none';
  srchCurrentTab = 'all';
  document.querySelectorAll('#srch-tabs-bar .srch-chip').forEach((c,i) => c.classList.toggle('active', i===0));
  const res = document.getElementById('srch-results');
  res.classList.add('mode-all');
  res.classList.remove('all-empty');
  // Show explore state (no active search)
  res.style.display = 'none';
  document.getElementById('exp-grid').style.display = 'grid';
  const cc = document.getElementById('country-chips');
  if (cc) cc.style.display = 'flex';
  _bsSelected.clear();
  initMixedChips();
  updatePlusBtn();
  const trendSection = document.querySelector('#sc-search .exp-section-title');
  const trendChips = document.querySelector('#sc-search .exp-section-title + div');
  if (trendSection) trendSection.style.display = 'block';
  if (trendChips) trendChips.style.display = 'flex';
  loadExplore();
  setTimeout(() => input.focus(), 300);
}

function closeSearch(){
  const sc=document.getElementById('sc-search');
  if(!sc)return;
  sc.style.transition='transform .25s cubic-bezier(0.23,1,0.32,1)';
  sc.style.transform='translateX(100%)';
  setTimeout(()=>{
    sc.style.transform='';
    sc.style.transition='';
    goS('sc-feed');
  },250);
}

// ── Swipe bord gauche → fermer la recherche ──
// Géré désormais par le handler « retour » unifié dans nav.js (initEdgeSwipeBack),
// commun à tous les écrans plein écran. closeSearch() reste la fonction de fermeture.

function srchQuick(q){ const inp=document.getElementById('srch-input'); if(inp){inp.value=q;doSearchGlobal(q);} }

const _srchFilters={
  pays:[
    {l:'Tout',v:''},
    {l:'🇫🇷 France',v:'France'},{l:'🇯🇵 Japon',v:'Japan'},{l:'🇺🇸 USA',v:'USA'},
    {l:'🇮🇹 Italie',v:'Italy'},{l:'🇰🇷 Corée',v:'South Korea'},{l:'🇲🇦 Maroc',v:'Morocco'},
    {l:'🇬🇧 UK',v:'UK'},{l:'🇩🇪 Allemagne',v:'Germany'},{l:'🇪🇸 Espagne',v:'Spain'}
  ],
  style:[
    {l:'Tout',v:''},
    {l:'Minimaliste',v:'minimaliste'},{l:'Streetwear',v:'streetwear'},
    {l:'Vintage',v:'vintage'},{l:'Casual',v:'casual'},
    {l:'Luxe',v:'luxe'},{l:'Éco',v:'eco'},{l:'Smart',v:'smart'},
    {l:'Coloré',v:'coloré'}
  ],
  occasion:[
    {l:'Tout',v:''},
    {l:'Date',v:'date'},{l:'Travail',v:'travail'},
    {l:'Plage',v:'plage'},{l:'Soirée',v:'soirée'},
    {l:'Sport',v:'sport'},{l:'Weekend',v:'weekend'},
    {l:'Voyage',v:'voyage'},{l:'Cérémonie',v:'cérémonie'}
  ]
};
let _srchFcatCurrent='pays';
function srchFcat(el,cat){
  // Called programmatically to switch filter category
  _srchFcatCurrent=cat;
  const chips=document.getElementById('country-chips');
  if(!chips)return;
  const filters=_srchFilters[cat]||_srchFilters.pays;
  chips.innerHTML=filters.map((f,i)=>
    `<div class="chip${i===0?' active':''}" onclick="countrySel(this,'${f.v}')">${trFilter(f.l)}</div>`
  ).join('');
  countrySel(chips.querySelector('.chip.active'),'');
}

function clearSearch() {
  const input = document.getElementById('srch-input');
  input.value = '';
  document.getElementById('srch-clear').style.display = 'none';
  // Restore explore state
  document.getElementById('srch-results').style.display = 'none';
  document.getElementById('exp-grid').style.display = 'grid';
  const cc = document.getElementById('country-chips');
  if (cc) cc.style.display = 'flex';
  const trendSection = document.querySelector('#sc-search .exp-section-title');
  const trendChips = document.querySelector('#sc-search .exp-section-title + div');
  if (trendSection) trendSection.style.display = 'block';
  if (trendChips) trendChips.style.display = 'flex';
  _bsSelected.clear();
  initMixedChips();
  updatePlusBtn();
  loadExplore();
  input.focus();
}

function srchTabSelect(el, tab) {
  srchCurrentTab = tab;
  document.querySelectorAll('#srch-tabs-bar .srch-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  ['posts','people','boutiques','hashtags'].forEach(p => {
    document.getElementById(`srch-results-${p}`).style.display = (tab==='all' || p===tab) ? 'block' : 'none';
  });
  const res = document.getElementById('srch-results');
  res.classList.toggle('mode-all', tab === 'all');
  res.classList.remove('all-empty');
  const q = document.getElementById('srch-input').value.trim();
  if (q.length > 0) doSearchGlobal(q); else loadSearchDefault();
}

function srchUpdateCombinedEmpty() {
  const res = document.getElementById('srch-results');
  const chips = document.querySelectorAll('#srch-tabs-bar .srch-chip');
  if (srchCurrentTab !== 'all') {
    res.classList.remove('all-empty');
    chips.forEach(c => c.classList.remove('disabled'));
    return;
  }
  const allEmpty = ['posts','people','hashtags','boutiques'].every(p => {
    return document.querySelector(`#srch-results-${p} .srch-empty`);
  });
  res.classList.toggle('all-empty', allEmpty);
  chips.forEach(c => {
    if (c.classList.contains('active')) { c.classList.remove('disabled'); return; }
    c.classList.toggle('disabled', allEmpty);
  });
  const q = document.getElementById('srch-input').value.trim();
  const qEl = document.getElementById('srch-combined-q');
  if (qEl) qEl.textContent = '"' + q + '"';
}

function doSearchGlobal(q) {
  document.getElementById('srch-clear').style.display = q.length > 0 ? 'block' : 'none';
  const hasQuery = q.length > 0;
  // Toggle explore vs results sections
  document.getElementById('srch-results').style.display = hasQuery ? 'block' : 'none';
  document.getElementById('exp-grid').style.display = hasQuery ? 'none' : 'block';
  const tabsBar = document.getElementById('srch-tabs-bar');
  if (tabsBar) tabsBar.style.display = hasQuery ? 'block' : 'none';
  const filterRow = document.querySelector('.srch-filter-row');
  if (filterRow) filterRow.style.display = hasQuery ? 'none' : 'flex';
  const cc = document.getElementById('country-chips');
  if (cc) cc.style.display = hasQuery ? 'none' : 'flex';
  const trendSection = document.querySelector('#sc-search .exp-section-title');
  const trendChips = document.querySelector('#sc-search .exp-section-title + div');
  if (trendSection) trendSection.style.display = hasQuery ? 'none' : 'block';
  if (trendChips) trendChips.style.display = hasQuery ? 'none' : 'flex';
  clearTimeout(srchDebounceTimer);
  srchDebounceTimer = setTimeout(() => {
    if (q.length === 0) { loadSearchDefault(); return; }
    if (q.length < 2) return;
    if (srchCurrentTab === 'all') {
      Promise.all([searchPosts(q), searchPeople(q), searchBoutiques(q), searchHashtags(q)]).then(()=>srchUpdateCombinedEmpty());
    } else {
      switch(srchCurrentTab) {
        case 'posts':     searchPosts(q);     break;
        case 'people':    searchPeople(q);    break;
        case 'boutiques': searchBoutiques(q); break;
        case 'hashtags':  searchHashtags(q);  break;
      }
    }
  }, 300);
}

function doSearch(v){ if(v.length>2)loadExplore(v,''); else if(!v)loadExplore(); }

async function loadSearchDefault() {
  if (srchCurrentTab === 'all') {
    loadDefaultPosts(); loadDefaultPeople(); loadDefaultBoutiques(); loadDefaultHashtags();
    return;
  }
  switch(srchCurrentTab) {
    case 'posts':     loadDefaultPosts();     break;
    case 'people':    loadDefaultPeople();    break;
    case 'boutiques': loadDefaultBoutiques(); break;
    case 'hashtags':  loadDefaultHashtags();  break;
  }
}

// ── STYLES / POSTS ──
async function loadDefaultPosts() {
  const el = document.getElementById('srch-results-posts');
  el.innerHTML = `<div class="srch-section-title">${t('trending')}</div><div class="srch-post-grid" id="srch-post-grid-inner"></div>`;
  const grid = document.getElementById('srch-post-grid-inner');
  if (!dbOk) { grid.innerHTML = demoPostGrid(); return; }
  const {data} = await sb.from('posts').select('id,image_url,likes_count,user_id').eq('hidden',false).order('likes_count',{ascending:false}).limit(12);
  if (!data?.length) { grid.innerHTML = demoPostGrid(); return; }
  grid.innerHTML = data.map(p => postGridItem(p)).join('');
}

async function searchPosts(q) {
  const el = document.getElementById('srch-results-posts');
  el.innerHTML = `<div class="srch-section-title">${t('results_for')} "${escapeHtml(q)}"</div><div class="loader" style="margin:40px auto"></div>`;
  if (!dbOk) { setTimeout(()=>{ el.innerHTML=`<div class="srch-section-title">${t('results_for')} "${escapeHtml(q)}"</div><div class="srch-post-grid">${demoPostGrid()}</div>`; },500); return; }
  const {data} = await sb.from('posts').select('id,image_url,likes_count,caption,tags,user_id').eq('hidden',false).or(`caption.ilike.%${q}%`).order('likes_count',{ascending:false}).limit(18);
  if (!data?.length) { el.innerHTML=`<div class="srch-empty">${t('no_styles_found')}<br><strong class="c-gold">"${escapeHtml(q)}"</strong></div>`; return; }
  el.innerHTML = `<div class="srch-section-title">${data.length} ${data.length>1?t('srch_results'):t('srch_result')}</div><div class="srch-post-grid">${data.map(p=>postGridItem(p)).join('')}</div>`;
}

function postGridItem(p) {
  const bgs=['bg-1','bg-2','bg-3','bg-4','bg-5','bg-6','bg-7','bg-8','bg-9'];
  const ems=['👗','🧥','👠','👜','🎩','🌿','💎','🧣','🌸'];
  const i=Math.floor(Math.random()*9);
  const img = p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="" loading="lazy">` : `<span style="font-size:36px">${ems[i]}</span>`;
  return `<div class="srch-post-item ${!p.image_url?bgs[i]:''}" onclick="openPostView('${p.id}')">${img}</div>`;
}

function demoPostGrid() {
  const bgs=['bg-1','bg-2','bg-3','bg-4','bg-5','bg-6','bg-7','bg-8','bg-9','bg-1','bg-3','bg-6'];
  const ems=['👗','🧥','👠','👜','🎩','🌿','💎','🧣','🌸','👗','🧥','👠'];
  return bgs.map((bg,i)=>`<div class="srch-post-item ${bg}" onclick="goTab('feed')"><span style="font-size:36px">${ems[i]}</span></div>`).join('');
}

// ── PERSONNES ──
async function loadDefaultPeople() {
  const el = document.getElementById('srch-results-people');
  el.innerHTML = `<div class="srch-section-title">${t('popular_accounts')}</div><div class="loader" style="margin:40px auto"></div>`;
  if (!dbOk) { el.innerHTML=`<div class="srch-section-title">${t('popular_accounts')}</div>${demoPeople()}`; return; }
  const {data} = await sb.from('profiles').select('id,username,full_name,avatar_url,bio').limit(10);
  if (!data?.length) { el.innerHTML=`<div class="srch-section-title">${t('popular_accounts')}</div>${demoPeople()}`; return; }
  el.innerHTML = `<div class="srch-section-title">${t('popular_accounts')}</div>` + data.map(p=>personItem(p)).join('');
}

async function searchPeople(q) {
  const el = document.getElementById('srch-results-people');
  el.innerHTML = `<div class="srch-section-title">${t('srch_people_title')}</div><div class="loader" style="margin:40px auto"></div>`;
  if (!dbOk) { el.innerHTML=`<div class="srch-section-title">${t('srch_people_title')}</div>${demoPeople()}`; return; }
  const {data} = await sb.from('profiles').select('id,username,full_name,avatar_url,bio').or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).limit(15);
  if (!data?.length) { el.innerHTML=`<div class="srch-empty">${t('no_people_found')}<br><strong class="c-gold">"${escapeHtml(q)}"</strong></div>`; return; }
  el.innerHTML = `<div class="srch-section-title">${data.length} ${data.length>1?t('srch_comptes'):t('srch_compte')}</div>` + data.map(p=>personItem(p)).join('');
}

function personItem(p) {
  const av = p.avatar_url ? `<img src="${escapeHtml(p.avatar_url)}" alt="">` : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.4)" stroke-width="1.5" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  return `<div class="srch-person-item" onclick="openUserProfile('${p.id}')">
    <div class="srch-person-av">${av}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:500;color:var(--white);margin-bottom:2px">${escapeHtml(p.full_name||p.username||'User')}</div>
      <div style="font-size:12px;color:var(--gold)">${escapeHtml(p.username||'user')}</div>
      ${p.bio?`<div style="font-size:12px;color:var(--wd);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(p.bio)}</div>`:''}
    </div>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(245,240,232,.3)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
  </div>`;
}

function demoPeople() {
  return [{id:'d1',username:'sofia.looks',full_name:'Sofia Laurent',bio:'Fashion. Ethics. Style. 🌿'},
    {id:'d2',username:'miamode',full_name:'Mia Dubois',bio:'Sustainable fashion lover 🌱'},
    {id:'d3',username:'auralooks',full_name:'Aura Studio',bio:'Curating ethical looks ✨'},
    {id:'d4',username:'styledarc',full_name:'Darc Style',bio:'Minimal. Intentional. 🖤'},
    {id:'d5',username:'earthwear',full_name:'Earth Wear',bio:'Conscious clothing 🌍'},
  ].map(p=>personItem(p)).join('');
}

// ── BOUTIQUES ──
async function loadDefaultBoutiques() {
  document.getElementById('srch-results-boutiques').innerHTML =
    `<div class="srch-section-title">${t('partner_brands')}</div>` + defaultBoutiques();
}

async function searchBoutiques(q) {
  const el = document.getElementById('srch-results-boutiques');
  el.innerHTML = `<div class="srch-section-title">${t('srch_boutiques_title')}</div><div class="loader" style="margin:40px auto"></div>`;
  try {
    const safeQ = q.replace(/"/g,'').replace(/\\/g,'').slice(0,50);
    const formula = `AND({actif}=1,OR(SEARCH(LOWER("${safeQ}"),LOWER({marque})),SEARCH(LOWER("${safeQ}"),LOWER({nom}))))`;
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=10&fields[]=marque&fields[]=url_affilie&fields[]=score_eco&fields[]=label_certif&fields[]=categorie_alt&fields[]=emoji`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_KEY}` } });
    const data = await res.json();
    if (!data.records?.length) { el.innerHTML=`<div class="srch-empty">${t('no_boutiques_found')}<br><strong class="c-gold">"${escapeHtml(q)}"</strong></div>`; return; }
    const seen=new Set();
    const marques=data.records.filter(r=>{ const m=r.fields.marque; if(seen.has(m))return false; seen.add(m); return true; }).map(r=>r.fields);
    el.innerHTML=`<div class="srch-section-title">${marques.length} ${marques.length>1?t('srch_boutiques_pl'):t('srch_boutique')}</div>`+marques.map(m=>boutiqueItem(m)).join('');
  } catch(e) {
    el.innerHTML=`<div class="srch-section-title">${t('srch_boutiques_title')}</div>`+defaultBoutiques();
  }
}

function boutiqueItem(m) {
  const badge = m.categorie_alt==='ethique'
    ? `<span style="font-size:11px;background:rgba(80,180,80,.15);color:#7dc97d;border:1px solid rgba(80,180,80,.3);padding:2px 8px;border-radius:10px">${escapeHtml(m.label_certif||t('bq_ethique_badge'))}</span>`
    : `<span style="font-size:11px;background:var(--gold-dim);color:var(--gold-l);border:1px solid var(--gold-b);padding:2px 8px;border-radius:10px">${t('bq_sm_badge')}</span>`;
  return `<div class="srch-boutique-item" onclick="window.open('${safeUrl(m.url_affilie)}','_blank')">
    <div style="width:44px;height:44px;border-radius:10px;background:var(--black-2);border:1px solid var(--gold-b);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.4)" stroke-width="1.5" stroke-linecap="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg></div>
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:500;color:var(--white);margin-bottom:4px">${escapeHtml(m.marque||'')}</div>
      ${badge}
    </div>
    <div style="display:inline-flex;gap:2px">${Array.from({length:5},(_,i)=>`<span style="color:var(--gold);opacity:${i<(m.score_eco||3)?.85:.2}"><svg width="7" height="7" viewBox="0 0 7 7"><circle cx="3.5" cy="3.5" r="3" fill="currentColor"/></svg></span>`).join('')}</div>
  </div>`;
}

function defaultBoutiques() {
  return [{marque:'Veja',emoji:'👟',categorie_alt:'ethique',label_certif:'GOTS',score_eco:5,url_affilie:'https://www.veja-store.com'},
    {marque:'Patagonia',emoji:'🧥',categorie_alt:'ethique',label_certif:'Fair Trade',score_eco:5,url_affilie:'https://www.patagonia.com/fr'},
    {marque:'Armedangels',emoji:'🌿',categorie_alt:'ethique',label_certif:'GOTS',score_eco:5,url_affilie:'https://www.armedangels.com/fr'},
    {marque:'Vestiaire Collective',emoji:'💎',categorie_alt:'seconde_main',label_certif:'',score_eco:5,url_affilie:'https://www.vestiairecollective.com'},
    {marque:'Vinted',emoji:'🌿',categorie_alt:'seconde_main',label_certif:'',score_eco:5,url_affilie:'https://www.vinted.fr'},
    {marque:'Rouje',emoji:'👗',categorie_alt:'ethique',label_certif:'',score_eco:4,url_affilie:'https://www.rouje.com'},
    {marque:'Thinking Mu',emoji:'🧥',categorie_alt:'ethique',label_certif:'GOTS',score_eco:5,url_affilie:'https://www.thinkingmu.com'},
    {marque:'Nudie Jeans',emoji:'👖',categorie_alt:'ethique',label_certif:'Fair Trade',score_eco:5,url_affilie:'https://www.nudiejeans.com/fr'},
  ].map(m=>boutiqueItem(m)).join('');
}

// ── HASHTAGS ──
async function loadDefaultHashtags() {
  document.getElementById('srch-results-hashtags').innerHTML =
    `<div class="srch-section-title">${t('trending')}</div>` + renderHashtags(defaultHashtags());
}

async function searchHashtags(q) {
  const el = document.getElementById('srch-results-hashtags');
  const cleanQ = q.replace('#','').toLowerCase();
  el.innerHTML = `<div class="srch-section-title">${t('srch_tags_title')}</div><div class="loader" style="margin:40px auto"></div>`;
  if (!dbOk) {
    el.innerHTML=`<div class="srch-section-title">${t('srch_tags_title')}</div>`+renderHashtags(defaultHashtags().filter(h=>h.includes(cleanQ)));
    return;
  }
  const {data} = await sb.from('posts').select('tags,caption').ilike('caption',`%#${cleanQ}%`).limit(50);
  const tagCounts={};
  data?.forEach(p=>{
    const matches=(p.caption||'').match(/#\w+/g)||[];
    matches.forEach(tag=>{ const tt=tag.toLowerCase(); if(tt.includes(cleanQ))tagCounts[tt]=(tagCounts[tt]||0)+1; });
  });
  const tags=Object.keys(tagCounts).sort((a,b)=>tagCounts[b]-tagCounts[a]);
  if (!tags.length) {
    const filtered=defaultHashtags().filter(h=>h.includes(cleanQ));
    if (!filtered.length) { el.innerHTML=`<div class="srch-empty">${t('no_tags_found')}<br><strong class="c-gold">"#${escapeHtml(cleanQ)}"</strong></div>`; return; }
    el.innerHTML=`<div class="srch-section-title">${t('tags_suggested')}</div>`+renderHashtags(filtered);
    return;
  }
  el.innerHTML=`<div class="srch-section-title">${tags.length} tag${tags.length>1?'s':''}</div>`+renderHashtags(tags);
}

function renderHashtags(tags) {
  if (!tags.length) return `<div class="srch-empty">${t('no_results')}</div>`;
  return `<div style="display:flex;flex-wrap:wrap;padding:8px 0">`+
    tags.map(tag=>`<div class="srch-hashtag-item" onclick="searchByHashtag('${tag}')">
      <span style="color:var(--gold);font-weight:600">#</span>
      <span style="font-size:13px;color:var(--white)">${tag.replace('#','')}</span>
    </div>`).join('')+`</div>`;
}

function defaultHashtags() {
  return ['#minimal','#ethical','#vintage','#streetwear','#secondhand','#sustainable',
    '#chic','#boheme','#luxe','#ootd','#slowfashion','#upcycled','#wearaura',
    '#veja','#patagonia','#armedangels','#sezane','#rouje'];
}

function searchByHashtag(tag) {
  const input=document.getElementById('srch-input');
  input.value=tag;
  document.getElementById('srch-clear').style.display='block';
  srchTabSelect(document.querySelectorAll('.srch-tab')[0],'posts');
  searchPosts(tag.replace('#',''));
}

function feedCountrySel(el,country){
  document.querySelectorAll('#feed-country-chips .chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  loadFeedExplorerGrid('',country);
}

async function loadFeedExplorerGrid(tag='',country=''){
  const grid=document.getElementById('feed-exp-grid');
  grid.innerHTML='<div class="loader" style="grid-column:1/-1;margin:40px auto"></div>';
  if(!dbOk){grid.innerHTML=demoExpGrid();return;}
  let q=sb.from('posts').select('id,image_url,caption,likes_count,city,country,profiles:user_id(username)').eq('hidden',false).order('created_at',{ascending:false}).limit(20);
  if(country)q=q.ilike('country','%'+country+'%');
  else if(tag)q=q.ilike('caption','%'+tag+'%');
  const{data}=await q;
  if(!data?.length){grid.innerHTML=demoExpGrid();return;}
  const bgs=['bg-1','bg-2','bg-3','bg-4','bg-5','bg-6','bg-7','bg-8','bg-9'];
  const ems=['👗','🧥','👠','👜','🎩','🌿','💎','🧣','🌸'];
  grid.innerHTML=data.map((p,i)=>{
    const img=p.image_url?`<img data-src="${escapeHtml(p.image_url)}" alt="" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">`:`<div class="exp-placeholder ${bgs[i%9]}">${ems[i%9]}</div>`;
    const flag=p.country?{France:'🇫🇷',Japan:'🇯🇵',USA:'🇺🇸',Italy:'🇮🇹','South Korea':'🇰🇷',Morocco:'🇲🇦',UK:'🇬🇧'}[p.country]||'📍':'📍';
    const user=escapeHtml(p.profiles?.username||'user');
    return `<div class="exp-item" onclick="openPostView('${p.id}')">
      <div class="exp-item-img">${img}</div>
      <div class="exp-item-info">
        ${p.city?`<div class="exp-loc">${flag} <span style="font-size:11px;opacity:.6;text-transform:uppercase;letter-spacing:.5px">${p.country||''}</span> ${escapeHtml(p.city)}</div>`:''}
        <div class="exp-caption">${escapeHtml(p.caption||'')}</div>
        <div class="exp-meta">
          <div class="exp-user-row"><div class="exp-av"><img src="wolf.webp" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"></div><span class="exp-user">${user}</span></div>
          <div class="exp-likes">♡ ${fmtN(p.likes_count||0)}</div>
        </div>
      </div>
    </div>`;
  }).join('');
  observeLazy(grid);
}

function bqFilter(el,type){bqChipSelect(el,type==='ethical'?'ethique':type==='secondhand'?'seconde_main':'');}
function bqChipSelect(el,filter){
  document.querySelectorAll('.bq-seg, .bq-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  moveBqSegSlider(el);
  bqCurrentFilter=filter;
  renderBoutiqueContent(bqAllProducts,filter);
}
function moveBqSegSlider(el){
  const slider=document.getElementById('bq-seg-slider');
  const bar=document.getElementById('bq-seg-bar');
  if(!slider||!bar||!el)return;
  const segments=Array.from(bar.querySelectorAll('.bq-seg'));
  const index=segments.indexOf(el);
  if(index<0)return;
  // 3 segments égaux : padding bar 3px chaque côté + gap 2px entre
  // largeur seg = (100% - 6px padding - 4px gaps) / 3 = (100% - 10px) / 3
  const barW=bar.clientWidth;
  const segW=(barW-10)/3;
  slider.style.transform=`translateX(${3+index*(segW+2)}px)`;
  slider.style.width=segW+'px';
  slider.style.opacity='1';
}

// ═══════════════════════════════════════════
