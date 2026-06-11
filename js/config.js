// ═══════════════════════════════════════════
// LOGGER (console uniquement — pas de panneau visible)
// ═══════════════════════════════════════════
const _IS_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
if (!_IS_DEV) { const _n = () => {}; console.log = _n; console.warn = _n; console.debug = _n; }
const _DBG = {
  log(msg) { if (_IS_DEV) console.log('[WA]', msg); },
  err(msg, e) { console.error('[WA ERR]', msg, e || ''); }
};

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
// Affiche wolf.png si disponible, fallback 🐺 sinon
// size  : CSS string ex. '32px' | '52px'
// extra : CSS inline supplémentaire
function wolfAv(size='32px', extra=''){
  return `<div class="wolf-av" style="width:${size};height:${size};${extra}"><img src="wolf.png" alt="WearAura" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<span class=\\'wolf-av-fallback\\'>🐺</span>')"><div class="wolf-av-fallback" style="display:none">🐺</div></div>`;
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
const WA_VAPID_PUBLIC_KEY = 'BGXt-IqDdApkWNDx_JNLSc5mKFCvm8Y4IJwLLnG1hfwl0e_WKXIVQCNHB0HOMEBC3m68ZPjLBJXFB_mWtS6dDK8';

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
