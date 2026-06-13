// ═══════════════════════════════════════════════════════════════
// WearAura — Edge Function : digest feedback + brouillons (Phase 3)
// Déclenchée par pg_cron (chaque jour). Lit feedback_digest ; pour
// chaque retour, fait rédiger un BROUILLON de réponse par Mistral et
// l'inclut dans le mail avec un lien ✉️ Répondre pré-rempli.
//
// ⚠️ LECTURE SEULE — ne répond JAMAIS tout seul : c'est toi qui relis
// et envoies depuis ton client mail (le lien ouvre un brouillon).
//
// Secrets : MISTRAL_KEY, RESEND_API_KEY, REPORT_EMAIL, REPORT_TOKEN,
//           REPORT_FROM (optionnel)
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2';

const MISTRAL_KEY    = Deno.env.get('MISTRAL_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const REPORT_EMAIL   = Deno.env.get('REPORT_EMAIL') ?? '';
const REPORT_TOKEN   = Deno.env.get('REPORT_TOKEN') ?? '';
const REPORT_FROM    = Deno.env.get('REPORT_FROM') ?? 'WearAura <onboarding@resend.dev>';

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

type Item = { category: string; description: string; username: string; created_at: string; email: string | null };

function catBadge(cat: string): { label: string; color: string } {
  const c = (cat || '').toLowerCase();
  if (c.includes('bug')) return { label: '🐞 Bug', color: '#E8312A' };
  if (c.includes('id')) return { label: '💡 Idée', color: '#E5B567' };
  return { label: '💬 Autre', color: '#7FA8C9' };
}

// Brouillon de réponse via Mistral. Renvoie '' si indispo (le mail reste utile).
async function draftReply(it: Item): Promise<string> {
  if (!MISTRAL_KEY) return '';
  const sys = `Tu es le support de WearAura, une application de mode communautaire bienveillante et soignée. Un utilisateur (@${it.username}) a envoyé un retour via le formulaire « Signaler un problème » (catégorie : ${it.category}). Rédige une réponse courte, chaleureuse et personnelle en français (2 à 4 phrases) : remercie-le, montre que tu as bien compris son message, et indique la suite si c'est pertinent (ex : « on regarde ça », « bonne idée, on la note »). Termine par « — L'équipe WearAura ». Réponds UNIQUEMENT avec le texte de la réponse, sans objet, sans guillemets.`;
  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MISTRAL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'system', content: sys }, { role: 'user', content: it.description }],
        temperature: 0.4,
        max_tokens: 250,
      }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return String(data?.choices?.[0]?.message?.content || '').trim();
  } catch { return ''; }
}

async function buildHtml(items: Item[], totalAllTime: number): Promise<string> {
  const cards = await Promise.all(items.map(async it => {
    const b = catBadge(it.category);
    const when = (() => { try { return new Date(it.created_at).toLocaleString('fr-FR'); } catch { return it.created_at; } })();
    const draft = await draftReply(it);

    // Bloc brouillon + bouton Répondre (mailto pré-rempli) si on a l'e-mail
    let replyBlock = '';
    if (draft) {
      const mailto = it.email
        ? `mailto:${it.email}?subject=${encodeURIComponent('WearAura — réponse à ton retour')}&body=${encodeURIComponent(draft)}`
        : '';
      replyBlock = `
      <div style="margin-top:12px;background:#0a1422;border:1px dashed rgba(229,181,103,0.4);border-radius:10px;padding:12px">
        <div style="color:#E5B567;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">✍️ Brouillon de réponse (suggéré)</div>
        <div style="color:#EDE4CF;font-size:13px;margin-top:6px;line-height:1.5;white-space:pre-wrap">${esc(draft)}</div>
        ${mailto
          ? `<div style="margin-top:10px"><a href="${esc(mailto)}" style="display:inline-block;background:#E5B567;color:#07101E;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:8px">✉️ Répondre à ${esc(it.email)}</a></div>`
          : `<div style="color:#6b7785;font-size:11px;margin-top:8px">Pas d'e-mail enregistré pour ce retour — copie le brouillon manuellement.</div>`}
      </div>`;
    }

    return `
    <div style="background:#111F32;border-radius:12px;padding:16px;margin-top:12px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="display:inline-block;background:${b.color};color:#07101E;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px">${b.label}</span>
        <span style="color:#6b7785;font-size:11px">${esc(when)}</span>
      </div>
      <div style="color:#EDE4CF;font-size:14px;margin-top:10px;line-height:1.5;white-space:pre-wrap">${esc(it.description)}</div>
      <div style="color:#9aa;font-size:11px;margin-top:8px">— @${esc(it.username)}${it.email ? ' · ' + esc(it.email) : ''}</div>
      ${replyBlock}
    </div>`;
  }));

  return `
  <div style="background:#07101E;padding:24px;font-family:Helvetica,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#0C1828;border-radius:16px;padding:28px;border:1px solid rgba(240,234,216,0.12)">
      <div style="font-size:20px;color:#F0EAD8;font-weight:300;letter-spacing:2px">WEARAURA</div>
      <div style="font-size:14px;color:#F0EAD8;margin-top:4px;font-weight:600">💬 Retours utilisateurs — 24 dernières heures</div>
      <div style="font-size:12px;color:#9aa;margin-top:2px">${items.length} nouveau(x) retour(s) · ${totalAllTime} au total</div>

      ${cards.join('')}

      <div style="margin-top:18px;padding:12px 14px;background:#111F32;border-radius:10px;font-size:12px;color:#9aa;line-height:1.6">
        Les brouillons sont <b style="color:#EDE4CF">suggérés par IA</b> : relis-les avant d'envoyer. Le bouton ✉️ ouvre ton client mail avec le brouillon pré-rempli — rien n'est envoyé automatiquement.
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

  if (!items.length) {
    return new Response(JSON.stringify({ sent: false, total_all_time: totalAllTime }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const html = await buildHtml(items, totalAllTime);
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
