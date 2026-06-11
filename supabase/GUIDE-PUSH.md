# Guide — Activer le push de ré-engagement (4 étapes, ~10 min)

Le code frontend est déjà déployé avec l'app. Il reste 4 étapes côté Supabase,
toutes dans le Dashboard ([supabase.com/dashboard](https://supabase.com/dashboard) → projet WearAura).

## Étape 1 — Les 3 secrets VAPID

Dashboard → **Edge Functions** → **Secrets** → ajouter :

| Nom | Valeur |
|---|---|
| `VAPID_PUBLIC_KEY` | voir `_dev/VAPID-PRIVATE-KEY.txt` |
| `VAPID_PRIVATE_KEY` | voir `_dev/VAPID-PRIVATE-KEY.txt` |
| `VAPID_SUBJECT` | `mailto:contact@wearaura.fr` |

Une fois enregistrés, supprime le fichier `_dev/VAPID-PRIVATE-KEY.txt`.

## Étape 2 — Déployer l'Edge Function

Dashboard → **Edge Functions** → **Deploy a new function** :
- Nom : `push-reengage`
- Colle le contenu de `supabase/functions/push-reengage/index.ts`
- Deploy

## Étape 3 — Exécuter le SQL

Dashboard → **SQL Editor** → nouvelle requête :
1. Ouvre `supabase/push-reengagement.sql`
2. **Remplace `SERVICE_ROLE_KEY_ICI`** par ta clé service_role
   (Dashboard → Settings → API → `service_role` → Reveal)
3. Colle le tout et Run

Ça crée : la colonne `last_seen`, la table `push_subscriptions` (avec RLS),
et le cron du lundi 18h UTC.

## Étape 4 — Tester

1. Ouvre l'app sur ton téléphone (version installée), accepte les notifications
   si demandé → ta souscription s'enregistre automatiquement
2. Vérifie dans Dashboard → Table Editor → `push_subscriptions` : une ligne doit apparaître
3. Pour tester l'envoi sans attendre lundi, dans SQL Editor :

```sql
-- Force ton profil comme "inactif depuis 8 jours"
update profiles set last_seen = now() - interval '8 days' where id = auth.uid();
```

puis appelle la fonction depuis SQL Editor :

```sql
select net.http_post(
  url     := 'https://whaxwmztbkgnfokuqlcc.supabase.co/functions/v1/push-reengage',
  headers := jsonb_build_object('Content-Type','application/json',
             'Authorization','Bearer TA_CLE_SERVICE_ROLE'),
  body    := '{}'::jsonb
);
```

Tu dois recevoir la notification sur ton téléphone (app fermée).

## Comment ça marche ensuite

- Chaque ouverture de l'app met à jour `last_seen`
- Tous les lundis 18h UTC, les utilisateurs inactifs depuis 7+ jours reçoivent
  **une seule** notification douce (3 messages en rotation)
- Jamais plus d'1 par semaine par appareil (`last_reengage_at`)
- Les souscriptions expirées sont nettoyées automatiquement
