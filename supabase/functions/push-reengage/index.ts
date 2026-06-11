// ═══════════════════════════════════════════════════════════════
// WearAura — Edge Function : push de ré-engagement hebdomadaire
// Cible : utilisateurs inactifs depuis 7 jours, max 1 notif/semaine.
// Déclenchée par le cron pg_cron 'wa-push-reengage' (voir push-reengagement.sql).
//
// Secrets requis (Dashboard → Edge Functions → Secrets) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@wearaura.fr';

// Ton réassurant, jamais agressif — charte WearAura : max 1/semaine
const MESSAGES = [
  { title: 'WearAura', body: 'De nouveaux looks dans ton style t’attendent ✨' },
  { title: 'WearAura', body: 'La communauté a publié de nouveaux looks cette semaine 👀' },
  { title: 'WearAura', body: 'Reviens découvrir les alternatives éthiques du moment 🌿' },
];

const INACTIVE_DAYS = 7;

Deno.serve(async (req) => {
  // Seul le cron (clé service_role) peut déclencher l'envoi
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  if (!serviceKey || !auth.includes(serviceKey)) {
    return new Response('Forbidden', { status: 403 });
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(JSON.stringify({ error: 'VAPID secrets manquants' }), { status: 500 });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
  const cutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 3600 * 1000).toISOString();

  // Utilisateurs inactifs (last_seen connu et vieux de 7 jours+)
  const { data: inactive, error: e1 } = await sb
    .from('profiles').select('id').lt('last_seen', cutoff);
  if (e1) return new Response(JSON.stringify({ error: e1.message }), { status: 500 });
  const ids = (inactive ?? []).map((p) => p.id);
  if (!ids.length) {
    return new Response(JSON.stringify({ sent: 0, reason: 'aucun inactif' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Leurs souscriptions, pas re-notifiées depuis 7 jours
  const { data: subs, error: e2 } = await sb
    .from('push_subscriptions')
    .select('id,endpoint,p256dh,auth')
    .in('user_id', ids)
    .or(`last_reengage_at.is.null,last_reengage_at.lt.${cutoff}`);
  if (e2) return new Response(JSON.stringify({ error: e2.message }), { status: 500 });

  let sent = 0, removed = 0, failed = 0;
  for (const s of subs ?? []) {
    const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ ...msg, url: '/?tab=feed' }),
      );
      sent++;
      await sb.from('push_subscriptions')
        .update({ last_reengage_at: new Date().toISOString() }).eq('id', s.id);
    } catch (err) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        // Souscription expirée/révoquée : on la supprime
        await sb.from('push_subscriptions').delete().eq('id', s.id);
        removed++;
      } else {
        failed++;
      }
    }
  }

  return new Response(JSON.stringify({ sent, removed, failed }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
