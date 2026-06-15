// PROFILE
// ═══════════════════════════════════════════
// _leafSvg et _clotheSvgFb définis dans boutique.js (chargé avant)
const _camSvgFb='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.25)" stroke-width="1.5" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>';
const _lockSvgFb='<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.25)" stroke-width="1" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>';
const _heartSvgFb='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.25)" stroke-width="1.5" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>';
const _itemSvg='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.45)" stroke-width="1.8" stroke-linecap="round"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/></svg>';
async function loadProfile(){
  attachPullToRefresh(
    document.querySelector('.prof-scroll'),
    loadProfile,
    document.getElementById('sc-profile')
  );
  if(!me)return;
  // Reset onglet Posts actif + grille visible
  showProfileTab('grid');
  // DB-first: une seule requête pour toutes les données du profil
  const {data:prof}=await sb.from('profiles').select('*').eq('id',me.id).maybeSingle();
  // Fallback sur user_metadata si le profil DB n'existe pas encore
  const m=me.user_metadata||{};
  const displayName=prof?.full_name||m.full_name||m.first_name||'User';
  const displayHandle=prof?.username||m.username||me.email?.split('@')[0]||'user';
  const handleEl=document.getElementById('my-handle');
  if(handleEl) handleEl.textContent=displayHandle;
  const avatarSrc=prof?.avatar_portrait_url||prof?.avatar_url;
  if(avatarSrc){
    document.getElementById('my-avatar').innerHTML=`<img src="${avatarSrc}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">`;
    const delBtn=document.getElementById('av-delete-btn');
    if(delBtn) delBtn.style.display='flex';
  }
  const bioCard=document.getElementById('my-bio-card');
  if(prof?.bio){
    document.getElementById('my-bio').textContent=prof.bio;
    if(bioCard) bioCard.style.display='block';
  } else {
    if(bioCard) bioCard.style.display='none';
  }
  const {count:fc}=await sb.from('follows').select('*',{count:'exact',head:true}).eq('following_id',me.id);
  animateCounter(document.getElementById('my-followers'),fc||0);
  if(!dbOk){demoGrid('my-grid');document.getElementById('my-grid').style.display='grid';return;}
  const {data:posts}=await sb.from('posts').select('id,image_url,likes_count,views_count').eq('user_id',me.id).eq('hidden',false).order('created_at',{ascending:false});
  animateCounter(document.getElementById('my-posts'),posts?.length||0);
  // Nombre de suivis (following)
  const {count:followingCount}=await sb.from('follows').select('*',{count:'exact',head:true}).eq('follower_id',me.id);
  const followingEl=document.getElementById('my-following');
  if(followingEl)animateCounter(followingEl,followingCount||0);
  const auraPoints=prof?.aura_points||0;
  const auraPointsEl=document.getElementById('my-aura-points');
  if(auraPointsEl)auraPointsEl.textContent=fmtN(auraPoints);
  const auraBadges=prof?.aura_badges||[];
  const auraEl=document.getElementById('my-aura');
  const badgeEl=document.getElementById('my-badges');
  if(badgeEl&&auraBadges.length>0){
    badgeEl.style.display='flex';
    badgeEl.innerHTML=auraBadges.map(b=>`<div style="background:var(--gold-dim);border:1px solid var(--gold-b);border-radius:50px;padding:5px 12px;font-size:12px;color:var(--gold)">${escapeHtml(b.label)}</div>`).join('');
  }
  if(!posts||!posts.length){
    const g=document.getElementById('my-grid');
    g.style.display='block';
    g.innerHTML=`<div class="empty-state empty-state--compact"><img src="mascote_ivory/the_artisan_cub.png" alt=""><div class="title-cor-sm">${t('empty_profile_title')}</div><div class="es-desc">${t('empty_profile_hint')}</div></div>`;
    return;
  }
  const _gridEl=document.getElementById('my-grid');
  _gridEl.innerHTML=posts.map((p,i)=>{
    const likes=p.likes_count||0;
    const views=p.views_count||0;
    return `<div class="pgrid-item" style="position:relative;user-select:none"
      onclick="_pgridTap(event,'${p.id}')"
      ontouchstart="_pgridTouchStart('${p.id}')"
      ontouchend="_pgridTouchEnd()"
      ontouchcancel="_pgridTouchEnd()"
      oncontextmenu="event.preventDefault();_showDeletePostConfirm('${p.id}');return false">
      ${p.image_url?`<img data-src="${p.image_url}" alt="" draggable="false" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`:''}
      ${p.image_url?`<span class="pgrid-ph" style="display:none">${_camSvgFb}</span>`:`<span class="pgrid-ph">${_camSvgFb}</span>`}
      <div id="pgrid-like-${p.id}" style="display:${likes>0?'flex':'none'};position:absolute;bottom:8px;right:8px;align-items:center;gap:3px;z-index:4;pointer-events:none">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="none" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.8))"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        <span id="pgrid-like-count-${p.id}" style="font-size:11px;font-weight:700;color:var(--white);text-shadow:0 1px 3px rgba(0,0,0,0.9)">${fmtN(likes)}</span>
      </div>
      <div id="pgrid-views-${p.id}" style="display:${views>0?'flex':'none'};position:absolute;bottom:8px;left:8px;align-items:center;gap:3px;z-index:4;pointer-events:none">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.8))"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        <span id="pgrid-views-count-${p.id}" style="font-size:11px;font-weight:700;color:var(--white);text-shadow:0 1px 3px rgba(0,0,0,0.9)">${fmtN(views)}</span>
      </div>
    </div>`;
  }).join('');
  observeLazy(_gridEl);
  // Stagger d'entrée sur la grille
  requestAnimationFrame(()=>animateGridItems('my-grid'));
  // Resync likes réels depuis la table likes (corrige likes_count dénormalisé)
  _resyncProfileLikes(posts.map(p=>p.id));
}

async function _resyncProfileLikes(postIds){
  if(!postIds||!postIds.length||!dbOk)return;
  try{
    const{data}=await sb.from('likes').select('post_id').in('post_id',postIds);
    const counts={};
    (data||[]).forEach(r=>{counts[r.post_id]=(counts[r.post_id]||0)+1;});
    postIds.forEach(pid=>{
      const badge=document.getElementById('pgrid-like-'+pid);
      const span=document.getElementById('pgrid-like-count-'+pid);
      const count=counts[pid]||0;
      if(!badge)return;
      const stale=parseInt(span?.textContent?.replace(/[^\d]/g,'')||'0');
      badge.style.display=count>0?'flex':'none';
      if(span)span.textContent=fmtN(count);
      // Corrige likes_count dénormalisé si décalé
      if(stale!==count) sb.from('posts').update({likes_count:count}).eq('id',pid).then(()=>{},()=>{});
    });
  }catch(e){console.warn('[resyncProfileLikes]',e);}
}

// ── Long press sur la grille ──────────────────────────────────
let _lpTimer=null, _lpActive=false;
function _pgridTouchStart(postId){
  _lpActive=false;
  _lpTimer=setTimeout(()=>{
    _lpActive=true;
    if(navigator.vibrate)navigator.vibrate(18);
    _showDeletePostConfirm(postId);
  },520);
}
function _pgridTouchEnd(){
  if(_lpTimer){clearTimeout(_lpTimer);_lpTimer=null;}
}
function _pgridTap(e,postId){
  if(_lpActive){_lpActive=false;return;}
  openPostView(postId);
}
function _showDeletePostConfirm(postId){
  const toastEl=document.getElementById('toast-el');
  toastEl.innerHTML=`
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:4px 0">
      <div style="font-size:12px;color:var(--white)">${t('confirm_delete_look')}</div>
      <div class="txt-xs-dim">${t('confirm_irreversible')}</div>
      <div style="display:flex;gap:8px;margin-top:2px">
        <div onclick="cancelBackConfirm()" style="padding:6px 16px;border:1px solid var(--gold-b);border-radius:50px;font-size:12px;color:var(--wd);cursor:pointer">Annuler</div>
        <div onclick="cancelBackConfirm();doDeletePost('${postId}')" style="padding:6px 16px;background:rgba(255,80,80,.85);border-radius:50px;font-size:12px;color:var(--gold-l);font-weight:600;cursor:pointer">Supprimer</div>
      </div>
    </div>`;
  const sab=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab'))||0;
  toastEl.style.bottom=(80+sab)+'px';
  toastEl.style.borderRadius='16px';
  toastEl.style.padding='14px 20px';
  toastEl.classList.add('show');
}
let _pendingDelete=null;
function askDeletePost(btn,postId){ _showDeletePostConfirm(postId); }
async function doDeletePost(postId){
  const{error}=await sb.from('posts').delete().eq('id',postId).eq('user_id',me.id);
  if(error)return toast(`❌ ${t('toast_error')}: ${error.message}`);
  toast(t('look_deleted'));loadProfile();
}

// ── SAVE / ENREGISTRÉS ──────────────────────
let _saveInProgress=false;
async function toggleSave(postId){
  if(!me)return toast(t('login_save'));
  if(_saveInProgress)return;
  _saveInProgress=true;
  const saveEl=document.getElementById('save-'+postId);
  try{
    const{data:existing}=await sb.from('saved_posts').select('id').eq('post_id',postId).eq('user_id',me.id).maybeSingle();
    if(existing){
      await sb.from('saved_posts').delete().eq('post_id',postId).eq('user_id',me.id);
      if(saveEl){saveEl.style.fill='none';saveEl.style.stroke='white';}
      _triggerAnim(saveEl?.closest('.slide-action'),'save-snap');
      navigator.vibrate?.(6);
      toast(t('unsaved_ok'));
    }else{
      await sb.from('saved_posts').insert({post_id:postId,user_id:me.id});
      if(saveEl){saveEl.style.fill='var(--gold)';saveEl.style.stroke='var(--gold)';}
      _triggerAnim(saveEl?.closest('.slide-action'),'save-snap');
      navigator.vibrate?.([10,30,10]);
      toast(t('saved_ok'));
    }
  }catch(e){
    console.error('toggleSave error:',e);
    toast('❌ '+t('save_error'));
  }finally{
    _saveInProgress=false;
  }
}

function showProfileTab(tab){
  const tabs=['grid','saved','liked','wishlist'];
  const gridsEl={
    grid:document.getElementById('my-grid'),
    saved:document.getElementById('my-saved-grid'),
    liked:document.getElementById('my-liked-grid'),
    wishlist:document.getElementById('my-wishlist-grid')
  };
  // Detect current active tab for direction animation
  let curTab=null;
  tabs.forEach(t=>{ if(document.getElementById('tab-prof-'+t)?.classList.contains('active')) curTab=t; });
  const curIdx=tabs.indexOf(curTab), newIdx=tabs.indexOf(tab);
  const dir=(curTab&&curTab!==tab)?(newIdx>curIdx?'left':'right'):null;

  tabs.forEach(t=>{
    document.getElementById('tab-prof-'+t)?.classList.toggle('active', t===tab);
  });
  gridsEl.grid.style.display=tab==='grid'?'grid':'none';
  gridsEl.saved.style.display=tab==='saved'?'grid':'none';
  gridsEl.liked.style.display=tab==='liked'?'grid':'none';
  gridsEl.wishlist.style.display=tab==='wishlist'?'block':'none';
  if(tab==='saved') loadSavedGrid();
  if(tab==='liked') loadLikedGrid();
  if(tab==='wishlist') loadWishlistGrid();
  // Slide in from the correct side
  if(dir){
    const el=gridsEl[tab];
    if(el){
      el.style.animation='none';
      void el.offsetWidth; // reflow
      el.style.animation=dir==='left'
        ?'profTabSlideInRight 240ms cubic-bezier(0.23,1,0.32,1) both'
        :'profTabSlideInLeft 240ms cubic-bezier(0.23,1,0.32,1) both';
    }
  }
}
async function loadWishlistGrid(){
  const grid=document.getElementById('my-wishlist-grid');
  if(!me||!grid)return;
  grid.innerHTML=skGrid();

  // ── Lire les envies boutique depuis localStorage ──
  const bqSavedUrls=JSON.parse(localStorage.getItem('bq_saved')||'[]');
  const bqSource=(typeof _bqAllProducts!=='undefined'&&_bqAllProducts.length)?_bqAllProducts
    :(typeof _bqRegistry!=='undefined'?_bqRegistry:[]);
  const bqLocalVotes=bqSavedUrls.map(url=>{
    const p=bqSource.find(r=>r&&r.url===url);
    const nom=p?.nom||url.split('/').filter(Boolean).pop()||'Produit';
    return {alt_key:'bq::'+url,alt_name:nom,alt_brand:p?.marque||'Boutique',alt_url:url,
      alt_price:p?String(p.prix||''):'',alt_score_eco:p?.score_eco||0,
      alt_image_url:p?.image_url||null,alt_type:p?.type||null,created_at:new Date().toISOString(),_bq:true};
  });

  // ── Lire depuis Supabase ──
  const{data:votes}=await safeRun(sb.from('alternative_feedback').select('alt_key,alt_brand,alt_type,alt_name,alt_image_url,alt_url,alt_price,alt_score_eco,created_at').eq('user_id',me.id).eq('vote','up').order('created_at',{ascending:false}),{silent:true,context:'loadWishlist'});

  // ── Merger : Supabase en priorité, localStorage en complément ──
  const dbKeys=new Set((votes||[]).map(v=>v.alt_key));
  const merged=[...(votes||[]),...bqLocalVotes.filter(v=>!dbKeys.has(v.alt_key))];

  if(!merged.length){
    grid.innerHTML=`<div class="empty-state"><img src="mascote_ivory/the_gatherer.png" alt=""><div class="title-cor-sm">${t('empty_no_wishlist')}</div><div class="es-desc">${t('empty_no_wishlist_desc')}</div></div>`;
    return;
  }
  grid.innerHTML=merged.map(v=>{
    const brand=v.alt_brand||'—';
    const name=v.alt_name||(v.alt_key||'').split('::')[2]||'Article';
    const safeBrand=escapeHtml(brand);
    const safeName=escapeHtml(name);
    const url=v.alt_url&&safeUrl(v.alt_url)!=='#'?safeUrl(v.alt_url):`https://www.google.com/search?q=${encodeURIComponent((name+' '+brand).trim())}`;
    const hasImg=!!v.alt_image_url;
    const imgPart=hasImg
      ?`<img src="${v.alt_image_url}" alt="${safeName}" class="img-cover-r" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      :'';
    const fallbackIcon=`<div style="display:${hasImg?'none':'flex'};width:100%;height:100%;align-items:center;justify-content:center"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.3)" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg></div>`;
    return `<div class="alt-result-card" style="margin-bottom:10px" onclick="window.open('${url}','_blank')">
      <div class="alt-result-img" style="overflow:hidden;border-radius:8px;background:var(--black-3);position:relative">${imgPart}${fallbackIcon}</div>
      <div class="flex-min">
        <div style="font-size:13px;font-weight:500;color:var(--white);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safeName}</div>
        <div class="txt-xs-gold-mb">${safeBrand}</div>
        <div class="row-tags">
          ${v.alt_score_eco?`<div class="eco-score">${ecoStars(v.alt_score_eco)}</div>`:''}
          <span class="txt-xxs-dim">Ajouté ${timeAgo(v.created_at)}</span>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;align-self:flex-start" onclick="event.stopPropagation()">
        ${v.alt_price?`<div style="font-size:14px;font-weight:500;color:var(--gold-l);margin-bottom:6px">${v.alt_price}€</div>`:''}
        <button onclick="removeFromWishlist('${v.alt_key.replace(/'/g,'\\\'')}')" style="background:transparent;border:1px solid rgba(255,120,120,0.4);border-radius:var(--r-pill);padding:4px 10px;color:rgba(255,120,120,0.85);font-size:11px;cursor:pointer">Retirer</button>
      </div>
    </div>`;
  }).join('');
}
async function removeFromWishlist(key){
  // Supprimer du localStorage si c'est un item boutique (clé bq::)
  if(key.startsWith('bq::')){
    const url=key.slice(4);
    const saved=JSON.parse(localStorage.getItem('bq_saved')||'[]').filter(u=>u!==url);
    localStorage.setItem('bq_saved',JSON.stringify(saved));
    if(typeof _bqSavedKeys!=='undefined') _bqSavedKeys.delete(url);
    toast(t('toast_wishlist_removed'));
    loadWishlistGrid();
    return;
  }
  if(!me)return;
  const{error}=await safeRun(sb.from('alternative_feedback').delete().eq('user_id',me.id).eq('alt_key',key),{friendly:"Impossible de retirer.",context:'removeWishlist'});
  if(error)return;
  delete _altVotesCache[key];
  toast(t('toast_wishlist_removed'));
  loadWishlistGrid();
}
async function loadLikedGrid(){
  const grid=document.getElementById('my-liked-grid');
  if(!me||!grid)return;
  grid.innerHTML=skGrid();
  const{data:likes,error:likesErr}=await sb.from('likes').select('post_id').eq('user_id',me.id);
  if(likesErr)console.warn('[loadLikedGrid]',likesErr);
  if(!likes||!likes.length){
    grid.style.display='block';
    grid.innerHTML=`<div style="padding:48px 20px;text-align:center"><img src="mascote_ivory/le_menestrel.png" alt="" style="display:block;width:60%;max-width:200px;height:auto;margin:0 auto 14px;opacity:.95"><div style="font-size:13px;color:var(--wd);line-height:1.6">${t('empty_no_liked')}</div></div>`;
    return;
  }
  const postIds=likes.map(l=>l.post_id);
  const{data:posts}=await sb.from('posts').select('id,image_url').eq('hidden',false).in('id',postIds);
  if(!posts||!posts.length){grid.innerHTML='';return;}
  const ordered=postIds.map(id=>posts.find(p=>p.id===id)).filter(Boolean);
  grid.innerHTML=ordered.map(p=>`<div class="pgrid-item">${p.image_url?`<img data-src="${p.image_url}" alt="">`:`<span class="pgrid-ph">${_heartSvgFb}</span>`}</div>`).join('');
  observeLazy(grid);
}

async function loadSavedGrid(){
  const grid=document.getElementById('my-saved-grid');
  if(!me||!grid)return;
  grid.innerHTML=skGrid();
  // Charger les IDs des posts enregistrés
  const{data:saves,error:savesErr}=await sb.from('saved_posts').select('post_id').eq('user_id',me.id);
  if(savesErr)console.warn('[loadSavedGrid]',savesErr);
  if(!saves||!saves.length){
    grid.style.display='block';
    grid.innerHTML=`<div style="padding:48px 20px;text-align:center"><img src="mascote_ivory/le_bibliothecaire.png" alt="" style="display:block;width:60%;max-width:200px;height:auto;margin:0 auto 14px;opacity:.95"><div style="font-size:13px;color:var(--wd);line-height:1.6">${t('no_saved')}</div><div style="font-size:12px;color:var(--wd);opacity:.6;margin-top:5px">${t('saved_hint')}</div></div>`;
    return;
  }
  const postIds=saves.map(s=>s.post_id);
  const{data:posts}=await sb.from('posts').select('id,image_url').eq('hidden',false).in('id',postIds);
  if(!posts||!posts.length){grid.innerHTML='';return;}
  // Conserver l'ordre d'enregistrement
  const ordered=postIds.map(id=>posts.find(p=>p.id===id)).filter(Boolean);
  grid.innerHTML=ordered.map(p=>`<div class="pgrid-item">${p.image_url?`<img data-src="${p.image_url}" alt="">`:`<span class="pgrid-ph">${_camSvgFb}</span>`}</div>`).join('');
  observeLazy(grid);
}

function demoGrid(id){
  const bgs=['bg-1','bg-4','bg-6','bg-3','bg-7','bg-8','bg-2','bg-9','bg-5'];
  const ems=['👗','🧥','👠','🌿','🎩','👜','🧣','💎','🌸'];
  document.getElementById(id).innerHTML=bgs.map((b,i)=>`<div class="pgrid-item"><span class="pgrid-ph ${b}">${ems[i]}</span></div>`).join('');
}
// ── CROP OVERLAY ──────────────────────────────
let _cropFile=null,_cropImgEl=null,_cropMode='portrait';
let _cropDrag=false,_cropLX=0,_cropLY=0,_cropLastDist=0;
// État indépendant par mode
const _cropState={
  portrait:{offX:0,offY:0,scale:1,fw:0,fh:0},
  circle:  {offX:0,offY:0,scale:1,fw:0,fh:0}
};

function _cropZoneDims(){
  const z=document.getElementById('crop-zone');
  return{zW:z.offsetWidth||window.innerWidth,zH:z.offsetHeight||Math.round(window.innerHeight*0.6)};
}
function _cropCurrent(){ return _cropState[_cropMode]; }

function openCrop(file){
  _cropFile=file; _cropMode='portrait';
  _cropImgEl=document.getElementById('av-crop-img');
  document.getElementById('sc-crop').style.display='flex';
  // Data URL (évite les problèmes d'affichage iOS avec blob: URLs dans position:fixed)
  const reader=new FileReader();
  reader.onload=e=>{
    _cropImgEl.onload=()=>{
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        const{zW,zH}=_cropZoneDims();
        const fw=Math.min(zW*0.82,zH*0.72);
        const fh=fw*4/3;
        _cropState.portrait.fw=fw; _cropState.portrait.fh=fh;
        _cropState.portrait.scale=Math.max(fw/_cropImgEl.naturalWidth,fh/_cropImgEl.naturalHeight);
        _cropState.portrait.offX=0; _cropState.portrait.offY=0;
        _cropState.circle.fw=fw; _cropState.circle.fh=fw;
        _cropState.circle.scale=Math.max(fw/_cropImgEl.naturalWidth,fw/_cropImgEl.naturalHeight);
        _cropState.circle.offX=0; _cropState.circle.offY=0;
        switchCropMode('portrait');
      }));
    };
    _cropImgEl.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

function switchCropMode(mode){
  _cropMode=mode;
  // Mise à jour UI
  const isPortrait=mode==='portrait';
  document.getElementById('crop-prev-portrait').style.borderColor=isPortrait?'var(--gold)':'rgba(240,234,216,0.2)';
  document.getElementById('crop-prev-circle').style.borderColor=!isPortrait?'var(--gold)':'rgba(240,234,216,0.2)';
  document.getElementById('crop-lbl-portrait').style.color=isPortrait?'var(--gold)':'var(--wd)';
  document.getElementById('crop-lbl-portrait').textContent=isPortrait?'Profil ✓':'Profil';
  document.getElementById('crop-lbl-circle').style.color=!isPortrait?'var(--gold)':'var(--wd)';
  document.getElementById('crop-lbl-circle').textContent=!isPortrait?'Feed ✓':'Feed';
  _cropDraw();
}

function closeCrop(){
  document.getElementById('sc-crop').style.display='none';
  if(_cropImgEl)_cropImgEl.src='';
}

function _cropDraw(){
  if(!_cropImgEl?.naturalWidth)return;
  const s=_cropCurrent();
  // Dimensions : window.innerWidth toujours fiable, hauteur via getBoundingClientRect
  const zone=document.getElementById('crop-zone');
  const rect=zone.getBoundingClientRect();
  const zW=rect.width>10?Math.round(rect.width):window.innerWidth;
  const zH=rect.height>10?Math.round(rect.height):Math.round(window.innerHeight*0.55);
  // Canvas principal
  const canvas=document.getElementById('av-crop-canvas');
  canvas.width=zW; canvas.height=zH;
  const ctx=canvas.getContext('2d');
  // Image
  const w=_cropImgEl.naturalWidth*s.scale;
  const h=_cropImgEl.naturalHeight*s.scale;
  const ix=(zW-w)/2+s.offX;
  const iy=(zH-h)/2+s.offY;
  ctx.drawImage(_cropImgEl,ix,iy,w,h);
  // Overlay sombre + cadre
  const fL=(zW-s.fw)/2, fT=(zH-s.fh)/2;
  ctx.fillStyle='rgba(0,0,0,0.62)';
  if(_cropMode==='circle'){
    ctx.save();
    ctx.beginPath();ctx.rect(0,0,zW,zH);
    ctx.arc(zW/2,zH/2,s.fw/2,0,Math.PI*2);
    ctx.fill('evenodd');ctx.restore();
    ctx.strokeStyle='rgba(240,234,216,0.85)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(zW/2,zH/2,s.fw/2,0,Math.PI*2);ctx.stroke();
  }else{
    ctx.fillRect(0,0,zW,fT);
    ctx.fillRect(0,fT+s.fh,zW,zH-fT-s.fh);
    ctx.fillRect(0,fT,fL,s.fh);
    ctx.fillRect(fL+s.fw,fT,zW-fL-s.fw,s.fh);
    ctx.strokeStyle='rgba(240,234,216,0.85)';ctx.lineWidth=1.5;
    ctx.strokeRect(fL+0.75,fT+0.75,s.fw-1.5,s.fh-1.5);
    ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=0.5;
    ctx.beginPath();
    for(let i=1;i<3;i++){
      ctx.moveTo(fL,fT+s.fh*i/3);ctx.lineTo(fL+s.fw,fT+s.fh*i/3);
      ctx.moveTo(fL+s.fw*i/3,fT);ctx.lineTo(fL+s.fw*i/3,fT+s.fh);
    }
    ctx.stroke();
  }
  _cropUpdatePreviews();
}

function _cropSrcCoords(mode){
  const s=_cropState[mode];
  const{zW,zH}=_cropZoneDims();
  const ix=(zW-_cropImgEl.naturalWidth*s.scale)/2+s.offX;
  const iy=(zH-_cropImgEl.naturalHeight*s.scale)/2+s.offY;
  const fL=(zW-s.fw)/2, fT=(zH-s.fh)/2;
  return{srcX:(fL-ix)/s.scale,srcY:(fT-iy)/s.scale,srcW:s.fw/s.scale,srcH:s.fh/s.scale};
}

function _cropUpdatePreviews(){
  // Portrait preview
  const {srcX:px,srcY:py,srcW:pw,srcH:ph}=_cropSrcCoords('portrait');
  const cp=document.getElementById('crop-prev-portrait');
  if(cp){const ctx=cp.getContext('2d');ctx.clearRect(0,0,cp.width,cp.height);try{ctx.drawImage(_cropImgEl,px,py,pw,ph,0,0,cp.width,cp.height);}catch(e){}}
  // Circle preview
  const {srcX:cx,srcY:cy,srcW:cw}=_cropSrcCoords('circle');
  const cc=document.getElementById('crop-prev-circle');
  if(cc){const ctx=cc.getContext('2d');ctx.clearRect(0,0,cc.width,cc.height);try{ctx.drawImage(_cropImgEl,cx,cy,cw,cw,0,0,cc.width,cc.height);}catch(e){}}
}

function cropTouchStart(e){
  e.preventDefault();
  if(e.touches.length===1){_cropDrag=true;_cropLX=e.touches[0].clientX;_cropLY=e.touches[0].clientY;}
  else if(e.touches.length===2){_cropDrag=false;_cropLastDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);}
}
function cropTouchMove(e){
  e.preventDefault();
  const s=_cropCurrent();
  if(e.touches.length===1&&_cropDrag){
    s.offX+=e.touches[0].clientX-_cropLX;s.offY+=e.touches[0].clientY-_cropLY;
    _cropLX=e.touches[0].clientX;_cropLY=e.touches[0].clientY;
  }else if(e.touches.length===2){
    const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    s.scale=Math.max(0.3,Math.min(6,s.scale*(d/_cropLastDist)));
    _cropLastDist=d;
  }
  _cropDraw();
}
function cropTouchEnd(){_cropDrag=false;}
function cropMouseDown(e){_cropDrag=true;_cropLX=e.clientX;_cropLY=e.clientY;}
function cropMouseMove(e){
  if(!_cropDrag)return;
  const s=_cropCurrent();
  s.offX+=e.clientX-_cropLX;s.offY+=e.clientY-_cropLY;
  _cropLX=e.clientX;_cropLY=e.clientY;
  _cropDraw();
}
function cropMouseUp(){_cropDrag=false;}
function cropWheel(e){
  e.preventDefault();
  const s=_cropCurrent();
  s.scale=Math.max(0.3,Math.min(6,s.scale*(e.deltaY>0?0.9:1.1)));
  _cropDraw();
}

async function confirmCrop(){
  if(!_cropImgEl?.naturalWidth||!_cropFile)return;
  if(!me)return;
  // FileReader → data URL → Image : méthode la plus fiable sur iOS
  const drawImg=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=e=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=e.target.result;};
    reader.onerror=reject;
    reader.readAsDataURL(_cropFile);
  });
  const toBlob=(c,q)=>new Promise(r=>c.toBlob(r,'image/jpeg',q));
  // Export cercle (400x400)
  const{srcX:cx,srcY:cy,srcW:cw}=_cropSrcCoords('circle');
  const cC=document.createElement('canvas'); cC.width=400; cC.height=400;
  cC.getContext('2d').drawImage(drawImg,cx,cy,cw,cw,0,0,400,400);
  // Export portrait (600x800)
  const{srcX:px,srcY:py,srcW:pw,srcH:ph}=_cropSrcCoords('portrait');
  const cP=document.createElement('canvas'); cP.width=600; cP.height=800;
  cP.getContext('2d').drawImage(drawImg,px,py,pw,ph,0,0,600,800);
  // Blobs AVANT closeCrop
  const[bC,bP]=await Promise.all([toBlob(cC,0.92),toBlob(cP,0.92)]);
  if(!bC||!bP){toast(t('toast_crop_error'));return;}
  closeCrop();
  const path=`avatars/${me.id}.jpg`;
  const pathP=`avatars/${me.id}_p.jpg`;
  await Promise.all([
    sb.storage.from('posts').upload(path, new File([bC],'a.jpg',{type:'image/jpeg'}),{upsert:true}),
    sb.storage.from('posts').upload(pathP,new File([bP],'p.jpg',{type:'image/jpeg'}),{upsert:true})
  ]);
  const ts=Date.now();
  const url=sb.storage.from('posts').getPublicUrl(path).data.publicUrl+`?t=${ts}`;
  const urlP=sb.storage.from('posts').getPublicUrl(pathP).data.publicUrl+`?t=${ts}`;
  // Mise à jour DB — avatar_url = cercle (feed), avatar_portrait_url = portrait (profil)
  const{error}=await sb.from('profiles').upsert({id:me.id,avatar_url:url,avatar_portrait_url:urlP});
  if(error) await sb.from('profiles').upsert({id:me.id,avatar_url:url});
  document.getElementById('my-avatar').innerHTML=`<img src="${urlP}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">`;
  const delBtn=document.getElementById('av-delete-btn');
  if(delBtn)delBtn.style.display='flex';
  toast(t('avatar_updated'));
  // Forcer un re-fetch DB au prochain loadFeed (pas de cache périmé)
  if(typeof invalidateProfileCache==='function') invalidateProfileCache(me.id);
  // Mise à jour directe des avatars DÉJÀ dans le DOM
  document.querySelectorAll(`.slide-avatar[data-uid="${me.id}"]`).forEach(el=>{
    el.innerHTML=`<img src="${url}" alt="">`;
  });
}

async function deleteProfilePhoto(){
  if(!me) return;
  if(!confirm('Supprimer ta photo de profil ?')) return;
  const {error}=await sb.from('profiles').update({avatar_url:null,avatar_portrait_url:null}).eq('id',me.id);
  if(error){ toast(t('toast_delete_error')); return; }
  await sb.storage.from('posts').remove([`avatars/${me.id}.jpg`,`avatars/${me.id}_p.jpg`]).catch(()=>{});
  document.getElementById('my-avatar').innerHTML=`<svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="rgba(240,234,216,0.25)" stroke-width="1.2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  const delBtn=document.getElementById('av-delete-btn');
  if(delBtn) delBtn.style.display='none';
  toast(t('toast_photo_deleted'));
  if(typeof invalidateProfileCache==='function') invalidateProfileCache(me.id);
  document.querySelectorAll(`.slide-avatar[data-uid="${me.id}"]`).forEach(el=>{
    el.innerHTML=`<span style="font-size:15px;font-weight:700;color:var(--gold);text-transform:uppercase">${(me.email||'?').charAt(0)}</span>`;
  });
}

async function onAvatarSelect(e){
  if(!me)return;const file=e.target.files[0];if(!file)return;
  e.target.value='';
  openCrop(file);
}
async function _onAvatarUploadDirect(file){
  if(!me)return;
  const ext=file.name.split('.').pop();const path=`avatars/${me.id}.${ext}`;
  const {error}=await sb.storage.from('posts').upload(path,file,{upsert:true});
  if(error)return toast(t('error_upload'));
  const {data:u}=sb.storage.from('posts').getPublicUrl(path);
  await sb.from('profiles').upsert({id:me.id,avatar_url:u.publicUrl});
  document.getElementById('my-avatar').innerHTML=`<img src="${u.publicUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">`;
  const delBtn=document.getElementById('av-delete-btn');
  if(delBtn) delBtn.style.display='flex';
  toast(t('avatar_updated'));
}

// ── VISITOR PROFILE ──────────────────────────
async function openUserProfile(uid){
  if(!uid||uid.startsWith('demo'))return toast(t('demo_profile'));
  if(me&&uid===me.id){goTab('profile');return;}
  prevScreen=document.querySelector('.screen.active')?.id||'sc-feed';
  viewUid=uid;goS('sc-vprofile');
  // Reset avatar
  document.getElementById('vp-av').innerHTML='<svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="rgba(240,234,216,0.25)" stroke-width="1.2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  const {data:prof}=await sb.from('profiles').select('*').eq('id',uid).maybeSingle();
  if(prof){
    document.getElementById('vp-handle').textContent=prof.username||'user';
    const bioCard=document.getElementById('vp-bio-card');
    if(prof.bio){
      document.getElementById('vp-bio').textContent=prof.bio;
      bioCard.style.display='block';
    }else{
      bioCard.style.display='none';
    }
    const portraitSrc=prof.avatar_portrait_url||prof.avatar_url;
    if(portraitSrc)document.getElementById('vp-av').innerHTML=`<img src="${portraitSrc}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">`;
  }
  const {data:posts}=await sb.from('posts').select('id,image_url,likes_count').eq('user_id',uid).eq('hidden',false).order('created_at',{ascending:false});
  const {count}=await sb.from('follows').select('*',{count:'exact',head:true}).eq('following_id',uid);
  document.getElementById('vp-followers').textContent=count||0;
  const {count:vpFollowing}=await sb.from('follows').select('*',{count:'exact',head:true}).eq('follower_id',uid);
  document.getElementById('vp-following').textContent=vpFollowing||0;
  let isFollowing=false;
  if(me){
    const {data:f}=await sb.from('follows').select('id').eq('follower_id',me.id).eq('following_id',uid).maybeSingle();
    isFollowing=!!f;
    const btn=document.getElementById('vp-follow');
    if(isFollowing){btn.classList.add('following');btn.textContent=t('suivi');}
    else{btn.classList.remove('following');btn.textContent='+ Suivre';}
    const profName=prof?.full_name||prof?.username||'User';
    const profHandle=prof?.username||'';
    const profAv=prof?.avatar_url||'';
    // Bouton Message
    document.getElementById('vp-message-btn')?.remove();
    const msgBtn=document.createElement('button');
    msgBtn.id='vp-message-btn';
    msgBtn.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right:5px;vertical-align:-1px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Message';
    msgBtn.className='prof-action-btn msg';
    msgBtn.onclick=()=>openDMWithUser(uid,profName,profAv,profHandle);
    document.getElementById('vp-follow')?.after(msgBtn);
    // Bouton options (3 points) — dans le slot haut droite
    const optsSlot=document.getElementById('vp-opts-slot');
    if(optsSlot){
      optsSlot.innerHTML='';
      const optsBtn=document.createElement('button');
      optsBtn.id='vp-opts-btn';
      optsBtn.style.cssText='background:none;border:none;cursor:pointer;opacity:.7;padding:4px;color:var(--white);display:flex;align-items:center;justify-content:center';
      optsBtn.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
      optsBtn.onclick=()=>openPostOptions(null,uid,profName);
      optsSlot.appendChild(optsBtn);
    }
  }
  const isPrivate=prof?.is_private||false;
  const vpGrid=document.getElementById('vp-grid');
  if(isPrivate&&!isFollowing&&me?.id!==uid){
    // Compte privé non suivi
    vpGrid.innerHTML=`
      <div class="grid-empty">
        <div class="flex-center-mb">${_lockSvgFb}</div>
        <div class="title-serif-sm">${t('private_account_title')}</div>
        <div class="txt-sm-body">${t('private_account_desc')}</div>
      </div>`;
    const followBtn=document.getElementById('vp-follow');
    if(followBtn&&!isFollowing){followBtn.textContent=t('demander_follow');followBtn.style.borderColor='var(--wd)';followBtn.style.color='var(--wd)';}
  }else{
    // Compte public ou déjà suivi
    if(!posts?.length){
      vpGrid.style.display='block';
      vpGrid.innerHTML=`<div style="padding:48px 20px;text-align:center"><img src="mascote_ivory/the_star_gazer.png" alt="" style="display:block;width:60%;max-width:200px;height:auto;margin:0 auto 14px;opacity:.95"><div style="font-size:13px;color:var(--wd);line-height:1.6">${t('aucun_post')}</div></div>`;
    }else{
      vpGrid.innerHTML=posts.map(p=>`<div class="pgrid-item" onclick="openPostView('${p.id}')">${p.image_url?`<img data-src="${p.image_url}" alt="">`:`<span class="pgrid-ph">${_camSvgFb}</span>`}</div>`).join('');
      observeLazy(vpGrid);
    }
  }
}
async function doFollowUser(){
  if(!me||!viewUid)return toast(t('login_required'));
  const btn=document.getElementById('vp-follow');
  _triggerAnim(btn,'follow-pulse');
  navigator.vibrate?.(10);
  const isF=btn.classList.contains('following');
  // Vérifie si le compte cible est privé
  const{data:targetProf}=await sb.from('profiles').select('is_private,username,full_name').eq('id',viewUid).single();
  const targetIsPrivate=targetProf?.is_private||false;
  if(isF){
    // Se désabonner
    await sb.from('follows').delete().eq('follower_id',me.id).eq('following_id',viewUid);
    btn.classList.remove('following');
    if(targetIsPrivate){
      btn.textContent=t('demander_follow');btn.style.borderColor='var(--wd)';btn.style.color='var(--wd)';
      // Re-affiche le verrou
      document.getElementById('vp-grid').innerHTML=`
        <div class="grid-empty">
          <div class="flex-center-mb">${_lockSvgFb}</div>
          <div class="title-serif-sm">${t('private_account_title')}</div>
          <div class="txt-sm-body">${t('private_account_desc')}</div>
        </div>`;
    }else{
      btn.textContent=t('suivre');btn.style.borderColor='';btn.style.color='';
    }
    toast(t('unfollow_done'));
  }else{
    if(targetIsPrivate){
      // Compte privé : demande d'abonnement
      await sb.from('notifications').insert({user_id:viewUid,from_user_id:me.id,type:'follow_request'});
      btn.textContent=t('follow_request_btn');btn.style.borderColor='var(--wd)';btn.style.color='var(--wd)';
      toast(t('follow_request_sent'));
    }else{
      // Compte public : follow immédiat
      await sb.from('follows').insert({follower_id:me.id,following_id:viewUid});
      await sb.from('notifications').insert({user_id:viewUid,from_user_id:me.id,type:'follow'});
      btn.classList.add('following');btn.textContent=t('suivi');btn.style.borderColor='var(--gold-l)';btn.style.color='var(--gold-l)';
      toast(t('follow_done'));
    }
  }
}
async function toggleFollow(uid,btn){
  if(!me)return toast(t('login_required'));
  _triggerAnim(btn,'follow-pulse');
  navigator.vibrate?.(10);
  const isF=btn.classList.contains('following');
  if(isF){await sb.from('follows').delete().eq('follower_id',me.id).eq('following_id',uid);btn.classList.remove('following');btn.textContent=t('suivre');}
  else{await sb.from('follows').insert({follower_id:me.id,following_id:uid});btn.classList.add('following');btn.textContent=t('suivi');}
}
async function getFollowed(){
  if(!me)return[];
  const {data}=await sb.from('follows').select('following_id').eq('follower_id',me.id);
  return data?data.map(f=>f.following_id):[];
}

// ═══════════════════════════════════════════
// ── HOTSPOTS SHOW/HIDE ───────────────────────
let _hideHspTimer=null;
let _hsObserver=null;

function _hspNavHide(){
  const nav=document.querySelector('.bnav');
  if(nav) nav.style.transform='translateY(110%)';
}
function _hspNavShow(){
  const nav=document.querySelector('.bnav');
  if(nav) nav.style.transform='';
}

function showHotspots(pid){
  const dots=document.getElementById('hdots-'+pid);
  const hint=document.getElementById('hint-'+pid);
  if(dots)dots.style.display='block';
  if(hint)hint.style.display='none';
  _hspNavHide();
  if(_hideHspTimer)clearTimeout(_hideHspTimer);
  _hideHspTimer=setTimeout(()=>hideHotspots(pid),3000);
}
function hideHotspots(pid){
  const dots=document.getElementById('hdots-'+pid);
  const hint=document.getElementById('hint-'+pid);
  if(dots)dots.style.display='none';
  if(hint)hint.style.display='flex';
  _hspNavShow();
}
function hideHotspotsDelayed(pid){setTimeout(()=>hideHotspots(pid),1500);}

// ── SHEET PIÈCE ─────────────────────────────
// Appelé par les hotspots du feed — ouvre la même fiche que "voir plus" → pièce
function _clickHspot(pid, idx) {
  dismissHotspotHint();
  const hs = window.__hs && window.__hs[pid];
  if (hs && hs[idx]) {
    openPieceSheet(hs[idx]);
  } else {
    // fallback : si les données ne sont plus en mémoire (scroll lointain)
    const look = window.__looks && window.__looks[pid];
    if (look) openLookComplet(look);
  }
}
function openPieceSheet(h){
  if(!h||!h.name)return;
  const matiere=h.matiere||h.tags?.matiere||'inconnu';
  const emp=getEmpreinte(matiere);
  const scoreEco=emp.co2===null?3:emp.co2<3?5:emp.co2<7?4:emp.co2<12?3:emp.co2<20?2:1;
  const ecoLeaves=Array.from({length:5},(_,i)=>`<span style="color:var(--gold);opacity:${i<scoreEco?.9:.15}">${_leafSvg}</span>`).join('');
  const chiffre=emp.eau!==null
    ?`<div style="font-size:22px;font-weight:300;color:var(--gold);font-family:'Cormorant Garamond',serif">~${emp.eau.toLocaleString()}L</div><div style="font-size:11px;color:var(--wd);letter-spacing:1px">${t('eau_label')} · ${emp.co2}kg CO₂</div>`
    :`<div style="font-size:13px;color:var(--wd)">${t('matiere_unknown')}</div>`;

  currentLook={emoji:h.emoji||'',name:h.name,brand:h.brand||'',eco:scoreEco,tags:h.tags||{},postId:h.postId||null};

  const imgWrap=document.getElementById('look-img-wrap');
  imgWrap.style.display='none';
  document.getElementById('look-img-real').style.display='none';
  document.getElementById('look-emoji').innerHTML=_itemSvg;
  const title=document.getElementById('look-title');
  title.textContent=h.name||'—';title.style.cssText='font-size:20px;font-weight:500;color:var(--gold);margin-bottom:4px';
  document.getElementById('look-desc').textContent='';

  // Section aide communautaire si matière inconnue
  const unknownSection=(matiere==='inconnu'&&h.postId&&h.id)?`
    <div style="margin:0 8px 12px;padding:14px 16px;background:rgba(240,234,216,.06);border:1px solid rgba(240,234,216,.2);border-radius:12px">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:8px">✦ Aide la communauté</div>
      <div style="font-size:12px;color:var(--wd);line-height:1.6;margin-bottom:10px">La matière de cette pièce n'est pas encore identifiée. Aide la communauté et gagne des <strong class="c-gold">points Aura</strong> !</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${['Coton','Lin','Laine','Soie','Cuir','Denim','Synthétique','Recyclé'].map(m=>`<div onclick="suggestMaterial('${h.postId}','${h.id}','${m.toLowerCase()}')" style="padding:5px 12px;border:1px solid var(--gold-b);border-radius:50px;font-size:12px;color:var(--wd);cursor:pointer;transition:background .2s" onmouseover="this.style.background='rgba(240,234,216,.15)'" onmouseout="this.style.background='transparent'">${m}</div>`).join('')}
      </div>
    </div>`:'';

  document.getElementById('look-products').innerHTML=`
    <div style="padding:0 8px 16px">
      <div style="font-size:13px;color:var(--wd);margin-bottom:2px">${escapeHtml(h.brand||'—')}</div>
      ${h.price?`<div style="font-size:16px;color:var(--gold-l);font-weight:500">${escapeHtml(h.price)}</div>`:''}
      ${matiere!=='inconnu'?`<div style="font-size:12px;color:var(--wd);margin-top:4px;letter-spacing:.5px">${t('matiere_prefix')} : ${escapeHtml(emp.label)}</div>`:''}
    </div>
    <div style="margin:0 8px 16px;background:var(--black-3);border-radius:12px;padding:14px 16px;border:1px solid var(--gold-b)">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:10px">${t('empreinte_titre')}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div>${chiffre}</div>
        <div style="text-align:center"><div style="margin-bottom:4px">${ecoLeaves}</div><div style="font-size:9px;color:var(--wd);letter-spacing:1px">${t('score_eco')}</div></div>
      </div>
      <div style="font-size:12px;color:var(--wd);line-height:1.6;border-top:1px solid rgba(240,234,216,.1);padding-top:8px;font-style:italic">${emp.info}</div>
      <div style="font-size:9px;color:rgba(245,240,232,.3);margin-top:6px;letter-spacing:.5px">${t('donnees_estim')}</div>
    </div>
    ${unknownSection}
    <div class="p-inner">
      <button class="btn-alt" id="look-alt-btn" onclick="openAlt(currentLook)">${t('voir_alternative')}</button>
    </div>`;

  document.getElementById('overlay').classList.add('show');
  document.getElementById('prod-sheet').classList.add('show');
}

// ── LOOK COMPLET ─────────────────────────────
function openLookComplet(look){
  if(!look)return;
  const imgWrap=document.getElementById('look-img-wrap');
  const imgReal=document.getElementById('look-img-real');
  if(look.imageUrl){imgReal.src=look.imageUrl;imgReal.style.display='block';imgWrap.style.display='flex';}
  else imgWrap.style.display='none';

  document.getElementById('look-emoji').innerHTML=_clotheSvgFb;
  const title=document.getElementById('look-title');
  title.textContent=t('look_complet');title.style.cssText='font-size:22px;font-weight:400;color:var(--gold);margin-bottom:6px';
  const desc=document.getElementById('look-desc');
  desc.textContent=look.caption||'';desc.style.cssText='font-size:12px;color:var(--white);line-height:1.7';

  const pieces=(look.hotspots||[]);
  const piecesHTML=pieces.length>0
    ?pieces.map(h=>`<div class="look-item" onclick="closeAll();setTimeout(()=>openPieceSheet(${JSON.stringify({...h,tags:look.tags,postId:look.id}).replace(/"/g,'&quot;')}),250)"><div class="look-item-img">${h.emoji||'🏷️'}</div><div class="look-item-info"><div class="look-item-name">${escapeHtml(h.name||'—')}</div><div class="look-item-brand">${escapeHtml(h.brand||'')}</div><div class="look-item-ref">${escapeHtml(h.price||'')}</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">${h.type?`<span style="font-size:9px;color:var(--gold);opacity:.7">${escapeHtml(h.type)}</span>`:''} ${h.matiere?`<span style="font-size:9px;color:var(--wd)">${escapeHtml(h.matiere)}</span>`:''}<span style="color:var(--gold);font-size:16px;opacity:.4">›</span></div></div>`).join('')
    :`<div style="text-align:center;padding:20px;color:var(--wd);font-size:12px">${t('aucune_piece')}</div>`;

  document.getElementById('look-products').innerHTML=`
    <div class="p-inner">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:12px">${pieces.length} ${pieces.length>1?t('pieces_identifiees'):t('piece_identifiee')}</div>
      <div style="display:flex;flex-direction:column;gap:8px">${piecesHTML}</div>
      <div style="margin-top:12px;padding:10px;background:var(--black-3);border-radius:10px;border:1px solid rgba(240,234,216,.1);text-align:center"><div style="font-size:12px;color:var(--wd);letter-spacing:.5px">${t('click_piece')}</div></div>
    </div>`;

  document.getElementById('overlay').classList.add('show');
  document.getElementById('prod-sheet').classList.add('show');
}

// PRODUCT / ALTERNATIVES
// ═══════════════════════════════════════════
function getTypeEmoji(){ return _itemSvg; }
function openProduct(){renderLookSheet(DEMO_LOOKS[Math.floor(Math.random()*DEMO_LOOKS.length)]);}
function openDemoProduct(){renderLookSheet(DEMO_LOOKS[Math.floor(Math.random()*DEMO_LOOKS.length)]);}
function openSingleProduct(hspotData) {
  let item;
  if (typeof hspotData === 'object' && hspotData !== null) {
    item = {
      emoji:   (typeof getTypeEmoji === 'function' ? getTypeEmoji(hspotData.type) : null) || hspotData.emoji || '👗',
      name:    hspotData.name    || t('item_fallback'),
      brand:   hspotData.brand   || '',
      price:   hspotData.price   || '',
      matiere: hspotData.matiere || '',
      type:    hspotData.type    || '',
      eco:     hspotData.eco     || 3,
    };
  } else {
    const index = typeof hspotData === 'number' ? hspotData : 0;
    const look  = DEMO_LOOKS[Math.floor(Math.random() * DEMO_LOOKS.length)];
    item = look.items[index % look.items.length];
    if (!item) return;
    item.eco = item.eco || 3;
  }
  // ── Sauvegarde currentLook AVANT d'ouvrir la sheet (openAlt l'utilise directement) ──
  currentLook = {
    emoji: item.emoji || '👗',
    name:  item.name  || t('item_fallback'),
    brand: item.brand || '',
    price: item.price || '',
    eco:   item.eco   || 3,
  };
  // ── Mise à jour de la sheet ──
  document.getElementById('look-emoji').textContent = currentLook.emoji;
  document.getElementById('look-img-real').style.display = 'none';
  document.getElementById('look-img-wrap').className = 'bg-1';
  const title = document.getElementById('look-title');
  title.textContent = currentLook.name;
  title.style.fontSize = '20px';
  title.style.color = 'var(--gold)';
  const desc = document.getElementById('look-desc');
  desc.style.color = 'var(--white)';
  desc.style.fontSize = '12px';
  desc.style.letterSpacing = 'normal';
  let descHtml = '';
  if (item.brand)   descHtml += `<div style="font-size:13px;color:var(--gold);font-weight:500;margin-bottom:4px">${escapeHtml(item.brand)}</div>`;
  if (item.price)   descHtml += `<div style="font-size:18px;color:var(--gold-l);font-weight:600;margin-bottom:8px">${escapeHtml(item.price)}</div>`;
  if (item.matiere) descHtml += `<div style="font-size:12px;color:var(--wd);margin-bottom:4px">Matière : ${escapeHtml(item.matiere)}</div>`;
  if (item.ref)     descHtml += `<div class="txt-xs-dim">${escapeHtml(item.ref)}</div>`;
  desc.innerHTML = descHtml || '';
  document.getElementById('look-products').innerHTML = `
    <div class="look-item bc-gold">
      <div class="look-item-img">${currentLook.emoji}</div>
      <div class="look-item-info">
        <div class="look-item-name">${escapeHtml(currentLook.name)}</div>
        ${item.brand   ? `<div class="look-item-brand">${escapeHtml(item.brand)}</div>` : ''}
        ${item.matiere ? `<div class="look-item-ref">Matière : ${escapeHtml(item.matiere)}</div>` : ''}
        ${item.price   ? `<div class="look-item-ref" style="color:var(--gold-l);font-size:13px;font-weight:600">${escapeHtml(item.price)}</div>` : ''}
      </div>
    </div>`;
  // Bouton alt déjà dans le HTML avec id="look-alt-btn" — currentLook est prêt
  const altBtn = document.getElementById('look-alt-btn');
  if (altBtn) altBtn.style.display = 'flex';
  document.getElementById('overlay').classList.add('show');
  document.getElementById('prod-sheet').classList.add('show');
}

function openHotspotDetail(postId,idx,isDemo){
  const h=(window.__hs&&window.__hs[postId])?window.__hs[postId][idx]:null;
  if(!h||!h.name){openProduct();return;}
  currentLook={emoji:'',name:h.name||'',brand:h.brand||'',price:h.price||'',eco:3,tags:h.tags||{},postId:h.postId||null};
  document.getElementById('look-emoji').innerHTML=_itemSvg;
  document.getElementById('look-img-real').style.display='none';
  document.getElementById('look-img-wrap').className='bg-1';
  const title=document.getElementById('look-title');
  title.textContent=h.name||t('item_fallback');title.style.fontSize='20px';title.style.color='var(--gold)';
  const desc=document.getElementById('look-desc');
  desc.textContent=h.brand?h.brand.toUpperCase():'';desc.style.color='var(--gold)';desc.style.fontSize='11px';desc.style.letterSpacing='2px';
  document.getElementById('look-products').innerHTML=`
    <div class="look-item bc-gold">
      <div class="look-item-img">${_itemSvg}</div>
      <div class="look-item-info">
        <div class="look-item-name">${escapeHtml(h.name||'—')}</div>
        <div class="look-item-brand">${escapeHtml(h.brand||'—')}</div>
        <div class="look-item-ref">${escapeHtml(h.price||'')}</div>
      </div>
      <div class="look-item-price">${escapeHtml(h.price||'')}</div>
    </div>
    <div style="margin-top:12px">
      <button class="btn" style="font-size:12px;letter-spacing:2px"
        onclick="openAlt(currentLook);closeAll()">
        ${t('find_alt')}
      </button>
    </div>`;
  document.getElementById('overlay').classList.add('show');
  document.getElementById('prod-sheet').classList.add('show');
}

function renderLookSheet(look){
  currentLook={emoji:look.emoji,name:look.title,brand:look.items?.[0]?.brand||'',price:look.items?.[0]?.price||'',eco:3};
  document.getElementById('look-emoji').textContent=look.emoji;
  document.getElementById('look-img-real').style.display='none';
  document.getElementById('look-img-wrap').className=look.bg||'bg-1';
  document.getElementById('look-img-wrap').style.fontSize='';
  const title=document.getElementById('look-title');
  title.textContent=look.title;title.style.fontSize='22px';title.style.color='var(--gold)';
  const desc=document.getElementById('look-desc');
  desc.textContent=look.desc;desc.style.color='var(--white)';desc.style.fontSize='12px';desc.style.letterSpacing='normal';
  document.getElementById('look-products').innerHTML=look.items.map(item=>`
    <div class="look-item">
      <div class="look-item-img">${item.emoji}</div>
      <div class="look-item-info">
        <div class="look-item-name">${escapeHtml(item.name||'')}</div>
        <div class="look-item-brand">${escapeHtml(item.brand||'')}</div>
        <div class="look-item-ref">${escapeHtml(item.ref||'')}</div>
      </div>
      <div class="look-item-price">${escapeHtml(item.price||'')}</div>
    </div>`).join('');
  document.getElementById('overlay').classList.add('show');
  document.getElementById('prod-sheet').classList.add('show');
}

function ecoStars(n){return Array.from({length:5},(_,i)=>`<span style="color:var(--gold);opacity:${i<n?.9:.2}">${_leafSvg}</span>`).join('');}
function safeUrl(url){return(url&&/^https?:\/\//i.test(url))?url:'#';}

// ════════════════════════════════════════
// ═══════════════════════════════════════════
// AIRTABLE — Fetch alternatives avec matching CLIP
// ═══════════════════════════════════════════
const AIRTABLE_BASE  = 'app8IHP9RRPqI4Mja';
const AIRTABLE_TABLE = 'Alternatives';
const AIRTABLE_KEY   = 'patYREmsYNiZxMUZ5.832a2d63c6a6f4e4ac8badde521d1be839fbdc0eb766cfe57197ef6cd681e937';

function getSimilarTypes(type) {
  if (!type) return [];
  const groups = [
    // Hauts
    ['blazer','veste','cardigan'],
    ['manteau','veste','cardigan'],
    ['pull','sweater','hoodie','sweatshirt','tricot','knit'],
    ['t-shirt','top','tshirt','polo'],
    ['chemise','shirt','blouse'],
    // Bas
    ['jean','pantalon','denim'],
    ['short','bermuda'],
    ['robe','dress','combinaison'],
    ['jupe','skirt'],
    // Chaussures (toutes regroupées)
    ['sneaker','sneakers','chaussures','chaussure','chaussure-ville','bottes','botte','sandales','sandale','chaussure-ville'],
    // Sacs
    ['sac','handbag','tote','sac-dos','backpack'],
    // Accessoires
    ['lunettes','sunglasses'],
    ['chapeau','hat','casquette','bonnet'],
    ['écharpe','echarpe','scarf'],
    ['ceinture','belt'],
  ];
  const group = groups.find(g => g.includes(type));
  return group || [type];
}

function mapAirtableRecord(r) {
  return {
    nom:        r.fields.nom          || '',
    marque:     r.fields.marque       || '',
    type:       r.fields.type         || '',
    matiere:    r.fields.matiere      || '',
    prix:       r.fields.prix         || 0,
    url:        r.fields.url_affilie  || '#',
    score_eco:  r.fields.score_eco    || 3,
    emoji:      r.fields.emoji        || '👗',
    label:      r.fields.label_certif || '',
    categorie:  r.fields.categorie_alt|| '',
    image_url:  r.fields.image_url    || null,
  };
}

async function fetchAlternatives(detectedType, categorie = '') {
  try {
    const catalog = await loadDemoCatalog();
    if (!catalog || !catalog.length) return getFallbackAlternatives(detectedType, categorie);

    let filtered = catalog;
    // Filtre par type (avec fallback large via getSimilarTypes)
    if (detectedType && detectedType !== 'vetement') {
      const similarTypes = getSimilarTypes(detectedType);
      filtered = filtered.filter(p => similarTypes.includes(p.type) || similarTypes.includes(p.type_precis));
    }
    // Filtre par catégorie (ethique / seconde_main)
    if (categorie && categorie !== 'budget') {
      filtered = filtered.filter(p => p.categorie === categorie || p.categorie_alt === categorie);
    } else if (categorie === 'budget') {
      // Pour "budget" : on prend les moins chers
      filtered = [...filtered].sort((a, b) => (a.prix || 999) - (b.prix || 999));
    }
    // Si pas de match sur type, fallback sur la catégorie seule
    if (!filtered.length && categorie) {
      filtered = catalog.filter(p => p.categorie === categorie || p.categorie_alt === categorie);
    }
    // Tri par score eco descendant
    if (categorie !== 'budget') {
      filtered = [...filtered].sort((a, b) => (b.score_eco || 0) - (a.score_eco || 0));
    }
    return filtered.slice(0, 6);
  } catch(e) {
    console.warn('Demo catalog fetch failed:', e.message);
    return getFallbackAlternatives(detectedType, categorie);
  }
}

async function fetchAlternativesFallback(categorie) {
  try {
    let formula = categorie && categorie !== 'budget'
      ? `AND({actif}=1,{categorie_alt}="${categorie}")`
      : `{actif}=1`;
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=6&sort[0][field]=score_eco&sort[0][direction]=desc`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_KEY}` } });
    const data = await res.json();
    if (!data.records?.length) return getFallbackAlternatives('', categorie);
    return data.records.map(mapAirtableRecord);
  } catch(e) {
    return getFallbackAlternatives('', categorie);
  }
}

// Fallback hardcodé — NE JAMAIS SUPPRIMER (règle absolue WearAura)
function getFallbackAlternatives(type, categorie) {
  const all = {
    ethique: [
      { nom:'Better Sweater Fleece', marque:'Patagonia', type:'pull', prix:129, url:'https://www.patagonia.com/fr/shop/fleece-jackets', score_eco:5, emoji:'🧥', label:'Fair Trade', categorie:'ethique', image_url:'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg?auto=compress&cs=tinysrgb&h=400&w=400' },
      { nom:'Campo Sneaker', marque:'Veja', type:'sneaker', prix:120, url:'https://www.veja-store.com/fr/sneakers/campo/', score_eco:5, emoji:'👟', label:'GOTS', categorie:'ethique', image_url:'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&h=400&w=400' },
      { nom:'Blazer Coton Bio', marque:'Thinking Mu', type:'blazer', prix:195, url:'https://www.thinkingmu.com/collections/blazers', score_eco:5, emoji:'🧥', label:'GOTS', categorie:'ethique', image_url:'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&h=400&w=400' },
    ],
    seconde_main: [
      { nom:'Manteau Max Mara', marque:'Vestiaire Collective', type:'manteau', prix:145, url:'https://www.vestiairecollective.com', score_eco:5, emoji:'💎', label:'', categorie:'seconde_main', image_url:'https://images.pexels.com/photos/7621136/pexels-photo-7621136.jpeg?auto=compress&cs=tinysrgb&h=400&w=400' },
      { nom:'Trench Vintage Burberry', marque:'Vinted', type:'veste', prix:38, url:'https://www.vinted.fr', score_eco:5, emoji:'🌿', label:'', categorie:'seconde_main', image_url:'https://images.pexels.com/photos/1040945/pexels-photo-1040945.jpeg?auto=compress&cs=tinysrgb&h=400&w=400' },
      { nom:'Robe Y2K Fleurie', marque:'Depop', type:'robe', prix:24, url:'https://www.depop.com', score_eco:5, emoji:'👗', label:'', categorie:'seconde_main', image_url:'https://images.pexels.com/photos/1021693/pexels-photo-1021693.jpeg?auto=compress&cs=tinysrgb&h=400&w=400' },
    ],
    budget: [
      { nom:'Jean Brut Selvedge', marque:'Atelier Tuffery', type:'jean', prix:185, url:'https://www.ateliertuffery.com', score_eco:5, emoji:'👖', label:'Fabriqué en France', categorie:'ethique', image_url:'https://images.pexels.com/photos/1598507/pexels-photo-1598507.jpeg?auto=compress&cs=tinysrgb&h=400&w=400' },
      { nom:'Parka Recyclée', marque:'Picture Organic', type:'manteau', prix:280, url:'https://www.picture-organic-clothing.com', score_eco:5, emoji:'🧥', label:'B Corp', categorie:'ethique', image_url:'https://images.pexels.com/photos/6984661/pexels-photo-6984661.jpeg?auto=compress&cs=tinysrgb&h=400&w=400' },
    ]
  };
  const items = all[categorie] || all.ethique;
  if (type && type !== 'vetement') {
    const similar = getSimilarTypes(type);
    const filtered = items.filter(i => similar.includes(i.type));
    if (filtered.length) return filtered;
  }
  return items;
}

// État global alternatives courantes
let currentAltData = { ethique: [], seconde_main: [], budget: [] };

// ── Feedback alternatives ──
let _altVotesCache={}; // {alt_key: 'up'|'down'}
async function loadAltVotes(){
  if(!me)return;
  try{
    const{data}=await sb.from('alternative_feedback').select('alt_key,vote').eq('user_id',me.id);
    _altVotesCache={};(data||[]).forEach(d=>_altVotesCache[d.alt_key]=d.vote);
  }catch(e){_altVotesCache={};}
}
function altKey(alt){return (alt.id||'')+'::'+(alt.marque||'')+'::'+(alt.nom||'').slice(0,40);}
async function voteAlt(key,brand,type,vote,btnEl){
  if(!me){toast(t('login_required'));return;}
  const card=btnEl.closest('.alt-result-card');
  // Récupérer toutes les données de l'alt depuis currentAltData
  let altData=null;
  for(const cat of Object.keys(currentAltData||{})){
    const found=(currentAltData[cat]||[]).find(a=>altKey(a)===key);
    if(found){altData=found;break;}
  }
  const current=_altVotesCache[key];
  // Toggle si même vote
  if(current===vote){
    await safeRun(sb.from('alternative_feedback').delete().eq('user_id',me.id).eq('alt_key',key),{silent:true,context:'voteAlt delete'});
    delete _altVotesCache[key];
  }else{
    const payload={
      user_id:me.id,
      alt_key:key,
      alt_brand:brand,
      alt_type:type,
      vote,
      alt_name:altData?.nom||null,
      alt_image_url:altData?.image_url||null,
      alt_url:altData?.url||null,
      alt_price:altData?.prix||null,
      alt_score_eco:altData?.score_eco||null
    };
    const{error}=await safeRun(sb.from('alternative_feedback').upsert(payload,{onConflict:'user_id,alt_key'}),{friendly:"Impossible d'enregistrer ton vote.",context:'voteAlt'});
    if(error)return;
    _altVotesCache[key]=vote;
  }
  // Refresh visuel du cœur
  const isActive=_altVotesCache[key]==='up';
  card.querySelectorAll('.alt-heart').forEach(h=>{
    h.classList.toggle('active',isActive);
    const svg=h.querySelector('svg');
    if(svg){
      svg.setAttribute('fill',isActive?'#1E4FD8':'none');
      svg.setAttribute('stroke',isActive?'#1E4FD8':'var(--wd)');
    }
  });
  // Backward compat (anciens boutons texte si jamais rendus)
  card.querySelectorAll('.alt-vote-btn').forEach(b=>{
    const v=b.dataset.vote;
    b.classList.toggle('active',_altVotesCache[key]===v);
  });
}

// ── Matching score ──
let _userPrefsCache=null;
async function getUserPrefs(){
  if(_userPrefsCache!==null)return _userPrefsCache;
  if(!me){_userPrefsCache={};return {};}
  try{
    const{data}=await sb.from('profiles').select('preferences').eq('id',me.id).maybeSingle();
    _userPrefsCache=data?.preferences||{};
  }catch(e){_userPrefsCache={};}
  return _userPrefsCache;
}
function invalidateUserPrefsCache(){_userPrefsCache=null;}

function budgetRangeMatch(prix, budgetPref){
  if(!prix||!budgetPref)return false;
  if(budgetPref==='economique')return prix<50;
  if(budgetPref==='equilibre')return prix>=50&&prix<=150;
  if(budgetPref==='premium')return prix>150;
  return false;
}

function computeMatchScore(alt, detectedType, detectedColor, prefs){
  let score=0;
  let breakdown=[];
  // Type (poids fort)
  if(detectedType&&detectedType!=='vetement'){
    const similar=getSimilarTypes(detectedType);
    if(similar.includes(alt.type)){score+=40;breakdown.push('type');}
  }else if(alt.type){score+=20;}
  // Couleur (si détectée et présente sur l'alt)
  if(detectedColor&&alt.couleur_principale&&alt.couleur_principale.toLowerCase()===detectedColor.toLowerCase()){
    score+=20;breakdown.push('couleur');
  }
  // Style (préférences user × tags alt)
  if(prefs?.styles?.length&&alt.style_tags){
    const altStyles=(Array.isArray(alt.style_tags)?alt.style_tags:String(alt.style_tags).split(',')).map(s=>s.trim().toLowerCase());
    if(prefs.styles.some(s=>altStyles.includes(s.toLowerCase()))){score+=15;breakdown.push('style');}
  }
  // Budget (gamme de prix user × prix alt)
  if(prefs?.budget&&budgetRangeMatch(alt.prix,prefs.budget)){
    score+=15;breakdown.push('budget');
  }
  // Bonus éthique (toujours valorisé)
  if(alt.score_eco>=4){score+=10;breakdown.push('eco');}
  return {score:Math.min(score,100),breakdown};
}

async function applyMatchScores(altsByCategory, detectedType, detectedColor){
  const prefs=await getUserPrefs();
  for(const cat of Object.keys(altsByCategory)){
    altsByCategory[cat]=altsByCategory[cat].map(a=>{
      const{score,breakdown}=computeMatchScore(a,detectedType,detectedColor,prefs);
      return {...a,_match:score,_matchBreakdown:breakdown};
    }).sort((a,b)=>b._match-a._match);
  }
  return altsByCategory;
}

async function openAlt(item) {
  const p = item || currentLook || { emoji:'👗', name:t('this_item'), brand:'—', price:'—', eco:3 };
  document.getElementById('scan-phase').style.display   = 'block';
  document.getElementById('result-phase').style.display = 'none';
  document.getElementById('scan-bar').style.width = '0%';
  document.getElementById('overlay').classList.add('show');
  document.getElementById('prod-sheet').classList.remove('show');
  document.getElementById('alt-sheet').classList.add('show');

  let prog = 0;
  const iv = setInterval(() => {
    prog += Math.random() * 12;
    if (prog >= 85) { prog = 85; clearInterval(iv); }
    document.getElementById('scan-bar').style.width = prog + '%';
  }, 100);

  try {
    // === CLIP : détecte le type de vêtement depuis l'image ===
    let detectedType = null;
    let detectionMethod = 'keywords';
    const imgEl = document.getElementById('look-img-real');
    const hasRealImage = imgEl && imgEl.style.display !== 'none' && imgEl.src;
    if (hasRealImage) {
      const detection = await detectVetement(imgEl, p.name || '');
      detectedType = detection.type;
      detectionMethod = detection.method;
      currentDetection = detection;
      console.log(`🎯 CLIP détecte: ${detectedType} (${Math.round(detection.confidence*100)}% conf, méthode: ${detectionMethod})`);
    } else {
      detectedType = detectTypeFromKeywords(p.name || '') || 'vetement';
    }

    // === Airtable : charge les 3 onglets en parallèle ===
    const [ethique, seconde_main, budget] = await Promise.all([
      fetchAlternatives(detectedType, 'ethique'),
      fetchAlternatives(detectedType, 'seconde_main'),
      fetchAlternatives(detectedType, 'budget'),
    ]);
    currentAltData = await applyMatchScores({ ethique, seconde_main, budget }, detectedType, currentDetection?.couleur);
    await loadAltVotes();

    clearInterval(iv);
    document.getElementById('scan-bar').style.width = '100%';
    setTimeout(() => {
      document.getElementById('scan-phase').style.display = 'none';
      document.getElementById('result-phase').style.display = 'flex';
      document.getElementById('res-emoji').innerHTML = _itemSvg;
      document.getElementById('res-name').textContent  = p.name  || t('this_item');
      document.getElementById('res-brand').textContent = p.brand || '';
      const methodBadge = detectionMethod === 'clip'
        ? `<span style="font-size:9px;background:rgba(240,234,216,.1);border:1px solid var(--gold-b);color:var(--gold);padding:2px 8px;border-radius:10px;letter-spacing:1px;margin-left:6px">🧠 CLIP Vision</span>`
        : `<span style="font-size:9px;background:rgba(245,240,232,.07);border:1px solid rgba(245,240,232,.15);color:var(--wd);padding:2px 8px;border-radius:10px;letter-spacing:1px;margin-left:6px">${t('detection_keywords')}</span>`;
      document.getElementById('res-eco').innerHTML = ecoStars(p.eco || 2) + methodBadge;
      document.querySelectorAll('.alt-tab').forEach((tabEl,i) => tabEl.classList.toggle('active', i===0));
      renderAltTabLive('ethique');
    }, 300);
  } catch(e) {
    console.error('openAlt error:', e);
    clearInterval(iv);
    currentAltData = await applyMatchScores({
      ethique:      getFallbackAlternatives('', 'ethique'),
      seconde_main: getFallbackAlternatives('', 'seconde_main'),
      budget:       getFallbackAlternatives('', 'budget'),
    }, null, null);
    document.getElementById('scan-bar').style.width = '100%';
    setTimeout(() => {
      document.getElementById('scan-phase').style.display = 'none';
      document.getElementById('result-phase').style.display = 'flex';
      document.getElementById('res-emoji').innerHTML = _itemSvg;
      document.getElementById('res-name').textContent  = p.name  || t('this_item');
      document.getElementById('res-brand').textContent = p.brand || '';
      document.getElementById('res-eco').innerHTML = ecoStars(p.eco || 2);
      document.querySelectorAll('.alt-tab').forEach((tabEl,i) => tabEl.classList.toggle('active', i===0));
      renderAltTabLive('ethique');
    }, 300);
  }
}
function altTab(el, type) {
  document.querySelectorAll('.alt-tab').forEach(tabEl => tabEl.classList.remove('active'));
  el.classList.add('active');
  renderAltTabLive(type);
}

function renderAltTabLive(type = 'ethique') {
  const items = currentAltData[type] || [];
  const container = document.getElementById('alt-content');
  if (!items.length) {
    container.innerHTML = `<div class="empty-state"><img src="mascote_ivory/the_balance.png" alt=""><div>${t('no_alt_found')}<div class="es-note">${t('donnees_estim')}</div></div></div>`;
    return;
  }
  container.innerHTML = items.map(a => {
    const aKey=altKey(a);
    const userVote=_altVotesCache[aKey];
    const hasImg = !!a.image_url;
    const imgPart = hasImg
      ? `<img src="${a.image_url}" alt="${escapeHtml(a.nom)}"
           class="img-cover-r"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const emojiFallback = `<div style="display:${hasImg?'none':'flex'};width:100%;height:100%;align-items:center;justify-content:center">${_clotheSvgFb}</div>`;
    const productUrl = safeUrl(a.url) !== '#'
      ? safeUrl(a.url)
      : `https://www.google.com/search?q=${encodeURIComponent((a.nom+' '+a.marque).trim())}`;
    const demoBadge=a._isDemo?`<div class="demo-badge demo-badge--sm">${t('demo_badge')}</div>`:'';
    const altCredit=a.image_photographer?`<div class="pexels-credit" style="font-size:7px;bottom:2px;right:2px;padding:1px 4px" title="Photo: ${escapeHtml(a.image_photographer)}"></div>`:'';
    return `
    <div class="alt-result-card" onclick="window.open('${productUrl}','_blank')">
      <div class="alt-result-img" style="overflow:hidden;border-radius:8px;position:relative">${imgPart}${emojiFallback}${demoBadge}${altCredit}</div>
      <div class="flex-min">
        <div style="font-size:13px;font-weight:500;color:var(--white);margin-bottom:2px">${escapeHtml(a.nom)}</div>
        <div class="txt-xs-gold-mb">${escapeHtml(a.marque)}</div>
        <div class="row-tags">
          <div class="eco-score">${ecoStars(a.score_eco)}</div>
          ${a.matiere ? `<span class="txt-xxs-dim">${escapeHtml(a.matiere)}</span>` : ''}
          ${a.label ? `<span style="font-size:9px;background:rgba(80,180,80,.15);color:#7dc97d;border:1px solid rgba(80,180,80,.3);padding:1px 6px;border-radius:10px">${escapeHtml(a.label)}</span>` : ''}
        </div>
        <div style="margin-top:6px">
          <span style="display:inline-block;font-size:9px;letter-spacing:1px;text-transform:uppercase;background:rgba(240,234,216,0.12);border:1px solid rgba(240,234,216,0.3);color:rgba(240,234,216,0.7);padding:2px 7px;border-radius:4px">${t('lien_affilie')}</span>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <div style="font-size:14px;font-weight:500;color:var(--gold-l)">${a.prix ? a.prix+'€' : '—'}</div>
        ${typeof a._match==='number'?`<div style="font-size:11px;font-weight:600;color:${a._match>=60?'#7dc97d':a._match>=30?'#D4AF6F':'var(--wd)'};letter-spacing:.3px">${a._match}% match</div>`:''}
        <div style="font-size:9px;letter-spacing:1px;color:var(--wd);text-transform:uppercase">${t('voir_arrow')}</div>
        <div onclick="event.stopPropagation();voteAlt('${aKey.replace(/'/g,'\\\'')}','${(a.marque||'').replace(/'/g,'\\\'')}', '${a.type||''}', 'up', this)" class="alt-heart ${userVote==='up'?'active':''}" data-key="${aKey.replace(/'/g,'\\\'')}" style="cursor:pointer;padding:4px;margin-top:2px">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="${userVote==='up'?'#1E4FD8':'none'}" stroke="${userVote==='up'?'#1E4FD8':'var(--wd)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition:fill 150ms cubic-bezier(0.23,1,0.32,1),stroke 150ms cubic-bezier(0.23,1,0.32,1)"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </div>
      </div>
    </div>`;
  }).join('') + `<div style="text-align:center;font-size:11px;color:var(--wd);opacity:.5;margin-top:8px;padding-bottom:8px">${t('donnees_estim')}</div>`;
}

// Compatibilité — NE PAS SUPPRIMER (règle absolue WearAura)
function renderAltTab(type) { renderAltTabLive(type); }

// ═══════════════════════════════════════════
// SHEETS & OVERLAYS
// ═══════════════════════════════════════════
var _sheetLastFocus=null;
var _sheetTrapCleanup=null;
function _trapFocus(el){
  const sel='button,a,[href],[tabindex]:not([tabindex="-1"]),input,textarea,select';
  function focusables(){return Array.from(el.querySelectorAll(sel)).filter(e=>!e.disabled&&e.offsetParent!==null);}
  function handler(e){
    if(e.key!=='Tab')return;
    const items=focusables();if(!items.length)return;
    const first=items[0],last=items[items.length-1];
    if(e.shiftKey){if(document.activeElement===first){e.preventDefault();last.focus();}}
    else{if(document.activeElement===last){e.preventDefault();first.focus();}}
  }
  el.addEventListener('keydown',handler);
  const first=focusables()[0];if(first)first.focus();
  return()=>el.removeEventListener('keydown',handler);
}
function openSheet(id){
  _sheetLastFocus=document.activeElement;
  document.getElementById('overlay').classList.add('show');
  const el=document.getElementById(id);
  el.classList.add('show');
  if(_sheetTrapCleanup)_sheetTrapCleanup();
  _sheetTrapCleanup=_trapFocus(el);
}
function closeSheet(id){
  const el=document.getElementById(id);
  const ov=document.getElementById('overlay');
  if(!el)return;
  if(_sheetTrapCleanup){_sheetTrapCleanup();_sheetTrapCleanup=null;}
  if(_sheetLastFocus&&_sheetLastFocus.focus)_sheetLastFocus.focus();
  el.classList.add('hiding');
  if(ov&&ov.classList.contains('show'))ov.classList.add('hiding');
  setTimeout(()=>{
    el.classList.remove('show','hiding');
    if(ov)ov.classList.remove('show','hiding');
  },240);
}
function closeAll(){
  cancelBackConfirm();
  _cancelEdit();
  const ov=document.getElementById('overlay');
  const SHEETS=['sheet-comments','prod-sheet','alt-sheet','sheet-share','retouche-sheet'];
  // Lancer l'animation de sortie sur tous les sheets visibles
  const visible=SHEETS.filter(id=>{const e=document.getElementById(id);return e&&e.classList.contains('show');});
  if(visible.length){
    visible.forEach(id=>document.getElementById(id).classList.add('hiding'));
    if(ov&&ov.classList.contains('show'))ov.classList.add('hiding');
    setTimeout(()=>{
      visible.forEach(id=>{const e=document.getElementById(id);if(e)e.classList.remove('show','hiding');});
      if(ov)ov.classList.remove('show','hiding');
    },240);
  }else{
    if(ov)ov.classList.remove('show');
  }
  const viewer=document.getElementById('conv-viewer');
  if(viewer)viewer.style.display='none';
  currentAltData={ethique:[],seconde_main:[],budget:[]};currentDetection=null;
  // Remettre look-img-wrap visible pour la prochaine ouverture
  const imgWrap=document.getElementById('look-img-wrap');
  if(imgWrap)imgWrap.style.display='flex';
}
function openSettings(){
  document.getElementById('settings-panel').style.right='0';
  document.getElementById('settings-overlay').style.display='block';
  ['edit-profile-form','change-pw-form','change-email-form'].forEach(id=>{document.getElementById(id).style.display='none';});
  loadSettingsPrefs();
  loadPrivateStatus();
}
function closeSettings(){
  document.getElementById('settings-panel').style.right='-100%';
  document.getElementById('settings-overlay').style.display='none';
  ['help-panel','report-panel','about-panel'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.style.display='none';
  });
  document.querySelectorAll('.faq-item.open').forEach(item=>item.classList.remove('open'));
}

// ── SETTINGS — Préférences & toggles ──────────────────────────────────────
const settPrefs={isPrivate:false,notifLikes:true,notifFollows:true};

async function loadSettingsPrefs(){
  if(!me)return;
  try{
    const{data}=await sb.from('profiles').select('is_private,notif_likes,notif_follows').eq('id',me.id).maybeSingle();
    if(!data)return;
    settPrefs.isPrivate=data.is_private||false;
    settPrefs.notifLikes=data.notif_likes!==false;
    settPrefs.notifFollows=data.notif_follows!==false;
    applyToggleUI('toggle-private',settPrefs.isPrivate);
    applyToggleUI('toggle-notif-likes',settPrefs.notifLikes);
    applyToggleUI('toggle-notif-follows',settPrefs.notifFollows);
    if(typeof refreshPushToggleUI==='function')refreshPushToggleUI();
  }catch(e){console.warn('loadSettingsPrefs:',e.message);}
}

function applyToggleUI(id,isOn){
  const el=document.getElementById(id);
  if(!el)return;
  const knob=document.getElementById(id+'-knob');
  if(isOn){el.style.background='var(--gold)';if(knob)knob.style.transform='translateX(22px)';}
  else{el.style.background='rgba(255,255,255,.1)';if(knob)knob.style.transform='translateX(0)';}
}

function togglePrivate(){togglePrivateAccount();}

// ═══════════════════════════════════════════
// COMPTE PRIVÉ — logique complète
// ═══════════════════════════════════════════
let isPrivateAccount=false;
async function loadPrivateStatus(){
  if(!me)return;
  try{
    const{data:prof}=await sb.from('profiles').select('is_private').eq('id',me.id).maybeSingle();
    isPrivateAccount=prof?.is_private||false;
  }catch(e){isPrivateAccount=false;console.warn('loadPrivateStatus:',e.message);}
  updatePrivateToggleUI(isPrivateAccount);
}
function updatePrivateToggleUI(isPrivate){
  const toggle=document.getElementById('toggle-private');
  const knob=document.getElementById('toggle-private-knob');
  const statusText=document.getElementById('private-status-text');
  const infoBox=document.getElementById('private-info-box');
  if(!toggle)return;
  if(isPrivate){
    toggle.style.background='var(--gold)';
    if(knob)knob.style.left='25px';
    if(statusText){statusText.textContent=t('private_on_status');statusText.style.color='var(--gold)';}
    if(infoBox)infoBox.style.display='block';
  }else{
    toggle.style.background='rgba(255,255,255,.1)';
    if(knob)knob.style.left='3px';
    if(statusText){statusText.textContent=t('private_off_status');statusText.style.color='var(--wd)';}
    if(infoBox)infoBox.style.display='none';
  }
}
async function togglePrivateAccount(){
  if(!me)return toast(t('login_settings'));
  const newValue=!isPrivateAccount;
  isPrivateAccount=newValue;
  settPrefs.isPrivate=newValue;
  updatePrivateToggleUI(newValue);
  const{error}=await sb.from('profiles').upsert({id:me.id,is_private:newValue});
  if(error){
    isPrivateAccount=!newValue;
    settPrefs.isPrivate=!newValue;
    updatePrivateToggleUI(!newValue);
    toast('❌ '+t('try_again'));
    return;
  }
  toast(newValue?t('toast_private_on'):t('toast_private_off'));
}

async function toggleNotif(type){
  if(!me)return;
  try{
    if(type==='likes'){
      settPrefs.notifLikes=!settPrefs.notifLikes;
      applyToggleUI('toggle-notif-likes',settPrefs.notifLikes);
      await sb.from('profiles').update({notif_likes:settPrefs.notifLikes}).eq('id',me.id);
    }else if(type==='follows'){
      settPrefs.notifFollows=!settPrefs.notifFollows;
      applyToggleUI('toggle-notif-follows',settPrefs.notifFollows);
      await sb.from('profiles').update({notif_follows:settPrefs.notifFollows}).eq('id',me.id);
    }
  }catch(e){console.warn('toggleNotif:',e.message);}
}

function openChangePassword(){
  const form=document.getElementById('change-pw-form');
  const isOpen=form.style.display==='block';
  ['edit-profile-form','change-pw-form','change-email-form'].forEach(id=>{document.getElementById(id).style.display='none';});
  if(!isOpen)form.style.display='block';
}

function openChangeEmail(){
  const form=document.getElementById('change-email-form');
  const isOpen=form.style.display==='block';
  ['edit-profile-form','change-pw-form','change-email-form'].forEach(id=>{document.getElementById(id).style.display='none';});
  if(!isOpen){
    form.style.display='block';
    if(me)document.getElementById('new-email').value=me.email||'';
  }
}

async function savePassword(){
  if(!me)return;
  const pw=document.getElementById('new-pw').value;
  const pw2=document.getElementById('new-pw-confirm').value;
  if(!pw||pw.length<6)return toast(t('pw_too_short'));
  if(pw!==pw2)return toast(t('pw_mismatch'));
  const{error}=await sb.auth.updateUser({password:pw});
  if(error)return toast('❌ '+error.message);
  document.getElementById('new-pw').value='';
  document.getElementById('new-pw-confirm').value='';
  document.getElementById('change-pw-form').style.display='none';
  toast(t('pw_updated'));
}

async function saveEmail(){
  if(!me)return;
  const email=document.getElementById('new-email').value.trim();
  if(!email||!email.includes('@'))return toast(t('email_invalid'));
  const{error}=await sb.auth.updateUser({email});
  if(error)return toast('❌ '+error.message);
  document.getElementById('change-email-form').style.display='none';
  toast(t('email_updated'));
}

let _aiTestFile=null;
let _aiTestMode='rect'; // 'rect' | 'cloud'
let _aiTestRegion={x:0,y:0,w:0,h:0};
let _aiTestPoints=[];
let _aiTestDragging=null;
let _aiTestDragStart=null;

async function runAITest(e){
  const file=e.target.files[0];
  if(!file)return;
  _aiTestFile=file;
  const panel=document.getElementById('ai-test-panel');
  const img=document.getElementById('ai-test-img');
  panel.style.display='block';
  img.src=URL.createObjectURL(file);
  aiTestSwitchMode('rect');

  const wrap=document.getElementById('ai-test-img-wrap');
  wrap.onclick=(ev)=>{
    if(_aiTestDragging)return;
    const rect=wrap.getBoundingClientRect();
    const xPct=((ev.clientX-rect.left)/rect.width)*100;
    const yPct=((ev.clientY-rect.top)/rect.height)*100;
    if(_aiTestMode==='rect')_aiTestPlaceRegion(xPct,yPct);
    else _aiTestAddCloudPoint(xPct,yPct);
  };
  _aiTestSetupDragHandlers();
}

function aiTestSwitchMode(mode){
  _aiTestMode=mode;
  // Reset visuel
  _aiTestRegion={x:0,y:0,w:0,h:0};
  _aiTestPoints=[];
  document.getElementById('ai-test-region').style.display='none';
  document.getElementById('ai-test-cloud-overlay').innerHTML='';
  document.getElementById('ai-test-btn-row').style.display='none';
  document.getElementById('ai-test-result').textContent='';
  // Tabs visuelles
  const rectTab=document.getElementById('ai-mode-rect');
  const cloudTab=document.getElementById('ai-mode-cloud');
  if(mode==='rect'){
    rectTab.classList.add('active');cloudTab.classList.remove('active');
    rectTab.style.cssText='flex:1;text-align:center;padding:8px;font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:var(--black);background:var(--gold);border-radius:var(--r-pill);cursor:pointer;font-weight:600';
    cloudTab.style.cssText='flex:1;text-align:center;padding:8px;font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:var(--wd);cursor:pointer';
    document.getElementById('ai-test-hint').textContent=t('hotspot_hint_zone');
  }else{
    cloudTab.classList.add('active');rectTab.classList.remove('active');
    cloudTab.style.cssText='flex:1;text-align:center;padding:8px;font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:var(--black);background:var(--gold);border-radius:var(--r-pill);cursor:pointer;font-weight:600';
    rectTab.style.cssText='flex:1;text-align:center;padding:8px;font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:var(--wd);cursor:pointer';
    document.getElementById('ai-test-hint').textContent=t('hotspot_hint_points');
  }
}

let _aiCloudDragIdx=null;
let _aiCloudPressStart=null;

function _aiTestFindPointNear(xPct,yPct,thresholdPct=4){
  for(let i=0;i<_aiTestPoints.length;i++){
    const p=_aiTestPoints[i];
    const dx=p.x-xPct,dy=p.y-yPct;
    if(Math.sqrt(dx*dx+dy*dy)<thresholdPct)return i;
  }
  return -1;
}

function _aiTestAddCloudPoint(xPct,yPct){
  // Vérifie si on tape sur un point existant
  const existingIdx=_aiTestFindPointNear(xPct,yPct);
  if(existingIdx>=0){
    // Tap sur un point existant → supprimer
    _aiTestPoints.splice(existingIdx,1);
    _aiTestRenderCloud();
    if(_aiTestPoints.length===0){
      document.getElementById('ai-test-btn-row').style.display='none';
      document.getElementById('ai-test-result').textContent='';
    }else{
      document.getElementById('ai-test-result').textContent=`📍 ${_aiTestPoints.length} point${_aiTestPoints.length>1?'s':''} restant${_aiTestPoints.length>1?'s':''}. Tape sur un point pour le supprimer.`;
    }
    return;
  }
  _aiTestPoints.push({x:xPct,y:yPct});
  _aiTestRenderCloud();
  document.getElementById('ai-test-btn-row').style.display='flex';
  document.getElementById('ai-test-result').textContent=`📍 ${_aiTestPoints.length} point${_aiTestPoints.length>1?'s':''} placé${_aiTestPoints.length>1?'s':''}. Tape sur un point pour le supprimer, drag pour bouger.`;
}

function _aiTestRenderCloud(){
  const overlay=document.getElementById('ai-test-cloud-overlay');
  overlay.style.pointerEvents=_aiTestPoints.length?'auto':'none';
  overlay.innerHTML=_aiTestPoints.map((p,i)=>`<div data-ptidx="${i}" style="position:absolute;left:${p.x}%;top:${p.y}%;width:18px;height:18px;border-radius:50%;background:var(--gold);border:2px solid white;transform:translate(-50%,-50%);box-shadow:0 2px 6px rgba(0,0,0,0.5);font-size:9px;font-weight:700;color:var(--black);display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none">${i+1}</div>`).join('');
  // Bind drag/tap sur chaque point
  overlay.querySelectorAll('[data-ptidx]').forEach(el=>{
    const idx=parseInt(el.dataset.ptidx);
    const onStart=(ev)=>{
      _aiCloudDragIdx=idx;
      const t=ev.touches?ev.touches[0]:ev;
      _aiCloudPressStart={x:t.clientX,y:t.clientY,moved:false};
      el.style.cursor='grabbing';
      ev.stopPropagation();
      ev.preventDefault();
    };
    el.addEventListener('mousedown',onStart);
    el.addEventListener('touchstart',onStart,{passive:false});
  });
}

// Handlers globaux pour le drag des points cloud
document.addEventListener('mousemove',_aiCloudMove);
document.addEventListener('touchmove',_aiCloudMove,{passive:false});
document.addEventListener('mouseup',_aiCloudEnd);
document.addEventListener('touchend',_aiCloudEnd);

function _aiCloudMove(ev){
  if(_aiCloudDragIdx===null||!_aiCloudPressStart)return;
  const t=ev.touches?ev.touches[0]:ev;
  const dx=Math.abs(t.clientX-_aiCloudPressStart.x);
  const dy=Math.abs(t.clientY-_aiCloudPressStart.y);
  if(dx<5&&dy<5)return; // pas encore en mode drag
  _aiCloudPressStart.moved=true;
  const wrap=document.getElementById('ai-test-img-wrap');
  const rect=wrap.getBoundingClientRect();
  const xPct=((t.clientX-rect.left)/rect.width)*100;
  const yPct=((t.clientY-rect.top)/rect.height)*100;
  _aiTestPoints[_aiCloudDragIdx]={x:Math.max(2,Math.min(98,xPct)),y:Math.max(2,Math.min(98,yPct))};
  _aiTestRenderCloud();
  ev.preventDefault();
}
function _aiCloudEnd(ev){
  if(_aiCloudDragIdx===null)return;
  const wasMoved=_aiCloudPressStart?._aiCloudPressStart?.moved||_aiCloudPressStart?.moved;
  // Si pas de mouvement = tap = supprimer
  if(_aiCloudPressStart&&!_aiCloudPressStart.moved){
    _aiTestPoints.splice(_aiCloudDragIdx,1);
    _aiTestRenderCloud();
    if(_aiTestPoints.length===0){
      document.getElementById('ai-test-btn-row').style.display='none';
      document.getElementById('ai-test-result').textContent='';
    }else{
      document.getElementById('ai-test-result').textContent=`📍 ${_aiTestPoints.length} point${_aiTestPoints.length>1?'s':''} restant${_aiTestPoints.length>1?'s':''}.`;
    }
  }
  _aiCloudDragIdx=null;
  _aiCloudPressStart=null;
}

function aiTestClearPoints(){
  _aiTestPoints=[];
  _aiTestRegion={x:0,y:0,w:0,h:0};
  document.getElementById('ai-test-cloud-overlay').innerHTML='';
  document.getElementById('ai-test-region').style.display='none';
  document.getElementById('ai-test-btn-row').style.display='none';
  document.getElementById('ai-test-result').textContent='';
}

async function aiTestDetect(){
  if(_aiTestMode==='rect')return aiTestDetectRegion();
  return aiTestDetectCloud();
}

async function aiTestDetectCloud(){
  if(!_aiTestPoints.length)return;
  const result=document.getElementById('ai-test-result');
  result.textContent=`🌱 Analyse de ${_aiTestPoints.length} point${_aiTestPoints.length>1?'s':''}...`;
  try{
    const img=new Image();
    img.crossOrigin='anonymous';
    await new Promise((r,e)=>{img.onload=r;img.onerror=e;img.src=URL.createObjectURL(_aiTestFile);});
    const w=img.naturalWidth,h=img.naturalHeight;
    const classifier=await window.loadFashionClassifier();
    if(!classifier){result.textContent=t('hotspot_model_unloaded');return;}
    const FASHION_LABELS=['coat','jacket','blazer','cardigan','sweater','hoodie','sweatshirt','t-shirt','shirt','polo','dress','skirt','jeans','pants','shorts','sneakers','boots','heels','sandals','handbag','backpack','tote bag','sunglasses','hat','scarf','belt'];
    const t0=performance.now();
    const scoreMap={};
    const cropSizePct=10; // 10% : crop précis pour isoler les détails (col roulé sous cardigan, etc.)
    for(const p of _aiTestPoints){
      const cropSize=Math.round(Math.min(w,h)*(cropSizePct/100));
      const cx=Math.round(w*p.x/100),cy=Math.round(h*p.y/100);
      const sx=Math.max(0,cx-cropSize/2),sy=Math.max(0,cy-cropSize/2);
      const sw=Math.min(cropSize,w-sx),sh=Math.min(cropSize,h-sy);
      const canvas=document.createElement('canvas');
      canvas.width=224;canvas.height=224;
      canvas.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,224,224);
      const res=await classifier(canvas.toDataURL('image/jpeg',0.9),FASHION_LABELS);
      const top=res[0];
      if(!scoreMap[top.label])scoreMap[top.label]={votes:0,sumScore:0,maxScore:0};
      scoreMap[top.label].votes++;
      scoreMap[top.label].sumScore+=top.score;
      scoreMap[top.label].maxScore=Math.max(scoreMap[top.label].maxScore,top.score);
    }
    const latency=Math.round(performance.now()-t0);
    const ranked=Object.entries(scoreMap)
      .map(([label,s])=>({label,votes:s.votes,avgScore:s.sumScore/s.votes,maxScore:s.maxScore,combined:s.votes*0.6+s.sumScore*0.4}))
      .sort((a,b)=>b.combined-a.combined);
    const winner=ranked[0];
    const LABEL_TO_TYPE={'coat':'manteau','jacket':'veste','blazer':'blazer','cardigan':'cardigan','sweater':'pull','hoodie':'pull','sweatshirt':'pull','t-shirt':'t-shirt','shirt':'chemise','polo':'polo','dress':'robe','skirt':'jupe','jeans':'jean','pants':'pantalon','shorts':'short','sneakers':'sneaker','boots':'bottes','heels':'chaussures','sandals':'sandales','handbag':'sac','backpack':'sac à dos','tote bag':'sac','sunglasses':'lunettes','hat':'chapeau','scarf':'écharpe','belt':'ceinture'};
    const labelKey=winner.label;
    result.innerHTML=`<b class="c-gold">✅ Détection consensuelle (nuage)</b>
Type : <b>${LABEL_TO_TYPE[labelKey]||labelKey}</b>
Consensus : ${winner.votes}/${_aiTestPoints.length} points (${Math.round(winner.votes/_aiTestPoints.length*100)}%)
Confiance moyenne : ${Math.round(winner.avgScore*100)}%
Confiance max : ${Math.round(winner.maxScore*100)}%
Latence totale : ${latency}ms (${Math.round(latency/_aiTestPoints.length)}ms/point)
─────
Top 3 :
${ranked.slice(0,3).map((r,i)=>`${i+1}. ${r.label} — ${r.votes} votes (${Math.round(r.avgScore*100)}% conf moy)`).join('\n')}`;
  }catch(err){
    result.textContent='❌ Erreur : '+err.message;
  }
}

function _aiTestPlaceRegion(cx,cy){
  const w=25,h=30;
  _aiTestRegion={
    x:Math.max(0,Math.min(100-w,cx-w/2)),
    y:Math.max(0,Math.min(100-h,cy-h/2)),
    w,h
  };
  _aiTestRenderRegion();
  document.getElementById('ai-test-btn-row').style.display='flex';
  document.getElementById('ai-test-result').textContent=t('hotspot_adjust_corners');
}

function _aiTestRenderRegion(){
  const region=document.getElementById('ai-test-region');
  region.style.display='block';
  region.style.left=_aiTestRegion.x+'%';
  region.style.top=_aiTestRegion.y+'%';
  region.style.width=_aiTestRegion.w+'%';
  region.style.height=_aiTestRegion.h+'%';
}

function _aiTestSetupDragHandlers(){
  const wrap=document.getElementById('ai-test-img-wrap');
  const onStart=(ev)=>{
    const target=ev.target.closest('.ai-test-handle');
    if(!target)return;
    _aiTestDragging=target.dataset.corner;
    const touch=ev.touches?ev.touches[0]:ev;
    _aiTestDragStart={x:touch.clientX,y:touch.clientY,region:{..._aiTestRegion}};
    ev.preventDefault();
  };
  const onMove=(ev)=>{
    if(!_aiTestDragging)return;
    const touch=ev.touches?ev.touches[0]:ev;
    const rect=wrap.getBoundingClientRect();
    const dx=((touch.clientX-_aiTestDragStart.x)/rect.width)*100;
    const dy=((touch.clientY-_aiTestDragStart.y)/rect.height)*100;
    const s=_aiTestDragStart.region;
    let nx=s.x,ny=s.y,nw=s.w,nh=s.h;
    if(_aiTestDragging==='move'){nx=s.x+dx;ny=s.y+dy;}
    else if(_aiTestDragging==='nw'){nx=s.x+dx;ny=s.y+dy;nw=s.w-dx;nh=s.h-dy;}
    else if(_aiTestDragging==='ne'){ny=s.y+dy;nw=s.w+dx;nh=s.h-dy;}
    else if(_aiTestDragging==='sw'){nx=s.x+dx;nw=s.w-dx;nh=s.h+dy;}
    else if(_aiTestDragging==='se'){nw=s.w+dx;nh=s.h+dy;}
    // Bornes : min 5%, max image
    if(nw<5||nh<5)return;
    nx=Math.max(0,Math.min(100-nw,nx));
    ny=Math.max(0,Math.min(100-nh,ny));
    nw=Math.min(nw,100-nx);
    nh=Math.min(nh,100-ny);
    _aiTestRegion={x:nx,y:ny,w:nw,h:nh};
    _aiTestRenderRegion();
    ev.preventDefault();
  };
  const onEnd=()=>{setTimeout(()=>{_aiTestDragging=null;},50);};
  wrap.addEventListener('mousedown',onStart);
  wrap.addEventListener('touchstart',onStart,{passive:false});
  window.addEventListener('mousemove',onMove);
  window.addEventListener('touchmove',onMove,{passive:false});
  window.addEventListener('mouseup',onEnd);
  window.addEventListener('touchend',onEnd);
}

async function aiTestDetectRegion(){
  const result=document.getElementById('ai-test-result');
  result.textContent=t('hotspot_analyzing');
  try{
    // Crop la zone exacte via canvas, puis classifier
    const img=new Image();
    img.crossOrigin='anonymous';
    await new Promise((r,e)=>{img.onload=r;img.onerror=e;img.src=URL.createObjectURL(_aiTestFile);});
    const w=img.naturalWidth,h=img.naturalHeight;
    const sx=Math.round(w*_aiTestRegion.x/100);
    const sy=Math.round(h*_aiTestRegion.y/100);
    const sw=Math.round(w*_aiTestRegion.w/100);
    const sh=Math.round(h*_aiTestRegion.h/100);
    const canvas=document.createElement('canvas');
    canvas.width=224;canvas.height=224;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(img,sx,sy,sw,sh,0,0,224,224);
    const cropUrl=canvas.toDataURL('image/jpeg',0.9);
    const t0=performance.now();
    const detection=await window.detectFashionOnDevice(cropUrl);
    const latency=Math.round(performance.now()-t0);
    if(detection.error){result.textContent='❌ Erreur : '+detection.error;return;}
    result.innerHTML=`<b class="c-gold">✅ Détection sur zone délimitée</b>
Type : <b>${detection.type}</b>
Confiance : ${detection.confidence}%
Latence : ${latency}ms
Zone : ${Math.round(_aiTestRegion.w)}% × ${Math.round(_aiTestRegion.h)}% de l'image
─────
Top 3 :
${detection.top3.map((r,i)=>`${i+1}. ${r.label} — ${r.score}%`).join('\n')}`;
  }catch(err){
    result.textContent='❌ Erreur : '+err.message;
  }
}

// ── Followers / Following list sheet ──
let _flwTargetUid=null;
let _flwCurrentTab='followers';
let _flwData={followers:[],following:[]};
let _flwMyFollowing=[];
let _flwMyFollowers=[];

async function openFollowList(kind,targetUid){
  if(!targetUid)return;
  _flwTargetUid=targetUid;
  _flwCurrentTab=kind;
  document.getElementById('flw-search').value='';
  document.getElementById('flw-overlay').style.display='block';
  document.getElementById('flw-sheet').style.display='flex';
  // Affiche le username du profil consulté
  try{
    const{data:targetProf}=await sb.from('profiles').select('username,full_name').eq('id',targetUid).maybeSingle();
    document.getElementById('flw-username').textContent=targetProf?.username||targetProf?.full_name||'';
  }catch(e){}
  // Charge mon réseau pour les badges "Follow back"
  if(me){
    try{
      const[mf,mfwr]=await Promise.all([
        sb.from('follows').select('following_id').eq('follower_id',me.id),
        sb.from('follows').select('follower_id').eq('following_id',me.id)
      ]);
      _flwMyFollowing=(mf.data||[]).map(f=>f.following_id);
      _flwMyFollowers=(mfwr.data||[]).map(f=>f.follower_id);
    }catch(e){_flwMyFollowing=[];_flwMyFollowers=[];}
  }
  await loadFollowTabData('followers');
  await loadFollowTabData('following');
  document.getElementById('flw-count-followers').textContent=_flwData.followers.length;
  document.getElementById('flw-count-following').textContent=_flwData.following.length;
  renderFollowTab();
  highlightFollowTab(kind);
}

async function loadFollowTabData(tab){
  try{
    const col=tab==='followers'?'follower_id':'following_id';
    const whereCol=tab==='followers'?'following_id':'follower_id';
    const{data:follows}=await sb.from('follows').select(col).eq(whereCol,_flwTargetUid);
    const ids=(follows||[]).map(f=>f[col]);
    if(!ids.length){_flwData[tab]=[];return;}
    _flwData[tab]=await getProfiles(ids);
  }catch(e){console.warn('[flw load]',tab,e);_flwData[tab]=[];}
}

function switchFollowTab(tab){
  _flwCurrentTab=tab;
  document.getElementById('flw-search').value='';
  highlightFollowTab(tab);
  renderFollowTab();
}

function highlightFollowTab(tab){
  const followersEl=document.getElementById('flw-tab-followers');
  const followingEl=document.getElementById('flw-tab-following');
  if(tab==='followers'){
    followersEl.style.color='var(--gold)';followersEl.style.borderBottomColor='var(--gold)';followersEl.style.fontWeight='600';
    followingEl.style.color='var(--wd)';followingEl.style.borderBottomColor='transparent';followingEl.style.fontWeight='500';
  }else{
    followingEl.style.color='var(--gold)';followingEl.style.borderBottomColor='var(--gold)';followingEl.style.fontWeight='600';
    followersEl.style.color='var(--wd)';followersEl.style.borderBottomColor='transparent';followersEl.style.fontWeight='500';
  }
}

function renderFollowTab(){
  const list=document.getElementById('flw-list');
  const profs=_flwData[_flwCurrentTab];
  if(!profs.length){
    const isFollowers=_flwCurrentTab==='followers';
    const img=isFollowers?'the_dreamer.png':'the_explorer.png';
    const msg=isFollowers?t('empty_no_followers'):t('empty_follows_nobody');
    const hint=isFollowers?'Partage ton profil pour gagner des abonnés.':'Explore et suis des créateurs inspirants.';
    list.innerHTML=`<div class="empty-state"><img src="mascote_ivory/${img}" alt=""><div>${msg}<div class="es-hint">${hint}</div></div></div>`;
    return;
  }
  const isOwnProfile=me&&_flwTargetUid===me.id;
  const query=(document.getElementById('flw-search').value||'').toLowerCase().trim();
  const filtered=query?profs.filter(p=>(p.username||'').toLowerCase().includes(query)||(p.full_name||'').toLowerCase().includes(query)):profs;
  if(!filtered.length){list.innerHTML=`<div class="empty-state-sm">${t('empty_no_results')}</div>`;return;}
  list.innerHTML=filtered.map(p=>{
    const av=p.avatar_url?`<img src="${p.avatar_url}" alt="" loading="lazy" class="img-cover">`:`<span class="txt-lg-gold-caps">${(p.username||p.full_name||'?').charAt(0)}</span>`;
    const isSelf=me&&p.id===me.id;
    const iFollowThem=_flwMyFollowing.includes(p.id);
    const theyFollowMe=_flwMyFollowers.includes(p.id);
    const followsBack=iFollowThem&&theyFollowMe;
    // Badge "Follow back" : quand quelqu'un me follow mais que je ne le follow pas (uniquement vue de tes propres followers)
    const showFollowBackBadge=isOwnProfile&&_flwCurrentTab==='followers'&&!iFollowThem&&!isSelf;
    let btns='';
    if(!isSelf){
      if(isOwnProfile&&_flwCurrentTab==='followers'){
        // Tes propres abonnés : "Retirer" + "Suivre/Suivi"
        btns=`<button onclick="event.stopPropagation();removeFollower('${p.id}',this)" class="flw-btn flw-btn-secondary">Retirer</button>
              <button onclick="event.stopPropagation();toggleFollowFromList('${p.id}',this)" class="flw-btn ${iFollowThem?'flw-btn-secondary':'flw-btn-primary'}">${iFollowThem?'Suivi ✓':'Suivre'}</button>`;
      }else{
        btns=`<button onclick="event.stopPropagation();toggleFollowFromList('${p.id}',this)" class="flw-btn ${iFollowThem?'flw-btn-secondary':'flw-btn-primary'}">${iFollowThem?'Suivi ✓':'Suivre'}</button>`;
      }
    }
    return `<div onclick="closeFollowList();openUserProfile('${p.id}')" class="list-row">
      <div style="width:44px;height:44px;border-radius:50%;background:var(--black-3);overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(240,234,216,0.15)">${av}</div>
      <div class="flex-min">
        <div style="display:flex;align-items:center;gap:6px"><span class="txt-sm-ellipsis">${escapeHtml(p.username||'utilisateur')}</span>${showFollowBackBadge?'<span style="font-size:11px;color:var(--gold);white-space:nowrap">· Suivre en retour</span>':''}</div>
        <div class="txt-xs-ellipsis">${escapeHtml(p.full_name||'')}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">${btns}</div>
    </div>`;
  }).join('');
}

function filterFollowList(query){
  renderFollowTab();
}

function closeFollowList(){
  document.getElementById('flw-overlay').style.display='none';
  document.getElementById('flw-sheet').style.display='none';
}

async function toggleFollowFromList(uid,btn){
  if(!me)return toast(t('login_required'));
  _triggerAnim(btn,'follow-pulse');
  navigator.vibrate?.(10);
  const isF=btn.classList.contains('flw-btn-secondary')&&btn.textContent.includes('✓');
  if(isF){
    await sb.from('follows').delete().eq('follower_id',me.id).eq('following_id',uid);
    _flwMyFollowing=_flwMyFollowing.filter(id=>id!==uid);
    btn.classList.remove('flw-btn-secondary');btn.classList.add('flw-btn-primary');btn.textContent='Suivre';
  }else{
    await sb.from('follows').insert({follower_id:me.id,following_id:uid});
    if(!_flwMyFollowing.includes(uid))_flwMyFollowing.push(uid);
    btn.classList.remove('flw-btn-primary');btn.classList.add('flw-btn-secondary');btn.textContent='Suivi ✓';
  }
  renderFollowTab(); // refresh "Follow back" badges
}

async function removeFollower(uid,btn){
  if(!me)return;
  if(!confirm(t('confirm_remove_follower')))return;
  await sb.from('follows').delete().eq('follower_id',uid).eq('following_id',me.id);
  _flwMyFollowers=_flwMyFollowers.filter(id=>id!==uid);
  _flwData.followers=_flwData.followers.filter(p=>p.id!==uid);
  document.getElementById('flw-count-followers').textContent=_flwData.followers.length;
  renderFollowTab();
  toast(t('toast_follower_removed'));
}

async function openBlockedUsers(){
  if(!me)return;
  const{data}=await sb.from('profiles').select('blocked_users').eq('id',me.id).maybeSingle();
  const blocked=data?.blocked_users||[];
  if(!blocked.length)return toast(t('aucun_bloque'));
  toast(`${blocked.length} ${t('blocked_users_label')}`);
}

// ── Centre d'aide ──────────────────────────────
function openHelp(){
  const panel=document.getElementById('help-panel');
  const isOpen=panel.style.display==='block';
  ['help-panel','report-panel','about-panel'].forEach(id=>{document.getElementById(id).style.display='none';});
  if(!isOpen)panel.style.display='block';
}

function toggleFaq(item){item.classList.toggle('open');}

// ── Signaler un problème ───────────────────────
let currentRepCat='bug';

function openReport(){
  const panel=document.getElementById('report-panel');
  const isOpen=panel.style.display==='block';
  ['help-panel','report-panel','about-panel'].forEach(id=>{document.getElementById(id).style.display='none';});
  if(!isOpen){
    panel.style.display='block';
    document.getElementById('report-desc').value='';
  }
}

function selectRepCat(el,cat){
  document.querySelectorAll('.rep-cat').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  currentRepCat=cat;
}

async function submitReport(){
  if(!me)return toast(t('login_report'));
  const desc=document.getElementById('report-desc').value.trim();
  if(!desc||desc.length<10)return toast('❌ '+t('report_min_chars'));
  const btn=document.querySelector('#report-panel .btn');
  btn.disabled=true;btn.textContent=t('sending');
  const{error}=await sb.from('feedback').insert({user_id:me.id,email:me.email||null,category:currentRepCat,description:desc});
  btn.disabled=false;btn.textContent=t('report_send_btn');
  if(error)return toast(`❌ ${t('toast_error')}: ${error.message}`);
  document.getElementById('report-desc').value='';
  document.getElementById('report-panel').style.display='none';
  toast(t('report_sent'));
}

// ── À propos ────────────────────────────────────
function openAbout(){
  const panel=document.getElementById('about-panel');
  const isOpen=panel.style.display==='block';
  ['help-panel','report-panel','about-panel'].forEach(id=>{document.getElementById(id).style.display='none';});
  if(!isOpen)panel.style.display='block';
}

// ════════════════════════════════════════
// POINTS AURA — Suggestions communautaires
// ════════════════════════════════════════
async function suggestMaterial(postId,hotspotId,matiere){
  if(!me)return toast(t('login_suggest'));
  const{error}=await sb.from('material_suggestions').insert({
    post_id:postId,hotspot_id:hotspotId,suggested_by:me.id,matiere
  });
  if(error)return toast('❌ '+error.message);
  toast(t('suggestion_sent'));
  await addAuraPoints(1,'suggestion_envoyee');
}

async function validateSuggestion(suggestionId,postId,hotspotId,matiere){
  if(!me)return;
  await sb.from('material_suggestions').update({validated:true}).eq('id',suggestionId);
  const{data:sugg}=await sb.from('material_suggestions').select('suggested_by').eq('id',suggestionId).single();
  if(sugg?.suggested_by){
    await addAuraPointsToUser(sugg.suggested_by,2,'suggestion_validee');
    await sb.from('notifications').insert({
      user_id:sugg.suggested_by,from_user_id:me.id,
      type:'aura_points',message:`${t('suggestion_val_pre')} "${matiere}" ${t('suggestion_val_suf')}`
    });
  }
  toast(t('suggestion_validated'));
}

async function addAuraPoints(points,reason){
  if(!me)return;
  await addAuraPointsToUser(me.id,points,reason);
  await checkAuraBadges(me.id);
}

async function addAuraPointsToUser(userId,points,reason){
  const{data:prof}=await sb.from('profiles').select('aura_points').eq('id',userId).single();
  const newPoints=(prof?.aura_points||0)+points;
  await sb.from('profiles').update({aura_points:newPoints}).eq('id',userId);
}

async function checkAuraBadges(userId){
  const{data:prof}=await sb.from('profiles').select('aura_points,aura_badges').eq('id',userId).single();
  const points=prof?.aura_points||0;
  const badges=prof?.aura_badges||[];
  const newBadges=[...badges];
  let earned=null;
  const BADGE_THRESHOLDS=[
    {points:5,  id:'debutant',    label:'🌱 Débutant Aura',  desc:'5 points Aura'},
    {points:20, id:'contributeur',label:'🌿 Contributeur',    desc:'20 points Aura'},
    {points:50, id:'expert',      label:'✦ Expert Matière',   desc:'50 points Aura'},
    {points:100,id:'guardian',    label:'💎 Aura Guardian',   desc:'100 points Aura'},
  ];
  for(const threshold of BADGE_THRESHOLDS){
    if(points>=threshold.points&&!badges.find(b=>b.id===threshold.id)){
      newBadges.push({id:threshold.id,label:threshold.label,desc:threshold.desc,earned_at:new Date().toISOString()});
      earned=threshold;
    }
  }
  if(newBadges.length>badges.length){
    await sb.from('profiles').update({aura_badges:newBadges}).eq('id',userId);
    if(earned&&userId===me?.id){
      toast(`${t('badge_earned_prefix')} ${earned.label} !`);
      await sb.from('notifications').insert({
        user_id:userId,type:'badge_earned',
        message:`Tu as gagné le badge ${earned.label} — ${earned.desc} ✦`
      });
    }
  }
}

// ── SETTINGS — Modifier le profil (accordion) ─────────────────────────────
async function openEditProfile(){
  if(!me)return toast(t('login_required'));
  const form=document.getElementById('edit-profile-form');
  const isOpen=form.style.display==='block';
  ['edit-profile-form','change-pw-form','change-email-form'].forEach(id=>{document.getElementById(id).style.display='none';});
  if(!isOpen){
    const{data:prof}=await sb.from('profiles').select('*').eq('id',me.id).maybeSingle();
    document.getElementById('ep-name').value=prof?.full_name||me.user_metadata?.full_name||'';
    document.getElementById('ep-username').value=prof?.username||me.user_metadata?.username||'';
    document.getElementById('ep-bio').value=prof?.bio||'';
    form.style.display='block';
  }
}
async function saveProfile(){
  if(!me)return;
  const full_name=document.getElementById('ep-name').value.trim();
  const username=document.getElementById('ep-username').value.trim().replace('@','');
  const bio=document.getElementById('ep-bio').value.trim();
  const{error}=await sb.from('profiles').upsert({id:me.id,full_name,username,bio});
  if(error)return toast(`❌ ${t('toast_error')}: ${error.message}`);
  invalidateProfileCache(me.id); // cache invalidé → prochain accès re-fetch les nouvelles données
  document.getElementById('edit-profile-form').style.display='none';
  toast(t('profile_updated'));
  loadProfile();closeSettings();
}

// ── EDIT PROFILE PANEL ─────────────────────────────────────────────────────
let _epOriginalUsername='';
let _epUsernameTimer=null;

async function openEditProfilePanel(){
  if(!me)return toast(t('login_required'));
  const{data:prof}=await sb.from('profiles').select('*').eq('id',me.id).maybeSingle();

  // Populate fields
  document.getElementById('ep-name2').value=prof?.full_name||me.user_metadata?.full_name||'';
  const uname=prof?.username||me.user_metadata?.username||'';
  document.getElementById('ep-username2').value=uname;
  _epOriginalUsername=uname;
  const bioVal=prof?.bio||'';
  document.getElementById('ep-bio2').value=bioVal;
  document.getElementById('ep-bio-count').textContent=`${bioVal.length} / 150`;

  // Avatar preview
  const avEl=document.getElementById('ep-avatar-preview');
  if(prof?.avatar_url){
    avEl.innerHTML=`<img src="${prof.avatar_url}" class="img-cover" alt="">`;
  }else{
    const initial=(prof?.full_name||prof?.username||'?').charAt(0).toUpperCase();
    avEl.innerHTML=`<span style="font-family:var(--fd);font-size:38px;font-weight:300;color:var(--gold)">${initial}</span>`;
  }

  // Reset states
  const msgEl=document.getElementById('ep-username-msg');
  msgEl.style.opacity='0';msgEl.textContent='';
  const btn=document.getElementById('ep-save-btn');
  btn.disabled=false;btn.textContent='Enregistrer';

  // Animate in
  const panel=document.getElementById('edit-profile-panel');
  panel.style.display='flex';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{panel.style.transform='translateX(0)';}));
}

function closeEditProfilePanel(){
  const panel=document.getElementById('edit-profile-panel');
  panel.style.transform='translateX(100%)';
  setTimeout(()=>{panel.style.display='none';},340);
}

function epBioCount(el){
  document.getElementById('ep-bio-count').textContent=`${el.value.length} / 80`;
}

function epCheckUsername(val){
  clearTimeout(_epUsernameTimer);
  const clean=val.replace(/^@/,'').toLowerCase();
  const msgEl=document.getElementById('ep-username-msg');
  if(!clean||clean===_epOriginalUsername){msgEl.style.opacity='0';return;}
  if(clean.length<3||!/^[a-z0-9._]+$/.test(clean)){
    msgEl.textContent='Min. 3 car. — lettres, chiffres, . et _ uniquement';
    msgEl.style.color='rgba(255,110,110,0.85)';
    msgEl.style.opacity='1';
    return;
  }
  msgEl.textContent='…';msgEl.style.color='var(--wd)';msgEl.style.opacity='0.5';
  _epUsernameTimer=setTimeout(async()=>{
    const{data}=await sb.from('profiles').select('id').eq('username',clean).neq('id',me.id).maybeSingle();
    if(data){msgEl.textContent=t('username_taken_short');msgEl.style.color='rgba(255,110,110,0.85)';}
    else{msgEl.textContent='✓ Disponible';msgEl.style.color='rgba(100,210,140,0.9)';}
    msgEl.style.opacity='1';
  },600);
}

async function onEditProfileAvatarSelect(e){
  if(!me)return;
  const file=e.target.files[0];if(!file)return;
  // Immediate local preview
  const avEl=document.getElementById('ep-avatar-preview');
  const reader=new FileReader();
  reader.onload=ev=>{avEl.innerHTML=`<img src="${ev.target.result}" class="img-cover" alt="">`;};
  reader.readAsDataURL(file);
  // Upload to Supabase
  const ext=file.name.split('.').pop().toLowerCase();
  const path=`avatars/${me.id}.${ext}`;
  const{error}=await sb.storage.from('posts').upload(path,file,{upsert:true});
  if(error)return toast(t('error_upload'));
  const{data:u}=sb.storage.from('posts').getPublicUrl(path);
  await sb.from('profiles').upsert({id:me.id,avatar_url:u.publicUrl});
  document.getElementById('my-avatar').innerHTML=`<img src="${u.publicUrl}" alt="">`;
  toast(t('avatar_updated'));
}

async function saveProfile2(){
  if(!me)return;
  const full_name=document.getElementById('ep-name2').value.trim();
  const username=document.getElementById('ep-username2').value.trim().replace(/^@/,'').toLowerCase();
  const bio=document.getElementById('ep-bio2').value.trim().slice(0,150);

  if(!username||username.length<3||!/^[a-z0-9._]+$/.test(username)){
    return toast(t('toast_username_invalid'));
  }

  const btn=document.getElementById('ep-save-btn');
  btn.disabled=true;btn.textContent='…';

  // Uniqueness check if changed
  if(username!==_epOriginalUsername){
    const{data:ex}=await sb.from('profiles').select('id').eq('username',username).neq('id',me.id).maybeSingle();
    if(ex){
      btn.disabled=false;btn.textContent='Enregistrer';
      return toast(t('toast_username_taken'));
    }
  }

  const{error}=await sb.from('profiles').upsert({id:me.id,full_name,username,bio});
  btn.disabled=false;btn.textContent='Enregistrer';
  if(error)return toast(`❌ ${t('toast_error')}: ${error.message}`);

  invalidateProfileCache(me.id); // cache invalidé → prochain accès re-fetch
  toast(t('profile_updated'));
  _epOriginalUsername=username;
  loadProfile();
  closeEditProfilePanel();
}

// ── ANIMATIONS PROFIL ─────────────────────────────────────────────────────

function animateGridItems(gridId){
  const items=document.querySelectorAll(`#${gridId} .pgrid-item`);
  items.forEach((item,i)=>{
    item.style.opacity='0';
    item.style.transform='scale(0.91)';
    item.style.transition='none';
    setTimeout(()=>{
      item.style.transition='opacity 260ms cubic-bezier(0.23,1,0.32,1),transform 260ms cubic-bezier(0.23,1,0.32,1)';
      item.style.opacity='1';
      item.style.transform='scale(1)';
    },i*40);
  });
}

function animateCounter(el,target){
  if(!el||!target)return;
  const duration=600;
  const start=performance.now();
  const easeOut=t=>1-Math.pow(1-t,3);
  (function tick(now){
    const progress=Math.min((now-start)/duration,1);
    el.textContent=fmtN(Math.round(easeOut(progress)*target));
    if(progress<1)requestAnimationFrame(tick);
    else el.textContent=fmtN(target);
  })(start);
}

// ── Modération : signaler / bloquer ──
let _poTarget=null;
function openPostOptions(postId, uid, username){
  if(!me)return toast(t('login_required'));
  _poTarget={postId,uid,username};
  document.getElementById('po-username').textContent=username||'cet utilisateur';
  // Affiche le bon groupe d'options selon si c'est notre post ou celui d'un autre
  const isOwn=postId&&uid&&me&&uid===me.id;
  const ownOpts=document.getElementById('po-own-opts');
  const otherOpts=document.getElementById('po-other-opts');
  if(ownOpts)ownOpts.style.display=isOwn?'block':'none';
  if(otherOpts)otherOpts.style.display=isOwn?'none':'block';
  document.getElementById('post-opts-overlay').style.display='block';
  document.getElementById('post-opts-sheet').style.display='block';
}
async function deletePostFromFeed(){
  if(!_poTarget?.postId||!me)return closePostOptions();
  const postId=_poTarget.postId;
  closePostOptions();
  // Supprimer la slide du DOM immédiatement
  const slide=document.querySelector(`.feed-slide[data-pid="${postId}"]`);
  if(slide)slide.remove();
  // Supprimer en base
  const{error}=await safeRun(sb.from('posts').delete().eq('id',postId).eq('user_id',me.id),{friendly:'Impossible de supprimer.',context:'deletePostFromFeed'});
  if(error)return;
  // Supprimer aussi du profil grid si visible
  const pgridItem=document.querySelector(`.pgrid-item[data-post-id="${postId}"]`);
  if(pgridItem)pgridItem.remove();
  toast(t('toast_post_deleted'));
}
function hidePost(){
  if(!_poTarget?.postId)return closePostOptions();
  const key='_hidden_posts_'+(me?.id||'anon');
  const hidden=JSON.parse(localStorage.getItem(key)||'[]');
  if(!hidden.includes(_poTarget.postId)){hidden.push(_poTarget.postId);localStorage.setItem(key,JSON.stringify(hidden));}
  // Supprimer la slide du DOM immédiatement
  const slide=document.querySelector(`.feed-slide[data-pid="${_poTarget.postId}"]`);
  if(slide)slide.remove();
  toast(t('toast_post_hidden'));
  closePostOptions();
}
function closePostOptions(){
  document.getElementById('post-opts-overlay').style.display='none';
  document.getElementById('post-opts-sheet').style.display='none';
  _poTarget=null;
}
async function reportPost(){
  if(!_poTarget||!me)return closePostOptions();
  const reason=prompt(t('prompt_report_post'));
  if(!reason||reason.length<3){closePostOptions();return;}
  try{
    await sb.from('reports').insert({reporter_id:me.id,post_id:_poTarget.postId,reported_user_id:_poTarget.uid,reason:reason.slice(0,500)});
    toast(t('report_thanks'));
  }catch(e){toast(t('report_error'));}
  closePostOptions();
}
async function openBlockedUsers(){
  const list=document.getElementById('blocked-users-list');
  const isOpen=list.style.display!=='none';
  if(isOpen){list.style.display='none';return;}
  if(!me){list.style.display='block';list.innerHTML='<div style="font-size:12px;color:var(--wd);padding:10px 0">Connexion requise</div>';return;}
  list.style.display='block';
  list.innerHTML=skRows(3);
  try{
    const{data:blocks}=await sb.from('blocked_users').select('blocked_id,created_at').eq('blocker_id',me.id).order('created_at',{ascending:false});
    if(!blocks||!blocks.length){
      list.innerHTML=`<div class="empty-state-sm"><img src="mascote_ivory/the_protector.png" alt=""><div>${t('empty_no_blocked')}</div></div>`;
      return;
    }
    const ids=blocks.map(b=>b.blocked_id);
    const profs=await getProfiles(ids);
    const profMap={};profs.forEach(p=>profMap[p.id]=p);
    list.innerHTML=blocks.map(b=>{
      const p=profMap[b.blocked_id]||{username:'inconnu',full_name:'Utilisateur inconnu'};
      const av=p.avatar_url?`<img src="${p.avatar_url}" alt="" loading="lazy" class="img-cover">`:`<span style="font-size:14px;color:var(--gold);text-transform:uppercase">${(p.username||'?').charAt(0)}</span>`;
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(240,234,216,0.08)">
        <div style="width:40px;height:40px;border-radius:var(--r-md);background:var(--black-3);overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0">${av}</div>
        <div class="flex-min">
          <div style="font-size:13px;color:var(--white);overflow:hidden;text-overflow:ellipsis">${escapeHtml(p.full_name||p.username||'Utilisateur')}</div>
          <div class="txt-xs-dim">${escapeHtml(p.username||'')}</div>
        </div>
        <button onclick="unblockUser('${b.blocked_id}')" style="background:transparent;border:1px solid var(--gold-b);border-radius:var(--r-pill);padding:5px 12px;color:var(--gold);font-size:11px;letter-spacing:.5px;cursor:pointer">${t('unblock_btn')}</button>
      </div>`;
    }).join('');
  }catch(e){list.innerHTML='<div style="font-size:12px;color:var(--wd);padding:14px 0;text-align:center">Erreur de chargement</div>';}
}
async function unblockUser(uid){
  if(!me)return;
  const{error}=await safeRun(sb.from('blocked_users').delete().eq('blocker_id',me.id).eq('blocked_id',uid),{friendly:t('err_unblock'),context:'unblock'});
  if(error)return;
  toast(t('toast_user_unblocked'));
  openBlockedUsers();openBlockedUsers();
}

async function blockPostUser(){
  if(!_poTarget||!me)return closePostOptions();
  if(!confirm(t('block_confirm').replace('{name}',_poTarget.username))){closePostOptions();return;}
  try{
    await sb.from('blocked_users').insert({blocker_id:me.id,blocked_id:_poTarget.uid});
    await sb.from('follows').delete().eq('follower_id',me.id).eq('following_id',_poTarget.uid);
    await sb.from('follows').delete().eq('follower_id',_poTarget.uid).eq('following_id',me.id);
    toast(t('block_done').replace('{name}',_poTarget.username));
    setTimeout(()=>{loadFeed();},500);
  }catch(e){toast(t('block_error'));}
  closePostOptions();
}

// Cache pour les posts partagés
const _sharedPostCache={};
async function renderSharedPostInBubble(msgId,postId){
  const container=document.getElementById('shared-post-'+msgId);
  if(!container)return;
  try{
    let post=_sharedPostCache[postId];
    if(!post){
      const{data}=await sb.from('posts').select('id,image_url,caption,user_id').eq('id',postId).maybeSingle();
      if(!data){container.innerHTML='<div class="txt-xs-dim" class="p-8">Post introuvable</div>';return;}
      post=data;
      // Récupérer le username
      try{
        const prof=await getProfile(post.user_id);
        post.username=prof?.username||'user';
      }catch(e){post.username='user';}
      _sharedPostCache[postId]=post;
    }
    container.style.padding='0';
    container.style.minHeight='0';
    container.innerHTML=`<div style="background:var(--black-3);border:1px solid rgba(240,234,216,0.12);border-radius:12px;overflow:hidden;width:170px">
      <div style="position:relative;aspect-ratio:1/1;background:var(--black-2)">
        ${post.image_url?`<img src="${post.image_url}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">`:`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;opacity:.5">${_camSvgFb}</div>`}
      </div>
      <div style="padding:7px 9px;background:var(--black-3)">
        <div style="font-size:12px;font-weight:600;color:var(--white);margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml((post.caption||'Post').slice(0,32))}</div>
        <div style="font-size:11px;color:var(--gold);margin-bottom:5px">@${escapeHtml(post.username)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
          <span style="display:inline-block;font-size:8px;letter-spacing:.5px;text-transform:uppercase;background:rgba(240,234,216,0.1);border:1px solid rgba(240,234,216,0.25);color:rgba(240,234,216,0.7);padding:1px 5px;border-radius:3px">Post</span>
          <span style="font-size:8px;letter-spacing:.8px;color:var(--gold);text-transform:uppercase">Voir →</span>
        </div>
      </div>
    </div>`;
  }catch(e){console.warn('[renderSharedPost]',e);container.innerHTML='<div class="txt-xs-dim" class="p-8">Erreur</div>';}
}
function openSharedPost(postId){
  closeConversationScreen();
  openPostView(postId);
}

let _sharePostId=null;
let _shareUsers=[];
async function sharePost(postId){
  if(!me){
    // Pas connecté → partage externe direct
    return sharePostExternalUrl(postId);
  }
  _sharePostId=postId;
  document.getElementById('share-search').value='';
  document.getElementById('share-overlay').style.display='block';
  document.getElementById('share-sheet').style.display='flex';
  const list=document.getElementById('share-list');
  list.innerHTML=skRows(4);
  try{
    // Récupérer les users à qui envoyer : people I follow + people who follow me
    const[mf,mfwr]=await Promise.all([
      sb.from('follows').select('following_id').eq('follower_id',me.id),
      sb.from('follows').select('follower_id').eq('following_id',me.id)
    ]);
    const followingIds=(mf.data||[]).map(f=>f.following_id);
    const followerIds=(mfwr.data||[]).map(f=>f.follower_id);
    const allIds=[...new Set([...followingIds,...followerIds])];
    if(!allIds.length){
      list.innerHTML=`<div class="empty-state"><img src="mascote_ivory/the_knot_weaver.png" alt=""><div>${t('empty_nobody_share')}<div class="es-hint">${t('empty_nobody_share_hint')}</div></div></div>`;
      return;
    }
    _shareUsers=await getProfiles(allIds);
    renderShareList(_shareUsers);
  }catch(e){
    console.warn('[share]',e);
    list.innerHTML='<div style="padding:30px;text-align:center;color:var(--wd)">Erreur de chargement</div>';
  }
}
function renderShareList(users){
  const list=document.getElementById('share-list');
  if(!users.length){
    list.innerHTML=`<div class="empty-state-sm">${t('empty_no_results')}</div>`;
    return;
  }
  list.innerHTML=users.map(p=>{
    const av=p.avatar_url?`<img src="${p.avatar_url}" alt="" loading="lazy" class="img-cover">`:`<span class="txt-lg-gold-caps">${(p.username||p.full_name||'?').charAt(0)}</span>`;
    return `<div onclick="sendPostAsDM('${p.id}','${escapeHtml(p.full_name||p.username||'').replace(/'/g,'')}',this)" class="list-row">
      <div style="width:42px;height:42px;border-radius:50%;background:var(--black-3);overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(240,234,216,0.15)">${av}</div>
      <div class="flex-min">
        <div class="txt-sm-ellipsis">${escapeHtml(p.username||'utilisateur')}</div>
        <div class="txt-xs-ellipsis">${escapeHtml(p.full_name||'')}</div>
      </div>
      <button class="flw-btn flw-btn-primary" style="flex-shrink:0">${t('envoyer_btn')}</button>
    </div>`;
  }).join('');
}
function filterShareList(query){
  const q=query.toLowerCase().trim();
  if(!q)return renderShareList(_shareUsers);
  const filtered=_shareUsers.filter(p=>(p.username||'').toLowerCase().includes(q)||(p.full_name||'').toLowerCase().includes(q));
  renderShareList(filtered);
}
function closeShareSheet(){
  document.getElementById('share-overlay').style.display='none';
  document.getElementById('share-sheet').style.display='none';
}
async function sendPostAsDM(recipientUid,recipientName,btnEl){
  if(!_sharePostId||!me)return;
  if(btnEl){btnEl.disabled=true;btnEl.textContent='...';btnEl.style.opacity='.6';}
  try{
    // Trouver ou créer la conversation
    let{data:existing}=await sb.from('conversations').select('id')
      .or(`and(participant_1.eq.${me.id},participant_2.eq.${recipientUid}),and(participant_1.eq.${recipientUid},participant_2.eq.${me.id})`)
      .maybeSingle();
    let convId=existing?.id;
    if(!convId){
      const{data:newConv,error:convErr}=await sb.from('conversations').insert({participant_1:me.id,participant_2:recipientUid}).select('id').single();
      if(convErr)throw convErr;
      convId=newConv.id;
    }
    // Envoyer le message comme un "shared post" : format spécial
    const content=`[POST:${_sharePostId}]`;
    const{error:msgErr}=await sb.from('messages').insert({conversation_id:convId,sender_id:me.id,receiver_id:recipientUid,content});
    if(msgErr)throw msgErr;
    // Notif au destinataire
    try{await sb.from('notifications').insert({user_id:recipientUid,from_user_id:me.id,type:'message',post_id:_sharePostId});}catch(e){}
    if(btnEl){btnEl.textContent=t('sent_check');btnEl.style.background='rgba(125,201,125,0.18)';btnEl.style.color='#7dc97d';btnEl.style.borderColor='rgba(125,201,125,0.4)';}
    toast(`Envoyé à ${recipientName}`);
    setTimeout(()=>closeShareSheet(),700);
  }catch(e){
    console.error('[sendPostAsDM]',e);
    toast(t('toast_send_error'));
    if(btnEl){btnEl.disabled=false;btnEl.textContent='Envoyer';btnEl.style.opacity='1';}
  }
}
function sharePostExternal(){
  if(!_sharePostId)return;
  sharePostExternalUrl(_sharePostId);
  closeShareSheet();
}
async function sharePostExternalUrl(postId){
  const url=window.location.origin+'?post='+postId;
  if(navigator.share){
    try{await navigator.share({title:t('share_title'),text:t('share_text'),url});}
    catch(e){/* user cancelled */}
  } else {
    try{await navigator.clipboard.writeText(url);toast(t('link_copied'));}catch(e){toast(t('toast_link_label')+' : '+url);}
  }
}
function shareAction(platform){
  const url=window.location.href;
  const shares={
    copy:()=>{navigator.clipboard?.writeText(url);toast(t('link_copied'));},
    whatsapp:()=>window.open(`https://wa.me/?text=${encodeURIComponent('WearAura 🌿 '+url)}`),
    twitter:()=>window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('WearAura 🌿')}&url=${encodeURIComponent(url)}`),
  };
  (shares[platform]||(() => toast(t('bientot'))))();
  closeAll();
}

// anciennes fonctions conversation supprimées — remplacées par le système DM complet

// ═══════════════════════════════════════════

