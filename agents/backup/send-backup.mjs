// ═══════════════════════════════════════════════════════════════
// WearAura — Envoi de la sauvegarde base par e-mail (Resend)
// Reçoit en argument le chemin d'un fichier .sql.gz (créé par pg_dump
// dans le workflow), l'attache et l'envoie au fondateur via Resend.
//
// Variables d'env : RESEND_API_KEY, REPORT_EMAIL, REPORT_FROM (optionnel)
// ═══════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const { RESEND_API_KEY, REPORT_EMAIL } = process.env;
const REPORT_FROM = process.env.REPORT_FROM || 'WearAura <onboarding@resend.dev>';
const file = process.argv[2] || 'backup.sql.gz';

if (!RESEND_API_KEY || !REPORT_EMAIL) {
  console.error('Secret manquant : RESEND_API_KEY ou REPORT_EMAIL');
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
const buf = readFileSync(file);
const sizeMB = buf.length / 1048576;
const content = buf.toString('base64');

// Resend limite la taille totale d'un e-mail (~40 Mo). Au-delà, on alerte.
if (sizeMB > 35) {
  console.error(`Sauvegarde trop volumineuse pour l'e-mail (${sizeMB.toFixed(1)} Mo). Il faudra passer à un stockage cloud.`);
  // On envoie quand même une alerte sans pièce jointe
}

const tooBig = sizeMB > 35;
const filename = `wearaura-backup-${date}.sql.gz`;

const html = `
<div style="font-family:Helvetica,Arial,sans-serif;background:#07101E;color:#EDE4CF;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#0C1828;border-radius:14px;padding:24px;border:1px solid rgba(240,234,216,.12)">
    <div style="font-size:18px;letter-spacing:2px;color:#F0EAD8">WEARAURA</div>
    <div style="margin-top:8px;font-weight:600">💾 Sauvegarde hebdomadaire de la base</div>
    ${tooBig
      ? `<div style="color:#ff9b9b;font-size:13px;margin-top:8px;line-height:1.6">⚠️ La base dépasse ${sizeMB.toFixed(1)} Mo : trop gros pour l'e-mail. La sauvegarde a été créée mais PAS jointe. Il faut passer à un stockage cloud (dis-le à ton assistant).</div>`
      : `<div style="color:#9aa;font-size:13px;margin-top:8px;line-height:1.6">Fichier joint : <b>${filename}</b> (${sizeMB.toFixed(2)} Mo).<br>Garde cet e-mail en lieu sûr (c'est ta copie de secours de toute l'app). Pour restaurer : décompresse le .gz puis importe le .sql dans une base PostgreSQL.</div>`}
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(240,234,216,.1);font-size:11px;color:#6b7785">WearAura · Sauvegarde · ${date}</div>
  </div>
</div>`;

const payload = {
  from: REPORT_FROM,
  to: [REPORT_EMAIL],
  subject: `💾 WearAura — sauvegarde base ${date}`,
  html,
};
if (!tooBig) payload.attachments = [{ filename, content }];

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
if (!res.ok) { console.error('resend', res.status, (await res.text()).slice(0, 300)); process.exit(1); }
console.log(`Sauvegarde envoyée (${sizeMB.toFixed(2)} Mo)${tooBig ? ' — SANS pièce jointe (trop gros)' : ''}`);
