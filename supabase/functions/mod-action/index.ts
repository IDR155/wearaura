// ═══════════════════════════════════════════════════════════════
// WearAura — API d'action de modération (Phase 2b)
// Appelée en POST par la page wearaura.fr/moderation.html (le bouton
// « Confirmer »). Sécurisée par un jeton par signalement
// (SHA-256 de l'id + REPORT_TOKEN). Réversible, jamais destructif.
//
// ⚠️ DÉPLOYER AVEC « Verify JWT » DÉSACTIVÉ (appel depuis le navigateur
//    sans header d'auth ; c'est le jeton qui protège).
//
// Secrets : REPORT_TOKEN
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2';

const REPORT_TOKEN = Deno.env.get('REPORT_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOWED_ORIGINS = new Set([
  'https://wearaura.fr',
  'https://www.wearaura.fr',
  'http://localhost:3333',
  'http://127.0.0.1:3333',
]);

const MSG: Record<string, string> = {
  hide: 'Contenu masqué',
  unhide: 'Contenu réaffiché',
  keep: 'Contenu conservé, signalement classé',
};

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://wearaura.fr',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

async function tokenFor(id: string): Promise<string> {
  const data = new TextEncoder().encode(id + ':' + REPORT_TOKEN);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const CORS = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

  let body: { id?: string; action?: string; token?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: 'Requête invalide' }, 400); }

  const { id, action, token } = body || {};
  if (!id || !action || !MSG[action] || !token) return json({ ok: false, error: 'Paramètres manquants' }, 400);
  if (token !== await tokenFor(id)) return json({ ok: false, error: 'Jeton invalide ou expiré' }, 403);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: r } = await sb.from('content_reports').select('*').eq('id', id).maybeSingle();
  if (!r) return json({ ok: false, error: 'Signalement introuvable' }, 404);

  const tbl = r.content_type === 'comment' ? 'comments' : r.content_type === 'message' ? 'messages' : null;
  const nowIso = new Date().toISOString();

  if (action === 'hide' && tbl) {
    await sb.from(tbl).update({ hidden: true, hidden_reason: 'manuel', hidden_at: nowIso }).eq('id', r.content_id);
    await sb.from('content_reports').update({ status: 'reviewed' }).eq('id', id);
  } else if (action === 'unhide' && tbl) {
    await sb.from(tbl).update({ hidden: false, hidden_reason: null, hidden_at: null }).eq('id', r.content_id);
    await sb.from('content_reports').update({ status: 'reviewed' }).eq('id', id);
  } else if (action === 'keep') {
    await sb.from('content_reports').update({ status: 'dismissed' }).eq('id', id);
  } else {
    return json({ ok: false, error: 'Action inconnue' }, 400);
  }

  return json({ ok: true, message: MSG[action] });
});
