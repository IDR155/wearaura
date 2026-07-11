// ═══════════════════════════════════════════════════════════════
// WearAura — Suppression de compte (RGPD / droit à l'effacement)
// Appelée par l'utilisateur connecté via sb.functions.invoke('delete-account').
// L'identité est dérivée du JWT de l'appelant → on ne peut supprimer QUE
// son propre compte.
//
// Politique (choix produit « tout supprimer sauf les messages ») :
//   • Supprime : posts, likes, saved_posts, comments, follows, stories,
//     story_views, story_reactions, scan_history, alternative_feedback,
//     feedback, material_suggestions, push_subscriptions, app_events,
//     client_errors, notifications, blocked_users, reports, content_reports.
//   • Garde : messages + conversations (pour ne pas trouer les fils des autres).
//   • Anonymise (au lieu de supprimer, car les messages y sont rattachés en
//     cascade) : la ligne profiles ET l'identifiant auth (email/mot de passe
//     effacés, connexion bannie). → l'utilisateur ne peut plus se connecter,
//     ses PII sont retirées, et ses messages s'affichent « Utilisateur supprimé ».
//
// ⚠️ DÉPLOYER AVEC « Verify JWT » DÉSACTIVÉ (comme les autres fonctions du
//    projet). La sécurité ne repose PAS sur la passerelle : la fonction
//    vérifie elle-même le JWT de l'appelant via getUser() et ne supprime que
//    l'utilisateur de ce token. Verify JWT activé bloquerait le preflight CORS
//    (OPTIONS sans header d'auth) et ferait échouer l'appel depuis le navigateur.
//
// Secrets utilisés (déjà présents par défaut sur Supabase) :
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOWED_ORIGINS = new Set([
  'https://wearaura.fr',
  'https://www.wearaura.fr',
  'http://localhost:3333',
  'http://127.0.0.1:3333',
  'http://localhost:3334',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://wearaura.fr',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const CORS = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

  // ── 1. Identifier l'appelant via son JWT ─────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ ok: false, error: 'Non authentifié' }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ ok: false, error: 'Session invalide' }, 401);

  const uid = user.id;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Suppression best-effort : une table/colonne absente ne doit pas tout arrêter.
  const del = async (table: string, col: string, val: string) => {
    try { await admin.from(table).delete().eq(col, val); } catch (_) { /* ignore */ }
  };

  // ── 2. Supprimer les données personnelles (tout sauf messages) ─
  await del('posts', 'user_id', uid);
  await del('likes', 'user_id', uid);
  await del('saved_posts', 'user_id', uid);
  await del('comments', 'user_id', uid);
  await del('stories', 'user_id', uid);
  await del('story_views', 'viewer_id', uid);
  await del('story_reactions', 'user_id', uid);
  await del('scan_history', 'user_id', uid);
  await del('alternative_feedback', 'user_id', uid);
  await del('feedback', 'user_id', uid);
  await del('material_suggestions', 'suggested_by', uid);
  await del('push_subscriptions', 'user_id', uid);
  await del('app_events', 'user_id', uid);
  await del('client_errors', 'user_id', uid);

  // Relations à double sens
  await del('follows', 'follower_id', uid);
  await del('follows', 'following_id', uid);
  await del('blocked_users', 'blocker_id', uid);
  await del('blocked_users', 'blocked_id', uid);
  await del('notifications', 'user_id', uid);
  await del('notifications', 'from_user_id', uid);

  // Signalements émis par l'utilisateur (on garde ceux émis CONTRE lui pour la modération)
  await del('content_reports', 'reporter_id', uid);
  await del('reports', 'reporter_id', uid);

  // ── 3. Anonymiser la ligne profiles (les messages y sont rattachés) ─
  try {
    await admin.from('profiles').update({
      username: 'deleted_' + uid.slice(0, 8),
      full_name: 'Utilisateur supprimé',
      avatar_url: null,
      bio: null,
    }).eq('id', uid);
  } catch (_) { /* ignore */ }

  // ── 4. Anonymiser + bannir l'identifiant auth (retire email/PII, bloque login) ─
  try {
    await admin.auth.admin.updateUserById(uid, {
      email: `deleted+${uid}@deleted.wearaura.fr`,
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: {},
      ban_duration: '876000h', // ~100 ans
    });
  } catch (_) { /* ignore */ }

  return json({ ok: true });
});
