// ═══════════════════════════════════════════════════════════════
// WearAura — Edge Function : rapport analytics hebdomadaire par e-mail
// Déclenchée par pg_cron (lundi matin). Lit les stats agrégées via la
// fonction SQL analytics_summary, compose un e-mail HTML, l'envoie via
// Resend au fondateur.
//
// Secrets requis (Dashboard → Edge Functions → Secrets) :
//   RESEND_API_KEY  — clé API Resend (resend.com, gratuit)
//   REPORT_EMAIL    — adresse de réception (= e-mail du compte Resend)
//   REPORT_TOKEN    — jeton de la fonction analytics_summary
//   REPORT_FROM     — optionnel, défaut "WearAura <onboarding@resend.dev>"
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const REPORT_EMAIL = Deno.env.get('REPORT_EMAIL') ?? '';
const REPORT_TOKEN = Deno.env.get('REPORT_TOKEN') ?? '';
const REPORT_FROM = Deno.env.get('REPORT_FROM') ?? 'WearAura <onboarding@resend.dev>';

// Décode le rôle d'un JWT Supabase (gateway l'a déjà validé).
function jwtRole(authHeader: string): string {
  try {
    const tok = (authHeader || '').replace(/^Bearer\s+/i, '').trim();
    let b64 = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=');
    return (JSON.parse(atob(b64)) as { role?: string })?.role ?? '';
  } catch { return ''; }
}

// event technique -> libellé humain FR
const LABELS: Record<string, string> = {
  login: 'Connexions',
  signup: 'Inscriptions',
  tab_view: 'Navigations (onglets)',
  post_published: 'Looks publiés',
  story_published: 'Stories publiées',
  message_sent: 'Messages envoyés',
  scan_used: 'Scans IA',
  product_open: 'Fiches produit ouvertes',
  product_outbound: 'Clics vers la boutique',
  push_enabled: 'Notifs activées',
  push_disabled: 'Notifs désactivées',
  lang_change: 'Changements de langue',
};
const TAB_LABELS: Record<string, string> = {
  feed: 'Accueil', notif: 'Messages', boutique: 'Boutique',
  profile: 'Profil', create: 'Création', explore: 'Recherche',
};

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function rows(obj: Record<string, number>, labels: Record<string, string>): string {
  const entries = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '<tr><td style="padding:6px 0;color:#9aa">— aucune donnée —</td></tr>';
  return entries.map(([k, v]) =>
    `<tr><td style="padding:6px 0;color:#EDE4CF">${esc(labels[k] || k)}</td>` +
    `<td style="padding:6px 0;text-align:right;color:#F0EAD8;font-weight:600">${v}</td></tr>`
  ).join('');
}

function buildHtml(d: Record<string, any>): string {
  const dau = d.daily_active_users || {};
  const dauRows = Object.entries(dau)
    .map(([j, n]) => `<tr><td style="padding:3px 0;color:#9aa;font-size:12px">${esc(j)}</td>` +
      `<td style="padding:3px 0;text-align:right;color:#EDE4CF;font-size:12px">${n}</td></tr>`).join('');
  const errs = (d.top_errors || []) as { message: string; n: number }[];
  const errRows = errs.length
    ? errs.map(e => `<tr><td style="padding:4px 0;color:#ff9b9b;font-size:12px">${esc(e.message)}</td>` +
        `<td style="padding:4px 0;text-align:right;color:#ff9b9b;font-size:12px">${e.n}</td></tr>`).join('')
    : '<tr><td style="padding:4px 0;color:#7dc97d;font-size:12px">Aucune erreur 🎉</td></tr>';

  return `
  <div style="background:#07101E;padding:24px;font-family:Helvetica,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#0C1828;border-radius:16px;padding:28px;border:1px solid rgba(240,234,216,0.12)">
      <div style="font-size:22px;color:#F0EAD8;font-weight:300;letter-spacing:2px">WEARAURA</div>
      <div style="font-size:13px;color:#9aa;margin-top:2px">Rapport d'usage — 7 derniers jours</div>

      <div style="display:flex;gap:12px;margin:22px 0">
        <div style="flex:1;background:#111F32;border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:30px;color:#F0EAD8;font-weight:600">${d.active_users ?? 0}</div>
          <div style="font-size:11px;color:#9aa">utilisateurs actifs</div>
        </div>
        <div style="flex:1;background:#111F32;border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:30px;color:#F0EAD8;font-weight:600">${d.total_events ?? 0}</div>
          <div style="font-size:11px;color:#9aa">actions</div>
        </div>
      </div>

      <div style="font-size:13px;color:#F0EAD8;font-weight:600;margin:18px 0 6px">📊 Ce qui est utilisé</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows(d.events, LABELS)}</table>

      <div style="font-size:13px;color:#F0EAD8;font-weight:600;margin:18px 0 6px">🧭 Onglets visités</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows(d.top_tabs, TAB_LABELS)}</table>

      <div style="font-size:13px;color:#F0EAD8;font-weight:600;margin:18px 0 6px">📈 Actifs par jour (14 j)</div>
      <table style="width:100%;border-collapse:collapse">${dauRows || '<tr><td style="color:#9aa;font-size:12px">—</td></tr>'}</table>

      <div style="font-size:13px;color:#F0EAD8;font-weight:600;margin:18px 0 6px">🩺 Santé technique — ${d.errors_7d ?? 0} erreur(s)</div>
      <table style="width:100%;border-collapse:collapse">${errRows}</table>

      <div style="margin-top:22px;padding-top:14px;border-top:1px solid rgba(240,234,216,0.1);font-size:11px;color:#6b7785">
        Généré automatiquement le ${esc((d.generated_at || '').slice(0, 10))} · WearAura Analytics
      </div>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (jwtRole(req.headers.get('Authorization') ?? '') !== 'service_role') {
    return new Response('Forbidden', { status: 403 });
  }
  if (!RESEND_API_KEY || !REPORT_EMAIL || !REPORT_TOKEN) {
    return new Response(JSON.stringify({ error: 'Config manquante (RESEND_API_KEY / REPORT_EMAIL / REPORT_TOKEN)' }), { status: 500 });
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await sb.rpc('analytics_summary', { p_token: REPORT_TOKEN });
  if (error || !data || (data as any).error) {
    return new Response(JSON.stringify({ error: 'analytics_summary: ' + (error?.message || (data as any)?.error) }), { status: 500 });
  }

  const html = buildHtml(data as Record<string, any>);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: REPORT_FROM,
      to: [REPORT_EMAIL],
      subject: '📊 WearAura — ton rapport de la semaine',
      html,
    }),
  });

  const out = await res.text();
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'resend', status: res.status, detail: out }), { status: 502 });
  }
  return new Response(JSON.stringify({ sent: true, to: REPORT_EMAIL }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
