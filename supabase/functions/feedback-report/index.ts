// ═══════════════════════════════════════════════════════════════
// WearAura — Edge Function : digest feedback (retours utilisateurs)
// Déclenchée par pg_cron (chaque jour). Lit feedback_digest ; envoie
// un e-mail QUE s'il y a de nouveaux retours dans les 24 h.
//
// ⚠️ LECTURE SEULE — surface les retours, ne modifie jamais rien.
//
// Réutilise les secrets : RESEND_API_KEY, REPORT_EMAIL, REPORT_TOKEN,
//                         REPORT_FROM (optionnel)
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const REPORT_EMAIL = Deno.env.get('REPORT_EMAIL') ?? '';
const REPORT_TOKEN = Deno.env.get('REPORT_TOKEN') ?? '';
const REPORT_FROM = Deno.env.get('REPORT_FROM') ?? 'WearAura <onboarding@resend.dev>';

function jwtRole(authHeader: string): string {
  try {
    const tok = (authHeader || '').replace(/^Bearer\s+/i, '').trim();
    let b64 = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=');
    return (JSON.parse(atob(b64)) as { role?: string })?.role ?? '';
  } catch { return ''; }
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type Item = { category: string; description: string; username: string; created_at: string };

// Étiquette + couleur par catégorie
function catBadge(cat: string): { label: string; color: string } {
  const c = (cat || '').toLowerCase();
  if (c.includes('bug')) return { label: '🐞 Bug', color: '#E8312A' };
  if (c.includes('id')) return { label: '💡 Idée', color: '#E5B567' };   // idée / idea
  return { label: '💬 Autre', color: '#7FA8C9' };
}

function buildHtml(items: Item[], totalAllTime: number): string {
  const cards = items.map(it => {
    const b = catBadge(it.category);
    const when = (() => { try { return new Date(it.created_at).toLocaleString('fr-FR'); } catch { return it.created_at; } })();
    return `
    <div style="background:#111F32;border-radius:12px;padding:16px;margin-top:12px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="display:inline-block;background:${b.color};color:#07101E;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px">${b.label}</span>
        <span style="color:#6b7785;font-size:11px">${esc(when)}</span>
      </div>
      <div style="color:#EDE4CF;font-size:14px;margin-top:10px;line-height:1.5;white-space:pre-wrap">${esc(it.description)}</div>
      <div style="color:#9aa;font-size:11px;margin-top:8px">— @${esc(it.username)}</div>
    </div>`;
  }).join('');

  return `
  <div style="background:#07101E;padding:24px;font-family:Helvetica,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#0C1828;border-radius:16px;padding:28px;border:1px solid rgba(240,234,216,0.12)">
      <div style="font-size:20px;color:#F0EAD8;font-weight:300;letter-spacing:2px">WEARAURA</div>
      <div style="font-size:14px;color:#F0EAD8;margin-top:4px;font-weight:600">💬 Retours utilisateurs — 24 dernières heures</div>
      <div style="font-size:12px;color:#9aa;margin-top:2px">${items.length} nouveau(x) retour(s) · ${totalAllTime} au total</div>

      ${cards}

      <div style="margin-top:18px;padding:12px 14px;background:#111F32;border-radius:10px;font-size:12px;color:#9aa;line-height:1.6">
        Retours envoyés via le formulaire « Signaler un problème ». <b style="color:#EDE4CF">Lecture seule</b> : réponds ou agis toi-même. Détail complet dans Supabase → Table Editor → feedback.
      </div>

      <div style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(240,234,216,0.1);font-size:11px;color:#6b7785">
        WearAura · Retours utilisateurs · ${esc((new Date()).toISOString().slice(0, 10))}
      </div>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (jwtRole(req.headers.get('Authorization') ?? '') !== 'service_role') {
    return new Response('Forbidden', { status: 403 });
  }
  if (!RESEND_API_KEY || !REPORT_EMAIL || !REPORT_TOKEN) {
    return new Response(JSON.stringify({ error: 'Config manquante' }), { status: 500 });
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await sb.rpc('feedback_digest', { p_token: REPORT_TOKEN });
  if (error || !data || (data as any).error) {
    return new Response(JSON.stringify({ error: 'feedback_digest: ' + (error?.message || (data as any)?.error) }), { status: 500 });
  }

  const items = ((data as any).items || []) as Item[];
  const totalAllTime = (data as any).total_all_time ?? 0;

  // Aucun nouveau retour → pas d'e-mail
  if (!items.length) {
    return new Response(JSON.stringify({ sent: false, total_all_time: totalAllTime }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const html = buildHtml(items, totalAllTime);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: REPORT_FROM,
      to: [REPORT_EMAIL],
      subject: `💬 WearAura — ${items.length} retour(s) utilisateur(s)`,
      html,
    }),
  });

  const out = await res.text();
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'resend', status: res.status, detail: out }), { status: 502 });
  }
  return new Response(JSON.stringify({ sent: true, items: items.length, to: REPORT_EMAIL }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
