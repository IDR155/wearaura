// NOTIFICATIONS / MESSAGES
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// MESSAGES — SYSTÈME COMPLET
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// MESSAGES + GROUPES — SYSTÈME COMPLET
// ═══════════════════════════════════════════
let currentConvId=null;
let currentConvUid=null;
let currentConvIsGroup=false;
let msgRealtimeSub=null;
let msgChipCurrent='all';
let groupSelectedMembers=[];
let _groupProfileCache={};
let _globalRealtime=null;
let _groupPollTimer=null;

function startGlobalRealtime(){
  if(!me||_globalRealtime)return;
  try{
    _globalRealtime=sb.channel(`wa-global-${me.id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`receiver_id=eq.${me.id}`},
        payload=>{
          if(payload.new.conversation_id===currentConvId)return;
          _showMsgNavDot();
          const sc=document.getElementById('sc-notif');
          if(sc&&sc.style.display!=='none')loadConversations();
        })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`user_id=eq.${me.id}`},
        payload=>{
          checkUnreadActivity();
          // Notification navigateur si l'app n'est pas au premier plan
          const n=payload?.new;
          if(n){
            const bodies={
              like:'❤️ Quelqu\'un a aimé ton post',
              comment:'💬 Nouveau commentaire sur ton post',
              follow:'👤 Quelqu\'un te suit maintenant',
              follow_request:'🔒 Nouvelle demande de suivi',
              follow_accepted:'✅ Ta demande de suivi a été acceptée',
              message_request:'✉️ Nouvelle demande de message',
            };
            _showBrowserNotif('WearAura', bodies[n.type]||'Tu as une nouvelle notification');
          }
        })
      .subscribe();
    // Demander la permission notif après 15s (non intrusif)
    setTimeout(_requestNotifPermission, 15000);
  }catch(e){}
}
function stopGlobalRealtime(){
  if(_globalRealtime){_globalRealtime.unsubscribe();_globalRealtime=null;}
  stopGroupPoll();
}
function _showMsgNavDot(){
  const nav=document.getElementById('ni-notif');
  if(!nav||nav.querySelector('.msg-unread-dot'))return;
  const dot=document.createElement('div');
  dot.className='msg-unread-dot';
  dot.style.cssText='position:absolute;top:2px;right:8px;width:8px;height:8px;background:#1E4FD8;border-radius:50%;border:1.5px solid var(--black)';
  nav.appendChild(dot);
  // Pastille générique sur l'icône de l'app si aucun compteur notifs déjà affiché
  if('setAppBadge' in navigator&&!document.querySelector('.notif-badge'))navigator.setAppBadge().catch(()=>{});
}
function _hideMsgNavDot(){document.querySelectorAll('.msg-unread-dot').forEach(d=>d.remove());}
function startGroupPoll(){
  stopGroupPoll();
  _groupPollTimer=setInterval(()=>{
    const sc=document.getElementById('sc-notif');
    if(sc&&sc.style.display!=='none')loadConversations();
  },30000);
}
function stopGroupPoll(){if(_groupPollTimer){clearInterval(_groupPollTimer);_groupPollTimer=null;}}

function _closeMsgSubScreens(){
  // Forcer la fermeture de tous les sous-écrans messages (sans animation)
  const ids=['sc-conversation','sc-new-dm','sc-new-group','msg-search-panel'];
  ids.forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.style.display='none';el.style.transform='';el.style.transition='';}
  });
  if(msgRealtimeSub){msgRealtimeSub.unsubscribe();msgRealtimeSub=null;}
  currentConvId=null;currentConvUid=null;currentConvIsGroup=false;
  _groupProfileCache={};
  groupSelectedMembers=[];
}

function loadNotifs(){
  _closeMsgSubScreens();
  _hideMsgNavDot();_ntab('msgs');loadConversations();checkUnreadActivity();startGroupPoll();loadStories();
}
function onLeaveMessagesTab(){
  stopGroupPoll();
  _closeMsgSubScreens();
}

// ── Chips filtre ──
function msgChipSelect(el,chip){
  document.querySelectorAll('.msg-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  msgChipCurrent=chip;
  loadConversations();
}

// ── FAB menu ──
function openNewMsgMenu(){
  document.getElementById('new-msg-sheet').style.bottom='0';
  document.getElementById('new-msg-overlay').style.display='block';
}
function closeNewMsgMenu(){
  document.getElementById('new-msg-sheet').style.bottom='-100%';
  document.getElementById('new-msg-overlay').style.display='none';
}

// ── Nouveau DM ──
function openNewDM(){
  closeNewMsgMenu();
  const sc=document.getElementById('sc-new-dm');sc.style.display='flex';
  _attachNewDMSwipe(sc);
  document.getElementById('dm-search-input').value='';
  document.getElementById('dm-search-results').innerHTML=`<div style="font-size:12px;color:var(--wd);text-align:center;padding:30px">${t('dm_search_hint')}</div>`;
  setTimeout(()=>document.getElementById('dm-search-input').focus(),200);
}
function closeNewDM(){
  const sc=document.getElementById('sc-new-dm');
  if(!sc)return;
  sc.style.transition='transform .25s cubic-bezier(0.23,1,0.32,1)';
  sc.style.transform='translateX(100%)';
  setTimeout(()=>{
    sc.style.display='none';
    sc.style.transform='';
    sc.style.transition='';
  },250);
}

// ── Swipe horizontal sur sc-new-dm → retour liste conversations ──
function _attachNewDMSwipe(sc){
  if(sc._swipeAttached)return;
  sc._swipeAttached=true;
  let sx=0,sy=0,triggered=false;
  sc.addEventListener('touchstart',e=>{
    // Fermer le clavier pour que le swipe soit détecté correctement
    document.activeElement&&document.activeElement.blur();
    sx=e.touches[0].clientX;sy=e.touches[0].clientY;triggered=false;
  },{passive:true});
  sc.addEventListener('touchmove',e=>{
    if(triggered)return;
    const dx=Math.abs(e.touches[0].clientX-sx);
    const dy=Math.abs(e.touches[0].clientY-sy);
    if(dx>40&&dx>dy){
      triggered=true;
      sc.style.display='none';
    }
  },{passive:true});
}

// ── Nouveau groupe ──
function openNewGroup(){
  closeNewMsgMenu();
  groupSelectedMembers=[];
  document.getElementById('sc-new-group').style.display='flex';
  document.getElementById('group-name-input').value='';
  document.getElementById('group-search-input').value='';
  document.getElementById('group-search-results').innerHTML=`<div style="font-size:12px;color:var(--wd);text-align:center;padding:30px">${t('group_search_hint')}</div>`;
  document.getElementById('group-selected-members').style.display='none';
  updateGroupCreateBtn();
}
function closeNewGroup(){document.getElementById('sc-new-group').style.display='none';groupSelectedMembers=[];}
function updateGroupCreateBtn(){
  const name=document.getElementById('group-name-input').value.trim();
  const btn=document.getElementById('btn-create-group');
  const valid=name.length>=2&&groupSelectedMembers.length>=1;
  btn.style.opacity=valid?'1':'0.4';btn.style.pointerEvents=valid?'auto':'none';
}

// ── Recherche DM ──
async function searchUsersForDM(q){
  const results=document.getElementById('dm-search-results');
  if(q.length<2){results.innerHTML=`<div style="font-size:12px;color:var(--wd);text-align:center;padding:30px">${t('min_chars')}</div>`;return;}
  results.innerHTML=skRows(3);
  try{
    const{data}=await sb.from('profiles').select('id,username,full_name,avatar_url')
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).neq('id',me.id).limit(10);
    if(!data?.length){results.innerHTML=`<div style="font-size:12px;color:var(--wd);text-align:center;padding:30px">${t('no_user_found')}</div>`;return;}
    results.innerHTML=data.map(p=>userRowItem(p,`startConversation('${p.id}','${(p.full_name||p.username||'User').replace(/'/g,"&#39;").replace(/"/g,'&quot;')}','${(p.avatar_url||'').replace(/'/g,'%27').replace(/"/g,'%22')}','${p.username?('@'+p.username).replace(/'/g,'&#39;').replace(/"/g,'&quot;'):''}')`)).join('');
  }catch(e){results.innerHTML=`<div style="font-size:12px;color:var(--wd);text-align:center;padding:30px">${t('search_error')}</div>`;}
}

// ── Recherche groupe ──
async function searchUsersForGroup(q){
  const results=document.getElementById('group-search-results');
  if(q.length<2){results.innerHTML=`<div style="font-size:12px;color:var(--wd);text-align:center;padding:30px">${t('group_members_hint')}</div>`;return;}
  results.innerHTML=skRows(3);
  try{
    const{data}=await sb.from('profiles').select('id,username,full_name,avatar_url')
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).neq('id',me.id).limit(10);
    if(!data?.length){results.innerHTML=`<div style="font-size:12px;color:var(--wd);text-align:center;padding:30px">${t('no_user_found')}</div>`;return;}
    results.innerHTML=data.map(p=>userRowItem(p,`toggleGroupMember('${p.id}','${(p.full_name||p.username||'User').replace(/'/g,"&#39;").replace(/"/g,'&quot;')}','${(p.avatar_url||'').replace(/'/g,'%27').replace(/"/g,'%22')}')`,groupSelectedMembers.some(m=>m.id===p.id))).join('');
  }catch(e){}
}

function userRowItem(p,onclickStr,isSelected=false){
  const name=p.username||p.full_name||'User';
  const av=p.avatar_url?`<img src="${p.avatar_url}" alt="" style="width:100%;height:100%;object-fit:cover">`:`<span style="font-size:18px">${escapeHtml(name.charAt(0))}</span>`;
  return `<div onclick="${onclickStr}" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(240,234,216,.06);cursor:pointer">
    <div style="width:46px;height:46px;border-radius:50%;border:2px solid ${isSelected?'var(--gold)':'var(--gold-b)'};background:var(--black-3);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">${av}</div>
    <div style="flex:1"><div style="font-size:14px;font-weight:500;color:var(--white)">${escapeHtml(name)}</div>${p.username?`<div style="font-size:12px;color:var(--gold)">${escapeHtml(p.username)}</div>`:''}</div>
    ${isSelected?`<div style="width:22px;height:22px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--black);font-weight:700">✓</div>`:''}
  </div>`;
}

function toggleGroupMember(uid,name,avatarUrl){
  const idx=groupSelectedMembers.findIndex(m=>m.id===uid);
  if(idx>=0){groupSelectedMembers.splice(idx,1);}
  else{
    if(groupSelectedMembers.length>=29){toast(t('max_members'));return;}
    groupSelectedMembers.push({id:uid,name,avatar:avatarUrl});
  }
  renderGroupSelectedMembers();updateGroupCreateBtn();
  const q=document.getElementById('group-search-input').value;
  if(q.length>=2)searchUsersForGroup(q);
}

function renderGroupSelectedMembers(){
  const container=document.getElementById('group-selected-members');
  if(!groupSelectedMembers.length){container.style.display='none';return;}
  container.style.display='flex';
  container.innerHTML=groupSelectedMembers.map(m=>{
    const av=m.avatar?`<img src="${m.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:`<span style="font-size:16px">${escapeHtml(m.name.charAt(0))}</span>`;
    return `<div class="member-chip" onclick="toggleGroupMember('${m.id}','${m.name.replace(/'/g,"&#39;").replace(/"/g,'&quot;')}','${m.avatar.replace(/'/g,'%27').replace(/"/g,'%22')}')">
      <div class="member-chip-av">${av}<div class="member-chip-remove">✕</div></div>
      <div style="font-size:9px;color:var(--wd);max-width:44px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(m.name.split(' ')[0])}</div>
    </div>`;
  }).join('');
}

async function createGroup(){
  if(!me||groupSelectedMembers.length<1)return;
  const name=document.getElementById('group-name-input').value.trim();
  if(!name)return toast(t('group_need_name'));
  const btn=document.getElementById('btn-create-group');
  btn.textContent='…';btn.style.pointerEvents='none';
  const allParticipants=[me.id,...groupSelectedMembers.map(m=>m.id)];
  try{
    const{data:conv,error}=await sb.from('conversations').insert({
      is_group:true,group_name:name,participants:allParticipants,created_by:me.id,
      participant_1:me.id,participant_2:me.id,
      last_message:`Groupe créé`,
    }).select().single();
    if(error)throw error;
    closeNewGroup();
    toast(`"${name}" — ${t('group_created')}`);
    openConversationScreen(conv.id,null,name,'',`${allParticipants.length} membres`,true);
  }catch(e){
    toast('❌ '+t('group_create_error'));
    btn.textContent=t('creer');btn.style.pointerEvents='auto';
  }
}

// ── Liste conversations ──
async function loadConversations(){
  attachPullToRefresh(
    document.getElementById('conv-list'),
    loadConversations,
    document.getElementById('sc-notif')
  );
  const list=document.getElementById('conv-list');
  list.innerHTML=skRows(5);
  if(!me||!dbOk){list.innerHTML=demoConversationsList();return;}
  let convs=null;
  try{
    const{data}=await sb.from('conversations')
      .select('*')
      .or(`participant_1.eq.${me.id},participant_2.eq.${me.id},participants.cs.["${me.id}"]`)
      .order('last_message_at',{ascending:false}).limit(30);
    convs=data;
  }catch(e){list.innerHTML=demoConversationsList();return;}
  if(!convs?.length){
    list.innerHTML=`<div class="empty-state empty-state--full"><img src="mascote_ivory/le_communicateur.png" alt=""><div>${t('no_conv')}<div class="es-hint">${t('start_conv_hint')}</div></div></div>`;
    return;
  }
  let filtered=convs;
  if(msgChipCurrent==='groups')filtered=convs.filter(c=>c.is_group);
  const dmConvs=filtered.filter(c=>!c.is_group);
  const otherIds=dmConvs.map(c=>c.participant_1===me.id?c.participant_2:c.participant_1).filter(Boolean);
  let profileMap={};
  if(otherIds.length){
    const profs=await getProfiles(otherIds);
    profs.forEach(p=>profileMap[p.id]=p);
  }
  let unreadMap={};
  try{
    const{data:unreadData}=await sb.from('messages').select('conversation_id').eq('receiver_id',me.id).eq('read',false);
    unreadData?.forEach(m=>{unreadMap[m.conversation_id]=(unreadMap[m.conversation_id]||0)+1;});
  }catch(e){}
  // Filtrer les conversations supprimées côté utilisateur
  const _deleted=getDeletedConvs();
  filtered=filtered.filter(c=>!_deleted.has(c.id));
  if(msgChipCurrent==='unread')filtered=filtered.filter(c=>unreadMap[c.id]>0);
  if(!filtered.length){
    list.innerHTML=`<div class="empty-state"><img src="mascote_ivory/le_communicateur.png" alt=""><div>${t('no_unread')}</div></div>`;
    return;
  }
  list.innerHTML=filtered.map(conv=>{
    const isGroup=conv.is_group;
    const unread=unreadMap[conv.id]||0;
    if(isGroup){
      const memberCount=(conv.participants||[]).length;
      return convItemHtml(conv.id,null,null,conv.group_name||t('groupes'),`${memberCount} membres`,conv.last_message||t('group_created'),timeAgo(conv.last_message_at),unread,true,conv);
    }else{
      const otherId=conv.participant_1===me.id?conv.participant_2:conv.participant_1;
      const prof=profileMap[otherId]||{};
      const name=prof.username||prof.full_name||t('someone');
      const handle='';
      return convItemHtml(conv.id,otherId,prof.avatar_url,name,handle,conv.last_message||t('conv_start'),timeAgo(conv.last_message_at),unread,false,conv);
    }
  }).join('');
}

function convItemHtml(convId,otherUid,avatarUrl,name,sub,lastMsg,time,unread,isGroup,conv){
  let avContent=isGroup
    ?`<div style="width:100%;height:100%;background:linear-gradient(135deg,var(--gold-dim),var(--black-3));display:flex;align-items:center;justify-content:center"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.5)" stroke-width="1.5" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></div>`
    :avatarUrl?`<img src="${avatarUrl}" alt="" style="width:100%;height:100%;object-fit:cover">`
    :`<span style="font-size:20px">${escapeHtml(name.charAt(0))}</span>`;
  const safeAv=(avatarUrl||'').replace(/'/g,'%27').replace(/"/g,'%22');
  const safeName=name.replace(/'/g,'&#39;').replace(/"/g,'&quot;');
  const safeSub=(sub||'').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
  const onclick=isGroup
    ?`openConversationScreen('${convId}',null,'${safeName}','','${(conv.participants||[]).length} membres',true)`
    :`openConversationScreen('${convId}','${otherUid}','${safeName}','${safeAv}','${safeSub}',false)`;
  return `<div class="conv-item" data-convid="${convId}"
    onclick="if(!this.classList.contains('swiped')){${onclick}}else{this.classList.remove('swiped')}"
    ontouchstart="convSwipeStart(this,event)" ontouchmove="convSwipeMove(this,event)" ontouchend="convSwipeEnd(this,event)">
    <div style="position:relative;flex-shrink:0">
      <div style="width:52px;height:52px;border-radius:14px;border:1.5px solid ${unread>0?'var(--gold)':'rgba(240,234,216,0.2)'};background:var(--black-3);overflow:hidden;display:flex;align-items:center;justify-content:center">${avContent}</div>
      ${unread>0?`<div style="position:absolute;bottom:0;right:0;min-width:18px;height:18px;background:var(--gold);border-radius:9px;border:2px solid var(--black);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--black);padding:0 3px">${unread>9?'9+':unread}</div>`:''}
    </div>
    <div style="flex:1;min-width:0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
        <div style="font-size:14px;font-weight:${unread>0?600:400};color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px">${escapeHtml(name)}</div>
        <div style="font-size:10px;color:var(--wd);flex-shrink:0;margin-left:6px">${escapeHtml(time)}</div>
      </div>
      <div style="font-size:12px;color:${unread>0?'var(--white)':'var(--wd)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:${unread>0?500:400}">${escapeHtml(lastMsg)}</div>
    </div>
    <div class="conv-dots-btn" onclick="event.stopPropagation();toggleConvSwipe(this.closest('.conv-item'))" style="padding:4px 6px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;opacity:0.45">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/></svg>
    </div>
    <div class="conv-delete-btn" onclick="event.stopPropagation();deleteConvForMe('${convId}')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
    </div>
  </div>`;
}

function demoConversationsList(){
  const demos=[
    {name:'sofia.looks',sub:'@sofia',msg:'Trop beau ce look 😍',time:'1min',unread:2,em:'🌸',group:false},
    {name:'Style Squad',sub:'3 membres',msg:'mia: On se retrouve quand ? 👗',time:'10min',unread:1,em:'👥',group:true},
    {name:'miamode',sub:'@mia',msg:'Merci pour le follow ✨',time:'1h',unread:0,em:'🦋',group:false},
    {name:'auralooks',sub:'@aura',msg:'Tu as vu ma dernière tenue ?',time:'2h',unread:0,em:'👠',group:false},
  ];
  return demos.map(d=>`<div class="conv-item" onclick="toast(t('login_messages'))">
    <div style="position:relative;flex-shrink:0">
      <div style="width:52px;height:52px;border-radius:50%;border:2px solid ${d.unread>0?'var(--gold)':'var(--gold-b)'};background:var(--black-3);display:flex;align-items:center;justify-content:center;font-size:22px">${d.em}</div>
      ${d.unread>0?`<div style="position:absolute;bottom:0;right:0;min-width:18px;height:18px;background:var(--gold);border-radius:9px;border:2px solid var(--black);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--black)">${d.unread}</div>`:''}
    </div>
    <div style="flex:1;min-width:0">
      <div style="display:flex;justify-content:space-between;margin-bottom:2px">
        <div style="font-size:14px;font-weight:${d.unread>0?600:400};color:var(--white)">${d.name}</div>
        <div style="font-size:10px;color:var(--wd)">${d.time}</div>
      </div>
      <div style="font-size:11px;color:var(--gold);margin-bottom:2px">${d.sub}</div>
      <div style="font-size:12px;color:${d.unread>0?'var(--white)':'var(--wd)'};font-weight:${d.unread>0?500:400}">${d.msg}</div>
    </div>
  </div>`).join('');
}

// ── Vue conversation ──
async function openConversationScreen(convId,otherUid,name,avatarUrl,sub,isGroup=false){
  currentConvId=convId;currentConvUid=otherUid;currentConvIsGroup=isGroup;
  const screen=document.getElementById('sc-conversation');screen.style.display='flex';
  const avEl=document.getElementById('conv-screen-av');
  if(isGroup){avEl.innerHTML=`<div style="width:100%;height:100%;background:linear-gradient(135deg,var(--gold-dim),var(--black-3));display:flex;align-items:center;justify-content:center;border-radius:50%"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.5)" stroke-width="1.5" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></div>`;}
  else if(avatarUrl){avEl.innerHTML=`<img src="${avatarUrl}" alt="" style="width:100%;height:100%;object-fit:cover">`;}
  else{avEl.innerHTML=`<span>${escapeHtml(name.charAt(0))}</span>`;}
  document.getElementById('conv-screen-name').textContent=name;
  const subEl=document.getElementById('conv-screen-sub');
  subEl.textContent=sub||'';
  subEl.style.display=sub?'block':'none';
  document.getElementById('conv-group-info-btn').style.display=isGroup?'block':'none';
  if(convId){await loadMessages(convId);}else{document.getElementById('conv-messages-list').innerHTML=`<div class="empty-state empty-state--full"><img src="mascote_ivory/the_friendly_greet.png" alt=""><div>${t('conv_start')}</div></div>`;}

  // Hint "long-press" la première fois pour les messages perso (uniquement une fois)
  if(!localStorage.getItem('wa_msg_longpress_hinted')&&!isGroup){
    setTimeout(()=>{
      const list=document.getElementById('conv-messages-list');
      if(!list)return;
      const hint=document.createElement('div');
      hint.id='msg-longpress-hint';
      hint.style.cssText='align-self:center;background:rgba(240,234,216,0.06);border:1px solid rgba(240,234,216,0.15);border-radius:50px;padding:6px 14px;font-size:10px;color:var(--wd);letter-spacing:.3px;margin:8px 0';
      hint.textContent='Appuie longtemps sur un message pour modifier ou supprimer';
      list.insertBefore(hint,list.firstChild);
      // Auto-dismiss après 5 min (300s)
      setTimeout(()=>hint.remove(),300000);
    },800);
    localStorage.setItem('wa_msg_longpress_hinted','1');
  }
  // Vérifier si c'est une demande de message en attente (envoyée par l'autre)
  let _pendingMsgReqId=null;
  window._pendingMsgReqId=null;
  if(me&&!isGroup&&otherUid){
    try{
      const{data:req}=await sb.from('notifications')
        .select('id,from_user_id').eq('user_id',me.id).eq('from_user_id',otherUid)
        .eq('type','message_request').eq('read',false).maybeSingle();
      if(req){
        window._pendingMsgReqId=req.id;
        window._pendingMsgReqUid=otherUid;
        // Afficher barre de demande, cacher input
        document.getElementById('conv-input-bar').style.display='none';
        document.getElementById('conv-request-bar').style.display='flex';
        document.getElementById('conv-req-title').textContent=`${name} veut t'envoyer un message`;
      } else {
        document.getElementById('conv-input-bar').style.display='flex';
        document.getElementById('conv-request-bar').style.display='none';
        // Vérifier si MOI j'ai envoyé une demande non encore acceptée
        try{
          const{data:sent}=await sb.from('notifications')
            .select('id').eq('user_id',otherUid).eq('from_user_id',me.id)
            .eq('type','message_request').eq('read',false).maybeSingle();
          const pendingBanner=document.getElementById('conv-pending-banner');
          if(pendingBanner) pendingBanner.style.display=sent?'flex':'none';
        }catch(e){}
      }
    }catch(e){
      document.getElementById('conv-input-bar').style.display='flex';
      document.getElementById('conv-request-bar').style.display='none';
    }
  } else {
    document.getElementById('conv-input-bar').style.display='flex';
    document.getElementById('conv-request-bar').style.display='none';
  }
  if(convId){
    try{
      if(me&&!isGroup)await sb.from('messages').update({read:true}).eq('conversation_id',convId).eq('receiver_id',me.id).eq('read',false);
    }catch(e){}
    if(msgRealtimeSub)msgRealtimeSub.unsubscribe();
    try{
      msgRealtimeSub=sb.channel(`conv-${convId}`)
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`conversation_id=eq.${convId}`},
          async payload=>{
            if(payload.new.sender_id!==me?.id){
              if(currentConvIsGroup&&!_groupProfileCache[payload.new.sender_id]){
                try{const p=await getProfile(payload.new.sender_id);if(p)_groupProfileCache[p.id]=p;}catch(e){}
              }
              appendMessage(payload.new);
            }
          })
        .subscribe();
    }catch(e){}
  }
}

async function loadMessages(convId){
  const list=document.getElementById('conv-messages-list');
  list.innerHTML=skComments(4);
  try{
    const{data:msgs}=await sb.from('messages').select('*').eq('conversation_id',convId).order('created_at',{ascending:true}).limit(50);
    // Filtrer : si c'est mon message et que je l'ai "supprimé pour moi" → ne pas l'afficher
    const filtered=(msgs||[]).filter(m=>!(m.sender_id===me?.id&&m.deleted_for_sender));
    if(!filtered.length){list.innerHTML=`<div class="empty-state empty-state--full"><img src="mascote_ivory/the_friendly_greet.png" alt=""><div>${t('conv_start')}</div></div>`;return;}
    if(currentConvIsGroup){
      const senderIds=[...new Set(filtered.map(m=>m.sender_id).filter(id=>id&&id!==me?.id))];
      if(senderIds.length){
        const profs=await getProfiles(senderIds);
        profs.forEach(p=>{_groupProfileCache[p.id]=p;});
      }
    }
    list.innerHTML='';filtered.forEach(m=>appendMessage(m,false));list.scrollTop=list.scrollHeight;
  }catch(e){list.innerHTML=`<div class="empty-state empty-state--full"><img src="mascote_ivory/the_friendly_greet.png" alt=""><div>${t('conv_start')}</div></div>`;}
}

function appendMessage(msg,scroll=true){
  const list=document.getElementById('conv-messages-list');
  const isSent=msg.sender_id===me?.id;
  const showSender=currentConvIsGroup&&!isSent;
  const senderProf=showSender?(_groupProfileCache[msg.sender_id]||null):null;
  const senderName=senderProf?(senderProf.username||senderProf.full_name||'?'):'';
  const senderAv=senderProf?.avatar_url||'';
  list.querySelector('.loader')?.remove();

  // ── Logique de groupement : même côté consécutif dans < 3 min ──
  const prevWraps=list.querySelectorAll('.msg-sent-wrap,.msg-received-wrap');
  const prevWrap=prevWraps.length?prevWraps[prevWraps.length-1]:null;
  const prevSent=prevWrap?.dataset?.sent==='1';
  const prevTime=prevWrap?.dataset?.msgt?new Date(prevWrap.dataset.msgt).getTime():0;
  const curTime=msg.created_at?new Date(msg.created_at).getTime():Date.now();
  const sameGroup=prevWrap&&(prevSent===isSent)&&((curTime-prevTime)<3*60*1000);

  // Si on est dans le même groupe, masquer le timestamp du message précédent
  if(sameGroup&&prevWrap){
    const prevTime2=prevWrap.querySelector('.msg-time');
    if(prevTime2)prevTime2.classList.add('hidden');
    // Enlever la queue de la bulle précédente
    const prevBubble=prevWrap.querySelector('.msg-bubble');
    if(prevBubble)prevBubble.classList.add('no-tail');
  }

  const div=document.createElement('div');
  div.className=(isSent?'msg-sent-wrap':'msg-received-wrap')+(sameGroup?' msg-group':' msg-new-group');
  div.dataset.msgid=msg.id;
  div.dataset.msgt=msg.created_at||new Date().toISOString();
  div.dataset.sent=isSent?'1':'0';
  const safeContent=msg.content.replace(/'/g,"\\'").replace(/"/g,'&quot;');
  const dotsBtn=isSent?`<button class="msg-dots-btn" aria-label="Options" onclick="event.stopPropagation();showMsgCtx('${msg.id}','${safeContent}','${msg.created_at}',this.closest('.msg-sent-wrap'),event)">⋮</button>`:'';
  const senderTag=showSender?`<div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">${senderAv?`<img src="${senderAv}" alt="" style="width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0">`:`<div style="width:20px;height:20px;border-radius:50%;background:var(--gold-dim);border:1px solid var(--gold-b);display:flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0;color:var(--gold)">${escapeHtml((senderName||'?').charAt(0).toUpperCase())}</div>`}<span style="font-size:10px;color:var(--gold);font-weight:600">@${escapeHtml(senderName)}</span></div>`:'';

  // Détecter les posts partagés [POST:id]
  const postMatch=msg.content.match(/^\[POST:([^\]]+)\]$/);
  let bubbleContent;
  if(postMatch){
    const sharedPostId=postMatch[1];
    bubbleContent=`<div class="msg-shared-post" id="bubble-${msg.id}" data-postid="${sharedPostId}" onclick="openSharedPost('${sharedPostId}')" style="cursor:pointer;background:transparent;padding:0;border:none">
      <div id="shared-post-${msg.id}" style="min-height:80px;display:flex;align-items:center;justify-content:center;padding:14px;text-align:center;font-size:11px;color:var(--wd)">Chargement…</div>
    </div>`;
    setTimeout(()=>renderSharedPostInBubble(msg.id,sharedPostId),50);
  }else{
    const tailClass=sameGroup?'no-tail':'';
    bubbleContent=`<div class="msg-bubble ${isSent?'sent':'received'} ${tailClass}" id="bubble-${msg.id}">${escapeHtml(msg.content)}</div>`;
  }
  div.innerHTML=`${senderTag}<div style="display:flex;align-items:flex-start;gap:4px;${isSent?'flex-direction:row-reverse':''}">${bubbleContent}${dotsBtn}</div><div class="msg-time" style="text-align:${isSent?'right':'left'}">${timeAgo(msg.created_at)}</div>`;

  if(isSent){
    // Long press → menu (touch ET mouse pour desktop)
    let lpt=null;
    const startLP=(e,coord)=>{if(lpt)clearTimeout(lpt);lpt=setTimeout(()=>{showMsgCtx(msg.id,msg.content,msg.created_at,div,coord);if(navigator.vibrate)navigator.vibrate(15);},550);};
    const cancelLP=()=>{if(lpt){clearTimeout(lpt);lpt=null;}};
    div.addEventListener('touchstart',e=>startLP(e,e.touches[0]),{passive:true});
    div.addEventListener('touchend',cancelLP);
    div.addEventListener('touchmove',cancelLP);
    div.addEventListener('mousedown',e=>{if(e.button===0)startLP(e,e);});
    div.addEventListener('mouseup',cancelLP);
    div.addEventListener('mouseleave',cancelLP);
    div.addEventListener('contextmenu',e=>{e.preventDefault();showMsgCtx(msg.id,msg.content,msg.created_at,div,e);});
  }
  list.appendChild(div);
  if(scroll)list.scrollTop=list.scrollHeight;
}

async function sendMessage(){
  if(!me)return;
  const input=document.getElementById('msg-input');
  const content=input.value.trim();if(!content)return;
  // Loading state — désactive l'envoi pendant l'opération réseau
  const sendBtn=input.parentElement?.querySelector('button');
  if(sendBtn){sendBtn.disabled=true;sendBtn.style.opacity='0.5';}
  input.disabled=true;
  try{
    // Créer la conversation en base uniquement au 1er message (jamais avant)
    if(!currentConvId&&!currentConvIsGroup&&currentConvUid){
      try{
        const{data:newConv,error}=await sb.from('conversations').insert({participant_1:me.id,participant_2:currentConvUid,is_group:false,participants:[me.id,currentConvUid]}).select().single();
        if(error)throw error;
        currentConvId=newConv.id;
        // Démarrer le realtime maintenant que la conv existe
        if(msgRealtimeSub)msgRealtimeSub.unsubscribe();
        try{
          msgRealtimeSub=sb.channel(`conv-${currentConvId}`)
            .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`conversation_id=eq.${currentConvId}`},
              payload=>{if(payload.new.sender_id!==me?.id)appendMessage(payload.new);})
            .subscribe();
        }catch(e){}
      }catch(e){toast('❌ '+t('conv_create_error'));return;}
    }
    if(!currentConvId)return;
    input.value='';input.style.height='auto';
    const receiverId=currentConvIsGroup?null:currentConvUid;
    try{
      const{data:msg}=await sb.from('messages').insert({conversation_id:currentConvId,sender_id:me.id,receiver_id:receiverId,content}).select().single();
      await sb.from('conversations').update({last_message:content,last_message_at:new Date().toISOString()}).eq('id',currentConvId);
      if(msg)appendMessage(msg);
      // 1er message → demande de message si non suivi
      if(_isNewConversation&&receiverId){
        _isNewConversation=false;
        try{
          const{count}=await sb.from('follows').select('*',{count:'exact',head:true}).eq('follower_id',me.id).eq('following_id',receiverId);
          if(!count){
            await sb.from('notifications').insert({user_id:receiverId,from_user_id:me.id,type:'message_request',read:false});
            const banner=document.getElementById('conv-pending-banner');
            if(banner)banner.style.display='flex';
          }
        }catch(e){}
      }
    }catch(e){toast('❌ '+t('msg_send_error'));}
  }finally{
    // Réactiver le bouton et l'input quoi qu'il arrive
    input.disabled=false;
    if(sendBtn){sendBtn.disabled=false;sendBtn.style.opacity='';}
  }
}

function closeConversationScreen(){
  const sc=document.getElementById('sc-conversation');
  sc.style.transition='transform .25s cubic-bezier(0.23,1,0.32,1)';
  sc.style.transform='translateX(100%)';
  setTimeout(()=>{
    sc.style.display='none';
    sc.style.transform='';
    sc.style.transition='';
  },250);
  if(msgRealtimeSub){msgRealtimeSub.unsubscribe();msgRealtimeSub=null;}
  currentConvId=null;currentConvUid=null;currentConvIsGroup=false;
  _groupProfileCache={};
  loadConversations();
}

// ── Swipe bord gauche → fermer la conversation ──
(function initConvSwipeBack(){
  let _sx=0,_sy=0,_tracking=false;
  const EDGE=28,THRESHOLD=80,MAX_VERT=60;
  document.addEventListener('touchstart',e=>{
    const sc=document.getElementById('sc-conversation');
    if(!sc||sc.style.display==='none')return;
    const t=e.touches[0];
    _sx=t.clientX;_sy=t.clientY;
    _tracking=_sx<=EDGE;
    if(_tracking)sc.style.transition='none';
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!_tracking)return;
    const sc=document.getElementById('sc-conversation');
    if(!sc||sc.style.display==='none'){_tracking=false;return;}
    const t=e.touches[0];
    const dx=t.clientX-_sx;
    const dy=Math.abs(t.clientY-_sy);
    if(dy>MAX_VERT){_tracking=false;sc.style.transform='';return;}
    if(dx>0)sc.style.transform=`translateX(${dx}px)`;
  },{passive:true});
  document.addEventListener('touchend',e=>{
    if(!_tracking)return;
    _tracking=false;
    const sc=document.getElementById('sc-conversation');
    if(!sc||sc.style.display==='none')return;
    const dx=e.changedTouches[0].clientX-_sx;
    if(dx>=THRESHOLD){
      closeConversationScreen();
    }else{
      sc.style.transition='transform .2s cubic-bezier(0.23,1,0.32,1)';
      sc.style.transform='';
      setTimeout(()=>{sc.style.transition='';},200);
    }
  },{passive:true});
})();
function gotoConvUserProfile(){
  if(currentConvIsGroup||!currentConvUid)return;
  const uid=currentConvUid;
  document.getElementById('sc-conversation').style.display='none';
  if(msgRealtimeSub){msgRealtimeSub.unsubscribe();msgRealtimeSub=null;}
  currentConvId=null;currentConvUid=null;currentConvIsGroup=false;
  openUserProfile(uid);
}

function autoResizeMsgInput(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,100)+'px';}

let _isNewConversation=false;
async function startConversation(otherUid,name,avatarUrl,handle){
  closeNewDM();
  try{
    const{data:existing}=await sb.from('conversations').select('id')
      .or(`and(participant_1.eq.${me.id},participant_2.eq.${otherUid}),and(participant_1.eq.${otherUid},participant_2.eq.${me.id})`)
      .eq('is_group',false).maybeSingle();
    _isNewConversation=!existing?.id;
    // Ne crée PAS la conversation en base avant le 1er message
    openConversationScreen(existing?.id||null,otherUid,name,avatarUrl,handle,false);
  }catch(e){toast('❌ '+t('conv_create_error'));}
}

async function openDMWithUser(otherUid,name,avatarUrl,handle){
  if(!me)return toast(t('login_msg_send'));
  goTab('notif');
  await startConversation(otherUid,name,avatarUrl,handle);
}

// ── Activité ──
function _ntab(tab){
  const msgsPanel=document.getElementById('notif-msgs-panel');
  const actPanel=document.getElementById('notif-act-panel');
  const tabMsgs=document.getElementById('ntab-msgs');
  const tabAct=document.getElementById('ntab-act');
  const fabBtn=document.getElementById('fab-new-msg');
  if(tab==='msgs'){
    if(msgsPanel)msgsPanel.style.display='flex';
    if(actPanel)actPanel.style.display='none';
    if(tabMsgs){tabMsgs.style.color='var(--white)';tabMsgs.style.borderBottom='2px solid var(--gold)';}
    if(tabAct){tabAct.style.color='var(--wd)';tabAct.style.borderBottom='2px solid transparent';}
    if(fabBtn)fabBtn.style.display='flex';
  }else{
    if(msgsPanel)msgsPanel.style.display='none';
    if(actPanel)actPanel.style.display='block';
    if(tabMsgs){tabMsgs.style.color='var(--wd)';tabMsgs.style.borderBottom='2px solid transparent';}
    if(tabAct){tabAct.style.color='var(--white)';tabAct.style.borderBottom='2px solid var(--gold)';}
    const dot=document.getElementById('ntab-act-dot');if(dot)dot.style.display='none';
    if(fabBtn)fabBtn.style.display='none';
    loadActivityNotifications();
  }
}
function openActivityPanel(){_ntab('act');}
function closeActivityPanel(){_ntab('msgs');}

async function loadActivityNotifications(){
  const list=document.getElementById('activity-list');
  list.innerHTML=skRows(5);
  if(!me||!dbOk){list.innerHTML=demoActivityNotifications();return;}
  try{
    const{data:notifs}=await sb.from('notifications').select('*').eq('user_id',me.id).order('created_at',{ascending:false}).limit(50);
    if(!notifs?.length){list.innerHTML=`<div class="empty-state empty-state--full"><img src="mascote_ivory/the_observer.png" alt=""><div>${t('no_notif')}<div class="es-hint">${t('notif_hint')}</div></div></div>`;return;}
    const uids=[...new Set(notifs.map(n=>n.from_user_id).filter(Boolean))];
    let pm={};
    if(uids.length){const profs=await getProfiles(uids);profs.forEach(p=>pm[p.id]=p);}
    const enriched=notifs.map(n=>({...n,profiles:pm[n.from_user_id]||null}));
    list.innerHTML=enriched.map(n=>renderActivityItem(n)).join('');
    try{await sb.from('notifications').update({read:true}).eq('user_id',me.id).eq('read',false);}catch(e){}
  }catch(e){list.innerHTML=demoActivityNotifications();}
}

function renderActivityItem(n){
  const prof=n.profiles||{};
  const name=escapeHtml(prof.username||prof.full_name||t('someone'));
  const av=prof.avatar_url?`<img src="${prof.avatar_url}" alt="" style="width:100%;height:100%;object-fit:cover">`:`<span style="font-size:18px">${name.charAt(0)}</span>`;
  const time=timeAgo(n.created_at);
  const icons={
    like:'<svg width="12" height="12" viewBox="0 0 24 24" fill="#1E4FD8" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>',
    comment:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
    follow:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    follow_request:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
    follow_accepted:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7dc97d" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>',
    message_request:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
    story_reaction: n.comment_text||'❤️',
  };
  const _defaultIcon='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>';
  const texts={
    like:`<strong style="color:var(--white)">${name}</strong> <span style="color:var(--wd)">${t('liked_post')}</span>`,
    comment:`<strong style="color:var(--white)">${name}</strong> <span style="color:var(--wd)">${t('commented_post')}</span>${n.comment_text?`<div style="font-size:11px;color:var(--wd);margin-top:2px;font-style:italic">"${escapeHtml(n.comment_text)}"</div>`:''}`,
    follow:`<strong style="color:var(--white)">${name}</strong> <span style="color:var(--wd)">${t('started_following')}</span>`,
    follow_request:`<strong style="color:var(--white)">${name}</strong> <span style="color:var(--wd)">${t('wants_follow')}</span>`,
    follow_accepted:`<strong style="color:var(--white)">${name}</strong> <span style="color:var(--wd)">${t('accepted_request')}</span>`,
    message_request:`<strong style="color:var(--white)">${name}</strong> <span style="color:var(--wd)">veut t'envoyer un message</span>`,
    story_reaction:`<strong style="color:var(--white)">${name}</strong> <span style="color:var(--wd)">a réagi à ta story</span>${n.comment_text?` <span style="font-size:16px">${escapeHtml(n.comment_text)}</span>`:''}`,
  };
  const icon=icons[n.type]||_defaultIcon;const text=texts[n.type]||`<span style="color:var(--wd)">${t('notif_generic')}</span>`;
  const isUnread=!n.read;
  return `<div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid rgba(240,234,216,.06);background:${isUnread?'rgba(240,234,216,.04)':'transparent'}">
    <div style="position:relative;flex-shrink:0">
      <div style="width:46px;height:46px;border-radius:50%;border:2px solid ${isUnread?'var(--gold)':'var(--gold-b)'};background:var(--black-3);display:flex;align-items:center;justify-content:center;font-size:18px;overflow:hidden">${av}</div>
      <div style="position:absolute;bottom:-2px;right:-2px;width:20px;height:20px;border-radius:50%;background:var(--black-2);border:2px solid var(--black);display:flex;align-items:center;justify-content:center;font-size:11px">${icon}</div>
    </div>
    <div style="flex:1;min-width:0"><div style="font-size:13px;line-height:1.5">${text}</div><div style="font-size:10px;color:var(--wd);margin-top:3px">${time}</div></div>
    ${n.type==='follow_request'?`<div style="display:flex;gap:6px;flex-shrink:0">
      <button onclick="acceptFollowRequest('${n.from_user_id}','${n.id}')" style="background:var(--gold);border:none;border-radius:8px;padding:6px 10px;font-family:var(--fb);font-size:10px;font-weight:600;color:var(--black);cursor:pointer">✓</button>
      <button onclick="rejectFollowRequest('${n.from_user_id}','${n.id}')" style="background:transparent;border:1px solid rgba(255,80,80,.4);border-radius:8px;padding:6px 8px;font-family:var(--fb);font-size:10px;color:rgba(255,80,80,.8);cursor:pointer">✕</button>
    </div>`:''}
    ${n.type==='message_request'?`<div style="display:flex;gap:6px;flex-shrink:0">
      <button onclick="acceptMsgRequest('${n.from_user_id}','${n.id}')" style="background:var(--gold);border:none;border-radius:8px;padding:6px 10px;font-family:var(--fb);font-size:10px;font-weight:600;color:var(--black);cursor:pointer">✓</button>
      <button onclick="dismissMsgRequest('${n.id}')" style="background:transparent;border:1px solid rgba(255,80,80,.4);border-radius:8px;padding:6px 8px;font-family:var(--fb);font-size:10px;color:rgba(255,80,80,.8);cursor:pointer">✕</button>
    </div>`:''}
  </div>`;
}

function demoActivityNotifications(){
  return `<div style="padding:14px 20px 6px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);opacity:.7">${t('today')}</div>
    <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid rgba(240,234,216,.06);background:rgba(240,234,216,.04)">
      <div style="position:relative;flex-shrink:0"><div style="width:46px;height:46px;border-radius:50%;border:2px solid var(--gold);background:var(--black-3);display:flex;align-items:center;justify-content:center"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,216,0.4)" stroke-width="1.5" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><div style="position:absolute;bottom:-2px;right:-2px;width:20px;height:20px;border-radius:50%;background:var(--black-2);border:2px solid var(--black);display:flex;align-items:center;justify-content:center"><svg width="10" height="10" viewBox="0 0 24 24" fill="#1E4FD8" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></div></div>
      <div style="flex:1"><div style="font-size:13px"><strong style="color:var(--white)">sofia.looks</strong> <span style="color:var(--wd)">${t('liked_post')}</span></div><div style="font-size:10px;color:var(--wd);margin-top:3px">2 min</div></div>
    </div>`;
}

async function checkUnreadActivity(){
  if(!me||!dbOk)return;
  try{
    const{count}=await sb.from('notifications').select('*',{count:'exact',head:true}).eq('user_id',me.id).eq('read',false);
    // Dot dans l'onglet Activité
    const tabDot=document.getElementById('ntab-act-dot');
    if(tabDot)tabDot.style.display=count>0?'block':'none';
    // Badge avec compteur sur toutes les icônes de nav (2 barres de nav dans l'app)
    document.querySelectorAll('[id="ni-notif"]').forEach(nav=>{
      let badge=nav.querySelector('.notif-badge');
      if(count>0){
        if(!badge){badge=document.createElement('div');badge.className='notif-badge';nav.appendChild(badge);}
        badge.textContent=count>99?'99+':String(count);
      }else if(badge){
        badge.remove();
      }
    });
    // Pastille sur l'icône de l'app installée (Android / desktop / iOS 16.4+)
    if('setAppBadge' in navigator){
      if(count>0)navigator.setAppBadge(count).catch(()=>{});
      else if(document.querySelector('.msg-unread-dot'))navigator.setAppBadge().catch(()=>{});
      else navigator.clearAppBadge().catch(()=>{});
    }
  }catch(e){}
}

// ── Notifications navigateur ─────────────────────
function _requestNotifPermission(){
  if(!('Notification' in window))return;
  if(Notification.permission==='granted'){_initPushSubscription();return;}
  if(Notification.permission!=='default')return;
  Notification.requestPermission().then(p=>{if(p==='granted')_initPushSubscription();});
}

// ── Web Push : souscription serveur (ré-engagement) ──────────────
// Enregistre l'appareil dans push_subscriptions pour recevoir des push
// même app fermée. Clé publique VAPID dans config.js ; envoi côté
// Edge Function push-reengage (max 1/semaine, charte non-intrusive).
function _vapidB64ToU8(b64){
  const pad='='.repeat((4-b64.length%4)%4);
  const raw=atob((b64+pad).replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function _initPushSubscription(){
  try{
    if(!me||!dbOk)return false;
    if(typeof WA_VAPID_PUBLIC_KEY==='undefined'||!WA_VAPID_PUBLIC_KEY)return false;
    if(!('serviceWorker' in navigator)||!('PushManager' in window))return false;
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub){
      sub=await reg.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:_vapidB64ToU8(WA_VAPID_PUBLIC_KEY),
      });
    }
    const j=sub.toJSON();
    if(!j?.keys?.p256dh)return false;
    const {error}=await sb.from('push_subscriptions').upsert(
      {user_id:me.id,endpoint:sub.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth},
      {onConflict:'endpoint'}
    );
    if(error){_DBG.log('push upsert: '+error.message);return false;}
    return true;
  }catch(e){_DBG.log('push subscribe: '+(e?.message||e));return false;}
}

// ── Toggle Notifications push (Paramètres) ────────────────────────
// Déclenché par un TAP utilisateur — indispensable sur iOS qui refuse
// toute demande de permission hors geste. Sur iPhone, l'app doit être
// installée sur l'écran d'accueil (sinon PushManager est absent).
function _pushSupported(){
  return ('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window);
}
function refreshPushToggleUI(){
  const isOn=_pushSupported()&&Notification.permission==='granted';
  if(typeof applyToggleUI==='function')applyToggleUI('toggle-notif-push',isOn);
}
async function togglePushNotif(){
  if(!me){toast(t('login_required'));return;}
  // iOS Safari hors PWA installée : pas de PushManager
  if(!_pushSupported()){
    toast(t('push_need_install'),4500,{type:'info'});
    return;
  }
  const perm=Notification.permission;
  // Déjà actives → on désactive (suppression de la souscription serveur)
  if(perm==='granted'){
    try{
      const reg=await navigator.serviceWorker.ready;
      const sub=await reg.pushManager.getSubscription();
      if(sub){
        await sb.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);
        await sub.unsubscribe();
      }
    }catch(e){_DBG.log('push off: '+(e?.message||e));}
    applyToggleUI('toggle-notif-push',false);
    toast(t('push_disabled'),2200,{type:'success'});
    return;
  }
  // Refusées au niveau OS → impossible de redemander, passer par les réglages
  if(perm==='denied'){
    toast(t('push_blocked_settings'),4500,{type:'info'});
    return;
  }
  // perm === 'default' : on demande (geste utilisateur ✓)
  try{
    const p=await Notification.requestPermission();
    if(p!=='granted'){
      applyToggleUI('toggle-notif-push',false);
      toast(t('push_refused'),3200,{type:'info'});
      return;
    }
    const ok=await _initPushSubscription();
    if(ok){
      applyToggleUI('toggle-notif-push',true);
      toast(t('push_enabled'),2400,{type:'success'});
    }else{
      applyToggleUI('toggle-notif-push',false);
      toast(t('push_error'),3200,{type:'error'});
    }
  }catch(e){
    _DBG.log('push request: '+(e?.message||e));
    toast(t('push_error'),3200,{type:'error'});
  }
}

function _showBrowserNotif(title, body){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  // App au premier plan → pas de notif native (toast suffira)
  if(document.visibilityState==='visible')return;
  // Via SW (meilleur support mobile)
  if(navigator.serviceWorker?.controller){
    navigator.serviceWorker.ready.then(reg=>{
      reg.showNotification(title,{
        body,
        icon:'/icon-192.png',
        badge:'/icon-192.png',
        vibrate:[200,100,200],
        tag:'wa-notif',
        renotify:true,
        data:{url:location.origin+'/?tab=notif'}
      });
    }).catch(()=>new Notification(title,{body,icon:'/icon-192.png'}));
  }else{
    new Notification(title,{body,icon:'/icon-192.png'});
  }
}

async function acceptFollowRequest(fromUid,notifId){
  try{
    await sb.from('follows').insert({follower_id:fromUid,following_id:me.id});
    await sb.from('notifications').update({type:'follow',read:true}).eq('id',notifId);
    toast(t('request_accepted'));loadActivityNotifications();
  }catch(e){toast('❌ '+t('toast_error'));}
}

async function rejectFollowRequest(fromUid,notifId){
  try{await sb.from('notifications').delete().eq('id',notifId);toast(t('request_refused'));loadActivityNotifications();}catch(e){toast('❌ '+t('toast_error'));}
}

/* ── Swipe conv pour supprimer ── */
let _swipeStartX=0;
function convSwipeStart(el,e){_swipeStartX=e.touches[0].clientX;}
function convSwipeMove(el,e){
  const dx=_swipeStartX-e.touches[0].clientX;
  if(dx>40) el.classList.add('swiped');
  else if(dx<-20) el.classList.remove('swiped');
}
function convSwipeEnd(el,e){}
function toggleConvSwipe(el){
  if(!el)return;
  // Fermer les autres
  document.querySelectorAll('.conv-item.swiped').forEach(c=>{if(c!==el)c.classList.remove('swiped');});
  el.classList.toggle('swiped');
}

// Supprimer côté utilisateur uniquement (localStorage)
function deleteConvForMe(convId){
  const key='_deletedConvs_'+(me?.id||'');
  const deleted=JSON.parse(localStorage.getItem(key)||'[]');
  if(!deleted.includes(convId)) deleted.push(convId);
  localStorage.setItem(key,JSON.stringify(deleted));
  // Retirer visuellement
  document.querySelector(`.conv-item[data-convid="${convId}"]`)?.remove();
  toast(t('toast_conv_deleted'));
}
function getDeletedConvs(){
  const key='_deletedConvs_'+(me?.id||'');
  return new Set(JSON.parse(localStorage.getItem(key)||'[]'));
}

/* ── Menu contextuel message ── */
let _ctxMsgId=null,_ctxMsgEl=null,_ctxMsgContent='';
let _ctxMsgCreatedAt=null;
function showMsgCtx(msgId,content,createdAt,el,event){
  _ctxMsgId=msgId;_ctxMsgEl=el;_ctxMsgContent=content;_ctxMsgCreatedAt=createdAt;
  // Vérifier si dans la fenêtre des 5 min
  const age=(Date.now()-new Date(createdAt).getTime())/1000/60;
  const editOpt=document.getElementById('ctx-edit-opt');
  if(editOpt) editOpt.style.display=age<=5?'flex':'none';
  // Le bouton "Supprimer" change de label selon l'âge
  const delOpt=document.querySelector('#msg-ctx-menu .ctx-opt.danger');
  if(delOpt){
    const labelSpan=delOpt.lastChild;
    if(labelSpan&&labelSpan.nodeType===3)labelSpan.textContent=age<=5?' Supprimer pour tous':' Supprimer pour moi';
  }
  const menu=document.getElementById('msg-ctx-menu');
  const overlay=document.getElementById('msg-ctx-overlay');
  menu.style.display='block';
  overlay.style.display='block';
  // Position
  const x=event.clientX||event.touches?.[0]?.clientX||window.innerWidth/2;
  const y=event.clientY||event.touches?.[0]?.clientY||window.innerHeight/2;
  menu.style.left=Math.min(x,window.innerWidth-190)+'px';
  menu.style.top=Math.min(y+10,window.innerHeight-120)+'px';
}
function closeMsgCtx(){
  document.getElementById('msg-ctx-menu').style.display='none';
  document.getElementById('msg-ctx-overlay').style.display='none';
}
function triggerEditMsg(){
  closeMsgCtx();
  if(!_ctxMsgEl||!_ctxMsgId)return;
  const bubble=document.getElementById('bubble-'+_ctxMsgId);
  if(!bubble)return;
  const orig=bubble.innerHTML;
  bubble.innerHTML=`<textarea class="msg-edit-area" id="edit-ta-${_ctxMsgId}" rows="1">${escapeHtml(_ctxMsgContent)}</textarea>
    <div style="display:flex;gap:8px;margin-top:6px;justify-content:flex-end">
      <span onclick="cancelEditMsg('${_ctxMsgId}','${encodeURIComponent(orig)}')" style="font-size:11px;cursor:pointer;opacity:.7">Annuler</span>
      <span onclick="confirmEditMsg('${_ctxMsgId}')" style="font-size:11px;font-weight:700;cursor:pointer">✓ Sauvegarder</span>
    </div>`;
  const ta=document.getElementById('edit-ta-'+_ctxMsgId);
  if(ta){ta.focus();ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';}
}
function cancelEditMsg(msgId,origEncoded){
  const bubble=document.getElementById('bubble-'+msgId);
  if(bubble) bubble.innerHTML=decodeURIComponent(origEncoded);
}
async function confirmEditMsg(msgId){
  const ta=document.getElementById('edit-ta-'+msgId);
  if(!ta)return;
  const newContent=ta.value.trim();
  if(!newContent)return;
  try{
    const{data,error}=await sb.from('messages').update({content:newContent}).eq('id',msgId).select();
    if(error){console.error('[editMsg]',error);toast(friendlyError?friendlyError(error):'Erreur de modification');return;}
    if(!data||!data.length){console.warn('[editMsg] no rows updated — RLS or id mismatch',{msgId});toast(t('toast_edit_denied'));return;}
    const bubble=document.getElementById('bubble-'+msgId);
    if(bubble) bubble.innerHTML=escapeHtml(newContent)+'<span style="font-size:10px;color:rgba(12,21,34,0.5);margin-left:6px">modifié</span>';
    toast(t('toast_msg_edited'));
  }catch(e){console.error('[editMsg]',e);toast('❌ '+t('toast_error'));}
}
async function triggerDeleteMsg(){
  closeMsgCtx();
  if(!_ctxMsgId)return;
  const age=_ctxMsgCreatedAt?(Date.now()-new Date(_ctxMsgCreatedAt).getTime())/1000/60:999;
  try{
    if(age<=5){
      // Dans les 5min : DELETE complet (disparaît pour tous)
      const{error}=await sb.from('messages').delete().eq('id',_ctxMsgId);
      if(error){console.error('[delMsg]',error);toast(friendlyError?friendlyError(error):'Suppression refusée');return;}
      _ctxMsgEl?.remove();
      toast(t('toast_msg_deleted_all'));
    }else{
      // Après 5min : marquer comme "supprimé pour moi" (reste pour le destinataire)
      const{data,error}=await sb.from('messages').update({deleted_for_sender:true}).eq('id',_ctxMsgId).select();
      if(error){console.error('[delMsg me]',error);toast(friendlyError?friendlyError(error):'Suppression refusée');return;}
      if(!data||!data.length){console.warn('[delMsg me] no rows updated');toast(t('toast_delete_denied'));return;}
      _ctxMsgEl?.remove();
      toast(t('toast_msg_deleted_me'));
    }
  }catch(e){console.error('[delMsg]',e);toast('❌ '+t('toast_error'));}
}

// Actions dans la conversation (barre demande)
async function acceptMsgConv(){
  try{
    if(window._pendingMsgReqId)
      await sb.from('notifications').update({read:true}).eq('id',window._pendingMsgReqId);
    window._pendingMsgReqId=null;
    document.getElementById('conv-request-bar').style.display='none';
    document.getElementById('conv-input-bar').style.display='flex';
    document.getElementById('conv-pending-banner').style.display='none';
    document.getElementById('msg-input').focus();
    toast(t('toast_conv_accepted'));
  }catch(e){toast('❌ '+t('toast_error'));}
}
async function deleteMsgConv(){
  try{
    if(window._pendingMsgReqId)
      await sb.from('notifications').delete().eq('id',window._pendingMsgReqId);
    if(currentConvId)
      await sb.from('conversations').delete().eq('id',currentConvId);
    closeConversationScreen();
    toast(t('toast_conv_deleted'));
  }catch(e){toast('❌ '+t('toast_error'));}
}
async function blockMsgRequest(){
  // Bloquer + supprimer
  try{
    if(window._pendingMsgReqUid){
      await sb.from('notifications').delete().eq('id',window._pendingMsgReqId);
      if(currentConvId) await sb.from('conversations').delete().eq('id',currentConvId);
    }
    closeConversationScreen();
    toast(t('toast_user_blocked'));
  }catch(e){closeConversationScreen();}
}

async function acceptMsgRequest(fromUid,notifId){
  try{
    await sb.from('notifications').update({read:true}).eq('id',notifId);
    // Ouvrir la conversation avec cet utilisateur
    const prof=await getProfile(fromUid);
    if(prof) await startConversation(prof.id,prof.full_name||prof.username||'',prof.avatar_url||'',prof.username||'');
    loadActivityNotifications();
  }catch(e){toast('❌ '+t('toast_error'));}
}
async function dismissMsgRequest(notifId){
  try{await sb.from('notifications').delete().eq('id',notifId);toast(t('toast_request_declined'));loadActivityNotifications();}catch(e){toast('❌ '+t('toast_error'));}
}

// ── Compatibilité ──
function openMsgSearch(){
  const panel=document.getElementById('msg-search-panel');
  if(!panel)return;
  panel.style.display='flex';
  document.getElementById('msg-srch-results').innerHTML='';
  setTimeout(()=>document.getElementById('msg-srch-input')?.focus(),200);
}
function closeMsgSearch(){
  const panel=document.getElementById('msg-search-panel');
  if(panel)panel.style.display='none';
  const inp=document.getElementById('msg-srch-input');
  if(inp)inp.value='';
  document.getElementById('msg-srch-clear').style.display='none';
}
function clearMsgSearch(){
  const inp=document.getElementById('msg-srch-input');
  if(inp){inp.value='';inp.focus();}
  document.getElementById('msg-srch-clear').style.display='none';
  document.getElementById('msg-srch-results').innerHTML='';
}
let _msgSrchTimer=null;
function doMsgSearch(q){
  const clr=document.getElementById('msg-srch-clear');
  if(clr)clr.style.display=q.length>0?'block':'none';
  clearTimeout(_msgSrchTimer);
  if(!q.trim()){document.getElementById('msg-srch-results').innerHTML='';return;}
  _msgSrchTimer=setTimeout(async()=>{
    const res=document.getElementById('msg-srch-results');
    res.innerHTML=`<div style="text-align:center;padding:30px;color:var(--wd);font-size:13px">Recherche…</div>`;
    try{
      const{data}=await sb.from('profiles').select('id,username,full_name,avatar_url')
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .neq('id',me?.id||'').limit(20);
      if(!data||data.length===0){
        res.innerHTML=`<div class="empty-state"><img src="mascote_ivory/the_seeker.png" alt=""><div>Aucun utilisateur trouvé<div class="es-hint">Essaie un autre nom ou username.</div></div></div>`;
        return;
      }
      // Vérifier qui on suit
      const ids=data.map(p=>p.id);
      const{data:followData}=await sb.from('follows').select('following_id').eq('follower_id',me.id).in('following_id',ids);
      const followingSet=new Set((followData||[]).map(f=>f.following_id));
      res.innerHTML=data.map(p=>{
        const isFollowing=followingSet.has(p.id);
        const av=p.avatar_url?`<img src="${p.avatar_url}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="rgba(240,234,216,0.4)" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        const badge=isFollowing?'':`<span style="font-size:10px;padding:3px 8px;border-radius:50px;background:rgba(240,234,216,0.1);border:1px solid rgba(240,234,216,0.2);color:var(--wd);margin-left:auto;flex-shrink:0">Demande</span>`;
        return `<div onclick="startMsgFromSearch('${p.id}','${(p.full_name||p.username||'').replace(/'/g,"&#39;")}','${(p.avatar_url||'').replace(/'/g,'%27')}','${(p.username||'').replace(/'/g,"&#39;")}',${isFollowing})"
          style="display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;transition:background .15s;border-radius:12px;margin:0 8px"
          onmouseover="this.style.background='rgba(240,234,216,0.05)'" onmouseout="this.style.background='transparent'">
          <div style="width:44px;height:44px;border-radius:50%;background:var(--wf);border:1px solid var(--gold-b);overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0">${av}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:600;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.username||p.full_name||'Utilisateur'}</div>
            <div style="font-size:12px;color:var(--wd)">${p.full_name||''}</div>
          </div>
          ${badge}
        </div>`;
      }).join('');
    }catch(e){
      document.getElementById('msg-srch-results').innerHTML=`<div style="text-align:center;padding:40px 20px;color:var(--wd);font-size:13px">Erreur de recherche</div>`;
    }
  },350);
}
async function startMsgFromSearch(uid,name,avatarUrl,username,isFollowing){
  if(!me)return toast(t('login_msg_send'));
  closeMsgSearch();
  await startConversation(uid,name,avatarUrl,username);
}
async function openGroupInfo(){
  const sheet=document.getElementById('group-info-sheet');
  if(!sheet||!currentConvId)return;
  sheet.style.display='flex';
  const title=document.getElementById('gi-title');
  const memberList=document.getElementById('gi-members');
  if(title)title.textContent=document.getElementById('conv-screen-name')?.textContent||'Groupe';
  if(memberList)memberList.innerHTML=skRows(3);
  try{
    const{data:conv}=await sb.from('conversations').select('participants,group_name,created_by').eq('id',currentConvId).single();
    if(!conv){if(memberList)memberList.innerHTML='';return;}
    const ids=conv.participants||[];
    const profs=await getProfiles(ids);
    if(!profs||!profs.length){if(memberList)memberList.innerHTML='';return;}
    if(memberList)memberList.innerHTML=profs.map(p=>{
      const isMe=p.id===me?.id;
      const isAdmin=p.id===conv.created_by;
      const name=p.username||p.full_name||'?';
      const av=p.avatar_url?`<img src="${p.avatar_url}" alt="" style="width:42px;height:42px;border-radius:50%;object-fit:cover">`:`<div style="width:42px;height:42px;border-radius:50%;background:var(--gold-dim);border:1px solid var(--gold-b);display:flex;align-items:center;justify-content:center;font-size:17px;color:var(--gold)">${escapeHtml(name.charAt(0).toUpperCase())}</div>`;
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 20px;cursor:${isMe?'default':'pointer'}" ${isMe?'':` onclick="closeGroupInfo();openUserProfile('${p.id}')"`}>
        ${av}
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:500;color:var(--white)">@${escapeHtml(name)}${isMe?' <span style="font-size:10px;color:var(--wd)">(toi)</span>':''}</div>
          ${isAdmin?`<div style="font-size:10px;color:var(--gold);letter-spacing:.5px">Admin</div>`:''}
        </div>
      </div>`;
    }).join('');
  }catch(e){if(memberList)memberList.innerHTML='';}
}
function closeGroupInfo(){const s=document.getElementById('group-info-sheet');if(s)s.style.display='none';}
function msgFilterSelect(el,filter){msgChipSelect(el,filter);}
function notifTabSelect(tab){}
function openNewConversation(){openNewMsgMenu();}
function closeNewConversation(){closeNewMsgMenu();}
function msgFilter(el,type){msgChipSelect(el,type);}
function openConversation(){toast(t('login_msg_view'));}
function closeConversation(){closeConversationScreen();}
function sendMsg(){sendMessage();}
// escapeHtml est défini dans config.js (chargé en premier) — fonction de sécurité
// partagée, ne doit pas dépendre de l'ordre de chargement des modules.


// ═══════════════════════════════════════════
