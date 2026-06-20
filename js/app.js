// START
// ═══════════════════════════════════════════
_DBG.log('⚡ Appel init()');
init().catch(e => _DBG.err('init() rejeté', e));

// ── Build screens track + shared navbar ──────────────────────────────────
(function(){
  var feed=document.getElementById('sc-feed');
  if(!feed||!feed.parentNode) return;
  var track=document.createElement('div');
  track.id='screens-track';
  feed.parentNode.insertBefore(track,feed);
  // Correct left→right order: feed | notif | boutique | profile
  ['sc-feed','sc-notif','sc-boutique','sc-profile'].forEach(function(id){
    var el=document.getElementById(id);
    if(el){ el.classList.add('track-screen'); track.appendChild(el); }
  });
  // Extract sc-feed's navbar as the single shared navbar, place after track
  var nav=feed.querySelector('.bnav');
  if(nav){
    nav.id='shared-bnav';
    track.parentNode.insertBefore(nav,track.nextSibling);
    // Ensure only feed is active on load
    nav.querySelectorAll('.ni').forEach(function(el,i){ el.classList.toggle('active',i===0); });
  }
})();

// ── Track scroll listener — side effects on CSS swipe ────────────────────
(function(){
  var track=document.getElementById('screens-track');
  if(!track) return;
  var TABS=['feed','notif','boutique','profile'];
  var loaded={feed:true,notif:false,boutique:false,profile:false};
  var lastTab='feed';
  var timer=null;
  track.addEventListener('scroll',function(){
    clearTimeout(timer);
    timer=setTimeout(function(){
      var W=track.clientWidth;
      var idx=Math.round(track.scrollLeft/W);
      idx=Math.max(0,Math.min(idx,TABS.length-1));
      var tab=TABS[idx];
      if(tab===lastTab) return;
      if(lastTab==='notif') onLeaveMessagesTab();
      lastTab=tab;
      updateNavActive(tab);
      // Toujours fermer les sous-écrans messages au retour sur notif
      if(tab==='notif' && typeof _closeMsgSubScreens==='function') _closeMsgSubScreens();
      if(!loaded[tab]){
        loaded[tab]=true;
        if(tab==='notif') loadNotifs();
        if(tab==='boutique') loadBoutique();
        if(tab==='profile') loadProfile();
      }
    },80);
  },{passive:true});
})();

// ── JS swipe handler — bypasses inner horizontal scrollers ───────────────
// CSS scroll-snap handles momentum & snap points; this layer handles
// direction lock, edge rubber-band, and skipping inner carousels/chips.
(function(){
  var track=document.getElementById('screens-track');
  if(!track) return;
  var N=4; // number of track screens
  var sx=0,sy=0,st=0,decided=null,dragging=false,startSL=0;

  function insideHorizScroll(el){
    while(el&&el!==track){
      var c=el.classList;
      if(c&&(c.contains('bq-carousel')||c.contains('bq-sm-scroll')||c.contains('chips')||c.contains('feed-tabs-pill'))) return true;
      el=el.parentElement;
    }
    return false;
  }
  function anySheetOpen(){
    var ov=document.getElementById('overlay');
    if(ov&&ov.classList.contains('show')) return true;
    return['share-overlay','post-opts-overlay','flw-overlay','new-msg-overlay','filter-overlay'].some(function(id){
      var el=document.getElementById(id);
      return el&&(el.style.display==='block'||el.style.display==='flex');
    });
  }

  var profTabsBar=document.querySelector('#sc-profile .prof-tabs-bar');
  var profScreen=document.getElementById('sc-profile');
  track.addEventListener('touchstart',function(e){
    if(e.touches.length!==1||anySheetOpen()||insideHorizScroll(e.target)) return;
    // Profile screen: split by Y position relative to the tabs bar
    //   above tabs → track handles (screen navigation)
    //   on/below tabs → profile IIFE handles (tab navigation)
    if(profScreen&&profScreen.contains(e.target)&&profTabsBar){
      if(e.touches[0].clientY>=profTabsBar.getBoundingClientRect().top) return;
    }
    sx=e.touches[0].clientX; sy=e.touches[0].clientY; st=Date.now();
    decided=null; dragging=true; startSL=track.scrollLeft;
  },{passive:true});

  track.addEventListener('touchmove',function(e){
    if(!dragging||e.touches.length!==1) return;
    var dx=e.touches[0].clientX-sx, dy=e.touches[0].clientY-sy;
    if(decided===null){
      if(Math.abs(dx)<6&&Math.abs(dy)<6) return;
      decided=Math.abs(dx)>Math.abs(dy)?'h':'v';
      if(decided==='h') track.style.scrollSnapType='none'; // pause snap during drag
    }
    if(decided==='v'){ dragging=false; return; }
    e.preventDefault();
    var W=track.clientWidth, max=(N-1)*W;
    var nl=startSL-dx;
    // Rubber-band at edges
    if(nl<0)      nl=nl*0.15;
    else if(nl>max) nl=max+(nl-max)*0.15;
    track.scrollLeft=nl;
  },{passive:false});

  function onRelease(e){
    if(!dragging){ dragging=false; decided=null; return; }
    dragging=false;
    track.style.scrollSnapType=''; // restore snap
    if(decided!=='h') return;
    var t=e.changedTouches?e.changedTouches[0]:null;
    var dx=t?t.clientX-sx:0;
    var vel=Math.abs(dx)/Math.max(1,Date.now()-st);
    var W=track.clientWidth;
    var curIdx=Math.round(startSL/W);
    var commit=Math.abs(dx)>W*0.25||vel>0.22;
    var target=commit?(dx>0?curIdx-1:curIdx+1):curIdx;
    target=Math.max(0,Math.min(N-1,target));
    // Fermer les sous-écrans messages si on quitte l'onglet notif (index 1)
    if(commit && curIdx===1 && target!==1){
      ['sc-conversation','sc-new-dm','sc-new-group'].forEach(function(id){
        var el=document.getElementById(id);
        if(el){el.style.display='none';el.style.transform='';el.style.transition='';}
      });
    }
    track.scrollTo({left:target*W,behavior:prefersReducedMotion()?'auto':'smooth'});
  }
  track.addEventListener('touchend',onRelease,{passive:true});
  track.addEventListener('touchcancel',function(){
    dragging=false; decided=null; track.style.scrollSnapType='';
  },{passive:true});
})();

// ── Swipe horizontal — tabs du profil ─────────────────────────────────────
(function(){
  var TABS=['grid','saved','liked','wishlist'];
  var scrollEl=document.querySelector('#sc-profile .prof-scroll');
  if(!scrollEl) return;

  var tabsBar=document.querySelector('#sc-profile .prof-tabs-bar');
  var sx=0, sy=0, st=0, dir=null, _active=false;

  scrollEl.addEventListener('touchstart', function(e){
    _active=false; dir=null;
    if(e.touches.length!==1) return;
    // Header zone (above tabs) → track IIFE handles; don't activate here
    if(tabsBar&&e.touches[0].clientY<tabsBar.getBoundingClientRect().top) return;
    sx=e.touches[0].clientX; sy=e.touches[0].clientY; st=Date.now();
    _active=true;
  },{passive:true});

  scrollEl.addEventListener('touchmove', function(e){
    if(!_active||e.touches.length!==1||dir==='v') return;
    var dx=e.touches[0].clientX-sx, dy=e.touches[0].clientY-sy;
    if(dir===null){
      if(Math.abs(dx)<8&&Math.abs(dy)<8) return;
      dir=Math.abs(dx)>Math.abs(dy)?'h':'v';
    }
    if(dir==='h') e.preventDefault();
  },{passive:false});

  scrollEl.addEventListener('touchend', function(e){
    if(!_active||dir!=='h') return;
    var dx=(e.changedTouches[0]?e.changedTouches[0].clientX:sx)-sx;
    var elapsed=Math.max(1,Date.now()-st);
    var vel=Math.abs(dx)/elapsed;
    if(Math.abs(dx)<50&&vel<0.3) return;

    var curTab='grid';
    TABS.forEach(function(t){
      if(document.getElementById('tab-prof-'+t)&&document.getElementById('tab-prof-'+t).classList.contains('active')) curTab=t;
    });
    var curIdx=TABS.indexOf(curTab);

    if(dx<0&&curIdx<TABS.length-1){
      showProfileTab(TABS[curIdx+1]);                 // tab suivant
    } else if(dx>0&&curIdx>0){
      showProfileTab(TABS[curIdx-1]);                 // tab précédent
    } else if(dx>0&&curIdx===0){
      goTab('boutique');                              // premier tab + swipe droite → boutique
    }
  },{passive:true});
})();

// ── Swipe-to-dismiss — tous les bottom sheets ──────────────────────────────
(function(){
  var S=[
    ['sheet-comments',  function(){closeAll();},                              '.comments-list'],
    ['prod-sheet',      function(){closeSheet('prod-sheet');},                null],
    ['alt-sheet',       function(){closeSheet('alt-sheet');},                 '#alt-content', true],
    ['retouche-sheet',  function(){closeRetoucheSheet();},                    null],
    ['sheet-share',     function(){closeSheet('sheet-share');},               null],
    ['new-msg-sheet',   function(){closeNewMsgMenu();},                       null],
    ['share-sheet',     function(){closeShareSheet();},                       '#share-list'],
    ['post-opts-sheet', function(){closePostOptions();},                      null],
    ['flw-sheet',       function(){closeFollowList();},                       '#flw-list'],
  ];
  S.forEach(function(cfg){
    var el=document.getElementById(cfg[0]);
    if(el) initSwipeDismiss(el, cfg[1], cfg[2], cfg[3]);
  });
})();
