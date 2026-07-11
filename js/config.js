// ═══════════════════════════════════════════
// LOGGER (console uniquement — pas de panneau visible)
// ═══════════════════════════════════════════
const _IS_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
if (!_IS_DEV) { const _n = () => {}; console.log = _n; console.warn = _n; console.debug = _n; }
const _DBG = {
  log(msg) { if (_IS_DEV) console.log('[WA]', msg); },
  err(msg, e) { console.error('[WA ERR]', msg, e || ''); }
};

// ── Échappement HTML (sécurité XSS) ──
// Défini ici (1er script chargé) pour être disponible dans tous les modules,
// quel que soit l'ordre de chargement. Toujours utiliser pour injecter du
// contenu utilisateur (pseudos, légendes, commentaires, messages) en innerHTML.
function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}

// ── Compte supprimé (anonymisé par l'Edge Function delete-account) ──
// La fonction pose username='deleted_<8 hex>' + full_name='Utilisateur supprimé'.
// On détecte ça pour afficher un libellé propre au lieu du slug technique.
function waIsDeletedProfile(p){
  if(!p)return false;
  return p.full_name==='Utilisateur supprimé' || /^deleted_[0-9a-f]{8}$/.test(p.username||'');
}
function waDisplayName(p,fallback){
  if(waIsDeletedProfile(p))return (typeof t==='function'?t('deleted_account'):'Compte supprimé');
  return (p&&(p.username||p.full_name))||fallback||(typeof t==='function'?t('someone'):'');
}

// ── Préférence "réduire les animations" (accessibilité) ──
// Lecture live : l'utilisateur peut changer le réglage système en cours de session.
function prefersReducedMotion(){return !!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);}

// ── Wrapper d'erreurs Supabase / friendly messages ──
const SB_FRIENDLY_ERROR_KEYS = {
  '23505': 'err_already_done',
  '23503': 'err_ref_not_found',
  '42501': 'err_perm',
  'PGRST116': 'err_not_found',
  'PGRST301': 'err_perm',
  'JWT expired': 'err_session',
  'invalid_token': 'err_session',
  'refresh_token_not_found': 'err_session',
  'Failed to fetch': 'err_network',
  'NetworkError': 'err_network',
  'Email not confirmed': 'err_email_confirm',
  'Invalid login credentials': 'err_bad_credentials',
  'User already registered': 'err_email_taken',
  'over_email_send_rate_limit': 'err_rate_limit',
  'weak_password': 'password_too_short',
  'Password should be at least': 'password_too_short',
};
const SB_FRIENDLY_ERRORS_FR = {
  'err_already_done': "Cette action a déjà été effectuée.",
  'err_ref_not_found': "Référence introuvable.",
  'err_not_found': "Cet élément n'existe plus.",
};
function friendlyError(error){
  if(!error)return t('err_generic')||"Something went wrong.";
  const txt=(error.code||'')+' '+(error.message||error.error_description||error.toString());
  for(const [key,msgKey] of Object.entries(SB_FRIENDLY_ERROR_KEYS)){
    if(txt.includes(key))return t(msgKey)||SB_FRIENDLY_ERRORS_FR[msgKey]||msgKey;
  }
  return t('err_fallback')||"Something went wrong. Please try again.";
}
async function safeRun(promiseOrFn, opts={}){
  const{friendly,silent,fallback=null,context=''}=opts;
  try{
    const result=typeof promiseOrFn==='function'?await promiseOrFn():await promiseOrFn;
    if(result&&result.error){
      _DBG.err(context||'safeRun',result.error);
      if(!silent)toast(friendly||friendlyError(result.error),2600,{type:'error'});
      return{data:fallback,error:result.error};
    }
    return result;
  }catch(e){
    _DBG.err(context||'safeRun exception',e);
    if(!silent)toast(friendly||friendlyError(e),2600,{type:'error'});
    return{data:fallback,error:e};
  }
}

// Détection online/offline
window.addEventListener('offline',()=>{toast(t('offline_msg'),3200,{type:'error'});});
window.addEventListener('online',()=>{toast(t('online_back'),2200,{type:'success'});});

// ── MASCOTTE LOUP — avatar universel ──
// Affiche wolf.webp si disponible, fallback 🐺 sinon
// size  : CSS string ex. '32px' | '52px'
// extra : CSS inline supplémentaire
function wolfAv(size='32px', extra=''){
  return `<div class="wolf-av" style="width:${size};height:${size};${extra}"><img src="wolf.webp" alt="WearAura" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<span class=\\'wolf-av-fallback\\'>🐺</span>')"><div class="wolf-av-fallback" style="display:none">🐺</div></div>`;
}

// ═══════════════════════════════════════════
// MISTRAL PIXTRAL — Vision IA (WearScan + Auto-hotspots)
// La clé est stockée côté serveur (Edge Function Supabase).
// Ne jamais remettre de clé ici.
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
// SUPABASE
// ═══════════════════════════════════════════
// Objet mock Supabase pour éviter un crash fatal si le CDN ne charge pas
const _sbMock = {
  auth: {
    getSession: async () => ({data:{session:null},error:null}),
    signInWithPassword: async () => ({data:{},error:{message:'Service indisponible'}}),
    signUp: async () => ({data:{},error:{message:'Service indisponible'}}),
    signOut: async () => ({}),
    onAuthStateChange: () => ({data:{subscription:{unsubscribe:()=>{}}}}),
    resetPasswordForEmail: async () => ({})
  },
  from: () => ({
    select: () => ({ limit: async () => ({data:[],error:null}), eq: () => ({single: async () => ({data:null,error:null})}), order: () => ({limit: async () => ({data:[],error:null})}), gte: () => ({order: () => ({limit: async () => ({data:[],error:null})})}) }),
    insert: async () => ({data:null,error:null}),
    update: () => ({ eq: async () => ({data:null,error:null}), match: async () => ({data:null,error:null}) }),
    delete: () => ({ eq: async () => ({data:null,error:null}), match: async () => ({data:null,error:null}) }),
    upsert: async () => ({data:null,error:null}),
    eq: () => ({single: async () => ({data:null,error:null})})
  }),
  storage: { from: () => ({ upload: async () => ({data:null,error:null}), getPublicUrl: () => ({data:{publicUrl:''}}) }) },
  functions: { invoke: async () => ({data:null,error:{message:'Service indisponible'}}) },
  channel: () => ({ on: () => ({subscribe: ()=>{}}), subscribe: ()=>{} }),
  removeChannel: ()=>{}
};
// ── Web Push : clé publique VAPID (la clé privée est un secret Supabase, jamais ici) ──
const WA_VAPID_PUBLIC_KEY = 'BOp6C69M0cQT5BGMXjk_CQSdMwA2c09H7jF1Fj8q1XO1xP1r98RZwwwoGEAiNoyYZLZ2b0zhFXhS3Qu49raG-tA';

let sb;
try {
  sb = supabase.createClient(
    'https://whaxwmztbkgnfokuqlcc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoYXh3bXp0YmtnbmZva3VxbGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMDU2OTgsImV4cCI6MjA4OTU4MTY5OH0.bCLmplzmZYtH8it9sOMmFTbnk4-qDAiLj_qy4nSoH7Y'
  );
} catch(e) {
  console.warn('[WA] Supabase offline mode');
  sb = _sbMock;
}

// ═══════════════════════════════════════════
// ANALYTICS PRODUIT + ERREURS (first-party, Supabase)
// track('event', {props}) — fire-and-forget, jamais bloquant,
// silencieux si la table n'existe pas encore ou si offline.
// ═══════════════════════════════════════════
function track(event, props){
  try{
    sb.from('app_events').insert({
      user_id:(typeof me!=='undefined'&&me)?me.id:null,
      event:String(event).slice(0,64),
      props:props||{},
      lang:(typeof currentLang!=='undefined')?currentLang:null,
    }).then(()=>{},()=>{});
  }catch(e){}
}

// Remontée d'erreurs JS : dédupe par message, max 10 par session,
// jamais d'erreur en cascade (tout est avalé).
const _errSeen=new Set();
let _errCount=0;
function _reportError(message, stack, src){
  try{
    if(_errCount>=10)return;
    const key=String(message).slice(0,120);
    if(_errSeen.has(key))return;
    _errSeen.add(key);_errCount++;
    sb.from('client_errors').insert({
      user_id:(typeof me!=='undefined'&&me)?me.id:null,
      message:String(message).slice(0,500),
      stack:String(stack||'').slice(0,2000),
      url:String(src||location.href).slice(0,300),
      ua:navigator.userAgent.slice(0,200),
    }).then(()=>{},()=>{});
  }catch(e){}
}
window.addEventListener('error',e=>{_reportError(e.message,e.error?.stack,e.filename);});
window.addEventListener('unhandledrejection',e=>{const r=e.reason;_reportError(r?.message||String(r),r?.stack,'unhandledrejection');});

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════
// ── Profiles cache ────────────────────────────────────────────
// Évite les requêtes Supabase répétées sur la table profiles.
// Champs cachés : id, username, full_name, avatar_url, bio, is_private
// Ne cache PAS : preferences, blocked_users, aura_points (données mutables fréquentes).
// Invalidation : invalidateProfileCache(id) après update, clear total au logout.
const _profileCache = new Map();

async function getProfiles(ids) {
  if (!ids || !ids.length) return [];
  const unique = [...new Set(ids.filter(Boolean))];
  const missing = unique.filter(id => !_profileCache.has(id));
  if (missing.length) {
    try {
      const { data } = await sb.from('profiles')
        .select('id,username,full_name,avatar_url,bio,is_private')
        .in('id', missing);
      (data || []).forEach(p => _profileCache.set(p.id, p));
    } catch(e) { _DBG.err('getProfiles', e); }
  }
  return unique.map(id => _profileCache.get(id)).filter(Boolean);
}

async function getProfile(id) {
  if (!id) return null;
  if (_profileCache.has(id)) return _profileCache.get(id);
  const list = await getProfiles([id]);
  return list[0] || null;
}

function invalidateProfileCache(id) {
  if (id) _profileCache.delete(id);
  else _profileCache.clear();
}

let me = null, dbOk = false, selFile = null, curPostId = null, viewUid = null, prevScreen = 'sc-feed';
let currentLook = null;
let isMuted = false;
let srchStyle = '';
let hspots = [], selHspot = null;

// ── CAMERA STATE ───────────────────────────
let camStream = null;
let camFacing = 'environment';
let flashOn = false;
let nightMode = false;
let timerSec = 0;

// ════════════════════════════════════════
