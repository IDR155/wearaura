// ═══════════════════════════════════════════════════════════════
// WearAura — Edge Function : agent de modération (Phase 2b)
// Déclenchée par pg_cron. Lit les content_reports en attente, fait
// juger chaque contenu par Mistral, MASQUE automatiquement (réversible)
// les cas évidents, met les cas limites en file, et envoie un mail
// récap avec boutons Masquer ✓ / Garder ✗ (validation 1-clic).
//
// Semi-auto + réversible : ne supprime JAMAIS, ne bannit JAMAIS.
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
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const AUTO_HIDE_THRESHOLD = 0.8;   // confiance mini pour masquer tout seul

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

// Jeton par signalement = SHA-256(id + ':' + REPORT_TOKEN). Inguessable sans le secret.
async function tokenFor(id: string): Promise<string> {
  const data = new TextEncoder().encode(id + ':' + REPORT_TOKEN);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

type Verdict = { verdict: string; category: string; confidence: number; reason: string };

async function classify(text: string): Promise<Verdict> {
  const sys = `Tu es un modérateur de contenu pour une application de mode communautaire (WearAura). On te donne le texte d'un commentaire ou message privé signalé par un utilisateur. Décide s'il enfreint les règles : haine/discrimination, harcèlement, menaces, contenu sexuel explicite, spam/arnaque, coordonnées pour transaction hors plateforme, insultes graves. Réponds UNIQUEMENT en JSON strict : {"verdict":"ok|review|violation","category":"courte catégorie","confidence":0.0,"reason":"explication brève en français"}. "violation" = clairement interdit. "review" = ambigu/limite, besoin d'un humain. "ok" = acceptable. confidence entre 0 et 1.`;
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${MISTRAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: text }],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 200,
    }),
  });
  if (!res.ok) throw new Error('mistral ' + res.status);
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || '{}';
  const p = JSON.parse(raw);
  return {
    verdict: String(p.verdict || 'review'),
    category: String(p.category || '?'),
    confidence: Number(p.confidence) || 0,
    reason: String(p.reason || ''),
  };
}

const TABLE: Record<string, string> = { comment: 'comments', message: 'messages' };
const TYPE_LABEL: Record<string, string> = { comment: 'Commentaire', message: 'Message privé' };

type Row = { id: string; content_type: string; content_id: string; content_text: string | null; ai: Verdict };

async function buildHtml(autoHidden: Row[], toReview: Row[]): Promise<string> {
  const link = (id: string, action: string, token: string) =>
    `${SUPABASE_URL}/functions/v1/mod-action?id=${id}&action=${action}&token=${token}`;

  const reviewCards = await Promise.all(toReview.map(async r => {
    const tk = await tokenFor(r.id);
    return `
    <div style="background:#111F32;border-radius:12px;padding:16px;margin-top:12px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="color:#E5B567;font-size:11px;font-weight:700">${esc(TYPE_LABEL[r.content_type] || r.content_type)} · à vérifier</span>
        <span style="color:#9aa;font-size:11px">${esc(r.ai.category)} · ${Math.round(r.ai.confidence * 100)}%</span>
      </div>
      <div style="color:#EDE4CF;font-size:14px;margin-top:8px;line-height:1.5;white-space:pre-wrap">« ${esc(r.content_text)} »</div>
      <div style="color:#9aa;font-size:11px;margin-top:6px;font-style:italic">${esc(r.ai.reason)}</div>
      <div style="margin-top:12px">
        <a href="${link(r.id, 'hide', tk)}" style="display:inline-block;background:#E8312A;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:8px;margin-right:8px">Masquer ✓</a>
        <a href="${link(r.id, 'keep', tk)}" style="display:inline-block;background:#1d3550;color:#EDE4CF;text-decoration:none;font-size:13px;font-weight:600;padding:8px 16px;border-radius:8px">Garder ✗</a>
      </div>
    </div>`;
  }));

  const hiddenCards = await Promise.all(autoHidden.map(async r => {
    const tk = await tokenFor(r.id);
    return `
    <div style="background:#111F32;border-radius:12px;padding:16px;margin-top:12px;border-left:3px solid #E8312A">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="color:#ff9b9b;font-size:11px;font-weight:700">${esc(TYPE_LABEL[r.content_type] || r.content_type)} · masqué auto 🔒</span>
        <span style="color:#9aa;font-size:11px">${esc(r.ai.category)} · ${Math.round(r.ai.confidence * 100)}%</span>
      </div>
      <div style="color:#EDE4CF;font-size:14px;margin-top:8px;line-height:1.5;white-space:pre-wrap">« ${esc(r.content_text)} »</div>
      <div style="color:#9aa;font-size:11px;margin-top:6px;font-style:italic">${esc(r.ai.reason)}</div>
      <div style="margin-top:12px">
        <a href="${link(r.id, 'unhide', tk)}" style="display:inline-block;background:#1d3550;color:#EDE4CF;text-decoration:none;font-size:13px;font-weight:600;padding:8px 16px;border-radius:8px">Réafficher (erreur ?)</a>
      </div>
    </div>`;
  }));

  return `
  <div style="background:#07101E;padding:24px;font-family:Helvetica,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#0C1828;border-radius:16px;padding:28px;border:1px solid rgba(240,234,216,0.12)">
      <div style="font-size:20px;color:#F0EAD8;font-weight:300;letter-spacing:2px">WEARAURA</div>
      <div style="font-size:14px;color:#F0EAD8;margin-top:4px;font-weight:600">🛡️ Modération — contenus signalés</div>
      <div style="font-size:12px;color:#9aa;margin-top:2px">${autoHidden.length} masqué(s) automatiquement · ${toReview.length} à vérifier</div>

      ${toReview.length ? `<div style="color:#E5B567;font-size:12px;font-weight:700;margin-top:20px;text-transform:uppercase">À vérifier — ton avis</div>${reviewCards.join('')}` : ''}
      ${autoHidden.length ? `<div style="color:#ff9b9b;font-size:12px;font-weight:700;margin-top:20px;text-transform:uppercase">Masqués automatiquement</div>${hiddenCards.join('')}` : ''}

      <div style="margin-top:18px;padding:12px 14px;background:#111F32;border-radius:10px;font-size:12px;color:#9aa;line-height:1.6">
        Le masquage est <b style="color:#EDE4CF">réversible</b> : rien n'est supprimé, aucun compte n'est banni. Un clic sur un bouton ouvre une page de confirmation.
      </div>
      <div style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(240,234,216,0.1);font-size:11px;color:#6b7785">
        WearAura · Modération · ${esc((new Date()).toISOString().slice(0, 10))}
      </div>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (jwtRole(req.headers.get('Authorization') ?? '') !== 'service_role') {
    return new Response('Forbidden', { status: 403 });
  }
  if (!MISTRAL_KEY || !RESEND_API_KEY || !REPORT_EMAIL || !REPORT_TOKEN) {
    return new Response(JSON.stringify({ error: 'Config manquante' }), { status: 500 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: reports, error } = await sb
    .from('content_reports').select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const autoHidden: Row[] = [];
  const toReview: Row[] = [];
  const nowIso = new Date().toISOString();

  for (const r of reports || []) {
    let c: Verdict;
    try { c = await classify(r.content_text || ''); }
    catch { continue; } // Mistral indispo → on laisse en pending, retenté au prochain run
    const tbl = TABLE[r.content_type];

    if (c.verdict === 'violation' && c.confidence >= AUTO_HIDE_THRESHOLD) {
      if (tbl) await sb.from(tbl).update({ hidden: true, hidden_reason: 'auto:' + c.category, hidden_at: nowIso }).eq('id', r.content_id);
      await sb.from('content_reports').update({ status: 'auto_hidden', ai_verdict: c.verdict, ai_category: c.category, ai_confidence: c.confidence }).eq('id', r.id);
      autoHidden.push({ ...r, ai: c });
    } else if (c.verdict === 'ok') {
      await sb.from('content_reports').update({ status: 'dismissed', ai_verdict: 'ok', ai_category: c.category, ai_confidence: c.confidence }).eq('id', r.id);
    } else {
      // review, ou violation peu sûre → file d'attente humaine (ne sera pas re-traité)
      await sb.from('content_reports').update({ status: 'needs_review', ai_verdict: 'review', ai_category: c.category, ai_confidence: c.confidence }).eq('id', r.id);
      toReview.push({ ...r, ai: c });
    }
  }

  if (!autoHidden.length && !toReview.length) {
    return new Response(JSON.stringify({ processed: (reports || []).length, sent: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const html = await buildHtml(autoHidden, toReview);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: REPORT_FROM,
      to: [REPORT_EMAIL],
      subject: `🛡️ WearAura — ${autoHidden.length} masqué(s), ${toReview.length} à vérifier`,
      html,
    }),
  });
  const out = await res.text();
  if (!res.ok) return new Response(JSON.stringify({ error: 'resend', detail: out }), { status: 502 });

  return new Response(JSON.stringify({ sent: true, auto_hidden: autoHidden.length, to_review: toReview.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
