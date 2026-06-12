// ═══════════════════════════════════════════════════════════════
// WearAura — Edge Function : veille des erreurs (agent Veilleur de bugs)
// Déclenchée par pg_cron (chaque jour). Lit error_watch_24h ; n'envoie
// un e-mail d'alerte QUE s'il y a des erreurs actionnables (sinon rien).
//
// Réutilise les secrets de weekly-report :
//   RESEND_API_KEY, REPORT_EMAIL, REPORT_TOKEN, REPORT_FROM (optionnel)
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

function buildHtml(items: { message: string; n: number; users: number }[], total: number): string {
  const rows = items.map(e => {
    const urgent = e.users >= 3;
    return `<tr>
      <td style="padding:8px 0;color:#EDE4CF;font-size:13px;${urgent ? 'font-weight:600' : ''}">${esc(e.message)}</td>
      <td style="padding:8px 8px;text-align:right;color:#9aa;font-size:12px;white-space:nowrap">${e.n}×</td>
      <td style="padding:8px 0;text-align:right;font-size:12px;white-space:nowrap;color:${urgent ? '#ff9b9b' : '#9aa'}">${e.users} util.${urgent ? ' ⚠️' : ''}</td>
    </tr>`;
  }).join('');

  return `
  <div style="background:#07101E;padding:24px;font-family:Helvetica,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#0C1828;border-radius:16px;padding:28px;border:1px solid rgba(232,49,42,0.25)">
      <div style="font-size:20px;color:#F0EAD8;font-weight:300;letter-spacing:2px">WEARAURA</div>
      <div style="font-size:14px;color:#ff9b9b;margin-top:4px;font-weight:600">⚠️ Erreurs à regarder — 24 dernières heures</div>
      <div style="font-size:12px;color:#9aa;margin-top:2px">${items.length} type(s) d'erreur · ${total} occurrence(s) au total</div>

      <table style="width:100%;border-collapse:collapse;margin-top:18px">
        <tr style="border-bottom:1px solid rgba(240,234,216,0.12)">
          <td style="padding-bottom:6px;color:#6b7785;font-size:11px;text-transform:uppercase">Erreur</td>
          <td style="padding-bottom:6px;text-align:right;color:#6b7785;font-size:11px">Occur.</td>
          <td style="padding-bottom:6px;text-align:right;color:#6b7785;font-size:11px">Touchés</td>
        </tr>
        ${rows}
      </table>

      <div style="margin-top:18px;padding:12px 14px;background:#111F32;border-radius:10px;font-size:12px;color:#9aa;line-height:1.6">
        ⚠️ = au moins 3 utilisateurs touchés (à traiter en priorité). Une erreur isolée sur 1 utilisateur peut être un cas limite ; une erreur sur plusieurs = vrai bug.
      </div>

      <div style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(240,234,216,0.1);font-size:11px;color:#6b7785">
        WearAura · Veilleur de bugs · ${esc((new Date()).toISOString().slice(0, 10))}
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
  const { data, error } = await sb.rpc('error_watch_24h', { p_token: REPORT_TOKEN });
  if (error || !data || (data as any).error) {
    return new Response(JSON.stringify({ error: 'error_watch_24h: ' + (error?.message || (data as any)?.error) }), { status: 500 });
  }

  const items = ((data as any).actionable || []) as { message: string; n: number; users: number }[];

  // Rien d'actionnable → pas d'e-mail (silence = bonne nouvelle)
  if (!items.length) {
    return new Response(JSON.stringify({ alert: false, total_24h: (data as any).total_24h ?? 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const html = buildHtml(items, (data as any).total_24h ?? 0);
  const urgent = items.some(e => e.users >= 3);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: REPORT_FROM,
      to: [REPORT_EMAIL],
      subject: `${urgent ? '🔴' : '⚠️'} WearAura — ${items.length} erreur(s) à regarder`,
      html,
    }),
  });

  const out = await res.text();
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'resend', status: res.status, detail: out }), { status: 502 });
  }
  return new Response(JSON.stringify({ alert: true, types: items.length, to: REPORT_EMAIL }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
