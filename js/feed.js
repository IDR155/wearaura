// FEED
// ═══════════════════════════════════════════
// ── Pull-to-refresh feed ────────────────────────
function initPullToRefresh(){
  attachPullToRefresh(
    document.getElementById('feed-scroll'),
    ()=>{
      const oc=document.querySelector('.ft.active')?.getAttribute('onclick')||'';
      return oc.includes('suivis')?loadFeedSuivis():loadFeed();
    },
    document.getElementById('sc-feed')
  );
}

async function loadFeed() {
  // Toujours s'assurer que la navbar est visible quand on arrive sur le feed
  const _bnav=document.getElementById('shared-bnav');
  if(_bnav){ _bnav.style.display=''; _bnav.style.transform=''; }
  initPullToRefresh();
  const c=document.getElementById('feed-scroll');
  c.innerHTML=skFeed(2);
  // Re-check si le timeout de init() a gagné la course (cold start Supabase)
  if(!dbOk){
    await sb.from('posts').select('id').limit(1).then(({error})=>{
      dbOk=!error||error.code!=='42P01';
    }).catch(()=>{dbOk=false;});
  }
  console.log('[WA] loadFeed — dbOk='+dbOk+' me='+me?.email);
  if(!dbOk){console.warn('[WA] dbOk=false → démos');renderSlides(DEMOS,true);return;}
  // Timeout de sécurité : si rien ne s'affiche après 6s → démos
  const safeTimer=setTimeout(()=>{ if(c.querySelector('.loader')){console.warn('[WA] 6s timeout → démos');renderSlides(DEMOS,true);} },6000);
  try{
    const {data,error}=await sb.from('posts').select('*').eq('hidden',false).order('created_at',{ascending:false}).limit(30);
    console.log('[WA] posts query → data='+(data?.length??'null')+' error='+JSON.stringify(error));
    if(!data||!data.length){clearTimeout(safeTimer);console.warn('[WA] 0 posts → démos (RLS? table vide?)');renderSlides(DEMOS,true);return;}
    const uids=[...new Set(data.map(p=>p.user_id))];
    let profs=await getProfiles(uids);
    const pm=Object.fromEntries(profs.map(p=>[p.id,p]));
    console.log('[WA] profs='+profs.length+' pm keys='+Object.keys(pm).length);
    const followed=await getFollowed().catch(()=>[]);
    // Filtre : posts masqués + comptes privés non suivis + posts sans image valide + image = avatar auteur
    const hiddenKey='_hidden_posts_'+(me?.id||'anon');
    const hiddenIds=new Set(JSON.parse(localStorage.getItem(hiddenKey)||'[]'));
    const filtered=data.filter(p=>{
      if(hiddenIds.has(p.id))return false;
      if(!p.image_url||typeof p.image_url!=='string'||!p.image_url.startsWith('http'))return false;
      if(p.image_url.includes('/avatars/'))return false;
      // Exclure les posts sans profil auteur chargé (posts orphelins / profil non défini)
      const prof=pm[p.user_id];
      if(!prof&&!(me&&p.user_id===me.id))return false;
      // Exclure les posts dont l'image est la photo de profil de l'auteur
      if(prof?.avatar_url&&p.image_url===prof.avatar_url)return false;
      if(!prof?.is_private)return true;
      if(me&&p.user_id===me.id)return true;
      if(followed.includes(p.user_id))return true;
      return false;
    });
    console.log('[WA] filtered='+filtered.length+'/'+data.length+' | me.id='+me?.id?.slice(0,8)+' | uids='+[...new Set(data.map(p=>p.user_id?.slice(0,8)))].join(','));
    if(!filtered.length){clearTimeout(safeTimer);console.warn('[WA] filtered=0 → démos');renderSlides(DEMOS,true);return;}
    // ── Look du jour : le post le plus aimé des dernières 24h passe en tête ──
    if(filtered.length>=3){
      const dayAgo=Date.now()-86400000;
      let best=null;
      for(const p of filtered){
        if(new Date(p.created_at).getTime()<dayAgo)continue;
        if((p.likes_count||0)<1)continue;
        if(!best||(p.likes_count||0)>(best.likes_count||0))best=p;
      }
      if(best){
        filtered.splice(filtered.indexOf(best),1);
        filtered.unshift(best);
        best._lookDuJour=true;
      }
    }
    // Likes & saves : tables optionnelles — ne jamais bloquer le feed
    clearTimeout(safeTimer);
    let likedIds=[], savedIds=[];
    try{
      const [likesRes,savesRes]=await Promise.allSettled([
        me?sb.from('likes').select('post_id').eq('user_id',me.id):Promise.resolve({data:[]}),
        me?sb.from('saved_posts').select('post_id').eq('user_id',me.id):Promise.resolve({data:[]})
      ]);
      likedIds=(likesRes.status==='fulfilled'?(likesRes.value?.data||[]):[]).map(l=>l.post_id);
      savedIds=(savesRes.status==='fulfilled'?(savesRes.value?.data||[]):[]).map(s=>s.post_id);
    }catch(_){ /* tables absentes → likes/saves ignorés */ }
    console.log('[WA] → renderSlides RÉELS posts='+filtered.length);
    renderSlides(filtered.map(p=>({id:p.id,imageUrl:p.image_url,uid:p.user_id,user:pm[p.user_id]?.username||pm[p.user_id]?.full_name||'user',avatarUrl:pm[p.user_id]?.avatar_url,caption:p.caption||'',likes:p.likes_count||0,comments_count:p.comments_count||0,hotspots:p.hotspots||[],tags:p.tags||{},followed:followed.includes(p.user_id),liked:likedIds.includes(p.id),saved:savedIds.includes(p.id),musicUrl:p.music_url||'',musicTitle:p.music_title||'',musicStart:p.music_start||0,lookDuJour:!!p._lookDuJour})),false);
    resyncFeedCounts(filtered.map(p=>p.id));
  }catch(e){
    clearTimeout(safeTimer);
    console.warn('[WA] loadFeed error',e);
    renderSlides(DEMOS,true);
  }
}

async function resyncFeedCounts(postIds){
  if(!postIds||!postIds.length)return;
  try{
    const[{data:likesData},{data:commentsData}]=await Promise.all([
      sb.from('likes').select('post_id').in('post_id',postIds),
      sb.from('comments').select('post_id').in('post_id',postIds)
    ]);
    const lc={},cc={};
    (likesData||[]).forEach(r=>{lc[r.post_id]=(lc[r.post_id]||0)+1;});
    (commentsData||[]).forEach(r=>{cc[r.post_id]=(cc[r.post_id]||0)+1;});
    postIds.forEach(pid=>{
      const likeEl=document.getElementById('like-count-'+pid);
      const commentEl=document.getElementById('comment-count-'+pid);
      if(likeEl){
        const n=lc[pid]||0;
        const stale=parseInt(likeEl.dataset.count||'0');
        likeEl.dataset.count=n;likeEl.textContent=fmtN(n);
        // Corrige likes_count dénormalisé si décalé
        if(stale!==n) sb.from('posts').update({likes_count:n}).eq('id',pid).then(()=>{},()=>{});
      }
      if(commentEl){commentEl.textContent=cc[pid]||0;}
    });
  }catch(e){console.warn('[resyncFeedCounts]',e);}
}

async function loadFeedSuivis() {
  initPullToRefresh();
  const c=document.getElementById('feed-scroll');
  c.innerHTML=skFeed(2);
  if(!me){
    c.innerHTML=`<div class="empty"><span class="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.3)" stroke-width="1.5" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>${t('suivis_login')}</div>`;
    return;
  }
  try{
    const followed=await getFollowed().catch(()=>[]);
    if(!followed.length){
      c.innerHTML=`<div class="empty-state empty-state--full"><img src="mascote_ivory/the_sentinel.png" alt=""><div>${t('suivis_empty')}<div class="es-hint">${t('suivis_empty_hint')}</div></div></div>`;
      return;
    }
    const{data}=await sb.from('posts').select('*').eq('hidden',false).in('user_id',followed).order('created_at',{ascending:false}).limit(50);
    if(!data||!data.length){
      c.innerHTML=`<div class="empty-state empty-state--full"><img src="mascote_ivory/the_sentinel.png" alt=""><div>${t('suivis_no_post')}<div class="es-hint">${t('suivis_no_post_hint')}</div></div></div>`;
      return;
    }
    const uids=[...new Set(data.map(p=>p.user_id))];
    let profs=[],myLikes=[],mySaves=[];
    profs=await getProfiles(uids);
    try{const r=await sb.from('likes').select('post_id').eq('user_id',me.id);myLikes=r.data||[];}catch(e){console.warn('[suivis likes]',e);}
    try{const r=await sb.from('saved_posts').select('post_id').eq('user_id',me.id);mySaves=r.data||[];}catch(e){console.warn('[suivis saves]',e);}
    const pm=Object.fromEntries(profs.map(p=>[p.id,p]));
    const likedIds=myLikes.map(l=>l.post_id);
    const savedIds=mySaves.map(s=>s.post_id);
    renderSlides(data.map(p=>({
      id:p.id,imageUrl:p.image_url,uid:p.user_id,
      user:pm[p.user_id]?.username||pm[p.user_id]?.full_name||'user',
      avatarUrl:pm[p.user_id]?.avatar_url,caption:p.caption||'',
      likes:p.likes_count||0,comments_count:p.comments_count||0,
      hotspots:p.hotspots||[],tags:p.tags||{},
      liked:likedIds.includes(p.id),saved:savedIds.includes(p.id),followed:true,
      musicUrl:p.music_url||'',musicTitle:p.music_title||'',musicStart:p.music_start||0
    })),false);
  }catch(e){
    console.warn('[WA] loadFeedSuivis error',e);
    c.innerHTML=`<div class="empty"><span class="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.3)" stroke-width="1.5" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>${t('toast_error')}</div>`;
  }
}

function renderSlides(posts,isDemo,containerId='feed-scroll'){
  const c=document.getElementById(containerId);
  const bgs=['bg-1','bg-2','bg-3','bg-4','bg-5','bg-6','bg-7','bg-8','bg-9'];
  const _slideFb='<svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.15)" stroke-width="0.8" stroke-linecap="round"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/></svg>';
  c.innerHTML=posts.map((p,i)=>{
    const bg=p.bg||bgs[i%9];
    // ── pid déclaré EN PREMIER (utilisé dans img et hotspotsZone) ──
    const pid=p.id||'demo'+i;
    const imgAlt=escapeHtml(p.caption||('Look de '+p.user));
    const img=p.imageUrl?`<img data-src="${p.imageUrl}" alt="${imgAlt}" onload="_autoFit(this);_fitHzone(this,'${pid}')" onerror="this.closest('.feed-slide')&&(this.closest('.feed-slide').style.display='none')">`:`<span class="slide-emoji">${_slideFb}</span>`;
    const avImg=p.avatarUrl
      ?`<img src="${p.avatarUrl}" alt="Photo de profil de ${escapeHtml(p.user||'')}">`
      :`<span style="font-size:15px;font-weight:700;color:var(--gold);text-transform:uppercase">${(p.user||'?').charAt(0)}</span>`;
    const followBtn=(me&&p.uid!==me.id)?`<button class="btn-follow ${p.followed?'following':''}" onclick="toggleFollow('${p.uid}',this)" style="margin-left:10px">${p.followed?t('suivi'):t('suivre')}</button>`:'';
    window.__hs=window.__hs||{};
    window.__looks=window.__looks||{};
    window.__looks[pid]={id:p.id,caption:p.caption,hotspots:p.hotspots||[],tags:p.tags||{},user:p.user,imageUrl:p.imageUrl||''};
    // ── Hotspots : tous les hotspots posés par le créateur, sans limite ──
    let hotspotsZone='';
    if(p.hotspots&&p.hotspots.length){
      window.__hs[pid]=p.hotspots.map(h=>({...h,tags:p.tags||{},postId:p.id||null}));
      const dots=p.hotspots.map((h,idx)=>{
        // Pas de clamping : _fitHzone recalcule la position réelle après chargement image
        const dotY=h.y??35;
        const dotX=h.x??50;
        const size =h.size||30;
        return `<div class="slide-hotspot" role="button" tabindex="0" aria-label="Voir l'alternative pour ${escapeHtml(h.label||'cette pièce')}"
          data-x="${dotX}" data-y="${dotY}"
          style="top:${dotY}%;left:${dotX}%;width:${size}px;height:${size}px;animation-delay:${idx*0.3}s"
          onclick="event.stopPropagation();_clickHspot('${pid}',${idx})"
          onkeydown="if(event.key==='Enter'||event.key===' '){event.stopPropagation();_clickHspot('${pid}',${idx})}">
        </div>`;
      }).join('')||`<div class="slide-hotspot" role="button" tabindex="0" aria-label="Voir l'alternative" style="top:35%;left:50%"></div>`;
      // hzone sera repositionné par _fitHzone() au chargement de l'image
      hotspotsZone=`<div id="hzone-${pid}" style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:9;cursor:pointer" onclick="showHotspots('${pid}')"><div id="hdots-${pid}" style="display:none;position:absolute;inset:0">${dots}</div></div>`;
    }
    return `<div class="feed-slide ${!p.imageUrl?bg:''}" data-pid="${pid}" data-demo="${isDemo}" ondblclick="doubleTapLike(event,this,'${p.id}','${isDemo}')">
      ${p.imageUrl?`<div style="position:absolute;inset:0;background:#07101E;z-index:0"></div>`:''}
      ${img}<div class="slide-gradient"></div>
      ${p.lookDuJour?`<div class="ldj-badge">${t('look_du_jour')}</div>`:''}
      ${hotspotsZone}
      <div class="slide-right" role="group" aria-label="Actions sur ce post">
        <div class="slide-action" role="button" tabindex="0" aria-label="${!isDemo&&p.liked?'Retirer le like':'Aimer ce post'}" aria-pressed="${!isDemo&&p.liked?'true':'false'}" onclick="${isDemo?'demLike(this)':'toggleLike(\''+pid+'\')'}" onkeydown="if(event.key==='Enter'||event.key===' '){${isDemo?'demLike(this)':'toggleLike(\''+pid+'\')'}}">
          <svg id="heart-${pid}" data-liked="${!isDemo&&p.liked?'1':'0'}" viewBox="0 0 24 24" aria-hidden="true" style="fill:${!isDemo&&p.liked?'#1E4FD8':'none'};stroke:${!isDemo&&p.liked?'var(--accent)':'var(--white)'};transition:fill .2s,stroke .2s"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span id="like-count-${pid}" data-count="${p.likes||0}">${fmtN(p.likes)}</span>
        </div>
        <div class="slide-action" role="button" tabindex="0" aria-label="Commenter" onclick="openComments('${p.id}','${isDemo}')" onkeydown="if(event.key==='Enter'||event.key===' ')openComments('${p.id}','${isDemo}')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span id="comment-count-${pid}">${p.comments_count||0}</span>
        </div>
        <div class="slide-action" role="button" tabindex="0" aria-label="${!isDemo&&p.saved?'Retirer la sauvegarde':'Sauvegarder'}" aria-pressed="${!isDemo&&p.saved?'true':'false'}" onclick="${isDemo?'':'toggleSave(\''+pid+'\')'}" onkeydown="if(event.key==='Enter'||event.key===' '){${isDemo?'':'toggleSave(\''+pid+'\')'}}">
          <svg id="save-${pid}" viewBox="0 0 24 24" aria-hidden="true" style="fill:${!isDemo&&p.saved?'var(--gold)':'none'};stroke:${!isDemo&&p.saved?'var(--gold)':'var(--white)'};transition:fill .2s,stroke .2s"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
        </div>
        <div class="slide-action" role="button" tabindex="0" aria-label="Partager" onclick="sharePost('${p.id}')" onkeydown="if(event.key==='Enter'||event.key===' ')sharePost('${p.id}')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </div>
        ${isDemo?'':`<div class="slide-action" role="button" tabindex="0" aria-label="Options du post" onclick="openPostOptions('${p.id}','${p.uid}','${escapeHtml(p.user||'')}')" onkeydown="if(event.key==='Enter'||event.key===' ')openPostOptions('${p.id}','${p.uid}','${escapeHtml(p.user||'')}')">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="white"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </div>`}
        <div onclick="toggleSound(this)" data-music="${escapeHtml(p.musicUrl||'')}" data-music-title="${escapeHtml(p.musicTitle||'')}" data-music-start="${p.musicStart||0}" style="display:flex;flex-direction:column;align-items:center;visibility:${p.musicUrl?'visible':'hidden'};pointer-events:${p.musicUrl?'auto':'none'}">
          <svg class="vinyl-svg vinyl-paused" style="width:56px;height:56px;animation:spin 4s linear infinite" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" fill="#1a1a1a" stroke="#333" stroke-width="1"/>
            <circle cx="50" cy="50" r="35" fill="none" stroke="#2a2a2a" stroke-width="1.5"/>
            <circle cx="50" cy="50" r="18" fill="var(--gold-muted)"/>
            <circle cx="50" cy="50" r="15" fill="#F0EAD8"/>
            <circle cx="50" cy="50" r="4" fill="#07101E"/>
          </svg>
        </div>
      </div>
      <div class="slide-bottom">
        <div class="slide-user">
          <div class="slide-avatar" data-uid="${p.uid}" role="button" tabindex="0" aria-label="Voir le profil de ${escapeHtml(p.user)}" onclick="openUserProfile('${p.uid}')" onkeydown="if(event.key==='Enter'||event.key===' ')openUserProfile('${p.uid}')">${avImg}</div>
          <span class="slide-username" role="button" tabindex="0" aria-label="Voir le profil de ${escapeHtml(p.user)}" onclick="openUserProfile('${p.uid}')" onkeydown="if(event.key==='Enter'||event.key===' ')openUserProfile('${p.uid}')">${escapeHtml(p.user)}</span>
          ${followBtn}
        </div>
        <div class="slide-caption">${escapeHtml(p.caption)}</div>
        <span class="slide-voir-plus" onclick="openLookComplet(window.__looks['${pid}'])" style="color:var(--gold);font-size:12px;font-weight:600;cursor:pointer;letter-spacing:.8px;text-transform:uppercase;display:inline-block;margin-top:5px;animation:goldPulse 2s ease-in-out infinite">${t('voir_plus')}</span>
      </div>

    </div>`;
  }).join('');
  observeLazy(c);
  // ── Double-tap/click — listeners sur chaque slide ──
  const _dtSt={el:null,t:0};
  let _lastTouchEnd=0; // Pour ignorer les click synthétiques issus du touch
  c.querySelectorAll('.feed-slide[data-pid]').forEach(slide=>{
    // Touch (mobile) — touchend
    slide.addEventListener('touchend',function(e){
      _lastTouchEnd=Date.now();
      if(e.target.closest('.slide-action,.slide-hotspot,.slide-right'))return;
      const now=Date.now();
      if(this===_dtSt.el&&now-_dtSt.t<350){
        doubleTapLike(e,this,this.dataset.pid,this.dataset.demo);
        _dtSt.el=null;_dtSt.t=0;
      }else{_dtSt.el=this;_dtSt.t=now;}
    },{passive:true});
    // Click (desktop) — ignore les click synthétiques venant du touch
    slide.addEventListener('click',function(e){
      if(Date.now()-_lastTouchEnd<500)return; // synthétique depuis touch
      if(e.target.closest('.slide-action,.slide-hotspot,.slide-right'))return;
      const now=Date.now();
      if(this===_dtSt.el&&now-_dtSt.t<350){
        doubleTapLike(e,this,this.dataset.pid,this.dataset.demo);
        _dtSt.el=null;_dtSt.t=0;
      }else{_dtSt.el=this;_dtSt.t=now;}
    });
  });
  // Caption tap-to-expand
  c.querySelectorAll('.slide-caption').forEach(cap=>{
    cap.addEventListener('click',function(e){
      if(e.target.closest('span[onclick]'))return;
      this.classList.toggle('expanded');
    });
  });
  // Pour le postview (post unique) : hotspots visibles immédiatement, pas de scroll-bind
  if(containerId!=='feed-scroll'){
    // Les hotspots sont gérés directement dans openPostView (chargement eager + onload)
    return;
  }
  // Masquer les hotspots au scroll, ré-afficher quand le slide se stabilise
  const feedScroll=document.getElementById('feed-scroll');
  if(feedScroll&&!feedScroll._hotspotScrollBound){
    feedScroll._hotspotScrollBound=true;
    feedScroll.addEventListener('scroll',()=>{
      // Cibler uniquement feed-scroll — ne pas toucher aux hdots de pv-scroll
      feedScroll.querySelectorAll('[id^="hdots-"]').forEach(el=>{el.style.display='none';});
      feedScroll.querySelectorAll('[id^="hint-"]').forEach(el=>{el.style.display='flex';});
    },{passive:true});
    // (scroll-settle : plus d'auto-show hotspots — la navbar ne doit pas disparaître en scrollant)
  }
  // Première impression : montre les dots du premier slide brièvement, SANS cacher la navbar
  setTimeout(()=>{
    const zones=[...feedScroll.querySelectorAll('[id^="hzone-"]')];
    if(!zones[0]) return;
    const pid=zones[0].id.replace('hzone-','');
    const dots=document.getElementById('hdots-'+pid);
    const hint=document.getElementById('hint-'+pid);
    if(!dots) return;
    dots.style.display='block';
    if(hint) hint.style.display='none';
    setTimeout(()=>{
      dots.style.display='none';
      if(hint) hint.style.display='flex';
    }, 3000);
  }, 600);
  // Onboarding overlay hotspots — déclenché depuis obSkip() dans nav.js
  // (le flag était consommé ici trop tôt, avant la fin prefs+onboarding)
  // Ce bloc est conservé comme fallback pour les sessions où wa_hotspot_onboard_pending
  // aurait été posé après wa_onboarded (cas edge : reconnexion post-onboarding).
  if(!localStorage.getItem('wa_hotspots_hinted')&&localStorage.getItem('wa_hotspot_onboard_pending')&&localStorage.getItem('wa_onboarded')){
    localStorage.removeItem('wa_hotspot_onboard_pending');
    setTimeout(_showHotspotOnboard,900);
  }
}

// ── POST VIEW (post unique, style feed) ──────
async function openPostView(id){
  if(!id)return;
  prevScreen=document.querySelector('.screen.active')?.id||'sc-feed';
  goS('sc-postview');
  const pvScroll=document.getElementById('pv-scroll');
  pvScroll.innerHTML=skFeed(1);
  if(!dbOk){
    renderSlides([DEMOS[0]],true,'pv-scroll');
    return;
  }
  const{data:p,error}=await sb.from('posts').select('*').eq('id',id).eq('hidden',false).maybeSingle();
  if(error||!p){
    pvScroll.innerHTML=`<div class="empty-state empty-state--full"><img src="mascote_ivory/the_observer.png" alt=""><div>${t('post_not_found')||'Post introuvable'}<div class="es-hint">${t('post_maybe_deleted')}</div></div></div>`;
    return;
  }
  const prof=await getProfile(p.user_id);
  let liked=false,saved=false,realLikesCount=p.likes_count||0;
  if(me){
    const[l,s,lc]=await Promise.all([
      sb.from('likes').select('id').eq('post_id',id).eq('user_id',me.id).maybeSingle(),
      sb.from('saved_posts').select('id').eq('post_id',id).eq('user_id',me.id).maybeSingle(),
      sb.from('likes').select('*',{count:'exact',head:true}).eq('post_id',id)
    ]);
    liked=!!l.data;saved=!!s.data;
    if(typeof lc.count==='number') realLikesCount=lc.count;
  }
  const followed=await getFollowed().catch(()=>[]);
  renderSlides([{
    id:p.id,
    imageUrl:p.image_url,
    uid:p.user_id,
    user:prof?.username||prof?.full_name||'user',
    avatarUrl:prof?.avatar_url,
    caption:p.caption||'',
    likes:realLikesCount,
    comments_count:p.comments_count||0,
    hotspots:p.hotspots||[],
    tags:p.tags||{},
    followed:followed.includes(p.user_id),
    liked,
    saved,
    musicUrl:p.music_url||'',
    musicTitle:p.music_title||'',
    musicStart:p.music_start||0
  }],false,'pv-scroll');
  resyncFeedCounts([p.id]);
  // Comptage de vue — non bloquant, ne compte pas les auto-vues
  trackView(p.id, p.user_id);
  // ── Hotspots dans le post view ─────────────────────────────
  if(p.hotspots&&p.hotspots.length){
    const pid=p.id;
    const lazyImg=document.querySelector('#pv-scroll img[data-src]');
    if(lazyImg){
      const src=lazyImg.dataset.src;
      lazyImg.removeAttribute('data-src');
      lazyImg.src=src;
    }
    const pvImg=document.querySelector('#pv-scroll .feed-slide img');
    const _showHs=()=>{
      // Cibler UNIQUEMENT le hdots dans pv-scroll (IDs dupliqués dans le DOM
      // car le même post peut être dans feed-scroll ET pv-scroll)
      const pvScroll=document.getElementById('pv-scroll');
      const hdots=pvScroll
        ?[...pvScroll.querySelectorAll('[id^="hdots-"]')].find(el=>el.id==='hdots-'+pid)
        :null;
      if(!hdots) return;
      // Re-applique _fitHzone avec les dimensions réelles du layout stable
      // pour garantir la même position que dans le feed
      const pvImg=pvScroll?.querySelector('.feed-slide img');
      if(pvImg&&pvImg.naturalWidth&&pvImg.naturalHeight){
        _autoFit(pvImg);
        _fitHzone(pvImg,pid);
      }
      hdots.style.display='block';
    };
    if(pvImg&&pvImg.complete){
      setTimeout(_showHs,50);
    } else if(pvImg){
      pvImg.addEventListener('load',()=>setTimeout(_showHs,80),{once:true});
      setTimeout(_showHs,800);
    }
  }
}
function dismissHotspotHint(){
  localStorage.setItem('wa_hotspots_hinted','1');
  const ov=document.getElementById('hs-onboard');
  if(ov){ov.style.opacity='0';setTimeout(()=>ov.remove(),280);}
  document.querySelectorAll('.hotspot-hint-active').forEach(el=>el.classList.remove('hotspot-hint-active'));
  // Enchaîne sur l'overlay du bouton + (créer un post)
  if(!localStorage.getItem('wa_plus_hinted')){
    setTimeout(_showNavPlusOnboard,500);
  }
}
function _showNavPlusOnboard(){
  if(document.getElementById('nav-plus-onboard'))return;
  if(localStorage.getItem('wa_plus_hinted'))return;
  const ov=document.createElement('div');
  ov.id='nav-plus-onboard';
  ov.setAttribute('role','dialog');
  ov.setAttribute('aria-modal','true');
  ov.setAttribute('aria-label','Astuce : créer un look');
  ov.style.cssText='position:fixed;inset:0;z-index:199;background:rgba(5,14,34,0.82);backdrop-filter:blur(2px);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:20px;padding-bottom:calc(72px + var(--sab,0px));opacity:0;transition:opacity .3s';
  ov.onclick=_dismissNavPlusOnboard;
  ov.innerHTML=`
    <div onclick="event.stopPropagation()" style="background:rgba(7,16,30,0.97);border:1px solid rgba(212,175,111,0.28);border-radius:20px;padding:24px 22px;max-width:300px;width:100%;text-align:center;flex-shrink:0">
      <div style="font:700 12px var(--fb);letter-spacing:2.5px;color:var(--gold);text-transform:uppercase;margin-bottom:10px">${t('hint_post_first')}</div>
      <div style="font:15px/1.65 'Cormorant Garamond',Georgia,serif;color:var(--wd);margin-bottom:20px">${t('ob3_desc')||'Photo · étiquettes · style — ton look devient une info utile pour toute la communauté.'}</div>
      <button onclick="_dismissNavPlusOnboard()" style="background:var(--gold);color:var(--black);border:none;border-radius:50px;padding:11px 0;font:700 11px var(--fb);letter-spacing:2px;text-transform:uppercase;cursor:pointer;width:100%">${t('cest_parti')||'Je me lance'}</button>
    </div>
    <div style="width:1px;height:32px;border-left:1.5px dashed rgba(212,175,111,0.4);margin-top:10px;flex-shrink:0"></div>
    <div style="color:var(--gold);font-size:14px;line-height:1;flex-shrink:0;margin-bottom:4px">▼</div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ov.style.opacity='1';}));
  // Anneau pulsant — enfant direct du bouton, suit sa position sans calcul viewport
  const btn=document.querySelector('.bnav .ni-center, #shared-bnav .ni-center');
  if(btn){
    btn.style.overflow='visible';
    btn.style.position='relative';
    btn.style.zIndex='301';
    const ring=document.createElement('div');
    ring.id='nav-plus-ring';
    ring.style.cssText='position:absolute;inset:-10px;border-radius:50%;border:2.5px solid rgba(240,234,216,0.9);animation:hintPulse 1.2s ease-out infinite;pointer-events:none;box-shadow:0 0 24px rgba(240,234,216,0.4)';
    btn.appendChild(ring);
  }
}
function _dismissNavPlusOnboard(){
  localStorage.setItem('wa_plus_hinted','1');
  const ov=document.getElementById('nav-plus-onboard');
  if(ov){ov.style.opacity='0';setTimeout(()=>ov.remove(),280);}
  const ring=document.getElementById('nav-plus-ring');
  if(ring){ring.style.opacity='0';setTimeout(()=>ring.remove(),280);}
  document.querySelectorAll('.ni-center').forEach(el=>{
    el.classList.remove('hint-pulse');
    el.style.zIndex='';
  });
}
function _showHotspotOnboard(){
  if(document.getElementById('hs-onboard'))return;
  // Garde supprimée — l'overlay est éducatif, pas besoin de hotspots rendus
  const ov=document.createElement('div');
  ov.id='hs-onboard';
  ov.setAttribute('role','dialog');
  ov.setAttribute('aria-modal','true');
  ov.setAttribute('aria-label','Astuce : les étiquettes');
  ov.style.cssText='position:fixed;inset:0;z-index:200;background:rgba(5,14,34,0.78);backdrop-filter:blur(2px);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .3s';
  ov.onclick=dismissHotspotHint;
  ov.innerHTML=`<div style="width:48px;height:48px;border-radius:50%;border:2px solid var(--gold);background:rgba(212,175,111,0.2);display:flex;align-items:center;justify-content:center;animation:hotspotHint 1.4s ease-out infinite;box-shadow:0 0 28px rgba(212,175,111,0.55);margin-bottom:14px;flex-shrink:0"><span style="font-size:20px;color:rgba(212,175,111,0.9);font-weight:300;line-height:1">+</span></div><div style="width:1px;height:36px;border-left:1.5px dashed rgba(212,175,111,0.35);margin-bottom:14px;flex-shrink:0"></div><div onclick="event.stopPropagation()" style="background:rgba(7,16,30,0.97);border:1px solid rgba(212,175,111,0.28);border-radius:20px;padding:24px 22px;max-width:300px;width:100%;text-align:center;flex-shrink:0"><div style="font:700 12px var(--fb);letter-spacing:2.5px;color:var(--gold);text-transform:uppercase;margin-bottom:10px">${t('hint_onboard_title')}</div><div style="font:15px/1.65 'Cormorant Garamond',Georgia,serif;color:var(--wd);margin-bottom:20px">${t('hint_onboard_body')}</div><button onclick="dismissHotspotHint()" style="background:var(--gold);color:var(--black);border:none;border-radius:50px;padding:11px 0;font:700 11px var(--fb);letter-spacing:2px;text-transform:uppercase;cursor:pointer;width:100%">${t('hint_onboard_cta')}</button></div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ov.style.opacity='1';}));
}

function doubleTapLike(e,el,id,isDemo){
  // Anti double-fire (listeners touch + click peuvent déclencher en même temps)
  if(doubleTapLike._cd)return;
  doubleTapLike._cd=true;
  setTimeout(()=>{doubleTapLike._cd=false;},700);
  // Position au toucher
  const touch=e?.changedTouches?.[0]||e?.touches?.[0]||e;
  const rect=el.getBoundingClientRect();
  const x=touch?.clientX??rect.left+rect.width/2;
  const y=touch?.clientY??rect.top+rect.height/2;
  // ── Cœur animé via RAF (non bloqué par prefers-reduced-motion CSS) ──
  const wrap=document.createElement('div');
  wrap.style.cssText=`position:fixed;left:${x}px;top:${y}px;z-index:99999;pointer-events:none`;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','90');svg.setAttribute('height','90');
  svg.setAttribute('fill','#1E4FD8');
  svg.style.cssText='display:block;filter:drop-shadow(0 4px 24px rgba(30,79,216,0.65));transform:translate(-50%,-50%) scale(0.2);opacity:0';
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d','M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z');
  svg.appendChild(path);wrap.appendChild(svg);document.body.appendChild(wrap);
  const t0=performance.now();const DUR=700;
  (function frame(now){
    const p=Math.min((now-t0)/DUR,1);
    const ease=1-Math.pow(1-p,3);
    const sc=p<0.25?0.2+ease*4*(1.2-0.2)*p:p<0.55?1.2-(p-0.25)/0.3*0.2:1.0;
    const op=p<0.18?p/0.18:p>0.65?(1-p)/0.35:1;
    const dy=-55*ease;
    svg.style.transform=`translate(-50%,-50%) translateY(${dy}px) scale(${sc})`;
    svg.style.opacity=op;
    if(p<1)requestAnimationFrame(frame);else wrap.remove();
  })(t0);
  navigator.vibrate?.([8,0,8]);
  if(isDemo==='false'||isDemo===false) addLikeOnly(id);
}
async function addLikeOnly(postId){
  if(!me)return toast(t('toast_login_like'));
  if(_likeInProgress)return;
  const heartEl=document.getElementById('heart-'+postId);
  const isAlreadyLiked=heartEl&&heartEl.dataset.liked==='1';
  if(isAlreadyLiked)return;
  _likeInProgress=true;
  // Optimistic update : bleu immédiatement sans attendre le réseau
  const countEl=document.getElementById('like-count-'+postId);
  const prevCount=parseInt(countEl?.dataset?.count??countEl?.textContent??'0',10);
  if(heartEl){heartEl.dataset.liked='1';heartEl.style.fill='#1E4FD8';heartEl.style.stroke='#1E4FD8';}
  if(countEl){const _nv=prevCount+1;countEl.dataset.count=_nv;countEl.textContent=fmtN(_nv);}
  try{
    const{data:existing}=await sb.from('likes').select('id').eq('post_id',postId).eq('user_id',me.id).maybeSingle();
    if(existing){_likeInProgress=false;return;}
    await sb.from('likes').insert({post_id:postId,user_id:me.id});
    const{data:post}=await sb.from('posts').select('likes_count,user_id').eq('id',postId).single();
    const newCount=(post?.likes_count||0)+1;
    await sb.from('posts').update({likes_count:newCount}).eq('id',postId);
    if(countEl){countEl.dataset.count=newCount;countEl.textContent=fmtN(newCount);}
    if(post?.user_id&&post.user_id!==me.id){
      try{await sb.from('notifications').insert({user_id:post.user_id,from_user_id:me.id,type:'like',post_id:postId});}catch(e){}
    }
  }catch(e){
    // Revert si erreur réseau
    if(heartEl){heartEl.dataset.liked='0';heartEl.style.fill='none';heartEl.style.stroke='var(--white)';}
    if(countEl){countEl.dataset.count=prevCount;countEl.textContent=fmtN(prevCount);}
    _DBG.err('addLikeOnly',e);
  }finally{_likeInProgress=false;}
}

function demLike(el){el.classList.toggle('liked');}

function _syncPgridLike(postId, count){
  const badge=document.getElementById('pgrid-like-'+postId);
  if(!badge)return;
  const span=document.getElementById('pgrid-like-count-'+postId);
  if(count>0){badge.style.display='flex';if(span)span.textContent=fmtN(count);}
  else{badge.style.display='none';}
}

let _likeInProgress=false;
async function toggleLike(postId){
  if(!me)return toast(t('toast_login_like'));
  if(_likeInProgress)return;
  _likeInProgress=true;
  const heartEl=document.getElementById('heart-'+postId);
  const countEl=document.getElementById('like-count-'+postId);
  const isLiked=heartEl&&heartEl.dataset.liked==='1';
  const prevCount=parseInt(countEl?.dataset?.count??countEl?.textContent??'0',10);
  if(isLiked){
    // ── UNLIKER optimistic ──
    if(heartEl){heartEl.dataset.liked='0';heartEl.style.fill='none';heartEl.style.stroke='white';}
    _triggerAnim(heartEl?.closest('.slide-action'),'heart-deflate');
    navigator.vibrate?.(6);
    if(countEl){const _nv=Math.max(0,prevCount-1);countEl.dataset.count=_nv;countEl.textContent=fmtN(_nv);}
    _syncPgridLike(postId, Math.max(0,prevCount-1));
    try{
      await sb.from('likes').delete().eq('post_id',postId).eq('user_id',me.id);
      const{data:post}=await sb.from('posts').select('likes_count').eq('id',postId).single();
      const newCount=Math.max(0,(post?.likes_count||1)-1);
      await sb.from('posts').update({likes_count:newCount}).eq('id',postId);
      if(countEl){countEl.dataset.count=newCount;countEl.textContent=fmtN(newCount);}
      _syncPgridLike(postId, newCount);
    }catch(e){
      if(heartEl){heartEl.dataset.liked='1';heartEl.style.fill='#1E4FD8';heartEl.style.stroke='#1E4FD8';}
      if(countEl){countEl.dataset.count=prevCount;countEl.textContent=fmtN(prevCount);}
      _syncPgridLike(postId, prevCount);
      toast('❌ '+t('like_error'));
    }
  }else{
    // ── LIKER optimistic ──
    if(heartEl){heartEl.dataset.liked='1';heartEl.style.fill='#1E4FD8';heartEl.style.stroke='#1E4FD8';}
    _triggerAnim(heartEl?.closest('.slide-action'),'heart-spring');
    navigator.vibrate?.(12);
    if(countEl){const _nv=prevCount+1;countEl.dataset.count=_nv;countEl.textContent=fmtN(_nv);}
    _syncPgridLike(postId, prevCount+1);
    try{
      await sb.from('likes').insert({post_id:postId,user_id:me.id});
      const{data:post}=await sb.from('posts').select('likes_count,user_id').eq('id',postId).single();
      const newCount=(post?.likes_count||0)+1;
      await sb.from('posts').update({likes_count:newCount}).eq('id',postId);
      if(countEl){countEl.dataset.count=newCount;countEl.textContent=fmtN(newCount);}
      _syncPgridLike(postId, newCount);
      if(post?.user_id&&post.user_id!==me.id){
        try{await sb.from('notifications').insert({user_id:post.user_id,from_user_id:me.id,type:'like',post_id:postId});}catch(e){}
      }
    }catch(e){
      if(heartEl){heartEl.dataset.liked='0';heartEl.style.fill='none';heartEl.style.stroke='white';}
      if(countEl){countEl.dataset.count=prevCount;countEl.textContent=fmtN(prevCount);}
      _syncPgridLike(postId, prevCount);
      toast('❌ '+t('like_error'));
    }
  }
  _likeInProgress=false;
}
function toggleSound(el) {
  const musicUrl = el.dataset.music || '';
  if (musicUrl) {
    // ── Musique du post ──────────────────────────
    const musicStart = parseFloat(el.dataset.musicStart || 0);
    if (!el._audio) {
      el._audio = new Audio(musicUrl);
      el._audio.loop = true;
      el._audio.oncanplay = () => {
        if (musicStart > 0 && el._audio.currentTime < 0.5) el._audio.currentTime = musicStart;
        el._audio.oncanplay = null;
      };
    }
    if (el._audioPlaying) {
      el._audio.pause();
      el._audioPlaying = false;
      el.classList.add('vinyl-paused');
    } else {
      // Arrête tous les autres vinyles + l'ambiance
      document.querySelectorAll('[data-music]').forEach(v => {
        if (v !== el && v._audio) { v._audio.pause(); v._audioPlaying = false; v.classList.add('vinyl-paused'); }
      });
      const amb = document.getElementById('feed-ambient');
      if (amb && !amb.paused) { amb.pause(); isMuted = true; }
      el._audio.play().catch(() => toast(t('toast_allow_sound')));
      el._audioPlaying = true;
      el.classList.remove('vinyl-paused');
    }
  } else {
    // ── Musique d'ambiance (post sans musique) ──
    const audio = document.getElementById('feed-ambient');
    if (!audio) return;
    if (isMuted) {
      if (!audio.src) { toast(typeof currentLang!=='undefined'&&currentLang==='en'?'Music unavailable offline':'Musique indisponible hors ligne'); return; }
      audio.play().catch(() => toast(t('toast_allow_sound')));
      isMuted = false;
      el.classList.remove('vinyl-paused');
    } else {
      audio.pause();
      isMuted = true;
      el.classList.add('vinyl-paused');
    }
  }
}

// ═══════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════
async function openComments(postId,isDemo){
  curPostId=postId;
  if(isDemo==='true'){
    document.getElementById('comments-list').innerHTML=`
      <div class="comment-item"><div class="comment-av"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="rgba(240,234,216,0.4)" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><div class="comment-body"><div class="comment-user">sofia.looks</div><div class="comment-text">Trop beau ce look</div><div class="comment-time">2h</div></div></div>
      <div class="comment-item"><div class="comment-av"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="rgba(240,234,216,0.4)" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><div class="comment-body"><div class="comment-user">miamode</div><div class="comment-text">Où tu as trouvé ce manteau ?</div><div class="comment-time">1h</div></div></div>`;
  } else {
    await loadComments(postId);
    // Resync likes count
    sb.from('likes').select('*',{count:'exact',head:true}).eq('post_id',postId).then(({count})=>{
      if(count===null)return;
      sb.from('posts').update({likes_count:count}).eq('id',postId);
      const likeEl=document.getElementById('like-count-'+postId);
      if(likeEl){likeEl.dataset.count=count;likeEl.textContent=fmtN(count);}
    });
  }
  document.getElementById('overlay').classList.add('show');
  document.getElementById('sheet-comments').classList.add('show');
}
async function loadComments(postId){
  const list=document.getElementById('comments-list');
  list.innerHTML=skComments();
  const {data,error}=await sb.from('comments').select('*').eq('post_id',postId).eq('hidden',false).order('created_at',{ascending:true});
  if(error){
    console.error('[loadComments]',error);
    list.innerHTML=`<div class="empty-state"><img src="mascote_ivory/le_gardien.png" alt=""><div>${t('error_loading')||'Impossible de charger les commentaires.'}</div></div>`;
    return;
  }
  if(!data||!data.length){
    // Resync le compteur si désynchronisé
    sb.from('posts').update({comments_count:0}).eq('id',postId).then(()=>{
      const countEl=document.getElementById('comment-count-'+postId);
      if(countEl)countEl.textContent='0';
    });
    list.innerHTML=`<div class="empty-state"><img src="mascote_ivory/le_communicateur.png" alt=""><div>${t('first_comment')}</div></div>`;
    return;
  }
  const uids=[...new Set(data.map(c=>c.user_id))];
  const profs=await getProfiles(uids);
  const pm=Object.fromEntries(profs.map(p=>[p.id,p]));
  list.innerHTML=data.map(c=>{
    const av=pm[c.user_id]?.avatar_url?`<img src="${pm[c.user_id].avatar_url}" alt="" class="img-cover">`:wolfAv('32px');
    const isOwn=me&&c.user_id===me.id;
    let menuBtn='',actions='';
    if(isOwn){
      menuBtn=`<button class="comment-menu-btn" onclick="event.stopPropagation();toggleCommentMenu('${c.id}')" title="Modifier ou supprimer">⋮</button>`;
      actions=`<div id="cmenu-${c.id}" class="comment-actions" style="display:none">
      <button class="comment-act" onclick="startEditComment('${c.id}',this)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="icon-inline"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Modifier</button>
      <button class="comment-act del" onclick="deleteComment('${c.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="icon-inline"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>Supprimer</button>
    </div>`;
    }else if(me){
      menuBtn=`<button class="comment-menu-btn" onclick="event.stopPropagation();toggleCommentMenu('${c.id}')" title="Signaler">⋮</button>`;
      actions=`<div id="cmenu-${c.id}" class="comment-actions" style="display:none">
      <button class="comment-act del" onclick="reportComment('${c.id}','${c.user_id}')">🚩 ${t('report_btn')}</button>
    </div>`;
    }
    const longPressAttr=me?` ontouchstart="_commentTouchStart(event,'${c.id}')" ontouchend="_commentTouchEnd()" ontouchcancel="_commentTouchEnd()" oncontextmenu="event.preventDefault();toggleCommentMenu('${c.id}');return false"`:'';
    return `<div class="comment-item" id="citem-${c.id}" style="align-items:flex-start"${longPressAttr}>
      <div class="comment-av">${av}</div>
      <div class="comment-body" class="flex-1">
        <div class="comment-user">${escapeHtml(pm[c.user_id]?.username||'user')}</div>
        <div class="comment-text" id="ctxt-${c.id}">${escapeHtml(c.content)}</div>
        <div class="comment-time">${timeAgo(c.created_at)}</div>
        ${actions}
      </div>
      ${menuBtn}
    </div>`;
  }).join('');
}
let _editingCommentId=null;

function toggleCommentMenu(cid){
  const menu=document.getElementById('cmenu-'+cid);
  if(!menu)return;
  // Ferme les autres menus ouverts
  document.querySelectorAll('.comment-actions').forEach(m=>{if(m.id!=='cmenu-'+cid)m.style.display='none';});
  menu.style.display=menu.style.display==='none'?'flex':'none';
}

let _commentLongPressTimer=null;
function _commentTouchStart(ev,cid){
  if(_commentLongPressTimer)clearTimeout(_commentLongPressTimer);
  _commentLongPressTimer=setTimeout(()=>{
    toggleCommentMenu(cid);
    // Vibration légère si supporté (feedback haptique)
    if(navigator.vibrate)navigator.vibrate(15);
  },550);
}
function _commentTouchEnd(){
  if(_commentLongPressTimer){clearTimeout(_commentLongPressTimer);_commentLongPressTimer=null;}
}
function startEditComment(cid, btn){
  const txtEl=document.getElementById('ctxt-'+cid);
  if(!txtEl)return;
  const input=document.getElementById('comment-input');
  const sendBtn=document.querySelector('.comment-send');
  _editingCommentId=cid;
  input.value=txtEl.textContent;
  input.focus();
  input.classList.add('comment-input-edit');
  if(sendBtn){sendBtn.textContent='✓';sendBtn.style.fontSize='20px';}
  // Ferme le menu
  const menu=document.getElementById('cmenu-'+cid);
  if(menu)menu.style.display='none';
}

function _cancelEdit(){
  _editingCommentId=null;
  const input=document.getElementById('comment-input');
  const sendBtn=document.querySelector('.comment-send');
  input.value='';
  input.classList.remove('comment-input-edit');
  if(sendBtn){sendBtn.textContent='➤';sendBtn.style.fontSize='16px';}
}

async function deleteComment(cid){
  if(!me)return;
  if(!confirm('Supprimer ce commentaire ?'))return;
  await sb.from('comments').delete().eq('id',cid).eq('user_id',me.id);
  const {count}=await sb.from('comments').select('*',{count:'exact',head:true}).eq('post_id',curPostId);
  await sb.from('posts').update({comments_count:count||0}).eq('id',curPostId);
  const countEl=document.getElementById('comment-count-'+curPostId);
  if(countEl)countEl.textContent=count||0;
  await loadComments(curPostId);
}

async function reportComment(cid,authorId){
  if(!me)return toast(t('login_report'));
  toggleCommentMenu(cid); // ferme le menu
  if(!confirm(t('report_comment_confirm')))return;
  const txtEl=document.getElementById('ctxt-'+cid);
  const snapshot=txtEl?txtEl.textContent:null;
  const{error}=await sb.from('content_reports').insert({
    content_type:'comment',content_id:cid,content_text:snapshot,
    reported_user_id:authorId,reporter_id:me.id,reason:'signalé par utilisateur'
  });
  if(error)return toast('❌ '+t('toast_error'));
  toast(t('report_sent'));
}

// ── Compteur de vues privé (visible uniquement sur le profil du créateur) ──
async function trackView(postId, postOwnerId){
  // Ne compte pas les auto-vues
  if(!me||me.id===postOwnerId) return;
  // Dédup par session — un seul comptage par post par session
  const key=`wa_view_${postId}`;
  if(sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key,'1');
  // Incrément non-bloquant (fire & forget)
  sb.from('posts')
    .select('views_count')
    .eq('id',postId)
    .maybeSingle()
    .then(({data})=>{
      if(data==null) return;
      return sb.from('posts')
        .update({views_count:(data.views_count||0)+1})
        .eq('id',postId);
    })
    .catch(()=>{}); // silencieux — jamais bloquant
}

async function sharePost(pid){
  const look=window.__looks?.[pid];
  const user=look?.user||'WearAura';
  const caption=look?.caption||'';
  const url=`${location.origin}${location.pathname}?post=${pid}`;

  const shareData={
    title:`Look de ${user} sur WearAura`,
    text:caption?`"${caption}" — Découvre ce look sur WearAura ✨`:`Découvre ce look sur WearAura ✨`,
    url
  };

  // Mobile — feuille de partage native
  if(navigator.share){
    try{
      await navigator.share(shareData);
    }catch(e){
      // AbortError = l'utilisateur a fermé la feuille → silencieux
      if(e.name!=='AbortError') toast(t('toast_share_unavailable'));
    }
    return;
  }

  // Desktop — copie du lien
  try{
    await navigator.clipboard.writeText(url);
    toast(t('toast_link_copied'));
  }catch(e){
    toast(t('toast_link_copy_fail'));
  }
}

function savePostFromOptions(){
  const pid=_poTarget?.postId;
  closePostOptions();
  if(pid) downloadPostImage(pid);
}

async function downloadPostImage(pid){
  const look=window.__looks?.[pid];
  const imageUrl=look?.imageUrl;
  if(!imageUrl){ toast(t('toast_image_unavailable')); return; }

  const icon=document.getElementById('dl-icon-'+pid);
  if(icon) icon.style.opacity='0.4';

  try{
    const res=await fetch(imageUrl);
    if(!res.ok) throw new Error('fetch '+res.status);
    const blob=await res.blob();
    const ext=blob.type.includes('png')?'png':'jpg';
    const filename=`wearaura_look_${pid.slice(-8)}.${ext}`;
    const file=new File([blob], filename, { type: blob.type });

    // iOS Safari + Android Chrome : Share API → feuille native → "Enregistrer dans Photos"
    if(navigator.canShare && navigator.canShare({ files:[file] })){
      await navigator.share({ files:[file], title:'Look WearAura' });
      return;
    }

    // Fallback : plein écran avec instruction "appuie longuement"
    _showSaveOverlay(URL.createObjectURL(blob));

  }catch(e){
    if(e.name!=='AbortError'){
      console.warn('[downloadPostImage]',e);
      toast(t('toast_error_retry'));
    }
  }finally{
    if(icon) icon.style.opacity='1';
  }
}

function _showSaveOverlay(blobUrl){
  // Overlay plein écran : l'utilisateur appuie longuement sur l'image pour enregistrer
  const ov=document.createElement('div');
  ov.id='save-img-overlay';
  ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:24px';

  const img=document.createElement('img');
  img.src=blobUrl;
  img.style.cssText='max-width:100%;max-height:70vh;border-radius:12px;object-fit:contain;-webkit-user-select:none;user-select:none;pointer-events:auto';
  img.setAttribute('draggable','false');

  const hint=document.createElement('div');
  hint.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,.7)" stroke-width="1.8" stroke-linecap="round" style="flex-shrink:0"><path d="M12 2a5 5 0 0 1 5 5v6a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg><span>Appuie longuement sur la photo → <strong style="color:#EDE4CF">Enregistrer dans la galerie</strong></span>';
  hint.style.cssText='display:flex;align-items:center;gap:10px;font-family:Montserrat,sans-serif;font-size:13px;color:rgba(240,234,216,.65);text-align:center;line-height:1.6;max-width:280px';

  const closeBtn=document.createElement('div');
  closeBtn.textContent='Fermer';
  closeBtn.style.cssText='margin-top:8px;padding:12px 32px;border:1px solid rgba(240,234,216,.25);border-radius:50px;font-family:Montserrat,sans-serif;font-size:12px;letter-spacing:2px;color:rgba(240,234,216,.6);cursor:pointer';
  closeBtn.onclick=()=>{ ov.remove(); URL.revokeObjectURL(blobUrl); };

  ov.appendChild(img);
  ov.appendChild(hint);
  ov.appendChild(closeBtn);
  document.body.appendChild(ov);
}

async function doComment(){
  if(!me)return toast(t('login_comment'));
  const input=document.getElementById('comment-input');
  const sendBtn=document.querySelector('.comment-send');
  const text=input.value.trim();if(!text)return;
  // Loading state — désactive le bouton pendant l'opération async
  if(sendBtn){sendBtn.disabled=true;sendBtn.style.opacity='0.45';}
  try{
    // ── Mode édition ──
    if(_editingCommentId){
      const cid=_editingCommentId;
      _cancelEdit();
      const{data,error}=await sb.from('comments').update({content:text}).eq('id',cid).eq('user_id',me.id).select();
      if(error){
        console.error('[doComment edit]',error);
        toast(friendlyError?friendlyError(error):'Erreur de modification');
        return;
      }
      if(!data||!data.length){
        console.warn('[doComment edit] no rows updated — RLS or id mismatch',{cid,me:me.id});
        toast(t('toast_edit_denied'));
        return;
      }
      await loadComments(curPostId);
      return;
    }

    // ── Nouveau commentaire ──
    input.value='';
    const{error:insertErr}=await sb.from('comments').insert({post_id:curPostId,user_id:me.id,content:text});
    if(insertErr){
      console.error('[doComment insert]',insertErr);
      input.value=text;
      toast(t('toast_comment_failed'));
      return;
    }
    const {count}=await sb.from('comments').select('*',{count:'exact',head:true}).eq('post_id',curPostId);
    await sb.from('posts').update({comments_count:count}).eq('id',curPostId);
    const countEl=document.getElementById('comment-count-'+curPostId);
    if(countEl)countEl.textContent=count;
    await loadComments(curPostId);
    try{
      const{data:post}=await sb.from('posts').select('user_id').eq('id',curPostId).single();
      if(post?.user_id&&post.user_id!==me.id){
        await sb.from('notifications').insert({user_id:post.user_id,from_user_id:me.id,type:'comment',post_id:curPostId,comment_text:text.slice(0,100)});
      }
    }catch(e){}
  }finally{
    // Réactiver le bouton quoi qu'il arrive (succès ou erreur)
    if(sendBtn){sendBtn.disabled=false;sendBtn.style.opacity='';}
  }
}

// ═══════════════════════════════════════════
// EXPLORE
// ═══════════════════════════════════════════
async function loadExplore(tag='',country=''){
  const grid=document.getElementById('exp-grid');
  grid.innerHTML=skGrid(6);
  const lbl=document.getElementById('exp-location-label');
  if(country){lbl.style.display='block';lbl.innerHTML=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="icon-inline"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${country}`;}
  else if(tag){lbl.style.display='block';lbl.innerHTML=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="icon-inline"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>"${tag}"`;}
  else{lbl.style.display='none';}
  if(!dbOk){grid.innerHTML=demoExpGrid();return;}
  let q=sb.from('posts').select('id,image_url,caption,likes_count,city,country,user_id').eq('hidden',false).order('created_at',{ascending:false}).limit(20);
  if(country)q=q.ilike('country',country);
  else if(tag)q=q.or(`caption.ilike.%${tag}%,city.ilike.%${tag}%`);
  const {data}=await q;
  if(!data||!data.length){grid.innerHTML=`<div class="empty grid-full"><span class="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.3)" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg></span>${t('no_results')}</div>`;return;}
  const uids=[...new Set(data.map(p=>p.user_id))];
  const profs=await getProfiles(uids);
  const pm=Object.fromEntries(profs.map(p=>[p.id,p]));
  const bgs=['bg-1','bg-2','bg-3','bg-4','bg-5','bg-6','bg-7','bg-8','bg-9'];
  const ems=['👗','🧥','👠','👜','🎩','🌿','💎','🧣','🌸'];
  grid.innerHTML=data.map((p,i)=>{
    const img=p.image_url?`<img data-src="${p.image_url}" alt="" style="width:100%;height:100%;object-fit:cover">`:`<div class="exp-placeholder ${bgs[i%9]}">${ems[i%9]}</div>`;
    return `<div class="exp-item" onclick="openPostView('${p.id}')">
      <div class="exp-item-img">${img}</div>
      <div class="exp-item-info">
        ${p.city?`<div class="exp-loc"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:2px;vertical-align:-1px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${escapeHtml(p.city)}</div>`:''}
        <div class="exp-caption">${escapeHtml(p.caption||'')}</div>
        <div class="exp-meta">
          <div class="exp-user-row"><div class="exp-av" style="overflow:hidden"><img src="wolf.png" alt="" class="img-cover" onerror="this.style.display='none'"></div><span class="exp-user">${escapeHtml(pm[p.user_id]?.username||'user')}</span></div>
          <div class="exp-likes">♡ ${fmtN(p.likes_count||0)}</div>
        </div>
      </div>
    </div>`;
  }).join('');
  observeLazy(grid);
}

/* ── Filter bottom sheet — multi-select ── */
let _filterSheetCat='pays';
let _bsSelected=new Set(); // format "cat:val"

// Chips mixtes pour la barre principale
const _mixedChips=[
  {cat:'pays',  l:'Tout',          v:'',           reset:true},
  {cat:'pays',  l:'🇫🇷 France',     v:'France'},
  {cat:'style', l:'Minimaliste',   v:'minimaliste'},
  {cat:'occasion',l:'Date',        v:'date'},
  {cat:'style', l:'Streetwear',    v:'streetwear'},
  {cat:'pays',  l:'🇯🇵 Japon',      v:'Japan'},
  {cat:'occasion',l:'Soirée',      v:'soirée'},
  {cat:'pays',  l:'🇮🇹 Italie',     v:'Italy'},
  {cat:'style', l:'Vintage',       v:'vintage'},
  {cat:'pays',  l:'🇰🇷 Corée',      v:'South Korea'},
  {cat:'occasion',l:'Plage',       v:'plage'},
  {cat:'style', l:'Luxe',          v:'luxe'},
];

function initMixedChips(){
  const cc=document.getElementById('country-chips');
  if(!cc)return;
  cc.innerHTML=_mixedChips.map(f=>{
    const isActive=f.reset&&_bsSelected.size===0;
    return `<div class="chip${isActive?' active':''}" onclick="quickChipSel(this,'${f.cat}','${f.v}',${!!f.reset})">${f.l}</div>`;
  }).join('');
}

function quickChipSel(el,cat,val,isReset){
  document.querySelectorAll('#country-chips .chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  _bsSelected.clear();
  if(!isReset&&val) _bsSelected.add(cat+':'+val);
  _srchFcatCurrent=cat;
  updatePlusBtn();
  const si=document.getElementById('srch-input');
  if(si)si.value='';
  const clr=document.getElementById('srch-clear');
  if(clr)clr.style.display='none';
  document.getElementById('srch-results').style.display='none';
  document.getElementById('exp-grid').style.display='grid';
  if(isReset){loadExplore('',''); return;}
  if(cat==='pays') loadExplore('',val);
  else loadExplore(val,'');
}

function updatePlusBtn(){
  const btn=document.getElementById('srch-filter-plus-btn');
  if(!btn)return;
  const n=_bsSelected.size;
  if(n>0){
    btn.style.background='var(--gold)';
    btn.style.borderColor='var(--gold)';
    btn.innerHTML=`<span style="color:var(--black);font-weight:700;font-size:13px">${n}</span>`;
  } else {
    btn.style.background='rgba(240,234,216,0.1)';
    btn.style.borderColor='rgba(240,234,216,0.25)';
    btn.innerHTML=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  }
}

function openFilterSheet(){
  const overlay=document.getElementById('filter-overlay');
  const sheet=document.getElementById('filter-sheet');
  if(!overlay||!sheet)return;
  overlay.classList.add('show');
  sheet.style.transform='translateY(0)';
  _filterSheetCat='pays';
  document.querySelectorAll('.srch-bstab').forEach((t,i)=>t.classList.toggle('active',i===0));
  renderBsChips('pays');
  updateBsCount();
}
function closeFilterSheet(){
  const overlay=document.getElementById('filter-overlay');
  const sheet=document.getElementById('filter-sheet');
  if(overlay)overlay.classList.remove('show');
  if(sheet)sheet.style.transform='translateY(100%)';
}
function filterSheetCat(el,cat){
  document.querySelectorAll('.srch-bstab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  _filterSheetCat=cat;
  renderBsChips(cat);
}
function renderBsChips(cat){
  const filters=_srchFilters[cat]||_srchFilters.pays;
  const bs=document.getElementById('bs-chips');
  if(!bs)return;
  bs.innerHTML=filters.map(f=>{
    const key=cat+':'+f.v;
    const isActive=_bsSelected.has(key);
    return `<div class="chip${isActive?' active':''}" onclick="toggleBsChip(this,'${cat}','${f.v}')">${f.l}</div>`;
  }).join('');
}
function toggleBsChip(el,cat,val){
  const key=cat+':'+val;
  // "Tout" de cette catégorie = reset cette catégorie
  if(val===''){
    // Retirer tous les items de cette catégorie
    [..._bsSelected].forEach(k=>{ if(k.startsWith(cat+':')) _bsSelected.delete(k); });
    el.classList.add('active');
    el.closest('.chips').querySelectorAll('.chip').forEach((c,i)=>{if(i>0)c.classList.remove('active');});
  } else {
    // Désactiver le "Tout" de cette catégorie si présent
    const allKey=cat+':';
    [..._bsSelected].forEach(k=>{ if(k===cat+':') _bsSelected.delete(k); });
    if(_bsSelected.has(key)){
      _bsSelected.delete(key);
      el.classList.remove('active');
    } else {
      _bsSelected.add(key);
      el.classList.add('active');
    }
    // Désactiver le chip "Tout" visuellement
    const bsChips=document.getElementById('bs-chips');
    if(bsChips)bsChips.querySelectorAll('.chip')[0]?.classList.remove('active');
  }
  updateBsCount();
}
function updateBsCount(){
  const n=_bsSelected.size;
  const countEl=document.getElementById('bs-count');
  if(countEl){
    countEl.textContent=n;
    countEl.style.display=n>0?'inline-flex':'none';
  }
}
function scrollToRewards(){
  toast(t('rewards_coming_soon'));
}
function resetBsFilters(){
  _bsSelected.clear();
  renderBsChips(_filterSheetCat);
  updateBsCount();
}
function applyBsFilters(){
  // Collecter les valeurs par catégorie
  const pays=[], tags=[];
  _bsSelected.forEach(k=>{
    const idx=k.indexOf(':');
    const cat=k.slice(0,idx), val=k.slice(idx+1);
    if(!val)return;
    if(cat==='pays') pays.push(val);
    else tags.push(val);
  });
  // Mettre à jour la barre principale pour refléter la sélection
  const cc=document.getElementById('country-chips');
  if(cc){
    if(_bsSelected.size===0){
      initMixedChips();
    } else {
      // Afficher uniquement les chips sélectionnés + "Tout" en tête
      const selChips=_mixedChips.filter(f=>f.reset||_bsSelected.has(f.cat+':'+f.v));
      cc.innerHTML=selChips.map(f=>{
        const isActive=!f.reset&&_bsSelected.has(f.cat+':'+f.v);
        return `<div class="chip${isActive?' active':''}" onclick="quickChipSel(this,'${f.cat}','${f.v}',${!!f.reset})">${f.l}</div>`;
      }).join('');
    }
  }
  updatePlusBtn();
  closeFilterSheet();
  // Appliquer les filtres
  const country=pays[0]||'';
  const tag=tags[0]||'';
  loadExplore(tag,country);
}

function countrySel(el,val){
  document.querySelectorAll('#country-chips .chip').forEach(c=>c.classList.remove('active'));
  if(el)el.classList.add('active');
  const si = document.getElementById('srch-input');
  if (si) si.value = '';
  const clr=document.getElementById('srch-clear');
  if(clr)clr.style.display = 'none';
  document.getElementById('srch-results').style.display = 'none';
  document.getElementById('exp-grid').style.display = 'grid';
  // Selon la catégorie active, filtrer différemment
  if(_srchFcatCurrent==='pays') loadExplore('',val);
  else if(_srchFcatCurrent==='style') loadExplore(val,'');
  else if(_srchFcatCurrent==='occasion') loadExplore(val,'');
  else loadExplore('',val);
}

// ═══════════════════════════════════════════
// AMBIANCE FEED — piste Jamendo libre de droits
// Remplace l'ancienne démo SoundHelix codée en dur. Seule l'URL est résolue
// au démarrage (JSON ~1 Ko) ; le mp3 n'est téléchargé qu'à la première
// lecture (preload="none"). Hors ligne : le vinyle affiche un toast.
// ═══════════════════════════════════════════
(async () => {
  const audio = document.getElementById('feed-ambient');
  if (!audio || audio.getAttribute('src')) return;
  try {
    const params = new URLSearchParams({
      client_id: 'fd86bffe', format: 'json', limit: '3',
      audioformat: 'mp31', tags: 'ambient', boost: 'popularity_total',
    });
    const res = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params}`);
    const data = await res.json();
    const track = (data.results || []).find(t => t.audio);
    if (track) audio.src = track.audio;
  } catch (_) { /* hors ligne — géré au moment du tap vinyle */ }
})();

function demoExpGrid(){
  const items=[
    ['bg-1','👗','@sofia.looks','🇫🇷 Paris','Sunday edit 🍂 vintage meets modern ✨',2400],
    ['bg-4','🧥','@miamode','🇯🇵 Tokyo','Autumn layers 🍁 conscious choices 🌿',1100],
    ['bg-5','👠','@auralooks','🇮🇹 Milan','Red moment 💃 secondhand Prada only',3800],
    ['bg-7','🎩','@styledarc','🇬🇧 London','Minimal. Intentional. 🖤',890],
    ['bg-8','👜','@vestibule','🇺🇸 New York','Luxury resale finds 💎',4200],
    ['bg-3','🌿','@earthwear','🇧🇷 São Paulo','Sustainable fashion 🌱',2100],
    ['bg-9','🧣','@knotted','🇰🇷 Séoul','K-style vibes ✨',1700],
    ['bg-6','💎','@luxeaura','🇲🇦 Marrakech','Desert glam 🌅',5300],
  ];
  const _pinSvg='<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-1px;margin-right:2px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  const _shirtSvg='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.2)" stroke-width="1" stroke-linecap="round"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/></svg>';
  return items.map(([bg,_e,u,loc,cap,l])=>`
    <div class="exp-item" onclick="goTab('feed')">
      <div class="exp-item-img"><div class="exp-placeholder ${bg} flex-center">${_shirtSvg}</div></div>
      <div class="exp-item-info">
        <div class="exp-loc">${_pinSvg}${loc}</div>
        <div class="exp-caption">${cap}</div>
        <div class="exp-meta">
          <div class="exp-user-row"><div class="exp-av flex-center">${_shirtSvg}</div><span class="exp-user">${u}</span></div>
          <div class="exp-likes">♡ ${fmtN(l)}</div>
        </div>
      </div>
    </div>`).join('');
}

// ═══════════════════════════════════════════

// ── Détecteur double-tap (touch mobile) ────────────────────────
(function(){
  let _dtLast={el:null,t:0};
  document.addEventListener('touchend',function(e){
    const slide=e.target.closest('.feed-slide[data-pid]');
    if(!slide)return;
    if(e.target.closest('.slide-action,.slide-hotspot,.slide-right'))return;
    const now=Date.now();
    if(slide===_dtLast.el&&now-_dtLast.t<350){
      doubleTapLike(e,slide,slide.dataset.pid,slide.dataset.demo);
      _dtLast={el:null,t:0};
    }else{
      _dtLast={el:slide,t:now};
    }
  },{passive:true});
})();
