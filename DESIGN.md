---
name: WearAura
description: La première app sociale qui allie partage de looks et découverte éthique.
colors:
  midnight-encre: "#07101E"
  deep-midnight: "#0C1828"
  ink-navy: "#111F32"
  creme-de-mode: "#F0EAD8"
  creme-lumiere: "#F7F2E8"
  editorial-cream: "#EDE4CF"
  muted-cream: "#EDE4CF"
  gold-border: "#4A4035"
typography:
  display:
    fontFamily: "'Cormorant Garamond', Georgia, serif"
    fontSize: "19px–32px"
    fontWeight: 300
    letterSpacing: "0.5px"
    lineHeight: 1.2
  body:
    fontFamily: "'Montserrat', system-ui, sans-serif"
    fontSize: "13px–15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Montserrat', system-ui, sans-serif"
    fontSize: "9px–11px"
    fontWeight: 600
    letterSpacing: "2px"
    lineHeight: 1.2
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  pill: "50px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.creme-de-mode}"
    textColor: "{colors.midnight-encre}"
    rounded: "{rounded.sm}"
    padding: "13px 16px"
  button-primary-hover:
    backgroundColor: "{colors.creme-lumiere}"
    textColor: "{colors.midnight-encre}"
  button-ghost:
    backgroundColor: "rgba(240,234,216,0.08)"
    textColor: "{colors.editorial-cream}"
    rounded: "{rounded.pill}"
    padding: "9px 20px"
  nav-pill:
    backgroundColor: "rgba(17,30,48,0.88)"
    rounded: "{rounded.pill}"
    padding: "10px 6px"
  chip:
    backgroundColor: "rgba(240,234,216,0.08)"
    textColor: "{colors.muted-cream}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  chip-active:
    backgroundColor: "{colors.creme-de-mode}"
    textColor: "{colors.midnight-encre}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  input:
    backgroundColor: "rgba(237,228,207,0.08)"
    textColor: "{colors.editorial-cream}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
---

# Design System: WearAura

## 1. Overview

**Creative North Star: "The Ivory Atelier"**

WearAura est un atelier chaud et habitable — pas un showroom froid, pas une marketplace. Le fond est profondément sombre (presque bleu nuit d'encre), non pas pour signaler le "premium dark mode tech", mais parce que les vêtements photographiés ressortent mieux sur du sombre, comme des pièces exposées dans une boutique éclairée en nocturne. Sur ce fond, la Crème de Mode (#F0EAD8) est le seul vrai accent : chaud, ivoiré, jamais criard. Cormorant Garamond apporte le geste éditorial ; Montserrat assure la lisibilité communautaire.

Le système refuse délibérément deux pièges : la sécurité fade des apps éco corporate (vert partout, ton moralisateur, design inoffensif) et la surcharge visuelle TikTok (animations agressives, UI optimisée pour l'addiction). WearAura est sérieuse sans être froide, communautaire sans être bruyante. L'éthique est dans le produit, jamais dans le discours.

**Key Characteristics:**
- Fond tricolore sombre (Midnight Encre → Deep Midnight → Ink Navy) créant une profondeur atmosphérique sans recourir aux ombres
- Un seul accent chromatique : Crème de Mode (#F0EAD8), utilisé avec parcimonie
- Typographie bipolaire : Cormorant Garamond pour l'éditorial, Montserrat pour l'opérationnel
- Interactions tactiles immédiates (scale on :active, easing exponentiel, jamais de bounce)
- Pas de vert "éco", pas de dégradés de texte, pas de glassmorphisme décoratif

## 2. Colors: La Palette Nocturne

La palette est construite sur une progression du plus sombre au plus clair, avec un unique accent ivoire chaud.

### Primary
- **Crème de Mode** (#F0EAD8): L'accent central de WearAura. Utilisé pour les CTAs primaires, les icônes actives dans la nav, les labels VOIR PLUS, les bordures de highlights. Jamais comme couleur de fond étendue. Sa rareté est son pouvoir.
- **Crème Lumière** (#F7F2E8): Version légèrement plus claire de la Crème de Mode. Hover des boutons primaires, état actif des chips, titre du splash screen.

### Neutral
- **Midnight Encre** (#07101E): Le fond le plus profond — body, écran de connexion, fond global. Légèrement teinté bleu nuit pour ne jamais être un noir pur.
- **Deep Midnight** (#0C1828): Second niveau de fond — écran de recherche, second plan de modales.
- **Ink Navy** (#111F32): Troisième niveau — fond des slides feed, cartes de contenu. La différence avec Deep Midnight est subtile mais crée de la profondeur.
- **Editorial Cream** (#EDE4CF): Texte principal sur fond sombre. Jamais blanc pur (#fff est prohibé).
- **Muted Cream** (rgba(237,228,207,0.65)): Texte secondaire, labels de navigation inactive, descriptions.

### Named Rules
**La Règle de l'Accent Unique.** La Crème de Mode (#F0EAD8) est le seul accent sur toute surface. Elle apparaît sur ≤15% d'un écran donné. Plus elle est rare, plus elle attire l'œil. Toute utilisation décorative supplémentaire la dilue.

**La Règle du Fond Teinté.** Aucun fond ne peut être #000 ou #fff pur. Chaque noir doit tirer vers le bleu nuit ; chaque blanc vers l'ivoire chaud.

## 3. Typography

**Display Font:** Cormorant Garamond (avec Georgia, serif en fallback)
**Body Font:** Montserrat (avec system-ui, sans-serif en fallback)

**Character:** Un contraste délibéré entre le geste aristocratique de Cormorant Garamond (éditorial, fashion, intemporel) et la lisibilité dense de Montserrat (communauté, action, fonctionnel). Ensemble, ils évitent le double écueil : trop luxe sans chaleur, trop neutre sans personnalité.

### Hierarchy
- **Display** (400, 28–32px, line-height 1.2, letter-spacing 0.5px): Titres des profils, noms d'utilisateurs dans le feed, titres de sections éditoriales. Toujours en Cormorant Garamond, jamais en gras.
- **Headline** (300–400, 20–24px, line-height 1.25): Titres de sections (Explore, Shop), onboarding, écrans de bienvenue.
- **Body** (400, 13–15px, line-height 1.5): Captions du feed, messages DM, descriptions de produits. Max 65ch.
- **Label** (600, 9–11px, letter-spacing 2px, uppercase): Navigation labels (cachés par défaut), VOIR PLUS, boutons de filtres, actions CTA secondaires. Toujours Montserrat, toujours uppercase.

### Named Rules
**La Règle des Deux Registres.** Cormorant Garamond pour l'identité (qui tu es, ce que tu portes). Montserrat pour l'action (ce que tu fais, où tu vas). Ne jamais mélanger les deux dans le même composant fonctionnel.

## 4. Elevation

WearAura utilise la **stratification tonale** comme principal outil de profondeur — trois niveaux de fond (#07101E → #0C1828 → #111F32) créent la hiérarchie visuelle sans recourir aux ombres lourdes. Les ombres existent mais sont réservées aux éléments flottants.

### Shadow Vocabulary
- **Flottant** (`box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)`): Nav pill flottante, bottom sheets, modales. Atmosphérique, jamais structurel.
- **Subtil interne** (`inset 0 1px 0 rgba(240,234,216,0.08)`): Séparateur lumineux interne sur la nav pill — simule une surface de verre légèrement rétroéclairée.
- **Glow accent** (`0 4px 20px rgba(240,234,216,0.4)`): Bouton central de la nav (+). Utilisé une seule fois dans l'interface.
- **Flat par défaut**: Toutes les surfaces au repos sont sans ombre. Les ombres apparaissent uniquement sur les éléments flottants ou en réponse à un état (drawer ouvert, modal visible).

### Named Rules
**La Règle du Plat Par Défaut.** Les cartes, chips, inputs et composants statiques n'ont pas d'ombre. La profondeur vient du fond tricolore. Les ombres sont réservées aux éléments qui "décollent" de la surface — nav pill, drawers, modales.

## 5. Components

### Buttons

Raffinés dans la forme, directs dans l'action. Jamais de gradients criards — la Crème de Mode est le seul vrai fond de bouton.

- **Shape:** Gently curved (8px radius — `--rs`) pour les boutons pleine largeur ; pill (50px) pour les actions contextuelles
- **Primary:** Fond gradient ivoire (`linear-gradient(135deg, #c8c2b4, #F0EAD8, #F7F2E8)`), texte Midnight Encre, padding 13px, letter-spacing 3px uppercase Montserrat
- **Ghost:** Fond `rgba(240,234,216,0.08)`, bordure `rgba(240,234,216,0.28)`, pill, texte Editorial Cream
- **Active State:** `transform: scale(0.97)` + `opacity: 0.88` avec easing `cubic-bezier(0.23,1,0.32,1)` en 140ms. Obligatoire sur tout élément pressable.
- **Hover (desktop):** `opacity: 0.88` uniquement, protégé par `@media(hover: hover)`.

### Chips / Filtres

- **Style:** Pill (50px), fond `rgba(240,234,216,0.08)`, bordure `rgba(240,234,216,0.28)`, texte Muted Cream, 10px font-size, letter-spacing 1px uppercase
- **Active:** Fond Crème de Mode, texte Midnight Encre, bordure Crème de Mode
- **Active:** `transform: scale(0.95)` sur press

### Navigation (Bottom Pill)

Le composant signature de WearAura.

- **Style:** Position fixed, `bottom: 6px`, marges gauche/droite 20px, pill complète (50px radius), fond `rgba(17,30,48,0.88)` avec `backdrop-filter: blur(28px)`, bordure `rgba(240,234,216,0.14)`
- **Icônes inactives:** Stroke `rgba(245,240,232,0.45)`, 24×24px, stroke-width 1.8
- **Icônes actives:** Stroke Crème de Mode
- **Bouton central (+):** 50×50px, fond gradient ivoire, ombre glow accent, scale(0.88) on press
- **Press feedback:** Icônes — `scale(0.84) opacity(0.6)` en 140ms WearAura curve

### Inputs / Champs

- **Style:** Fond `rgba(237,228,207,0.08)`, bordure `rgba(240,234,216,0.28)`, radius 10px, padding 10×14px, font Montserrat 13px
- **Focus:** `border-color: #F0EAD8` (Crème de Mode), transition 300ms
- **Placeholder:** `rgba(245,240,232,0.3)`

### Cards / Conteneurs

- **Corner Style:** Légèrement arrondis (12–16px selon contexte)
- **Background:** Ink Navy (#111F32) ou Deep Midnight (#0C1828) selon la profondeur souhaitée
- **Shadow Strategy:** Plat par défaut (voir Règle du Plat Par Défaut)
- **Border:** `rgba(240,234,216,0.10–0.15)` — subtil, jamais structurant
- **Internal Padding:** 12–16px

### Feed Slide (Composant Signature)

- Image plein écran en `object-fit: contain` sur fond Ink Navy — les flat-lays gardent leurs proportions sans crop
- Gradient overlay `rgba(0,0,0,0.25) → transparent → rgba(0,0,0,0.65)` — lisibilité du texte sans masquer l'image
- Username en Cormorant Garamond 19px, caption en Montserrat 15px, VOIR PLUS en Crème de Mode uppercase 12px
- Boutons d'action : scale(0.90) on press, SVG stroke blanc avec drop-shadow

## 6. Do's and Don'ts

### Do
- **Do** utiliser `transform: scale(0.97)` sur tous les éléments pressables — le feedback tactile est obligatoire, jamais optionnel.
- **Do** utiliser Cormorant Garamond pour les noms d'utilisateurs, titres éditoriaux et identités de profil.
- **Do** garder la Crème de Mode (#F0EAD8) sur ≤15% de l'écran — sa rareté est ce qui lui donne son pouvoir d'attraction.
- **Do** respecter le fond tricolore (Midnight Encre → Deep Midnight → Ink Navy) pour créer la profondeur sans ombres.
- **Do** utiliser `cubic-bezier(0.23,1,0.32,1)` comme courbe d'easing standard pour toutes les interactions UI (WearAura curve).
- **Do** protéger les hover states derrière `@media(hover: hover) and (pointer: fine)` — les écrans touch déclenchent faussement les hovers.
- **Do** animer uniquement `transform` et `opacity` pour les animations continues — jamais `box-shadow`, `width`, `height`, `padding`.
- **Do** maintenir un contraste WCAG AA minimum pour tout texte sur fond sombre.

### Don't
- **Don't** utiliser le vert comme couleur d'accent ou de validation — pas de bannières vertes, pas de "badge éco", pas de checkmarks verts. L'éthique est silencieuse chez WearAura.
- **Don't** créer des grids de cards identiques (icône + titre + texte × N). C'est le design SaaS générique que WearAura refuse explicitement.
- **Don't** ajouter des animations sur les actions répétées au clavier ou keyboard-initiated. Les actions fréquentes doivent être instantanées.
- **Don't** utiliser du glassmorphisme décorativement — le backdrop-filter est réservé à la nav pill et aux drawers fonctionnels.
- **Don't** imiter le design TikTok : pas de surcharge d'animations, pas de notifications agressives, pas d'UI pensée pour l'addiction.
- **Don't** imiter les apps fast fashion (Shein, Zara app) : pas de scroll commercial infini, pas d'optimisation pour l'achat impulsif.
- **Don't** imiter les apps éco corporate : pas de ton moralisateur, pas de vert partout, pas de design "sécurisé et inoffensif".
- **Don't** utiliser `#000` ou `#fff` purs — chaque noir tire vers le bleu nuit, chaque blanc vers l'ivoire.
- **Don't** utiliser du gradient text (`background-clip: text`) — c'est décoratif et illisible. Une couleur solide, toujours.
- **Don't** placer des cards dans des cards — la hiérarchie de fond (tricolore) suffit à structurer l'information.
- **Don't** ouvrir une modale en première réponse à un problème UX — épuise les alternatives inline ou progressives d'abord.
