// BOUTIQUE
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// BOUTIQUE — REDESIGN COMPLET
// ═══════════════════════════════════════════
const _leafSvg='<svg width="9" height="9" viewBox="0 0 9 9" style="display:inline-block;vertical-align:middle"><circle cx="4.5" cy="4.5" r="4" fill="currentColor"/></svg>';
const _clotheSvgFb='<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.2)" stroke-width="1" stroke-linecap="round"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/></svg>';
const _bagSvg='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.35)" stroke-width="1.5" stroke-linecap="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>';
function _ecoLeaves(n){
  const c=Math.min(Math.max(n||0,0),5);
  const on=Array.from({length:c},()=>`<span style="color:var(--gold);opacity:.85;line-height:1">${_leafSvg}</span>`).join('');
  const off=Array.from({length:5-c},()=>`<span style="color:var(--gold-b);opacity:.5;line-height:1">${_leafSvg}</span>`).join('');
  return on+off;
}
function pNom(p){return(typeof currentLang!=='undefined'&&currentLang!=='fr'&&p.name_en)||p.nom||'';}
let bqCurrentFilter='';
let bqAllProducts=[];
let bqCurrentView='pieces';
let bqCurrentSort='eco';
let bqCurrentBrand=null;
function bqViewToggle(el,view){
  document.querySelectorAll('.bq-view-chip').forEach(c=>c.classList.toggle('active',c===el));
  bqCurrentView=view;
  // Clic sur PIÈCES depuis n'importe où → retour à la vue catalogue (sans filtre marque)
  if(view==='pieces'){
    bqCurrentBrand=null;
    document.getElementById('bq-brand-filter').style.display='none';
  }
  document.getElementById('bq-cat-chips').style.display=view==='marques'?'none':'block';
  renderBoutiqueContent(bqAllProducts,bqCurrentFilter);
  if(view==='pieces'){
    setTimeout(()=>{
      const active=document.querySelector('#bq-seg-bar .bq-seg.active');
      if(active)moveBqSegSlider(active);
    },50);
  }
}
function bqFilterByBrandCompat(){} // compat
const BQ_SORT_LABELS={eco:'Top éco',price_asc:'Prix ↑',price_desc:'Prix ↓'};
function bqSortBy(sort){
  bqCurrentSort=sort;
  const lbl=document.getElementById('bq-sort-label');
  if(lbl)lbl.textContent=BQ_SORT_LABELS[sort];
  document.getElementById('bq-sort-menu').style.display='none';
  renderBoutiqueContent(bqAllProducts,bqCurrentFilter);
}
function bqOpenSortMenu(triggerEl){
  const menu=document.getElementById('bq-sort-menu');
  if(menu.style.display==='block'){menu.style.display='none';return;}
  const rect=triggerEl.getBoundingClientRect();
  const parentRect=triggerEl.closest('#sc-boutique').getBoundingClientRect();
  menu.style.top=(rect.bottom-parentRect.top+6)+'px';
  menu.innerHTML=Object.entries(BQ_SORT_LABELS).map(([k,label])=>`
    <div onclick="bqSortBy('${k}')" style="padding:10px 16px;cursor:pointer;font-size:12px;color:${bqCurrentSort===k?'var(--gold)':'var(--white)'};display:flex;align-items:center;gap:8px">
      ${bqCurrentSort===k?'<span style="font-size:11px">✓</span>':'<span style="width:10px"></span>'}
      ${label}
    </div>`).join('');
  menu.style.display='block';
  setTimeout(()=>{
    const close=(e)=>{if(!menu.contains(e.target)&&!triggerEl.contains(e.target)){menu.style.display='none';document.removeEventListener('click',close);}};
    document.addEventListener('click',close);
  },10);
}
function bqFilterByBrand(brand){
  bqCurrentBrand=brand;
  bqCurrentView='marques';
  document.querySelectorAll('.bq-view-chip').forEach(c=>c.classList.toggle('active',c.dataset.view==='marques'));
  document.getElementById('bq-cat-chips').style.display='none';
  document.getElementById('bq-brand-filter').style.display='none';
  renderBoutiqueContent(bqAllProducts,bqCurrentFilter);
}
function bqClearBrandFilter(){
  bqCurrentBrand=null;
  document.getElementById('bq-brand-filter').style.display='none';
  renderBoutiqueContent(bqAllProducts,bqCurrentFilter);
}
function bqBackToBrands(){
  bqCurrentBrand=null;
  bqCurrentView='marques';
  document.getElementById('bq-brand-filter').style.display='none';
  document.querySelectorAll('.bq-view-chip').forEach(c=>c.classList.toggle('active',c.dataset.view==='marques'));
  document.getElementById('bq-cat-chips').style.display='none';
  renderBoutiqueContent(bqAllProducts,bqCurrentFilter);
}
function bqSortProducts(arr){
  const a=[...arr];
  if(bqCurrentSort==='price_asc')a.sort((x,y)=>(x.prix||0)-(y.prix||0));
  else if(bqCurrentSort==='price_desc')a.sort((x,y)=>(y.prix||0)-(x.prix||0));
  else a.sort((x,y)=>(y.score_eco||0)-(x.score_eco||0));
  return a;
}

function refreshBoutique(){
  bqAllProducts=[];
  _bqRegistry.length=0;
  loadBoutique();
}
let _bqSearchTimer=null;
function bqSearch(q){
  const clear=document.getElementById('bq-search-clear');
  if(clear)clear.style.display=q?'block':'none';
  clearTimeout(_bqSearchTimer);
  _bqSearchTimer=setTimeout(()=>_bqApplySearch(q),300);
}
function bqSearchClear(){
  const inp=document.getElementById('bq-search-input');
  if(inp)inp.value='';
  const clear=document.getElementById('bq-search-clear');
  if(clear)clear.style.display='none';
  _bqApplySearch('');
}
function _bqApplySearch(q){
  const content=document.getElementById('bq-content');
  if(!content)return;
  if(!q){renderBoutiqueContent(bqAllProducts,bqCurrentFilter);return;}
  const ql=q.toLowerCase();
  const filtered=(bqAllProducts||[]).filter(p=>
    (p.brand||'').toLowerCase().includes(ql)||
    (p.marque||'').toLowerCase().includes(ql)||
    (p.name||'').toLowerCase().includes(ql)||
    (p.boutique||'').toLowerCase().includes(ql)||
    (p.description||'').toLowerCase().includes(ql)
  );
  renderBoutiqueContent(filtered,'');
}

// Cache pour le catalogue démo
let _demoCatalog=null;
async function loadDemoCatalog(){
  if(_demoCatalog)return _demoCatalog;
  try{
    const res=await fetch('catalog-demo.json');
    const data=await res.json();
    _demoCatalog=data.map(p=>({
      ...p,
      type_precis:p.type_precis||p.type,
      style_tags:typeof p.style_tags==='string'?p.style_tags.split(',').map(s=>s.trim()):(p.style_tags||[]),
      style:p.style_tags||'',
      categorie:p.categorie_alt||'',
      label:p.label_certif||p.label||'',
      _isDemo:true
    }));
    return _demoCatalog;
  }catch(e){console.warn('Demo catalog fetch failed:',e);return [];}
}

async function loadBoutique(){
  attachPullToRefresh(
    document.getElementById('bq-content'),
    loadBoutique,
    document.getElementById('sc-boutique')
  );
  const content=document.getElementById('bq-content');
  if(!content)return;
  content.innerHTML='<div class="loader" style="margin:80px auto"></div>';

  try{
    // Catalogue démo en local (en attendant les vrais partenaires)
    bqAllProducts=await loadDemoCatalog();

    setTimeout(()=>{
      const active=document.querySelector('#bq-seg-bar .bq-seg.active');
      if(active)moveBqSegSlider(active);
    },50);

    renderBoutiqueContent(bqAllProducts,bqCurrentFilter);

  }catch(e){
    console.warn('Boutique Airtable failed:',e.message);
    bqAllProducts=getBoutiqueDemo();
    renderBoutiqueContent(bqAllProducts,bqCurrentFilter);
  }
}

function renderBoutiqueContent(products,filter=''){
  const content=document.getElementById('bq-content');
  if(!content)return;

  // Mise à jour stats header
  const brandsCount=[...new Set(products.map(p=>p.marque).filter(Boolean))].length;
  const statsEl=document.getElementById('bq-stats');
  if(statsEl)statsEl.textContent=`${products.length} ${t('bq_pieces_label')} · ${brandsCount} ${t('bq_brands_label')}`;

  // Page partenaire (a la priorité — peut être déclenchée depuis vue marques)
  if(bqCurrentBrand){
    const brandProducts=bqAllProducts.filter(p=>p.marque===bqCurrentBrand);
    const sorted=bqSortProducts(brandProducts);
    const _avg=arr=>arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):null;
    const _emp=brandProducts.map(p=>empreinteVals(p.matiere)).filter(Boolean);
    const avgEau=_avg(_emp.map(x=>x.eau));
    const avgCo2=_emp.length?Math.round(_emp.reduce((a,b)=>a+b.co2,0)/_emp.length*10)/10:null;

    const certifs=[...new Set(brandProducts.map(p=>p.label).filter(Boolean))].slice(0,3);
    content.innerHTML=`<div style="padding:18px 16px 16px;border-bottom:1px solid var(--gold-b);margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div onclick="bqBackToBrands()" style="color:var(--gold);cursor:pointer;font-size:22px;padding:2px 4px">←</div>
        <div style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:10px;background:rgba(240,234,216,0.06);border:1px solid rgba(240,234,216,0.12);flex-shrink:0">${_bagSvg}</div>
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--fd);font-size:24px;font-weight:300;color:var(--white);line-height:1.1">${escapeHtml(bqCurrentBrand)}</div>
          <div style="font-size:12px;color:var(--wd);letter-spacing:.3px;margin-top:2px;display:flex;align-items:center;gap:6px">${sorted.length} pièce${sorted.length>1?'s':''} ${impactGaugesAbsVals(avgEau,avgCo2)}</div>
        </div>
      </div>
      ${certifs.length?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${certifs.map(c=>`<span class="certif-badge">${escapeHtml(c)}</span>`).join('')}</div>`:''}
    </div>
    <div class="bq-product-grid">${sorted.map(p=>bqProductCard(p)).join('')}</div>`;
    return;
  }

  // Vue Marques
  if(bqCurrentView==='marques'){
    const brandsMap={};
    products.forEach(p=>{
      if(!p.marque)return;
      if(!brandsMap[p.marque])brandsMap[p.marque]={name:p.marque,count:0,wSum:0,wN:0,cSum:0,cN:0};
      const bm=brandsMap[p.marque];
      bm.count++;
      const ev=empreinteVals(p.matiere); if(ev){bm.wSum+=ev.eau;bm.wN++;bm.cSum+=ev.co2;bm.cN++;}
    });
    const brandsList=Object.values(brandsMap).map(b=>({...b,avgW:b.wN?Math.round(b.wSum/b.wN):null,avgC:b.cN?Math.round(b.cSum/b.cN*10)/10:null})).sort((a,b)=>(a.avgW==null?1e9:a.avgW)-(b.avgW==null?1e9:b.avgW)||b.count-a.count);
    if(!brandsList.length){
      content.innerHTML=`<div class="empty-state"><img src="mascote_ivory/the_gatherer.png" alt=""><div>${t('no_products')}</div></div>`;
      return;
    }
    content.innerHTML=`<div class="bq-brand-grid">${brandsList.map(b=>`
      <div class="bq-brand-card" onclick="bqFilterByBrand('${b.name.replace(/'/g,'\\\'')}')">
        <div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:8px;background:rgba(240,234,216,0.06);border:1px solid rgba(240,234,216,0.12);margin:0 auto 6px">${_bagSvg}</div>
        <div style="font-size:13px;font-weight:600;color:var(--white);line-height:1.3">${escapeHtml(b.name)}</div>
        <div style="margin-top:3px">${impactGaugesAbsVals(b.avgW,b.avgC)}</div>
        <div style="font-size:11px;color:var(--wd)">${b.count} pièce${b.count>1?'s':''}</div>
      </div>`).join('')}</div>`;
    return;
  }

  // Vue Pièces — applique filtre catégorie + marque
  let filtered=filter?products.filter(p=>p.categorie===filter):products;
  if(bqCurrentBrand)filtered=filtered.filter(p=>p.marque===bqCurrentBrand);

  if(!filtered.length){
    content.innerHTML=`<div class="empty-state"><img src="mascote_ivory/the_gatherer.png" alt=""><div>${t('no_products')}</div></div>`;
    return;
  }

  const sorted=bqSortProducts(filtered);
  let html='';


  const ethical=filtered.filter(p=>p.categorie==='ethique');
  const secondhand=filtered.filter(p=>p.categorie==='seconde_main');
  const top5=bqSortProducts(filtered).slice(0,8);

  // ── Tendances : uniquement sur le filtre TOUT ──
  if(!filter&&top5.length){
    html+=`<div class="bq-section-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>${t('bq_trending')}</div>
    <div class="bq-carousel">${top5.map(p=>bqCarouselCard(p)).join('')}</div>`;
  }

  // ── Coups de cœur éthiques (uniquement sur filtre ÉTHIQUE) ──
  if(filter==='ethique'&&ethical.length){
    html+=`<div class="bq-section-title bq-section-title--ethical"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>${t('bq_ethical_section')}</div>
    <div class="bq-carousel">${bqSortProducts(ethical).slice(0,8).map(p=>bqCarouselCard(p)).join('')}</div>`;
  }

  // ── Seconde main (uniquement sur filtre SECONDE MAIN) ──
  if(filter==='seconde_main'&&secondhand.length){
    html+=`<div class="bq-section-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>${t('bq_secondhand_section')}</div>
    <div class="bq-carousel">${bqSortProducts(secondhand).slice(0,8).map(p=>bqCarouselCard(p)).join('')}</div>`;
  }

  // ── Tout le catalogue ──
  html+=`<div class="bq-section-title" style="margin-top:18px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>${t('bq_all_catalogue')} · ${sorted.length}</div>
  <div class="bq-all-grid">${sorted.map(p=>bqProductCard(p)).join('')}</div>`;

  content.innerHTML=html||`<div class="empty-state"><img src="mascote_ivory/the_gatherer.png" alt=""><div>${t('no_products')}</div></div>`;
}

// ── Long-press registry ─────────────────────────────────────
const _bqRegistry=[];  // index → product
let _bqLpTimer=null,_bqLpFired=false;
function _bqRegister(p){const i=_bqRegistry.length;_bqRegistry.push(p);return i;}
function _bqTouchStart(idx){
  _bqLpFired=false;
  clearTimeout(_bqLpTimer);
  _bqLpTimer=setTimeout(()=>{
    _bqLpFired=true;
    navigator.vibrate?.(10);
    bqCtxShow(_bqRegistry[idx]);
  },520);
}
function _bqTouchEnd(){clearTimeout(_bqLpTimer);}
function _bqClick(idx){
  if(_bqLpFired){_bqLpFired=false;return;}
  bqOpenProduct(idx);
}
// Ouvre la fiche détail d'un produit boutique : empreinte estimée (absolue) + CTA affilié
function bqOpenProduct(idx){
  const p=_bqRegistry[idx];
  if(!p) return;
  const sh=isSecondHand(p);
  const emp=getEmpreinte(p.matiere);
  const img=p.image_url
    ? `<img src="${p.image_url}" alt="${escapeHtml(pNom(p))}" style="width:100%;height:100%;object-fit:cover;object-position:center top;position:absolute;inset:0" onerror="this.style.display='none'">`
    : '';
  const footprint = sh
    ? `<div style="font-size:13px;color:var(--wd);line-height:1.6">${t('ig_reuse_hint')}</div>`
    : (emp.eau!=null
        ? `${_hgauge(t('emp_eau_lbl'),'~'+emp.eau.toLocaleString('fr-FR')+' L',emp.eau/5000*100,'#5aa9bd')}${emp.co2!=null?_hgauge(t('emp_co2_lbl'),'~'+emp.co2+' kg CO₂',emp.co2/20*100,'#8f7fc0'):''}`
        : `<div style="font-size:13px;color:var(--wd)">${t('matiere_unknown')}</div>`);
  const certifs = p.label?`<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px"><span class="certif-badge">${escapeHtml(p.label)}</span></div>`:'';
  const fbSvg=`<span style="position:absolute;inset:0;display:${p.image_url?'none':'flex'};align-items:center;justify-content:center"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.3)" stroke-width="1.2" stroke-linecap="round"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/></svg></span>`;
  document.getElementById('bq-prod-body').innerHTML=`
    <div style="display:flex;gap:14px;padding:18px 20px 6px;align-items:flex-start">
      <div style="width:84px;height:84px;border-radius:12px;background:var(--black-3);position:relative;overflow:hidden;flex-shrink:0">${img}${fbSvg}</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--fd);font-size:19px;font-weight:400;color:var(--gold);line-height:1.2;margin-bottom:3px">${escapeHtml(pNom(p))}</div>
        <div style="font-size:13px;color:var(--wd)">${escapeHtml(p.marque||'—')}${p._isDemo?` · <span style="opacity:.7">${t('demo_badge')}</span>`:''}</div>
        ${p.prix?`<div style="font-size:18px;color:var(--gold-l);font-weight:500;margin-top:5px">${escapeHtml(String(p.prix))}€</div>`:''}
      </div>
    </div>
    <div style="padding:0 20px 12px">
      ${p.matiere?`<div style="font-size:12px;color:var(--wd);letter-spacing:.5px">${t('matiere_prefix')} : ${escapeHtml(emp.label)}</div>`:''}
      ${certifs}
    </div>
    <div style="margin:0 20px 16px;background:var(--black-3);border-radius:12px;padding:14px 16px;border:1px solid var(--gold-b)">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:10px">${t('empreinte_titre')}</div>
      ${footprint}
      ${(!sh&&emp.info)?`<div style="font-size:12px;color:var(--wd);line-height:1.6;border-top:1px solid rgba(240,234,216,.1);padding-top:8px;margin-top:4px;font-style:italic">${emp.info}</div>`:''}
      <div style="font-size:9px;color:rgba(245,240,232,.3);margin-top:6px;letter-spacing:.5px">${t('donnees_estim')}</div>
    </div>
    <div style="padding:0 20px">
      <div style="margin-bottom:10px"><span style="display:inline-block;font-size:9px;letter-spacing:1px;text-transform:uppercase;background:rgba(240,234,216,0.12);border:1px solid rgba(240,234,216,0.3);color:rgba(240,234,216,0.7);padding:2px 7px;border-radius:4px">${t('lien_affilie')}</span></div>
      <button class="btn" onclick="bqGoToProduct(${idx})">${t('bq_voir_produit')}</button>
    </div>`;
  document.getElementById('overlay').classList.add('show');
  document.getElementById('bq-product-sheet').classList.add('show');
}
function bqGoToProduct(idx){
  const p=_bqRegistry[idx];
  if(p) window.open(safeUrl(p.url),'_blank');
}

function bqCarouselCard(p){
  const idx=_bqRegister(p);
  const imgContent=p.image_url
    ?`<img src="${p.image_url}" alt="${escapeHtml(pNom(p))}" onerror="this.style.display='none';this.parentNode.querySelector('.bq-emoji-fb').style.display='flex'">`:'';
  const gauges=impactGaugesAbs(p);
  const demoBadge=p._isDemo?`<div class="demo-badge">${t('bq_apercu_demo')}</div>`:'';
  const credit=p.image_photographer?`<div class="pexels-credit" title="Photo via Pexels">${escapeHtml(p.image_photographer)}</div>`:'';
  return `<div class="bq-carousel-card"
    onclick="_bqClick(${idx})"
    ontouchstart="_bqTouchStart(${idx})"
    ontouchend="_bqTouchEnd()"
    ontouchcancel="_bqTouchEnd()"
    oncontextmenu="event.preventDefault();_bqTouchStart(${idx})">
    <div class="bq-carousel-img">
      ${imgContent}
      <div class="bq-emoji-fb" style="display:${p.image_url?'none':'flex'};width:100%;height:100%;align-items:center;justify-content:center">${_clotheSvgFb}</div>
      ${demoBadge}
      ${credit}
    </div>
    <div class="bq-carousel-info">
      <div class="bq-carousel-name">${escapeHtml(pNom(p))}</div>
      <div class="bq-carousel-brand">${escapeHtml(p.marque)}</div>
      <div style="margin:6px 0 4px">${gauges}</div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div class="bq-carousel-price">${escapeHtml(String(p.prix))}€</div>
        <div style="font-size:11px;color:var(--wd)">${t('bq_voir')}</div>
      </div>
      <div class="aff-badge">${t('aff_badge')}</div>
    </div>
  </div>`;
}

function bqProductCard(p){
  const idx=_bqRegister(p);
  const imgContent=p.image_url
    ?`<img src="${p.image_url}" alt="${escapeHtml(pNom(p))}" onerror="this.style.display='none';this.parentNode.querySelector('.bq-emoji-fb').style.display='flex'">`:'';
  const demoBadge=p._isDemo?`<div class="demo-badge">${t('bq_apercu_demo')}</div>`:'';
  const credit=p.image_photographer?`<div class="pexels-credit" title="Photo via Pexels">${escapeHtml(p.image_photographer)}</div>`:'';
  return `<div class="bq-product-card"
    onclick="_bqClick(${idx})"
    ontouchstart="_bqTouchStart(${idx})"
    ontouchend="_bqTouchEnd()"
    ontouchcancel="_bqTouchEnd()"
    oncontextmenu="event.preventDefault();_bqTouchStart(${idx})">
    <div class="bq-product-img">
      ${imgContent}
      <div class="bq-emoji-fb" style="display:${p.image_url?'none':'flex'};width:100%;height:100%;align-items:center;justify-content:center">${_clotheSvgFb}</div>
      ${p.label?`<div style="position:absolute;top:8px;right:8px"><span class="certif-badge">${escapeHtml(p.label)}</span></div>`:''}
      ${demoBadge}
      ${credit}
    </div>
    <div class="bq-product-info">
      <div class="bq-product-name">${escapeHtml(pNom(p))}</div>
      <div class="bq-product-brand">${escapeHtml(p.marque)}</div>
      ${p.matiere?`<div style="font-size:11px;color:var(--wd);margin-bottom:4px">${escapeHtml(p.matiere)}</div>`:''}
      <div style="margin-bottom:6px">${impactGaugesAbs(p)}</div>
      <div class="bq-product-footer">
        <div class="bq-product-price">${escapeHtml(String(p.prix))}€</div>
        <div class="bq-product-voir">${t('bq_voir')}</div>
      </div>
      <div class="aff-badge">${t('aff_badge')}</div>
    </div>
  </div>`;
}

function bqSecondhandCard(p){
  const imgContent=p.image_url
    ?`<img src="${p.image_url}" alt="${escapeHtml(pNom(p))}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">`
    :_clotheSvgFb;
  return `<div class="bq-sm-card" onclick="window.open('${safeUrl(p.url)}','_blank')">
    <div class="bq-sm-img">${imgContent}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:500;color:var(--white);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(pNom(p))}</div>
      <div style="font-size:11px;color:var(--gold);margin-bottom:4px">${escapeHtml(p.marque)}</div>
      <div style="font-size:13px;color:var(--gold-l);font-weight:600;margin-bottom:4px">${escapeHtml(String(p.prix))}€</div>
      <div class="aff-badge">${t('aff_badge')}</div>
    </div>
  </div>`;
}

function getBrandEmoji(brand,products){
  const p=products.find(p=>p.marque===brand);
  return p?.emoji||'🛍';
}

function getBoutiqueDemo(){
  return [
    {nom:'Better Sweater Fleece',marque:'Patagonia',type:'pull',matiere:'recyclé',style:'casual',categorie:'ethique',prix:129,url:'https://www.patagonia.com/fr/shop/fleece-jackets',score_eco:5,emoji:'🧥',label:'Fair Trade',image_url:null},
    {nom:'Campo Sneaker',marque:'Veja',type:'sneaker',matiere:'coton bio',style:'casual',categorie:'ethique',prix:120,url:'https://www.veja-store.com/fr/sneakers/campo/',score_eco:5,emoji:'👟',label:'GOTS',image_url:null},
    {nom:'Blazer Coton Bio',marque:'Thinking Mu',type:'blazer',matiere:'coton',style:'chic',categorie:'ethique',prix:195,url:'https://www.thinkingmu.com/collections/blazers',score_eco:5,emoji:'🧥',label:'GOTS',image_url:null},
    {nom:'Pull Laine Mérinos',marque:'Armedangels',type:'pull',matiere:'laine mérinos',style:'minimal',categorie:'ethique',prix:149,url:'https://www.armedangels.com/fr/pulls-sweaters/',score_eco:5,emoji:'🧣',label:'GOTS',image_url:null},
    {nom:'Robe Midi Tencel',marque:'Armedangels',type:'robe',matiere:'tencel',style:'minimal',categorie:'ethique',prix:129,url:'https://www.armedangels.com/fr/robes/',score_eco:5,emoji:'👗',label:'GOTS',image_url:null},
    {nom:'Jean Slim Bio',marque:'Nudie Jeans',type:'jean',matiere:'denim bio',style:'casual',categorie:'ethique',prix:149,url:'https://www.nudiejeans.com/fr/jeans/slim',score_eco:5,emoji:'👖',label:'Fair Trade',image_url:null},
    {nom:'Manteaux occasion',marque:'Vestiaire Collective',type:'manteau',matiere:'laine',style:'chic',categorie:'seconde_main',prix:95,url:'https://www.vestiairecollective.com/women-clothes/coats/',score_eco:5,emoji:'💎',label:'',image_url:null},
    {nom:'Vêtements vintage',marque:'Vinted',type:'vetement',matiere:'mixte',style:'vintage',categorie:'seconde_main',prix:20,url:'https://www.vinted.fr/catalog',score_eco:5,emoji:'🌿',label:'',image_url:null},
  ];
}

// ═══════════════════════════════════════════
// ── Boutique Context Sheet ──────────────────
let _bqCtxProduct=null;
const _bqSavedKeys=new Set(JSON.parse(localStorage.getItem('bq_saved')||'[]'));

function bqCtxShow(p){
  if(!p)return;
  track('product_open',{id:p.id||null,marque:p.marque||null});
  _bqCtxProduct=p;
  const sheet=document.getElementById('bq-ctx-sheet');
  const overlay=document.getElementById('bq-ctx-overlay');
  if(!sheet)return;
  const imgEl=document.getElementById('bq-ctx-img');
  if(imgEl){
    imgEl.innerHTML=p.image_url
      ?`<img src="${p.image_url}" alt="" style="width:100%;height:100%;object-fit:cover">`
      :_clotheSvgFb;
  }
  const nameEl=document.getElementById('bq-ctx-name');
  const brandEl=document.getElementById('bq-ctx-brand');
  const priceEl=document.getElementById('bq-ctx-price');
  if(nameEl) nameEl.textContent=pNom(p)||'';
  if(brandEl) brandEl.textContent=p.marque||'';
  if(priceEl) priceEl.textContent=p.prix?p.prix+'€':'';
  const saveLabel=document.getElementById('bq-ctx-save-label');
  const isSaved=_bqSavedKeys.has(p.url);
  if(saveLabel) saveLabel.textContent=isSaved?t('unsave_wishlist'):t('save_wishlist');
  if(overlay){overlay.style.display='block';}
  sheet.style.display='block';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{sheet.style.transform='translateY(0)';}));
}

function closeBqCtx(){
  const sheet=document.getElementById('bq-ctx-sheet');
  const overlay=document.getElementById('bq-ctx-overlay');
  if(!sheet)return;
  sheet.style.transform='translateY(100%)';
  setTimeout(()=>{sheet.style.display='none';if(overlay)overlay.style.display='none';},280);
  _bqCtxProduct=null;
}

async function bqCtxSave(){
  const p=_bqCtxProduct;if(!p)return;
  const isSaved=_bqSavedKeys.has(p.url);
  if(isSaved){_bqSavedKeys.delete(p.url);toast(t('toast_wishlist_removed'));}
  else{
    _bqSavedKeys.add(p.url);toast(t('toast_wishlist_added'));
    if(me&&dbOk){
      const key='bq::'+p.url;
      sb.from('alternative_feedback').upsert({
        user_id:me.id,alt_key:key,vote:'up',
        alt_name:p.nom,alt_brand:p.marque,alt_url:p.url,
        alt_price:String(p.prix),alt_score_eco:p.score_eco||0,
        alt_image_url:p.image_url||null,alt_type:p.type||null
      }).catch(()=>{});
    }
  }
  localStorage.setItem('bq_saved',JSON.stringify([..._bqSavedKeys]));
  closeBqCtx();
}

function bqCtxSendDm(){
  const p=_bqCtxProduct;if(!p)return;
  closeBqCtx();
  if(navigator.share){
    navigator.share({title:pNom(p),text:`${p.marque} — ${p.prix}€`,url:p.url}).catch(()=>{});
  }else{
    goTab('notif');toast(t('toast_share_via_messages'));
  }
}

function bqCtxCopy(){
  const p=_bqCtxProduct;if(!p)return;
  navigator.clipboard?.writeText(p.url).then(()=>toast(t('link_copied')||t('toast_link_copied'))).catch(()=>toast(t('toast_link_label')+' : '+p.url));
  closeBqCtx();
}

function bqCtxOpen(){
  const p=_bqCtxProduct;if(!p)return;
  track('product_outbound',{id:p.id||null,marque:p.marque||null});
  window.open(safeUrl(p.url),'_blank');
  closeBqCtx();
}
