---
target: "WearAura — index.html (full app)"
slug: index-html
date: 2026-06-01
total_score: 22
p0_count: 2
p1_count: 4
p2_count: 0
p3_count: 0
---

## Design Health Score

| # | Heuristique | Score | Problème clé |
|---|-------------|-------|--------------|
| 1 | Visibilité du statut système | 3/4 | Pas de skeleton feed ; état de publication = toast texte seulement |
| 2 | Correspondance monde réel | 3/4 | "Aura Points" jamais expliqué ; badge "APERÇU DÉMO" opaque |
| 3 | Contrôle et liberté | 2/4 | Pas de brouillon, pas d'annulation publication, long-press delete non découvrable |
| 4 | Cohérence et standards | 2/4 | Cœur liké = cobalt #1E4FD8, reste UI = ivoire — rupture totale de système |
| 5 | Prévention des erreurs | 2/4 | Pas de validation temps-réel sur auth, pas d'avertissement si quitter create en cours |
| 6 | Reconnaissance plutôt que rappel | 3/4 | Nav icons claires ; hotspot ripple indique la tappabilité |
| 7 | Flexibilité et efficacité | 1/4 | Zéro raccourcis, pas de flux galerie-first, create flow = 3 étapes obligatoires |
| 8 | Minimalisme esthétique | 3/4 | Système cohérent et distingué ; step 2 du create flow trop dense |
| 9 | Aide à la récupération d'erreur | 2/4 | Erreurs auth bien affichées ; caméra = écran statique sans retry |
| 10 | Aide et documentation | 1/4 | Zéro onboarding, zéro tooltip, FAQ enterrée dans settings |
| **Total** | | **22/40** | **En dessous de la moyenne — normal pour MVP** |

## Priority Issues

### [P0] Onboarding inexistant — rétention D1 proche de zéro
Nouveaux utilisateurs arrivent sur feed vide sans contexte. Aucune séquence first-run, aucun empty state éducatif, aucune explication du concept hotspot.
Fix: 3 slides onboarding post-inscription + empty state feed avec CTA create.

### [P0] Cœur liké cobalt #1E4FD8 — rupture design system
app.css:207 `.slide-action.liked svg{stroke:#1E4FD8;fill:#1E4FD8}` — couleur orpheline dans un système entièrement ivoire.
Fix: remplacer par `var(--gold)`.

### [P1] Notifications introuvables — rétention sociale cassée
Notifications réelles (likes, follows) dans panneau secondaire de l'écran Messages. Jamais découvertes par un utilisateur standard.
Fix: écran notifications dédié en position nav primaire.

### [P1] Boutique déconnectée du feed social
Alt-sheet et Boutique sont des silos séparés. Aucun lien produit→look, aucun lien look→boutique.
Fix: lien "Voir dans la Boutique" depuis alt-sheet + grille looks par marque en boutique.

### [P1] Flux Create bloqué par la caméra
Pas de chemin galerie-first. Sur HTTP ou desktop, le create flow est inaccessible ou dégradé.
Fix: deux tabs Caméra/Galerie dès l'entrée du create flow.

### [P1] Settings panel = right drawer — incohérent avec bottom sheets
Toute l'UI utilise des bottom sheets. Le Settings panel arrive par la droite. Rupture d'affordance.

## Minor Observations
- Bouton ✕ Settings encore en texte brut (index.html:782)
- `_ecoLeaves()` définie mais pas encore appelée (boutique.js:3)
- `📸` placeholder encore dans profile.js
- Bio default "Fashion. Ethics. Style. 🌿" hardcodée pour tous les nouveaux comptes (auth.js:29)
- Panel "Test IA locale" en production HTML — à supprimer ou conditionner à DEBUG
- `glowFade` animation infinie sur bouton + nav — impact batterie sur appareils lents
