// AUTH
// ═══════════════════════════════════════════
function switchAuthTab(tab){
  document.querySelectorAll('.auth-tab').forEach((el,i)=>{
    const active=(i===0&&tab==='login')||(i===1&&tab==='signup');
    el.classList.toggle('active',active);
    el.setAttribute('aria-selected',active?'true':'false');
    el.setAttribute('tabindex',active?'0':'-1');
  });
  document.getElementById('auth-login').style.display=tab==='login'?'block':'none';
  document.getElementById('auth-signup').style.display=tab==='signup'?'block':'none';
  // Le pied "En continuant…" fait doublon avec la case de consentement de l'inscription : on le masque sur cet onglet (et il libère de la place).
  const foot=document.querySelector('.auth-foot');
  if(foot)foot.style.display=tab==='signup'?'none':'block';
}
function showErr(msg){const e=document.getElementById('auth-err');e.textContent=msg;e.style.display='block';}

async function doLogin(){
  const email=document.getElementById('l-email').value.trim(),pw=document.getElementById('l-pw').value;
  if(!email||!pw)return showErr(t('fill_fields'));
  const btn=document.getElementById('btn-login');btn.disabled=true;btn.textContent=t('connecting');
  const {data,error}=await sb.auth.signInWithPassword({email,password:pw});
  btn.disabled=false;btn.textContent=t('sign_in');
  if(error)return showErr(friendlyError(error));
  me=data.user;track('login');startGlobalRealtime();loadFeed();goS('sc-feed');handleDeepLink();
}
async function doSignup(){
  const fn=document.getElementById('s-fn').value.trim(),ln=document.getElementById('s-ln').value.trim();
  const un=document.getElementById('s-un').value.trim();
  const email=document.getElementById('s-em').value.trim(),pw=document.getElementById('s-pw').value;
  if(!fn||!email||!pw||!un)return showErr(t('fill_fields'));
  if(!document.getElementById('s-consent')?.checked)return showErr(t('accept_terms'));
  // Le champ username ne doit pas contenir d'email (autofill Safari) — message clair
  if(un.includes('@'))return showErr(t('username_no_email'));
  if(pw.length<8)return showErr(t('password_too_short'));
  const btn=document.getElementById('btn-signup');btn.disabled=true;btn.textContent=t('creating');
  // Vérifie la disponibilité du username AVANT de créer le compte (sinon erreur générique)
  const {data:taken}=await sb.from('profiles').select('id').ilike('username',un).maybeSingle();
  if(taken){btn.disabled=false;btn.textContent=t('create_account');return showErr(t('username_taken'));}
  const {data,error}=await sb.auth.signUp({email,password:pw,options:{data:{first_name:fn,last_name:ln,username:un,full_name:`${fn} ${ln}`}}});
  btn.disabled=false;btn.textContent=t('create_account');
  if(error)return showErr(friendlyError(error));
  me=data.user;track('signup');startGlobalRealtime();
  try{await sb.from('profiles').upsert({id:me.id,username:un,full_name:`${fn} ${ln}`,bio:'',aura_points:0});}catch(e){await sb.from('profiles').upsert({id:me.id,username:un,full_name:`${fn} ${ln}`});}
  toast(t('compte_cree'),2600,{type:'success'});setTimeout(()=>{loadFeed();goS('sc-feed');handleDeepLink();},1500);
  // wa_hotspot_onboard_pending posé depuis obSkip() (nav.js) pour éviter
  // la race condition : loadFeed() consommait le flag avant la fin de l'onboarding.
  localStorage.removeItem('wa_hotspot_onboard_pending'); // nettoyer flag résiduel éventuel
  localStorage.removeItem('wa_onboarded');
  localStorage.removeItem('wa_preferences_set');
  setTimeout(()=>showPreferencesScreen(),1600);
}
async function doLogout(){stopGlobalRealtime();await sb.auth.signOut();me=null;invalidateUserPrefsCache();invalidateProfileCache();closeSettings();goS('sc-auth');}

// ── Suppression de compte (RGPD) ──
function openDeleteAccount(){
  const m=document.getElementById('delete-account-modal');if(!m)return;
  m.style.display='flex';
}
function closeDeleteAccount(){
  const m=document.getElementById('delete-account-modal');if(m)m.style.display='none';
}
async function confirmDeleteAccount(){
  const btn=document.getElementById('da-confirm-btn');
  if(btn){btn.disabled=true;btn.textContent=t('deleting');}
  try{
    const{data,error}=await sb.functions.invoke('delete-account');
    if(error||!data||data.ok!==true){
      if(btn){btn.disabled=false;btn.textContent=t('delete_account_btn');}
      toast(t('delete_account_failed'),3200,{type:'error'});
      return;
    }
  }catch(e){
    if(btn){btn.disabled=false;btn.textContent=t('delete_account_btn');}
    toast(t('delete_account_failed'),3200,{type:'error'});
    return;
  }
  // Compte supprimé : on nettoie la session locale et on repart à zéro
  closeDeleteAccount();closeSettings();
  try{await sb.auth.signOut();}catch(e){}
  me=null;
  try{invalidateUserPrefsCache();invalidateProfileCache();}catch(e){}
  try{localStorage.clear();}catch(e){}
  toast(t('delete_account_done'),3000,{type:'success'});
  setTimeout(()=>goS('sc-auth'),1200);
}
async function doForgot(){
  const email=document.getElementById('forgot-em').value.trim();
  if(!email)return toast(t('enter_email'));
  await sb.auth.resetPasswordForEmail(email);
  toast(t('lien_envoye'));setTimeout(()=>goS('sc-auth'),1500);
}

// ═══════════════════════════════════════════
