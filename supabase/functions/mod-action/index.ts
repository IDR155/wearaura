// ═══════════════════════════════════════════════════════════════
// WearAura — Edge Function : action de modération 1-clic (Phase 2b)
// Cliquée depuis le mail de l'agent mod-scan. Sécurisée par un jeton
// par signalement (SHA-256 de l'id + REPORT_TOKEN).
//
// ⚠️ DÉPLOYER AVEC « Verify JWT » DÉSACTIVÉ (cliquée depuis un mail,
//    sans header d'auth ; c'est le jeton qui protège).
//
// Anti-prefetch : un GET affiche une page de CONFIRMATION (aucune
// mutation) ; seul le bouton (POST) exécute réellement l'action. Les
// anti-virus/préchargeurs de mail font des GET → ne déclenchent rien.
//
// Secrets : REPORT_TOKEN
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2';

const REPORT_TOKEN = Deno.env.get('REPORT_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function tokenFor(id: string): Promise<string> {
  const data = new TextEncoder().encode(id + ':' + REPORT_TOKEN);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const ACTION_LABEL: Record<string, string> = {
  hide: 'Masquer ce contenu',
  unhide: 'Réafficher ce contenu',
  keep: 'Conserver ce contenu (classer le signalement)',
};

function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WearAura · Modération</title></head>
  <body style="margin:0;background:#07101E;font-family:Helvetica,Arial,sans-serif;color:#EDE4CF;display:flex;min-height:100vh;align-items:center;justify-content:center">
    <div style="max-width:440px;margin:24px;background:#0C1828;border:1px solid rgba(240,234,216,.12);border-radius:16px;padding:32px;text-align:center">
      <div style="font-size:20px;font-weight:300;letter-spacing:2px;color:#F0EAD8">WEARAURA</div>
      <div style="font-size:13px;color:#9aa;margin-bottom:18px">Modération</div>
      ${title ? `<div style="font-size:17px;font-weight:600;margin-bottom:12px">${title}</div>` : ''}
      ${body}
    </div>
  </body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  const action = url.searchParams.get('action') || '';
  const token = url.searchParams.get('token') || '';

  if (!id || !ACTION_LABEL[action] || !token) return page('Lien invalide', '<div style="color:#9aa">Ce lien est incomplet.</div>', 400);
  if (token !== await tokenFor(id)) return page('Lien invalide', '<div style="color:#9aa">Jeton incorrect ou expiré.</div>', 403);

  // GET → page de confirmation (aucune mutation, anti-prefetch)
  if (req.method !== 'POST') {
    const color = action === 'hide' ? '#E8312A' : '#3a6ea5';
    return page(ACTION_LABEL[action], `
      <form method="POST" action="${esc(url.pathname + url.search)}">
        <button type="submit" style="background:${color};color:#fff;border:none;font-size:15px;font-weight:700;padding:12px 28px;border-radius:10px;cursor:pointer">Confirmer</button>
      </form>
      <div style="font-size:12px;color:#6b7785;margin-top:14px">Action réversible. Clique pour confirmer.</div>`);
  }

  // POST → exécution
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: r } = await sb.from('content_reports').select('*').eq('id', id).maybeSingle();
  if (!r) return page('Introuvable', '<div style="color:#9aa">Ce signalement n\'existe plus.</div>', 404);

  const tbl = r.content_type === 'comment' ? 'comments' : r.content_type === 'message' ? 'messages' : null;
  const nowIso = new Date().toISOString();

  if (action === 'hide' && tbl) {
    await sb.from(tbl).update({ hidden: true, hidden_reason: 'manuel', hidden_at: nowIso }).eq('id', r.content_id);
    await sb.from('content_reports').update({ status: 'reviewed' }).eq('id', id);
    return page('✅ Contenu masqué', '<div style="color:#9aa">Le contenu n\'apparaît plus dans l\'app. Tu peux le réafficher depuis Supabase si besoin.</div>');
  }
  if (action === 'unhide' && tbl) {
    await sb.from(tbl).update({ hidden: false, hidden_reason: null, hidden_at: null }).eq('id', r.content_id);
    await sb.from('content_reports').update({ status: 'reviewed' }).eq('id', id);
    return page('✅ Contenu réaffiché', '<div style="color:#9aa">Le contenu est de nouveau visible.</div>');
  }
  if (action === 'keep') {
    await sb.from('content_reports').update({ status: 'dismissed' }).eq('id', id);
    return page('✅ Contenu conservé', '<div style="color:#9aa">Le signalement a été classé sans suite.</div>');
  }
  return page('Action inconnue', '', 400);
});

function esc(s: unknown) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
