// ═══════════════════════════════════════════════════════════════
// WearAura — Edge Function : digest modération (agent Modérateur)
// Déclenchée par pg_cron (chaque jour). Lit moderation_digest ; envoie
// un e-mail QUE s'il y a de nouveaux posts signalés.
//
// ⚠️ LECTURE SEULE — ne bloque/supprime/modifie JAMAIS rien. Surface
// les signalements et laisse le fondateur décider et agir à la main.
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

type Reported = { post_id: string; reported_user: string; caption: string | null; reporters: number; reasons: string[] };

function buildHtml(items: Reported[], totalPending: number): string {
  const cards = items.map(it => {
    const urgent = it.reporters >= 3;
    const reasons = (it.reasons || []).map(r => `<li style="margin:2px 0">${esc(r)}</li>`).join('');
    return `
    <div style="background:#111F32;border-radius:12px;padding:16px;margin-top:12px;border-left:3px solid ${urgent ? '#E8312A' : 'rgba(240,234,216,0.2)'}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="color:#F0EAD8;font-size:14px;font-weight:600">@${esc(it.reported_user)}</div>
        <div style="color:${urgent ? '#ff9b9b' : '#9aa'};font-size:12px">${it.reporters} signalement(s)${urgent ? ' ⚠️' : ''}</div>
      </div>
      <div style="color:#9aa;font-size:12px;margin-top:6px;font-style:italic">${it.caption ? '« ' + esc(it.caption.slice(0, 120)) + ' »' : '(post supprimé ou sans légende)'}</div>
      <div style="color:#6b7785;font-size:11px;margin-top:8px;text-transform:uppercase">Motifs</div>
      <ul style="color:#EDE4CF;font-size:13px;margin:4px 0 0;padding-left:18px">${reasons}</ul>
      <div style="color:#6b7785;font-size:10px;margin-top:8px">post_id : ${esc(it.post_id)}</div>
    </div>`;
  }).join('');

  return `
  <div style="background:#07101E;padding:24px;font-family:Helvetica,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#0C1828;border-radius:16px;padding:28px;border:1px solid rgba(240,234,216,0.12)">
      <div style="font-size:20px;color:#F0EAD8;font-weight:300;letter-spacing:2px">WEARAURA</div>
      <div style="font-size:14px;color:#F0EAD8;margin-top:4px;font-weight:600">🚩 Posts signalés — 24 dernières heures</div>
      <div style="font-size:12px;color:#9aa;margin-top:2px">${items.length} post(s) signalé(s) · ${totalPending} en attente au total</div>

      ${cards}

      <div style="margin-top:18px;padding:12px 14px;background:#111F32;border-radius:10px;font-size:12px;color:#9aa;line-height:1.6">
        ⚠️ = signalé par 3+ personnes (à examiner en priorité). <b style="color:#EDE4CF">Cet agent ne fait qu'alerter</b> : examine et agis toi-même depuis l'app ou Supabase (masquer le post, bloquer le compte…). Aucune action n'est prise automatiquement.
      </div>

      <div style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(240,234,216,0.1);font-size:11px;color:#6b7785">
        WearAura · Modérateur · ${esc((new Date()).toISOString().slice(0, 10))}
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
  const { data, error } = await sb.rpc('moderation_digest', { p_token: REPORT_TOKEN });
  if (error || !data || (data as any).error) {
    return new Response(JSON.stringify({ error: 'moderation_digest: ' + (error?.message || (data as any)?.error) }), { status: 500 });
  }

  const items = ((data as any).reported_posts || []) as Reported[];
  const totalPending = (data as any).total_pending ?? 0;

  // Aucun nouveau signalement → pas d'e-mail
  if (!items.length) {
    return new Response(JSON.stringify({ alert: false, total_pending: totalPending }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const html = buildHtml(items, totalPending);
  const urgent = items.some(i => i.reporters >= 3);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: REPORT_FROM,
      to: [REPORT_EMAIL],
      subject: `${urgent ? '🔴' : '🚩'} WearAura — ${items.length} post(s) signalé(s)`,
      html,
    }),
  });

  const out = await res.text();
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'resend', status: res.status, detail: out }), { status: 502 });
  }
  return new Response(JSON.stringify({ alert: true, posts: items.length, to: REPORT_EMAIL }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
