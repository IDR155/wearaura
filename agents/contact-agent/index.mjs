// ═══════════════════════════════════════════════════════════════
// WearAura — Agent contact@ (brouillons de réponse)
// Tourne via GitHub Actions (planifié). Se connecte en IMAP à la boîte
// contact@wearaura.fr (OVH/Zimbra), lit les NOUVEAUX mails (non lus),
// les classe + rédige une réponse complète avec Mistral, et envoie le
// brouillon au fondateur via Resend (avec un lien ✉️ Répondre pré-rempli).
//
// ⚠️ NE RÉPOND JAMAIS TOUT SEUL : c'est toi qui relis et envoies.
//
// Variables d'env (secrets GitHub) :
//   IMAP_HOST (ex: ssl0.ovh.net), IMAP_USER (contact@wearaura.fr), IMAP_PASS
//   MISTRAL_KEY, RESEND_API_KEY, REPORT_EMAIL, REPORT_FROM (optionnel)
// ═══════════════════════════════════════════════════════════════
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const {
  IMAP_HOST, IMAP_USER, IMAP_PASS,
  MISTRAL_KEY, RESEND_API_KEY, REPORT_EMAIL,
} = process.env;
const REPORT_FROM = process.env.REPORT_FROM || 'WearAura <onboarding@resend.dev>';
const MAX_PER_RUN = 10;

for (const [k, v] of Object.entries({ IMAP_HOST, IMAP_USER, IMAP_PASS, MISTRAL_KEY, RESEND_API_KEY, REPORT_EMAIL })) {
  if (!v) { console.error('Secret manquant :', k); process.exit(1); }
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CAT = {
  partenariat: { label: '🤝 Partenariat', color: '#E5B567' },
  signalement: { label: '🚩 Signalement', color: '#E8312A' },
  presse: { label: '📰 Presse', color: '#7FA8C9' },
  spam: { label: '🗑️ Spam probable', color: '#6b7785' },
  autre: { label: '💬 Autre', color: '#9aa' },
};

async function classifyAndDraft(fromName, subject, body) {
  const sys = `Tu es l'assistant de WearAura, une application de mode communautaire éthique. On te transmet un e-mail reçu à contact@wearaura.fr.
1) Classe-le dans EXACTEMENT une de ces catégories : "partenariat", "signalement", "presse", "spam", "autre".
2) Rédige une réponse COMPLÈTE en français, professionnelle et chaleureuse, prête à être envoyée : formule d'appel adaptée, corps qui répond au message, et signature « — L'équipe WearAura ». Si c'est du spam évident, rédige une réponse polie très courte (ou indique que ça ne nécessite pas de réponse).
Réponds UNIQUEMENT en JSON strict : {"category":"...","draft":"..."}.`;
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${MISTRAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: `De : ${fromName}\nObjet : ${subject}\n\n${body}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 700,
    }),
  });
  if (!res.ok) throw new Error('mistral ' + res.status + ' ' + (await res.text()).slice(0, 200));
  const data = await res.json();
  const p = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
  const category = CAT[String(p.category || '').toLowerCase()] ? String(p.category).toLowerCase() : 'autre';
  return { category, draft: String(p.draft || '').trim() };
}

async function sendDraft({ fromAddr, fromName, subject, snippet, category, draft }) {
  const cat = CAT[category] || CAT.autre;
  const mailto = `mailto:${fromAddr}?subject=${encodeURIComponent('Re: ' + subject)}&body=${encodeURIComponent(draft)}`;
  const html = `
  <div style="background:#07101E;padding:24px;font-family:Helvetica,Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#0C1828;border-radius:16px;padding:28px;border:1px solid rgba(240,234,216,0.12)">
      <div style="font-size:20px;color:#F0EAD8;font-weight:300;letter-spacing:2px">WEARAURA</div>
      <div style="font-size:14px;color:#F0EAD8;margin-top:4px;font-weight:600">📨 Nouveau mail à contact@wearaura.fr</div>

      <div style="margin-top:16px;background:#111F32;border-radius:12px;padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="display:inline-block;background:${cat.color};color:#07101E;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px">${cat.label}</span>
        </div>
        <div style="color:#EDE4CF;font-size:14px;margin-top:10px"><b>De :</b> ${esc(fromName)} &lt;${esc(fromAddr)}&gt;</div>
        <div style="color:#EDE4CF;font-size:14px;margin-top:4px"><b>Objet :</b> ${esc(subject)}</div>
        <div style="color:#9aa;font-size:13px;margin-top:8px;line-height:1.5;white-space:pre-wrap">${esc(snippet)}</div>
      </div>

      <div style="margin-top:12px;background:#0a1422;border:1px dashed rgba(229,181,103,0.4);border-radius:12px;padding:16px">
        <div style="color:#E5B567;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">✍️ Brouillon de réponse (suggéré)</div>
        <div style="color:#EDE4CF;font-size:14px;margin-top:8px;line-height:1.6;white-space:pre-wrap">${esc(draft)}</div>
        <div style="margin-top:14px">
          <a href="${esc(mailto)}" style="display:inline-block;background:#E5B567;color:#07101E;text-decoration:none;font-size:14px;font-weight:700;padding:10px 20px;border-radius:8px">✉️ Répondre à ${esc(fromAddr)}</a>
        </div>
      </div>

      <div style="margin-top:18px;padding:12px 14px;background:#111F32;border-radius:10px;font-size:12px;color:#9aa;line-height:1.6">
        Brouillon <b style="color:#EDE4CF">suggéré par IA</b> — relis et ajuste avant d'envoyer. Le bouton ✉️ ouvre ton client mail avec la réponse pré-remplie. Rien n'est envoyé automatiquement.
      </div>
    </div>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: REPORT_FROM,
      to: [REPORT_EMAIL],
      reply_to: fromAddr || undefined,
      subject: `📨 contact@ — ${cat.label} — ${subject}`.slice(0, 120),
      html,
    }),
  });
  if (!res.ok) throw new Error('resend ' + res.status + ' ' + (await res.text()).slice(0, 200));
}

const client = new ImapFlow({
  host: IMAP_HOST, port: 993, secure: true,
  auth: { user: IMAP_USER, pass: IMAP_PASS },
  logger: false,
});

await client.connect();
const lock = await client.getMailboxLock('INBOX');
let processed = 0;
try {
  const uids = await client.search({ seen: false }, { uid: true });
  const slice = (uids || []).slice(0, MAX_PER_RUN);
  for (const uid of slice) {
    let item;
    try {
      const msg = await client.fetchOne(uid, { source: true }, { uid: true });
      const parsed = await simpleParser(msg.source);
      const fromAddr = parsed.from?.value?.[0]?.address || '';
      const fromName = parsed.from?.value?.[0]?.name || parsed.from?.text || fromAddr;
      const subject = parsed.subject || '(sans objet)';
      const rawBody = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ') : '') || '';
      const body = rawBody.replace(/\s+\n/g, '\n').trim().slice(0, 4000);
      const { category, draft } = await classifyAndDraft(fromName, subject, body);
      item = { fromAddr, fromName, subject, snippet: body.slice(0, 600), category, draft };
    } catch (e) {
      console.error('Erreur analyse uid', uid, '-', e.message);
      continue; // on laisse le mail NON lu pour réessayer au prochain run
    }
    try {
      await sendDraft(item);
    } catch (e) {
      console.error('Erreur envoi brouillon uid', uid, '-', e.message);
      continue; // non lu → réessai
    }
    // Brouillon envoyé → on marque le mail comme lu pour ne pas le retraiter
    await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
    processed++;
  }
} finally {
  lock.release();
  await client.logout();
}
console.log('Brouillons préparés :', processed);
