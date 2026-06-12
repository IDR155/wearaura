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
  const un=document.getElementById('s-un').value.trim().replace('@','');
  const email=document.getElementById('s-em').value.trim(),pw=document.getElementById('s-pw').value;
  if(!fn||!email||!pw||!un)return showErr(t('fill_fields'));
  const btn=document.getElementById('btn-signup');btn.disabled=true;btn.textContent=t('creating');
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
async function doForgot(){
  const email=document.getElementById('forgot-em').value.trim();
  if(!email)return toast(t('enter_email'));
  await sb.auth.resetPasswordForEmail(email);
  toast(t('lien_envoye'));setTimeout(()=>goS('sc-auth'),1500);
}

// ═══════════════════════════════════════════
