// ═══════════════════════════════════════════════════════════════
// WearAura — Edge Function : push temps réel sur nouvelle notification
// Déclenchée par un trigger Postgres AFTER INSERT sur public.notifications
// (voir push-notify.sql). Envoie un web-push au destinataire, app fermée,
// en respectant ses préférences (notif_likes / notif_follows) et sa langue.
//
// Secrets requis (Dashboard → Edge Functions → Secrets) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@wearaura.fr';

// Décode le rôle d'un JWT Supabase sans vérifier la signature
// (le gateway Supabase l'a déjà validée si "Verify JWT" est activé).
function jwtRole(authHeader: string): string {
  try {
    const tok = (authHeader || '').replace(/^Bearer\s+/i, '').trim();
    let b64 = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=');
    return (JSON.parse(atob(b64)) as { role?: string })?.role ?? '';
  } catch {
    return '';
  }
}

// Texte localisé selon le type de notification.
function compose(type: string, name: string, lang: string): { title: string; body: string } {
  const fr = lang !== 'en';
  const T = 'WearAura';
  switch (type) {
    case 'like':
      return { title: T, body: fr ? `${name} a aimé ta publication` : `${name} liked your post` };
    case 'comment':
      return { title: T, body: fr ? `${name} a commenté ta publication` : `${name} commented on your post` };
    case 'follow':
      return { title: T, body: fr ? `${name} s'est abonné·e à toi` : `${name} started following you` };
    case 'follow_request':
      return { title: T, body: fr ? `${name} souhaite s'abonner à toi` : `${name} requested to follow you` };
    case 'message':
    case 'message_request':
      return { title: T, body: fr ? `${name} t'a envoyé un message` : `${name} sent you a message` };
    case 'badge_earned':
      return { title: T, body: fr ? 'Tu as débloqué un nouveau badge ✨' : 'You unlocked a new badge ✨' };
    default:
      return { title: T, body: fr ? 'Tu as une nouvelle notification' : 'You have a new notification' };
  }
}

// Préférence qui gouverne chaque type (messages/badges = toujours envoyés).
function allowedByPrefs(
  type: string,
  prefs: { notif_likes?: boolean; notif_follows?: boolean },
): boolean {
  if (type === 'like' || type === 'comment') return prefs.notif_likes !== false;
  if (type === 'follow' || type === 'follow_request') return prefs.notif_follows !== false;
  return true;
}

const ok = (obj: unknown) =>
  new Response(JSON.stringify(obj), { headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (jwtRole(req.headers.get('Authorization') ?? '') !== 'service_role') {
    return new Response('Forbidden', { status: 403 });
  }
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: 'SERVICE_ROLE_KEY manquant' }), { status: 500 });
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(JSON.stringify({ error: 'VAPID secrets manquants' }), { status: 500 });
  }

  let row: Record<string, unknown>;
  try {
    row = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad json' }), { status: 400 });
  }

  const userId = row.user_id as string | undefined;
  const fromId = row.from_user_id as string | undefined;
  const type = (row.type as string | undefined) ?? '';
  if (!userId || !type) return ok({ skipped: 'no user/type' });
  if (fromId && fromId === userId) return ok({ skipped: 'self' });

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  // Préférences + langue du destinataire
  const { data: pref } = await sb
    .from('profiles').select('notif_likes,notif_follows,lang').eq('id', userId).maybeSingle();
  if (!allowedByPrefs(type, pref ?? {})) return ok({ skipped: 'pref off' });
  const lang = (pref?.lang as string) || 'fr';

  // Nom de l'auteur de l'action
  let name = lang === 'en' ? 'Someone' : 'Quelqu\'un';
  if (fromId) {
    const { data: actor } = await sb
      .from('profiles').select('username,full_name').eq('id', fromId).maybeSingle();
    name = actor?.username || actor?.full_name || name;
  }

  const msg = compose(type, name, lang);
  const url = (type === 'message' || type === 'message_request') ? '/?tab=notif' : '/?tab=notif';

  const { data: subs } = await sb
    .from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', userId);

  let sent = 0, removed = 0, failed = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ ...msg, url }),
      );
      sent++;
    } catch (err) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        await sb.from('push_subscriptions').delete().eq('id', s.id);
        removed++;
      } else {
        failed++;
      }
    }
  }
  return ok({ sent, removed, failed });
});
