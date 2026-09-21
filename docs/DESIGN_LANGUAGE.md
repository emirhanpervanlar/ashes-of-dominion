# Design Language — "Ashes of Dominion" visual system

Status: PROPOSAL from ui-ux for owner approval. Once approved it ranks with `DESIGN_BIBLE.md` (tier 2) and **supersedes the Bible's "three families" palette table and the "emoji" constraint**. Layout and behavior stay in `SCREEN_SPEC.md`; this file defines how everything looks. Reference mood: Heroes of Might and Magic 3 and Disciples: serious medieval, 90s pixel art, muted palette, stone / wood / parchment / iron / aged gold.

Constraints kept: no image files, no external art assets, everything is CSS, inline SVG, or code-generated pixel data. Desktop first, 1366x900. English copy.

---

## 1. Principles (8)

1. **Muted, never neon.** No colour has saturation above 60% except the two semantic accents at rest (blood red, verdigris green) and gold highlights. Saturation is reserved for things the player must react to (legal target, damage).
2. **Sharp and stepped.** `border-radius` is banned everywhere (0). Corners are cut in 4px steps (section 4). Circles exist only as pixel-drawn gems and portrait medallions built from stepped clip-paths.
3. **Every surface is a material.** Each element is stone, wood, parchment, iron or gold. Flat unexplained grey-blue panels do not exist. A material is a base colour plus a 2px light top-left edge and a 2px dark bottom-right edge (bevel) plus optional grain.
4. **One light source: top-left.** Highlights on top/left edges, shadows on bottom/right. Never reversed, on any component.
5. **Colour temperature is the map.** The player learns the screen from its tint: parchment = travel, warm stone and wood = safe town, cool dark stone = fight, near-black vault + gold = choice. Chrome (buttons, tooltips, popups) is identical everywhere and only borrows the screen's tint through tokens.
6. **Pixel crispness.** Icons and sprites are integer-scaled (16 -> 32 -> 48) with `image-rendering: pixelated`. Borders are 2px or 4px, text sizes sit on the 8px grid, no half-pixel positions, no blur except one hard drop shadow.
7. **Icons over words, icons never emoji.** State is an icon plus a number. Zero emoji or Unicode pictograph characters in the UI (plain typographic symbols such as `x`, `+`, `-`, `/` are fine).
8. **Restraint.** Ornament lives on frames (corners, plaques, rivets), never inside reading areas. Text on a surface must reach contrast 4.5:1 (body) / 3:1 (large). Prefer removing decoration to adding it.

---

## 2. Colour tokens

Define all of these in `:root` of `src/index.css`. Old tokens (`--bg --panel --panel-2 --border --text --text-dim --hp --hp-low --block --enemy --player --accent`) are deleted and every usage migrated (mapping in section 10).

```css
:root {
  color-scheme: dark;

  /* ---- Neutrals: stone (cool-neutral grey-brown), 9 steps, dark to light ---- */
  --stone-950: #0e0d0c;   /* page void, behind everything */
  --stone-900: #171512;   /* deepest panel */
  --stone-800: #221f1b;   /* panel base */
  --stone-700: #2e2a24;   /* raised panel */
  --stone-600: #3d3830;   /* borders, dividers */
  --stone-500: #544d42;   /* bevel light on dark, disabled fill */
  --stone-400: #746b5c;   /* dim text on dark, disabled text */
  --stone-300: #9a907d;   /* secondary text on dark */
  --stone-200: #c4baa4;   /* primary text on dark */
  --stone-100: #e6dcc3;   /* headings, emphasis on dark (bone white) */

  /* ---- Wood ---- */
  --wood-900: #1c130c;
  --wood-800: #2b1d11;
  --wood-700: #3c2916;
  --wood-600: #523821;
  --wood-500: #6b4a2b;    /* bevel light on wood */

  /* ---- Parchment (light material, dark ink text) ---- */
  --parch-100: #e3d3a8;   /* light spot */
  --parch-200: #d2bf8e;   /* base */
  --parch-300: #b9a271;   /* shade */
  --parch-400: #8f7a50;   /* stain / fold */
  --ink-900: #211a10;     /* text on parchment */
  --ink-700: #3e3222;     /* secondary text on parchment */

  /* ---- Iron ---- */
  --iron-900: #16181b;
  --iron-800: #23272b;
  --iron-700: #33393e;
  --iron-600: #4a5259;
  --iron-500: #66707a;    /* bevel light on iron */
  --iron-300: #9aa4ad;    /* rivet highlight */

  /* ---- Aged gold (accent 1: reward, selection, primary action) ---- */
  --gold-900: #3d2f0d;
  --gold-700: #7a5f1c;    /* gold shade */
  --gold-500: #b08d2e;    /* gold base */
  --gold-400: #cfa93f;    /* gold light */
  --gold-200: #ecd082;    /* gold highlight, plaque text */

  /* ---- Semantic (muted) ---- */
  --blood-900: #2a0f0d;
  --blood-700: #6e1f1a;   /* enemy trim, danger button fill */
  --blood-500: #9c2f26;   /* damage, enemy accent, danger */
  --blood-300: #cf6a58;   /* damage text on dark */

  --moss-900: #131f12;
  --moss-700: #2f4a26;
  --moss-500: #4f7a3a;    /* heal, success, positive buff */
  --moss-300: #8fb56b;    /* heal text on dark */

  --steel-900: #0f1a24;
  --steel-700: #21405a;   /* player trim, block base */
  --steel-500: #3f6f95;   /* block, player accent, info */
  --steel-300: #86b0cf;   /* block text on dark */

  --frost-500: #7fb7c4;   /* freeze (only ice/frozen use this) */
  --frost-200: #cfe8ec;
  --venom-500: #6f8a2a;   /* poison */
  --ember-500: #b5651d;   /* burn */
  --arcane-500: #6d4f96;  /* epic rarity, mage/arcane */

  /* ---- Accent 2: verdigris (UI selection / focus that is NOT reward) ---- */
  --teal-700: #1f4a48;
  --teal-500: #2f7a72;
  --teal-300: #7fbdb2;

  /* ---- Role tokens (what components use) ---- */
  --text: var(--stone-200);
  --text-strong: var(--stone-100);
  --text-dim: var(--stone-300);
  --text-faint: var(--stone-400);
  --text-on-parch: var(--ink-900);
  --text-on-parch-dim: var(--ink-700);
  --line: var(--stone-600);
  --focus: var(--gold-200);
  --danger: var(--blood-500);
  --heal: var(--moss-500);
  --block: var(--steel-500);
  --reward: var(--gold-400);
  --selectable: var(--gold-400);   /* legal target ring */
  --selected: var(--stone-100);    /* chosen unit ring */

  /* ---- Rarity ---- */
  --rar-common: var(--stone-300);
  --rar-uncommon: var(--moss-500);     /* cards only */
  --rar-rare: var(--steel-500);
  --rar-epic: var(--arcane-500);       /* relics: epic; cards: legendary maps here */

  /* ---- Per-screen tints (each screen root sets data-screen; see section 9) ---- */
  --tint-void: var(--stone-950);       /* page background */
  --tint-a: var(--stone-800);          /* surface field (large areas) */
  --tint-b: var(--stone-700);          /* surface raised */
  --tint-trim: var(--iron-600);        /* frame trim */
  --tint-glow: transparent;            /* ambient vignette colour */
}

[data-screen='title']    { --tint-void:#0c0b0a; --tint-a:#1a1613; --tint-b:#2b231c; --tint-trim:var(--gold-700);  --tint-glow:#3a2a12; }
[data-screen='hero']     { --tint-void:#0e0c0a; --tint-a:#221b15; --tint-b:#32271d; --tint-trim:var(--gold-700);  --tint-glow:#2f2312; }
[data-screen='map']      { --tint-void:#1a1509; --tint-a:var(--parch-200); --tint-b:var(--parch-300); --tint-trim:var(--wood-600); --tint-glow:#5a4520; }
[data-screen='city']     { --tint-void:#160f0a; --tint-a:#3b2e22; --tint-b:#4d3a28; --tint-trim:var(--wood-500); --tint-glow:#7a4a1c; }
[data-screen='battle']   { --tint-void:#0a0c0f; --tint-a:#171b20; --tint-b:#232a31; --tint-trim:var(--iron-600); --tint-glow:#10202c; }
[data-screen='vault']    { --tint-void:#08080a; --tint-a:#14131a; --tint-b:#201e27; --tint-trim:var(--gold-700); --tint-glow:#2a2210; } /* reward, merchant, event */
[data-screen='defeat']   { --tint-void:#0c0808; --tint-a:#1d1413; --tint-b:#2c1d1b; --tint-trim:var(--blood-700); --tint-glow:#3a1210; }
[data-screen='victory']  { --tint-void:#0b0a07; --tint-a:#1f1b12; --tint-b:#302a19; --tint-trim:var(--gold-500); --tint-glow:#4a3a12; }
```

Rules:
- Components read only role tokens and `--tint-*`. Raw palette steps (`--stone-600`) are allowed inside the **materials** (section 5) and component definitions, never in screen-specific CSS.
- No hex literal outside `:root` and the material snippets. `grep "#[0-9a-fA-F]\{3,6\}" src/index.css` outside `:root` must return only SVG data URIs.
- Text on `--stone-800` uses `--text` (contrast about 9:1); on parchment only `--ink-*`.

---

## 3. Typography

Three fonts, all verified on Google Fonts on 2026-09-19 (`fonts.googleapis.com/css2?family=MedievalSharp`, `Silkscreen:wght@400;700`, `Alegreya+Sans:wght@400;500;700` each returned HTTP 200 with `@font-face`; MedievalSharp has only weight 400). Silkscreen (uppercase-oriented pixel face) is used only for short labels and numbers, at 8/16/24px; MedievalSharp only for titles and names at 20px and up; Alegreya Sans carries everything read at 14-16px. Load in `index.html` with a single `<link>` and `display=swap`.

| Role | Family | Weights | Used for |
|---|---|---|---|
| **Display** (titles, plaques, hero/city names) | `MedievalSharp` | 400 | Game title, plaque banners, screen titles, card names, building names. Serious, sharp, blackletter-adjacent. |
| **Pixel** (labels, numbers, buttons) | `Silkscreen` | 400, 700 | Button labels, resource numbers, unit counts, cost gems, tab labels, stat abbreviations, uppercase micro-labels. Always uppercase or digits. |
| **Body** (reading text) | `Alegreya Sans` | 400, 500, 700 | Card rules text, tooltips, descriptions, event text, log lines, popups body, stats table values. |

```css
:root {
  --font-display: 'MedievalSharp', 'Georgia', serif;
  --font-pixel: 'Silkscreen', 'Courier New', monospace;
  --font-body: 'Alegreya Sans', 'Segoe UI', sans-serif;
}
body { font-family: var(--font-body); font-size: 16px; line-height: 24px; -webkit-font-smoothing: none; }
```

Size scale (px / line-height, all multiples of 8 for line-height; sizes 8-grid-adjacent because pixel font needs multiples of 8 to stay crisp):

| Token | Font | Size / LH | Use |
|---|---|---|---|
| `--t-title` | Display | 64 / 72 | Title screen logo only |
| `--t-h1` | Display | 40 / 48 | Screen banner (Victory, Defeat, road layer) |
| `--t-h2` | Display | 24 / 32 | Plaque title, popup title, building name, card name on large card |
| `--t-h3` | Display | 20 / 24 | Card name on hand card, list section header |
| `--t-label` | Pixel | 8 / 16 | Micro-labels: FRONT, BACK, EMPTY, group labels (uppercase, letter-spacing 1px, always at 8, 16 or 24; Silkscreen is drawn on an 8px grid) |
| `--t-btn` | Pixel | 16 / 24 | Button text |
| `--t-num` | Pixel | 16 / 16 (32 / 32 for big counts) | Resource numbers, unit count `x12`, cost gem |
| `--t-body` | Body | 16 / 24 | Default reading text, tooltips, descriptions |
| `--t-small` | Body | 14 / 16 | Secondary lines, log entries (only size not on the 8 grid; line-height is) |
| `--t-tip` | Body | 16 / 24 | Tooltip text |

Rules:
- Pixel font is never used for sentences longer than 3 words. Body font is never used for numbers that the player compares (counts, costs, gold): those are Pixel.
- Text-shadow only one form: `text-shadow: 0 2px 0 var(--stone-950)` on text that sits on textures. Parchment text has none.
- Numbers use `font-variant-numeric: tabular-nums` (body) and are right-aligned in lists.
- Maximum measure 56ch for body blocks. Uppercase only for Pixel font and plaque banners.
- Card rules text minimum 14px; never shrink text to fit — shorten the copy or grow the box.

---

## 4. Spacing, borders, corners, bevels

**Spacing scale** (`--s-1..--s-8`): 4, 8, 12, 16, 24, 32, 48, 64. Component padding is `--s-2` (8) minimum, panels `--s-4` (16). Icon sizes: 16, 24 (16 x1.5 not allowed) so use **16, 32, 48**; badges 16 (inside 24 medallion). Hit target minimum 32px height for any button.

**Borders:** only 2px (small controls, list rows, tooltips) or 4px (panels, popups, cards, buttons of size L). No 1px, no 3px. Border colour comes from materials (bevel: light top/left, dark bottom/right).

**No border-radius.** Lint rule: `border-radius` must not appear in `src/index.css` except `0`. Circular things are pixel-stepped (below).

**Stepped corner technique** (default for every panel/button/card): one clip-path, 4px step, plus a border faked with layered box-shadow inset (clip-path removes real borders at corners, so we draw the border with inset shadows).

```css
/* 4px stepped corners. Apply to any box. --c = corner step. */
.step {
  --c: 4px;
  clip-path: polygon(
    0 var(--c), var(--c) var(--c), var(--c) 0,
    calc(100% - var(--c)) 0, calc(100% - var(--c)) var(--c), 100% var(--c),
    100% calc(100% - var(--c)), calc(100% - var(--c)) calc(100% - var(--c)), calc(100% - var(--c)) 100%,
    var(--c) 100%, var(--c) calc(100% - var(--c)), 0 calc(100% - var(--c))
  );
}
.step-8 { --c: 8px; }   /* large panels, popups, plaques */
```

Because clip-path also clips outer `box-shadow`, drop shadows are done on a **wrapper**: `filter: drop-shadow(0 4px 0 var(--stone-950))` on the parent of the clipped element (`.step` inside `.shadowed`). Never put drop-shadow and clip-path on the same element.

**Bevel rule (inset, 2px):**
```css
.bevel-2 { box-shadow:
  inset 2px 2px 0 var(--bev-light),   /* top-left highlight */
  inset -2px -2px 0 var(--bev-dark);  /* bottom-right shadow */
}
.bevel-4 { box-shadow:
  inset 4px 4px 0 var(--bev-light),
  inset -4px -4px 0 var(--bev-dark),
  inset 0 0 0 4px transparent;
}
.bevel-in { box-shadow:                /* pressed / sunken (inputs, wells, art windows) */
  inset 2px 2px 0 var(--bev-dark),
  inset -2px -2px 0 var(--bev-light);
}
```
Each material sets `--bev-light` and `--bev-dark`. Sunken elements (art window, text input, list well) use `.bevel-in`.

**Shadows:** exactly two: `--shadow-1: 0 2px 0 rgba(0,0,0,.6)` (buttons, cards at rest), `--shadow-2: 0 4px 0 rgba(0,0,0,.7)` (popups, hovered card lift). Always hard, never blurred. Ambient vignettes are the only soft gradients (`radial-gradient` of `--tint-glow` to `--tint-void`) and only on screen backgrounds.

**Stepped circle** (gems, medallions): a 16-step polygon clip-path; class `.gem` uses:
```css
.gem { clip-path: polygon(25% 0,75% 0,75% 12.5%,87.5% 12.5%,87.5% 25%,100% 25%,100% 75%,87.5% 75%,87.5% 87.5%,75% 87.5%,75% 100%,25% 100%,25% 87.5%,12.5% 87.5%,12.5% 75%,0 75%,0 25%,12.5% 25%,12.5% 12.5%,25% 12.5%); }
```

**Layout grid:** 1366x900 viewport, outer safe margin 16px, 8px baseline. Elements snap to 4px. Full-screen screens are `position: fixed; inset: 0` scenes with content centred inside a 1320px max frame.

---

## 5. Materials (CSS/SVG recipes)

All grain textures are **inline SVG data URIs** (tiny 16x16 or 32x32 noise tiles) used as `background-image` with `image-rendering: pixelated`. Build them once as CSS custom properties so they are reused.

```css
:root {
  /* 16x16 noise tile, 3 grey levels at ~6% alpha. Reused by every material. */
  --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' shape-rendering='crispEdges'%3E%3Crect x='2' y='1' width='1' height='1' fill='%23000' fill-opacity='.18'/%3E%3Crect x='9' y='3' width='2' height='1' fill='%23fff' fill-opacity='.07'/%3E%3Crect x='5' y='7' width='1' height='2' fill='%23000' fill-opacity='.14'/%3E%3Crect x='13' y='6' width='1' height='1' fill='%23fff' fill-opacity='.08'/%3E%3Crect x='1' y='11' width='2' height='1' fill='%23fff' fill-opacity='.06'/%3E%3Crect x='10' y='12' width='1' height='2' fill='%23000' fill-opacity='.16'/%3E%3Crect x='14' y='14' width='1' height='1' fill='%23000' fill-opacity='.12'/%3E%3Crect x='6' y='14' width='2' height='1' fill='%23fff' fill-opacity='.05'/%3E%3C/svg%3E");
}
```

### 5.1 Stone (default panel, battle, city walls)
Block pattern (dressed stone): 32x16 bricks via two gradients and grain.
```css
.mat-stone {
  --bev-light: var(--stone-500); --bev-dark: var(--stone-950);
  background:
    var(--grain),
    linear-gradient(90deg, var(--stone-950) 0 2px, transparent 2px) 0 0 / 32px 16px,      /* vertical joints */
    linear-gradient(90deg, var(--stone-950) 0 2px, transparent 2px) 16px 16px / 32px 16px, /* offset row joints */
    linear-gradient(0deg, var(--stone-950) 0 2px, transparent 2px) 0 0 / 100% 16px,        /* horizontal joints */
    var(--stone-800);
  background-blend-mode: normal;
}
.mat-stone-smooth {  /* reading surface: grain only, no bricks */
  --bev-light: var(--stone-500); --bev-dark: var(--stone-950);
  background: var(--grain), var(--stone-800);
}
```
Rule: brick pattern only on large scene surfaces (city walls, battle frame); panels containing text use `.mat-stone-smooth`.

### 5.2 Wood
Vertical plank grain: 24px planks, dark seam, two grain lines.
```css
.mat-wood {
  --bev-light: var(--wood-500); --bev-dark: var(--wood-900);
  background:
    var(--grain),
    repeating-linear-gradient(90deg, transparent 0 22px, var(--wood-900) 22px 24px),        /* plank seams */
    repeating-linear-gradient(0deg, transparent 0 6px, rgba(0,0,0,.10) 6px 8px),            /* horizontal grain */
    linear-gradient(90deg, var(--wood-700), var(--wood-600) 40%, var(--wood-700));
}
.mat-wood-dark { /* text-carrying wood */
  --bev-light: var(--wood-600); --bev-dark: var(--wood-900);
  background: var(--grain), repeating-linear-gradient(90deg, transparent 0 22px, var(--wood-900) 22px 24px), var(--wood-800);
}
```
Nail/rivet: 4x4 squares `--iron-300` with 2px `--iron-900` bottom-right, placed at 8px from corners via `box-shadow` on `::before`/`::after` (see iron).

### 5.3 Parchment
```css
.mat-parch {
  --bev-light: var(--parch-100); --bev-dark: var(--parch-400);
  color: var(--text-on-parch);
  background:
    var(--grain),
    radial-gradient(ellipse at 20% 15%, var(--parch-100) 0, transparent 45%),      /* light spot */
    radial-gradient(ellipse at 85% 90%, var(--parch-300) 0, transparent 55%),      /* age shade */
    linear-gradient(0deg, var(--parch-300) 0 8px, transparent 8px calc(100% - 8px), var(--parch-300) calc(100% - 8px)),  /* burnt edges */
    var(--parch-200);
}
```
Parchment edges use the stepped clip (`.step-8`) with an extra 8px dark border `--parch-400`, giving a torn-step edge. Text on parchment: `--ink-900` body, Display font headings in `--wood-800`. Map roads on parchment are `--ink-700` dashed 4px/4px lines.

### 5.4 Iron
Riveted plate for frames, buttons secondary, unit frames.
```css
.mat-iron {
  --bev-light: var(--iron-500); --bev-dark: var(--iron-900);
  background:
    var(--grain),
    linear-gradient(180deg, rgba(255,255,255,.05) 0 2px, transparent 2px),
    linear-gradient(180deg, var(--iron-700), var(--iron-800));
}
.rivets::before, .rivets::after {   /* two rivets top; 4x4 pixel squares */
  content: ''; position: absolute; top: 4px; width: 4px; height: 4px; background: var(--iron-300);
  box-shadow: 2px 2px 0 var(--iron-900);
}
.rivets::before { left: 4px; } .rivets::after { right: 6px; }
```
Iron frames add a 2px inner line `--iron-900`, then 2px `--iron-500` highlight (double outline).

### 5.5 Gold (aged)
Used for plaques, primary buttons, selection, rarity epic trim, cost gems, borders of reward objects. Never a full-screen fill.
```css
.mat-gold {
  --bev-light: var(--gold-200); --bev-dark: var(--gold-900);
  color: var(--gold-900);
  background:
    var(--grain),
    linear-gradient(180deg, rgba(255,255,255,.18) 0 2px, transparent 2px),
    linear-gradient(180deg, var(--gold-400), var(--gold-500) 55%, var(--gold-700));
}
.trim-gold { box-shadow: inset 0 0 0 2px var(--gold-900), inset 0 0 0 4px var(--gold-500), inset 0 0 0 6px var(--gold-900); }
```
Gold text on dark: `--gold-200` (Display/Pixel), never `--gold-500` for text below 24px.

### 5.6 Vault backdrop (reward/merchant/event)
```css
.bg-vault { background: radial-gradient(ellipse at 50% 30%, var(--tint-glow) 0, transparent 60%), var(--tint-void); }
```
Plus a static row of 4px-stepped vertical stone pillars at the screen edges (built with repeating-linear-gradient 96px wide).

### 5.7 Allowed gradients
Only: material gradients above, ambient vignettes (`--tint-glow` radial), and 2-3 stop vertical shading on metal/gold. No rainbow, no diagonal stripes except hazard-free "disabled hatch" (`repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,.25) 4px 6px)`).

---

## 6. Component catalogue

All components are stepped (`.step`, 4px unless noted), bordered by bevel, and defined by class + state modifiers. Each lists **states**: default / hover / active(pressed) / selected / disabled / focus. Global focus: 2px `--focus` outline offset 2px via `outline` (allowed even with clip-path when placed on an unclipped wrapper; for clipped elements use `box-shadow: 0 0 0 2px var(--focus)` on wrapper).

Transition on all interactive elements: `0ms` (state changes are instant; pixel style) except hover lift 1 step (see motion).

### 6.1 Panel (`.panel`)
- Variants: `.panel--stone` (default), `--wood`, `--parch`, `--iron`.
- Structure: `.panel > .panel__title (optional plaque) + .panel__body`. 4px bevel border, `.step-8` corners at popup/large size, `.step` at small size. Padding 16px.
- Sunken well (`.well`): `.mat-stone-smooth` darkened (`background: var(--stone-900)`), `.bevel-in`, used for lists and stat tables inside panels.

### 6.2 Plaque / title banner (`.plaque`)
- Gold plate: `.mat-gold`, `.step-8`, height 48 (h1 style 64), padding 0 32px, Display font `--t-h2`, colour `--gold-900`, text-shadow `0 2px 0 var(--gold-200)` (engraved look). Two 8x8 iron rivets at left/right ends. Ends have 8px triangular notches (ribbon ends) drawn by extra stepped clip-path: `polygon(0 0,100% 0,calc(100% - 16px) 50%,100% 100%,0 100%,16px 50%)` snapped to 8px steps for `.plaque--ribbon` (title of reward/merchant/event).
- `.plaque--wood`: `.mat-wood-dark` with `--gold-200` text, for city building names.
- `.plaque--iron`: for battle chips (hero name, turn).
- States: static (never interactive).

### 6.3 Button (`.btn`)
Base: height 40 (S 32, L 56), padding 0 24px, Pixel font `--t-btn`, uppercase, letter-spacing 1px, `.step`, 4px bevel, `--shadow-1`.
| State | Primary (`.btn--primary`, gold) | Secondary (`.btn` iron) | Danger (`.btn--danger`) |
|---|---|---|---|
| default | `.mat-gold`, text `--gold-900` | `.mat-iron`, text `--stone-100` | fill `--blood-700`->`--blood-900` gradient, text `--stone-100`, bevel light `--blood-500` |
| hover | brightness +8% (`--gold-400`->`--gold-200` top), translateY(-2px), shadow grows to 4px | bevel light -> `--gold-400` (1 line at top), translateY(-2px) | bevel light -> `--blood-300` |
| pressed (`:active`) | translateY(+2px), shadow 0, bevel inverted (`.bevel-in`) | same | same |
| disabled | `background: var(--stone-700)`, text `--stone-400`, bevel `--stone-500`/`--stone-900`, disabled-hatch overlay, no hover, `cursor: not-allowed` | same as primary disabled | same |
| focus | 2px `--focus` outline | same | same |
```css
.btn { position: relative; font: 700 16px/24px var(--font-pixel); text-transform: uppercase; letter-spacing: 1px;
  height: 40px; padding: 0 24px; border: 0; cursor: pointer; color: var(--stone-100);
  transition: none; }
.btn:hover:not(:disabled) { transform: translateY(-2px); }
.btn:active:not(:disabled) { transform: translateY(2px); box-shadow: inset 2px 2px 0 var(--bev-dark), inset -2px -2px 0 var(--bev-light); }
.btn:disabled { color: var(--stone-400); background: var(--stone-700); box-shadow: inset 2px 2px 0 var(--stone-500), inset -2px -2px 0 var(--stone-900); }
```
Rules: one `.btn--primary` per screen/popup. A disabled button always has its reason shown by the shared tooltip on hover **and** (per Bible) a dimmed reason line under it where the spec already requires one. Icon buttons are 40x40 with a 16px or 32px icon centred.

### 6.4 Card (`.card`) — hand, reward, merchant, deck viewer
Size: hand 144x208; large (reward/merchant/info popup) 240x336 (scale 5/3, same layout). Built from 4 layers top to bottom:
1. **Frame:** 4px bevel border, material by card polarity (the five values of `CardPolarity` in `cardVisuals.ts`, today the `.polarity-*` classes): attack = `.mat-iron` with `--blood-700` inner trim; defense = `.mat-iron` with `--steel-700` trim; buff = `.mat-iron` with `--moss-700` trim; debuff = `.mat-iron` with `--arcane-500` trim; utility = `.mat-stone` with `--stone-600` trim. Whole frame `.step`. The `.polarity-*` glow colours are deleted.
2. **Title bar** (top, 32h): `.mat-wood-dark`, Display 20px `--stone-100`, single line, ellipsis is forbidden — names must fit at 16 chars.
3. **Art window** (96h hand / 168h large): sunken `.bevel-in` 2px `--iron-900`, background = card-type tint vertical shade, holds one 32x32 (hand) / 64x64 (large) pixel icon (section 7) centred with `image-rendering: pixelated`, plus a 16px type-icon at top-right corner.
4. **Text box** (rest): `.mat-parch`, sunken bevel, Body 14/16 in `--ink-900`, keywords bold. Conditional-use warnings (AO-D040) appear as a 16px `warn` icon + one line in `--blood-700` at the bottom of the text box.
- **Cost gem:** top-left overlapping frame by 8px, 32x32 `.gem` (stepped), `--steel-700` fill with `--steel-300` highlight pixel, 2px `--gold-500` ring, number Pixel 16 `--stone-100`. Unaffordable: fill `--stone-600`, number `--blood-300`. Reward/merchant price sits on a separate gold coin plate below (Section 6.6).
- **Rarity:** shown by frame outer 4px line + a 8x8 pixel gem centred on the title bar bottom edge: common `--rar-common` (no gem, plain iron outer line), uncommon `--rar-uncommon`, rare `--rar-rare`, legendary/epic `--rar-epic` plus `.trim-gold` on the frame. Engine rarities map: common->common, uncommon->uncommon, rare->rare, legendary->epic.
- **States:** default; hover = translateY(-8px) hand lift and `--shadow-2`, frame outer line -> `--gold-400`; selected (chosen for play, awaiting target) = 4px `--gold-200` outer ring wrapper and lifted -16px; unplayable = art window + frame at 50% brightness (filter: `brightness(.55) saturate(.6)`), cost gem red number, hover tooltip states reason; dragging/flying = no lift, `--shadow-2`. Upgraded card: `+` after the name and gold `--gold-200` name.
- Right-click opens card info popup (large card + full rules text + condition explanation).

### 6.5 Relic frame (`.relic`)
Sizes: 32x32 in the bar grid (today `.garrison-relic-cell` is 28x28; the change is intentional, see the bar row in section 9), 48x48 in popups, 64x64 on choice screens. Each holds a 16x16 icon at an integer scale: x1 in the 32 cell (centred, 8px padding), x2 at 48 (8px padding), x3 at 64 (48px icon, 8px padding).
Rarity frames (all `.step`, 4px bevel):
| Rarity | Frame | Backdrop | Extra |
|---|---|---|---|
| common | `.mat-iron`, outer 2px `--iron-500` | `--stone-900` | none |
| rare | `.mat-iron`, outer 2px `--steel-500`, inner 2px `--steel-700` | `--steel-900` | 2 corner pixels `--steel-300` |
| epic | `.mat-gold` frame (`.trim-gold`), inner `--arcane-500` 2px | `#1a1226` | 4 corner pixels `--gold-200`, on hover a 2-frame sparkle (motion 8) |
Empty slot: dashed 2px `--stone-600` inner square (dash 4/4), no fill, no hover. Tooltip on hover: name (Display), rarity word coloured, effect and drawback lines (drawback in `--blood-300` with `minus` icon).

### 6.6 Unit tile / frame (`.unit`)
Used on battle boards, army grid (bar), popups. No HP bar (AO-D024), no HP numbers (AO-D004).
- **Frame:** `.mat-iron` `.step` 4px bevel, 96x112 in battle (icon window 80x64 + name row), 64x64 in bar grid (sprite only). Side accent: player = 4px `--steel-500` top edge line, enemy = 4px `--blood-500` top edge line. That is the only player/enemy colour cue on the tile.
- **Sprite window:** sunken, `--stone-900` backdrop with a faint per-side floor tint, sprite drawn scaled (section 7.6) x2 or x3. Until sprites exist, the window shows the 16x16 role icon scaled x3 (48px).
- **Role badge:** 16x16 iron chip at top-left inside the window holding the role icon (melee/ranged/support/tank/...). Tooltip: role name.
- **Count:** bottom-right, Pixel 16 `--t-num`, `x12`, `--stone-100` on a `--stone-950` plate (plate 8px padding, `.step`). Bigger 32/32 pixel in popups.
- **Status row:** up to 4 buff/debuff icons (16x16 with amount in Pixel 8 bottom-right, white with 2px black shadow) stacked along the top-left below the role badge, wrapping. Buff icon backing = `--moss-700` 2px underline; debuff = `--blood-700` underline.
- **Block:** shown as status icon `shield` with amount (`--steel-300`), never as a bar.
- **States:**
  - default: as above.
  - selectable (legal target/actor): 2px `--selectable` ring + 4px outer offset; slow 2-step pulse (motion 8) only when the game is waiting for a pick.
  - selected: 2px `--selected` (bone white) ring + `--gold-400` corner pixels at four corners.
  - hover (only if interactive): frame bevel light -> `--gold-400`.
  - **acted:** `filter: saturate(.35) brightness(.6)` on the whole tile; no lock icon (AO-D024); hover none.
  - **frozen:** ice overlay: `--frost-500` at 35% opacity multiply, plus a stepped ice-crystal border (a 4px `--frost-200` inner line with jagged 4px teeth on top edge via clip-path) and 3 small crystal shards on top-left corner. Sprite is `saturate(.5)`; freeze status icon remains in the status row. Not selectable.
  - **cannot act (cannotAttack/cannotMove/blocked-by-front-ally):** chains overlay: two diagonal 4px-thick iron chain links drawn by an SVG data-URI pattern (alternating 8x4 links, `--iron-500` fill, `--iron-900` outline) crossing the tile corner to corner, plus the `chain` status icon. Sprite `brightness(.75)`. Not selectable.
  - **dead / removed:** death fade (motion 8).
  - **dimmed (not relevant to current action):** `opacity: .5`.
- Empty slot (bar grid): 2px dashed `--stone-600`, Pixel 8 label `EMPTY` `--stone-400`.

### 6.7 Resource pill (`.pill`)
Height 32, padding 0 12px, `.mat-iron` small step (4), 2px bevel, layout: 16px icon (or 32 in bar) + Pixel 16 number `--stone-100`. Gold pill numeral `--gold-200`; food pill turns `--blood-300` when projected to run out (existing rule) with a 2-step blink once. Tooltip on hover (shared).
Bar resource rows (32h) use the same pill at full column width (88).

### 6.8 Tooltip (`.tip`) — ONE shared component (AO-D025)
- Single React component + single DOM node in a portal (`<Tip>` context provider), rendered at 0ms delay (instant) on `pointerenter`, hidden on `pointerleave`, `Escape`, or scroll. Positioned 8px from the target, auto-flip to stay inside the viewport with 8px margin. Max width 280px, follows the target, does not follow the cursor.
- Look: `.mat-stone-smooth` `--stone-900`, 2px `--gold-700` border with `.step` 4px, padding 8px 12px, `--shadow-2`. Title line: Display 16/24 `--gold-200`; body: Body 16/24 `--text`; numbers/effect values in bold `--text-strong`; drawback/warning line: 16px icon + `--blood-300`. No arrow pointer, no animation.
- Content contract: `{title?, body, lines?: [{icon?, text, tone?: 'good'|'bad'|'dim'}]}`. Never interactive, no scrolling. Every place that used `title=` or its own hover bubble is replaced.

### 6.9 Modal / popup (`.modal`)
- Backdrop: `rgba(8,7,6,.78)` full-screen plus 4px stepped dither edge (optional), click on backdrop = close if it is non-destructive, Esc closes.
- Window: `.panel` in the screen's material (city popups: `--wood`; battle popups: `--iron`; deck/pile viewers: `--stone`; hero/unit/card info: `--stone`), `.step-8`, 4px bevel double frame (`.trim-gold` on outer for info popups only), `--shadow-2`, max-width 720, centred.
- Header: `.plaque` centred and overlapping the top edge by 24px (title), close button = 32x32 iron `.btn` with `x` icon at top-right, inside the frame. Body padding 24; footer row with buttons right-aligned, primary rightmost.
- Rendered in a portal. Opening: instant with a 2-step scale (motion 8). Only one modal at a time; deck picker over a popup is allowed as a stacked modal with a darker second backdrop.
- Inner scroll area uses the shared scrollbar (6.13) and a `.well`.

### 6.10 Tabs (`.tabs`)
Tab = iron plate 40h, Pixel 8/16 uppercase label, 4px steps on top corners only (`polygon(0 4px,4px 4px,4px 0,calc(100% - 4px) 0,calc(100% - 4px) 4px,100% 4px,100% 100%,0 100%)`). Inactive: `--stone-700`, text `--stone-300`, sits 4px lower. Active: `--stone-800` (same as the panel it opens, no bottom border so it fuses), text `--gold-200`, 2px `--gold-500` top line. Hover inactive: text `--stone-100`. Disabled: `--stone-400`.

### 6.11 List rows (`.row`)
Height 40 (with icon 32 + 4px pad) or 32 compact. Zebra: odd `--stone-800`, even `--stone-700`. 2px bottom line `--stone-900`. Hover: left 4px bar `--gold-400`, background `--stone-600`. Selected: background `--gold-900`, left bar `--gold-200`, text `--gold-200`. Disabled: text `--stone-400`, no hover. Layout: icon, name (Body 16, bold), right-aligned Pixel value. Used in deck viewer (name + cost), log/history, stats table, barracks unit list.

### 6.12 Toggles and inputs
- Toggle (`.toggle`): 48x24 sunken `.bevel-in` track; knob 24x24 iron square sliding 2 steps (0ms, instant). On: track `--moss-700`, knob `--moss-300` mark; off: track `--stone-900`, knob `--stone-500`. Label to the right Body 16.
- Slider (music volume): 8px sunken track, filled part `--gold-500`, knob 16x24 iron block.
- Text input (hero name): sunken `.bevel-in`, `--stone-900` fill, Body 16 `--text-strong`, caret `--gold-200` (block caret 8px wide via `caret-shape: block` where supported), focus = 2px `--gold-400` outline.
- Number stepper (barracks count): input + two 32x32 `.btn` (`-` `+`), value Pixel 16.
- Checkbox/radio are not used; use toggle or selectable card.

### 6.13 Scrollbar
```css
* { scrollbar-width: auto; scrollbar-color: var(--iron-600) var(--stone-900); }
::-webkit-scrollbar { width: 16px; height: 16px; background: var(--stone-900); }
::-webkit-scrollbar-thumb { background: var(--iron-600); box-shadow: inset 2px 2px 0 var(--iron-500), inset -2px -2px 0 var(--iron-900); }
::-webkit-scrollbar-thumb:hover { background: var(--iron-500); }
::-webkit-scrollbar-button { display: none; }
```

### 6.14 Toast (`.toast`)
Bottom-centre, 24px above the bottom bar; `.mat-iron` `.step`, `--shadow-2`, left 8px colour block (info `--steel-500`, good `--moss-500`, warn `--ember-500`), Body 16 text, 16px icon. Enters by sliding up 16px in 2 steps, stays 2.5s, leaves in 2 steps fading. Max one visible at a time; new replaces old.

### 6.15 Other shared pieces
- **Divider:** 2px `--stone-900` + 2px `--stone-600` below (engraved line). Vertical the same rotated.
- **Badge/number chip:** Pixel 8, `.step` 4, iron.
- **Cursor:** existing golden arrow SVG cursor is kept but recoloured to `--gold-200` fill with `--stone-950` stroke, drawn without `stroke-linejoin: round` (miter, pixel look).
- **Screen frame (`.screen`):** every screen root: `<div class="screen" data-screen="...">` with background `var(--tint-void)` + vignette; content inside `.frame` (iron/wood/stone per screen) 8px inset, `.step-8`, with four 16x16 corner brackets (stepped L-shape pixels in `--tint-trim`).

---

## 7. Icon set (~44 icons)

**Format:** every icon is a 16x16 grid. Storage: palette-indexed string grids in `src/ui/pixel/icons.ts` (see 7.6). Rendered by one `<PixelIcon name size />` component into a `<canvas>` (or a memoised `data:image/svg+xml` of `<rect>`s) with `image-rendering: pixelated`, size = integer multiple of 16 (`16`, `32`, `48`). Icons use a **shared 8-colour master palette** so they always sit together:

```
'.' transparent
'k' outline   #100e0c   (1px dark outline, present on every icon)
'w' light     #e6dcc3   (bone white highlight)
'g' grey      #9a907d
'd' dark grey #544d42
'y' gold      #cfa93f   'Y' gold shade #7a5f1c
'r' red       #9c2f26   'R' red shade  #4a1712
'b' blue      #3f6f95   'B' blue shade #21405a
'n' green     #4f7a3a   'N' green shade #22381b
'p' purple    #6d4f96
'i' ice       #7fb7c4
'o' orange    #b5651d
't' brown     #6b4a2b   'T' brown shade #3c2916
's' steel     #66707a   'S' steel shade #33393e
```
Rules: light comes from top-left (highlight pixels on top-left edges); 1px outline `k`; max 6 colours per icon; silhouette must read at 16px in greyscale.

**Icon list (60, numbered):** `name` — silhouette and colours.

Resources / HUD (8)
1. `gold` — coin, yellow disc, dark rim, slit highlight
2. `food` — ham hock, brown with white bone tip
3. `day` — half sun over horizon, 3 rays, gold
4. `mana` — faceted blue crystal
5. `slots` — square with corner brackets, grey
6. `deck` — three offset cards, brown/blue
7. `discard` — one card with red X
8. `relic` — small chalice, gold (generic placeholder)

Unit roles (6)
9. `role_melee` — short sword, steel
10. `role_ranged` — bow with arrow, brown/steel
11. `role_tank` — kite shield, blue/steel
12. `role_support` — cross, white/gold
13. `role_caster` — star-tipped staff, purple
14. `role_beast` — paw print, brown
15. `role_undead` — bone skull with glowing eyes (Skeleton, AO-048)

Statuses, one per engine `StatusType` (10)
15. `st_strength` — upward sword, red-orange
16. `st_weak` — drooping sword with down arrow, grey
17. `st_armor` — breastplate, steel
18. `st_bleed` — blood drop with cut, red
19. `st_poison` — drop with bubble, green
20. `st_burn` — flame, orange/gold
21. `st_fear` — pale face, wide eyes, grey-white
22. `st_taunt` — war horn, gold/brown
23. `st_freeze` — ice crystal, ice-blue
24. `st_chain` — two interlocked links, steel (cannot act / cannot move; not an engine status, drawn for `cannotAttack`/blocked flags)

Combat indicators (3)
25. `shield` — small heater shield, blue (block amount)
26. `heal` — green plus over drop
27. `damage` — red spike burst

Card polarity, one per `CardPolarity` in `cardVisuals.ts` (5)
28. `card_attack` — diagonal sword, red
29. `card_defense` — shield, blue
30. `card_buff` — up chevron over diamond, green
31. `card_debuff` — down chevron over diamond, purple
32. `card_utility` — cog, grey/gold

Node types, one per `NodeType` (8)
33. `node_road` — dashed path step, brown
34. `node_battle` — crossed swords, red
35. `node_fort` — palisade camp with a red banner (AO-D077; replaces `node_elite`)
36. `node_mine` — timbered mine entrance in a rock face with gold ore (AO-D076; replaces `node_resource`)
37. `node_merchant` — coin purse, gold/brown
38. `node_event` — scroll with question mark, parchment
39. `node_city` — castle towers, stone/red
    `node_village` — cottage with chimney on grass (village node, AO-D072)
40. `node_boss` — horned crown with red gem, dark red/gold

Buildings (10)
41. `bld_townhall` — banner tower
42. `bld_barracks` — crossed spears and tent
43. `bld_temple` — cross-topped arch
44. `bld_stable` — horseshoe
45. `bld_forge` — anvil with spark
46. `bld_mage_tower` — pointed tower with star
47. `bld_shrine` — small altar with flame
48. `bld_market` — stall awning
49. `bld_gold_mine` — mine cart with nuggets
50. `bld_training` — target dummy
    `bld_marketplace` — striped-awning stall with produce (Marketplace hotspot, AO-D071)
    `garrison` — plumed helm (Barracks garrison, Day tip, toasts)

UI (10)
51. `ui_close` (x) 52. `ui_lock` 53. `ui_warn` (triangle with !) 54. `ui_info` (i) 55. `ui_log` (scroll) 56. `ui_menu` (three bars) 57. `ui_swap` (two opposing arrows) 58. `ui_check` (tick) 59. `ui_arrow_l` 60. `ui_arrow_r`

Batches: A = 1-27 and 51-54 (replace emoji in battle and bar), B = 28-32 plus relics, C = 33-40, D = 41-50 and 55-60.

**Relic icons** (currently 10 emoji: banner, crystal, crown, blood banner, cursed crown, hawk eye, champions trophy, horde boar, bulwark standard, grave crown) get their own 16x16 pixel art named `rel_<relicId>`, one per relic in `relics.ts`, same palette. Hero portraits get 32x32 sprites (7.6) `hero_<id>`. Rule: **adding a relic/unit/hero requires adding its icon/sprite; a missing one renders `ui_info` placeholder and fails a vitest that iterates the data ids.**

### 7.1 Example: `gold` (16x16)
```
................
.....kkkkkk.....
...kkyyyyyykk...
..kyyyyyyyyyYk..
..kywwyyyyyyYk..
.kyywyyyykyyyYk.
.kyyyyyyykyyyYk.
.kyyyyyyykyyyYk.
.kyyyyyyykyyyYk.
.kyyyyyyykyyyYk.
.kyyyyyyyyyyYYk.
..kyyyyyyyyYYk..
..kYyyyyyyYYYk..
...kkYYYYYYkk...
.....kkkkkk.....
................
```
### 7.2 Example: `st_freeze` (16x16)
```
.......kk.......
......kiik......
...k..kiik..k...
..kik.kiik.kik..
...kikkiikkik...
....kkiwwikk....
.kkkiiiwwiiikkk.
kiiiiwwwwwwiiiik
kiiiiwwwwwwiiiik
.kkkiiiwwiiikkk.
....kkiwwikk....
...kikkiikkik...
..kik.kiik.kik..
...k..kiik..k...
......kiik......
.......kk.......
```
### 7.3 Example: `st_chain` (16x16)
```
................
...kkkk.........
..ksssSk........
.ksSkkSsk.......
.ksk..kSk.......
.ksSkksSk.......
..kSssSkkkk.....
...kkkksssSk....
.......ksSskk...
.......kSk.kSk..
.......kSsSSsk..
........kSssSk..
.........kkkk...
................
................
................
```
(Example grids show format; final art is drawn by ui-frontend against the silhouette description above and reviewed by ui-ux at 16 and 32 px.)

### 7.4 Emoji ban and replacement map
| Old emoji use | Replacement |
|---|---|
| `⚔️🏹🛡️✚` role/unit glyphs | `role_*` icons in unit frame; unit sprites (7.6) later |
| `💪🥀🛡️🩸☠️🔥😨📣❄️` statuses (`stackStatus.ts`) | `st_*` icons; `STATUS_ICONS` becomes `Record<StatusType, IconName>` |
| relic emoji (`relicIcons.ts`) | `rel_*` icons |
| hero portrait emoji (`heroIcons.ts`) | `hero_*` 32x32 sprites; interim: role icon on `--stone-900` |
| gold / food / day text-icons | `gold`, `food`, `day` |
| node/building emoji | `node_*`, `bld_*` |
Check: `grep -P "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{FE0F}]" src` returns nothing (exception: none).

### 7.5 Card art
Until illustrations exist, every card's art window shows one 32x32 (hand) / 64x64 (large) pixel icon chosen by `cardVisuals.ts`: an icon per card *effect* (attack, block, buff, heal, draw, freeze, etc.) drawn from the icon set scaled x2/x4 (16 -> 32/64). No per-card unique art required in this phase.

### 7.6 Sprites actually drawn (AO-040, src/ui/pixel/sprite.ts, PixelSprite.tsx, sprites/*)
Format: a `Sprite` is two 32x32 palette-indexed grids (`frames: [idleA, idleB]`), every character a key of the master palette (`palette.ts`) or `.` for transparent. At most 16 colours besides the `k` outline. Idle B is either drawn (the five style-proof sprites) or made by `withIdleBob(rows, feetRow)`: everything above `feetRow` sinks one row, the feet stay planted.

Renderer: `gridsToUrl` (render.ts) paints the frames side by side on a canvas once per (id, team) and caches the PNG data URL. `PixelSprite` shows it as a `.px-sprite` background at an integer scale (1 = 32px ... 4 = 128px), `image-rendering: pixelated`; the idle loop is a 1s `steps(1)` background-position swap (CSS `sprite-idle`), offset per stack (`seed`) so neighbours do not bob in lockstep; it stops under `prefers-reduced-motion`.

Teams: the team characters `a` `A` `h` (terracotta) are substituted by steel blue `#4a6a8a #26384e #86a8c8` for `team="enemy"`, and enemy sprites are mirrored (`.mirrored`, scaleX(-1)) so they face the player. Player sprites stay warm. One grid serves both sides. Units with no team characters (goblin, orc, shaman, wolf) look the same on both sides; the blue enemy frame line and the mirror mark the side.

`UnitArt` (unit id, `size` scale, `team`, `seed`) is the only place a unit picture is drawn; `HeroArt` does the same for the hero busts. Scales in use: battle tile and army slot 2 (64px in the 88x76 window / 64px slot), Barracks card and event offers 2, unit popup 3, hero plaque and battle hero chip 1, hero popup 3, hero setup 2, stack previews (hero setup, end screen, event gains) 1. Frozen, chained and acted overlays sit on top of the sprite; the death ghost clones the tile, so the frozen frame is kept. The hit flash is the existing `fx-flash` overlay, no separate hit frame.

Sprites drawn: swordsman, archer, knight, goblin, orc (the approved style proof grids, unchanged); priest (bone hood and robe, terracotta mantle, gold-orb staff, red tome), shaman (green orc, feather crest, purple robe, skull staff, purple orb), wolf (grey wolf in profile facing right, open jaws); skeleton (bone-white raised dead, dark sockets, glowing eyes, rusty blade, terracotta rag; AO-048); hero busts filling the 32x32 frame: warlord (horned steel helm, terracotta beard, spiked pauldrons), rogue (green hood, terracotta scarf, two daggers), mage (blue pointed hat, white beard, purple orb). Completeness and format: `sprites.test.ts` (a sprite for every unit id and hero id, two 32x32 frames, master palette keys, at most 16 colours, idle frame differs).

### 7.7 Icons actually drawn (AO-020, AO-040, src/ui/pixel/icons/*)
Deviations from the list in 7: `day` reuses the proof hourglass, `hp` is the proof heart, `ui_log` is the proof scroll, `card_attack` = `role_melee` art, `card_defense` = `shield` art. Added beyond the list: `crest` (title), `ornament_dragon` (battle frame), relics `rel_<relicId>` (19), card effect art `fx_bolt fx_target fx_wind fx_horse fx_helm fx_dagger fx_sparkle fx_flag fx_banner fx_skull`, doctrine icons `doctrine_military doctrine_arcane doctrine_necromantic doctrine_economic` (Temple cards and the active effects list). The per-unit `unit_<id>` and hero `hero_<id>` 16x16 portraits were deleted when the 32x32 sprites (7.6) replaced them; the six `role_*` badges stay. AO-040 redrew the weak icons: `ornament_dragon` (horned head with open jaws), `card_buff` / `card_debuff` (green up arrow, violet down arrow), `st_weak` (snapped sword), `st_taunt` (red shout burst with an exclamation mark), `rel_crown_of_champions`, `rel_shadow_ring`, `rel_glass_cannon_idol` (icy cannon), `rel_whetstone`, and `role_tank` (steel tower shield, no longer the same silhouette as the blue defense `shield`). `node_road` no longer exists (AO-D045). Palette keys beyond the 8-colour set are those of the style proof (see `src/ui/pixel/palette.ts`). Completeness is enforced by `src/ui/pixel/icons.test.ts`.

---

## 8. Motion rules

**Principle:** pixel-step. Use `steps()` timing functions instead of smooth curves for movement of UI objects; smooth `ease-out` only for large ambient things (screen fades). Nothing loops except: selectable pulse, pending-action pulse, epic relic sparkle. All motion respects a `prefers-reduced-motion` switch: durations become 0 and pulses become static rings.

Tokens: `--dur-fast: 80ms; --dur-1: 120ms; --dur-2: 200ms; --dur-3: 320ms; --dur-4: 480ms; --ease-step2: steps(2, end); --ease-step4: steps(4, end); --ease-out: cubic-bezier(.2,.8,.2,1)` (ease-out only for card travel and screen fades).

| Motion | Duration | Easing | Notes |
|---|---|---|---|
| Button hover lift / press | 0 (instant) | none | 2px translate, no transition |
| Card hover lift | 120ms | `steps(2)` | 8px lift |
| Card draw (deck -> hand) | 320ms | `--ease-out` | slide + 4-step flip; stagger 80ms |
| Card play travel to centre | 320ms | `--ease-out` | stays until resolve (Bible) |
| Discard sweep | 320ms | `--ease-out` | stagger 40ms |
| Popup / modal open | 120ms | `steps(2)` | scale 0.9 -> 1 in 2 steps, opacity 0 -> 1 |
| Screen transition | 240ms | linear | fade through `--tint-void` (out 120 + in 120) |
| Toast | 200ms in, 200ms out | `steps(2)` | as 6.14 |
| Selectable pulse | 1000ms loop | `steps(2)` | ring alternates `--gold-400` / `--gold-700` |
| Enemy playback step | ~700ms per action (Bible/AO-D023) | — | sequence: actor glow 120, effect, target reaction, settle |
| Floating text | 800ms | `steps(8)` | rises 32px in 8 steps, holds, fades last 2 steps; Pixel 16, 2px black shadow; damage `--blood-300`, block `--steel-300`, heal `--moss-300`, status `--stone-100` |

**Effect vocabulary (all code-drawn, no assets):** each is a small self-contained CSS/canvas effect component; durations at 1x speed:
1. **Lunge:** actor translates 16px toward target in 80ms (`steps(2)`), 80ms hold, returns in 120ms.
2. **Slash:** a 4px-thick white/`--gold-200` diagonal line drawn across the target tile by a `clip-path` wipe in 4 steps (160ms), then 2 steps fade; 3 tiny 4x4 spark pixels flying off.
3. **Projectile:** a 4x12 arrow/bolt pixel sprite (`--stone-100` with `--gold-400` tip; mage: 8x8 `--arcane-500` orb with 2px trail) moving from actor to target in 240ms `steps(8)`, on impact triggers hit shake. Magic projectiles use the `--arcane-500` orb.
4. **Hit shake:** target tile translates +-4px horizontal alternately, 4 steps, 200ms, plus a 1-frame `--stone-100` flash overlay (`mix-blend-mode: screen`, 80ms).
5. **Block ring:** on the target a stepped octagon outline in `--steel-300`, scaling 1.2 -> 1.0 in 3 steps (160ms) then fading; the `shield` status icon pops in with a 2-step scale.
6. **Heal particles:** 6 4x4 `--moss-300` plus-shaped pixels rise from the tile bottom over 480ms `steps(8)`, drifting +-8px; final `+N` floating text.
7. **Buff particles:** 4 4x4 `--gold-200` up-arrows (chevrons) rise 320ms; debuffs: 4 `--blood-500` chevrons falling.
8. **Freeze ice:** on application, 6 `--frost-200` diamond shards (4x4) appear around the tile in 3 steps, ice overlay grows from the edges inward (`clip-path` inset from 50% -> 0 in 4 steps, 240ms); on thaw it shatters: shards fly outward 200ms.
9. **Chains:** two chain links slide in from opposite corners in 3 steps (200ms), close with a 1-frame flash; persistent while the effect lasts; they break (split + drop 16px + fade) when it ends.
10. **Death fade:** tile desaturates (`filter` steps) and collapses: height scaleY 1 -> 0.6 while opacity 1 -> 0 in 6 steps (400ms), then removed; the count text goes to `x0` first for one step.
11. **Recruit "+N":** floating `+N` in `--gold-200` rises inside the slot (existing behaviour, restyled).
12. **Selectable/selected ring:** described in 6.6.
13. **Epic relic sparkle:** one 4x4 white pixel appears at a random corner every 2s for 2 steps (only when hovered or on choice screens).

Rules: effects never obscure the count number; max 2 simultaneous effects per tile; playback speed setting scales all durations (0.5x / 1x / 2x) via one `--speed` variable (no per-effect hardcoded ms outside tokens).

---

## 9. Per-screen application

Screen root gets `data-screen`. "Chrome" (buttons, tooltips, modals, pills) is the same everywhere. The "Today" column names the real classes in `src/index.css` / `src/ui/*.tsx` that each row replaces or restyles; classes not named there keep their name and get the new material.

| Screen | Today (real classes / files) |
|---|---|
| Title (`TitleScreen.tsx`) | `.title-screen`, `.title-crest`, `.title-name`, `.title-tagline`, `.title-menu`, `.title-menu-btn` (+ `.primary`), `.title-footer` |
| Hero + relic (`CommanderSetupScreen.tsx`, `StartingRelicScreen.tsx`, two screens today) | `.setup-screen`, `.commander-select-screen`, `.commander-card` (+ `-portrait -title -name -desc`), `.commander-selected-badge`, `.setup-option(s)`, `.name-input`, `.begin-journey-btn`, `.setup-hero-portrait` |
| Road (`WorldMapScreen.tsx`) | `.map-layer`, `.map-column`, `.map-connector`, `.path-choice-card/-row/-heading/-name/-badge`, `.path-progress`, `.current-location-badge/-icon`, bar = `GarrisonBar` |
| City (`CityScreen.tsx`) | `.th-frame`, `.th-scene` (sky gradient `#24314f...`), `.th-skyline`, `.th-hotspot(-icon -name -sub)`, `.city-building-popup`, `.mage-tower-tier`, `.card-removal-popup` |
| Bar (`GarrisonBar.tsx`, `ArmyGrid.tsx`) | `.garrison-bar` (+ `-col -main -resources -hero -actions -stat -btn`), `.garrison-hero-plaque`, `.garrison-hero-portrait-rect`, `.garrison-relic-grid/-cell`, `.garrison-leave-btn`, `.army-block`, `.army-grid`, `.army-slot(-icon -role -count -name -digit -text -swap -move-label)`, `.army-row-label(s)`, `.resource-orb`, `.recruit-flourish` |
| Battle (`App.tsx`, `StackTile.tsx`, `ActionCardTile.tsx`, `FlyingCard.tsx`) | `.disciples-frame`, `.frame-ornament/-topbar/-hero-chip/-turn-chip/-body/-scene/-bottombar/-pile/-hand-slots/-round-buttons`, `.portrait-rail/-col/-slot/-frame/-art/-role-badge/-select-badge/-lock-badge/-statuses/-status/-block-strip/-hp-strip`, `.stack-tile`, `.drop-zone`, `.hand`, `.hand-card-slot`, `.action-card` (+ `-cost -icon -name -desc -footer -tray`), `.card-tile`, `.polarity-*`, `.pile-card-back/-count/-label`, `.round-btn(-main)`, `.floater(-damage -block -heal -status)`, `.flying-card`, `.mana-bar-track/-fill`, `.bar-fill-hp/-block/-preview` |
| Reward (`RewardScreen.tsx`) | `.reward-overlay`, `.reward-banner`, `.reward-card(-row -cost -icon -name -desc -tag)`, `.reward-actions`, `.reward-skip-btn`, `.reward-empty` |
| Merchant (`MerchantScreen.tsx`) | `.merchant-overlay/-topbar/-title/-gold/-gold-icon/-shelf/-card/-price/-removal/-leave-ribbon` |
| Event (`EventScreen.tsx`) | `.event-overlay`, `.event-badge`, `.event-banner`, `.event-description`, `.event-options`, `.event-option-card(-label -desc)` |
| Run end (`RunEndScreen.tsx`) | `.result-banner` |
| Popups / drawers | `.modal-backdrop`, `.modal-close`, `.unit-popup-*` (`UnitPopup.tsx`), `.card-removal-*` (`CardRemovalPicker.tsx`), `.pause-backdrop`, `.pause-menu-*` (`PauseMenu.tsx`, `SettingsPanel.tsx`), `.history-drawer*` (`HistoryDrawer.tsx`), `.toast-*` (`Toast.tsx`), local title/tooltip bubbles (to be replaced by `Tip`) |

Target look per screen:

| Screen | Tint | Key materials | What changes vs today |
|---|---|---|---|
| **Title** | `title`: near-black warm, gold trim, candle-like glow behind logo | `.bg-vault`-style vignette; logo on large `.plaque--ribbon` gold plate, Display 64; menu = stacked L `.btn` on `.mat-stone` slab | Remove gradient/emoji; logo becomes engraved plaque; a code-drawn castle silhouette (pixel row polygon) on the horizon in `--stone-800`. Menu buttons all same width 320. |
| **Hero + starting relic (one screen, AO-D029)** | `hero`: warm dark stone, gold trim | Left/top: name input + 3 hero cards side by side as tall `.mat-stone` panels with 96px portrait (32x32 sprite x3), 5 stat rows (Pixel abbreviations with `.row`), selected = gold `.trim-gold`; below: "Choose your relic" plaque and 5 relic frames (64px) in a row with rarity frames (all common), selected = gold ring; relic detail well underneath (name, effect, drawback `--blood-300`); primary `Begin Journey` bottom-right (disabled until name + hero + relic) | Two-step flow collapses to one screen (AO-D029); stats as icon-less pixel table; relic emoji -> icons; hero cards lose gradients. |
| **Road / map** | `map`: parchment field | `.mat-parch` map board full-width with wood frame border (`.mat-wood` 16px, corner iron plates); nodes as 48x48 stepped medallions (`.mat-iron` with `node_*` icon x3), path = dashed ink line, current node = gold pin; path cards 250x300 become parchment cards with wood border and ink text, node-type colour only as a 4px top band + icon (colour: battle `--blood-500`, elite `--ember-500`, resource `--moss-500`, merchant `--gold-500`, event `--steel-500`, city `--wood-500`, boss `--blood-700`); bottom bar (shared) uses `.mat-wood-dark` | Purple/orange saturated cards -> muted parchment; emoji removed; layer counter on a wood plaque. |
| **City** | `city`: warm stone + wood | Scene: pixel-row castle skyline with `.mat-stone` bricks, `.mat-wood` building signs (plaque--wood name + `bld_*` icon x3); built = full colour, unbuilt = `saturate(.3)` + dashed outline + cost pill; popups = `.modal` `--wood` with parchment-free `.well` inside; bar shared | Skyline gradient sky replaced by dusk vignette (`--tint-glow`); hotspots gain material; popups get plaque headers; Barracks list = `.row`s + stepper + primary `Recruit`. |
| **Bottom bar (Road + City, one component)** | inherits screen | Wood bar (`.mat-wood-dark`) 200px high, 4px iron top edge; columns separated by engraved dividers; resource `.pill`s; hero plaque `--plaque--iron`; relic grid cells 32x32 (see note below); army grid uses `.unit` 64 tiles (spec dimensions kept: slots 86h); Log / Deck / Menu 64x48 `.btn`s (Deck button added by AO-D040) | Emoji -> icons; rounded slots -> stepped; dashed-empty preserved. **Note:** relic cells growing to 32px changes the 156px hero column; ui-frontend must recompute (3 columns x 32 + 2 gaps x 4 = 104 <= 156 OK; rows 5 x 32 + 4 gaps x 4 = 176 <= 181 OK; hero portrait/plaque height shrinks 8px). Spec dimensions update goes to SCREEN_SPEC via ui-ux. |
| **Battle** | `battle`: cool dark stone; **enemy half tinted colder**, player half warmer | Frame `.mat-iron`; scene = `.mat-stone` floor with two halves: player rail `background: linear-gradient(90deg, #1d1a17, #191b1e)` (warm end toward the player side), enemy rail `linear-gradient(270deg, #14191f, #171b20)` (cold); trim: player rail top line `--steel-500`, enemy rail `--blood-700`; hero chip `.plaque--iron`, turn chip `.plaque--iron`; units `.unit`; bottom bar = `.mat-wood-dark` tray with deck/discard piles as card-back stacks (`.mat-iron` with `deck`/`discard` icon + count), hand of `.card`, End Turn = wide `.btn--primary` (AO-D024); Log, Settings `.btn` icons | Kill green-black panel and blue/red portrait fills; effects vocabulary in section 8; frozen/chains/acted states of 6.6; drop-card zone = dashed 4px `--gold-700` stepped rectangle that fills with `--gold-900` on drag-hover. |
| **Reward** | `vault` | `.bg-vault`; `.plaque--ribbon` "Victory - choose one" (Display); up to 3 large cards (240x336) with price/cost gem; below `Remove a card` `.btn` and `Skip` `.btn`; hover card lifts 8px and casts `--shadow-2` | Replace radial brown/gold with cold vault; cards use new card frames; no confirm (unchanged). |
| **Merchant** | `vault` | Same vault; shelf = a `.mat-wood` counter (32px tall plank) beneath the offers; price plates = `.plaque--wood` small with `gold` icon; relic offers use rarity frame at 64px; unaffordable = brightness .55 + red price; `Leave` = `.btn` bottom-left; gold pill top-right | Shelf becomes an actual counter; relic rarity visible; prices are pixel numerals. |
| **Event** | `vault` | Vault; event title plaque; centre `.mat-parch` scroll (`.step-8`) with description in ink; option buttons stacked below as `.btn` L with effect line in Body | `?` badge -> `node_event` icon x3 on the scroll; option cards -> uniform wide buttons with effect text. |
| **Defeat** | `defeat`: dark + blood trim | Vault layout; `.plaque--ribbon` in `--blood-700` variant (gold text kept); stats `.well` with two columns of `.row`s (see stats list below); primary `New Run` | Red muted, not bright; adds full run statistics (AO-D027). |
| **Victory / run complete** | `victory` | Same layout, gold plaque, `--tint-glow` warm | Shares component with Defeat (`RunEndScreen`); only tint + title differ. |
| **Run statistics (Defeat/Victory)** | — | Groups with Pixel 8 uppercase group labels: RUN (days, layers cleared, turns), COMBAT (battles won, enemies killed, damage dealt, damage taken, largest stack, units lost), ECONOMY (gold earned/spent, food used, cards added/removed, relics), plus hero + army snapshot (`.unit` tiles) | Stats list is the engine's `runStats` set (gameplay owns the fields); UI renders whatever fields exist; missing field = row omitted, never `0` placeholder. |
| **Pause menu / Settings / History drawer** | inherits | Modal `--iron`; buttons stacked; settings with toggles/slider; history drawer = right-side `.panel--stone` 400 wide with `.row` log lines, newest first | Emoji/round removed. |
| **Deck viewer** (bar button, AO-D040) | inherits | `.modal` `--stone`, grid of hand-size cards (144x208) in a `.well` scroll area, sort by cost then name, tabs: All / Attack / Defense / Buff / Debuff / Utility (with counts; empty tabs hidden) | New. |
| **Draw / discard pile viewers** (battle) | `battle` | Same modal; contents sorted, header states "Draw pile - N (order hidden)" | New. |
| **Card info popup** (right-click, AO-D040) | inherits | `.modal` `--stone` with `.trim-gold`; left large card 240x336; right: rules text (Body 16), condition/warning block in a `.well` with `ui_warn`, upgrade preview if upgradable | New. |
| **Hero stats popup** (click portrait, AO-D040) | inherits | `.modal` `--stone`; left 96px hero sprite frame + name plaque, right `.well` stat rows (STR DEX INT VIT WIS with pixel numbers and tooltip explanations), relic list below as rarity frames; reserved bottom section labelled LEVEL for AO-D030 is NOT rendered until designed | New. |
| **Unit info popup** (right-click) | inherits | `.modal` `--stone`; large sprite 96px, name plaque, count, stats `.well` (attack/defense/damage/reach), morale, veterancy, statuses as `.row` with icon + effect text; in bar/city also Split/Merge buttons | Restyled; content per SCREEN_SPEC. |
| **Deck picker (remove a card)** | inherits | Same as deck viewer, card click removes (hover = red outline); header `Remove a card` and reason line | Restyled. |

---

## 10. Migration order, token mapping, review checklist

### 10.1 Token mapping (old -> new)
Real tokens in `:root` today: `--bg #14161c`, `--panel #1e212b`, `--panel-2 #262a37`, `--border #3a3f4f`, `--text`, `--text-dim`, `--hp`, `--hp-low`, `--block`, `--enemy`, `--player`, `--accent`. Mapping: `--bg -> --tint-void`, `--panel -> --stone-800`, `--panel-2 -> --stone-700`, `--border -> --line`, `--text -> --text`, `--text-dim -> --text-dim`, `--hp -> --moss-500`, `--hp-low -> --blood-500`, `--block -> --steel-500`, `--enemy -> --blood-500`, `--player -> --steel-500`, `--accent -> --gold-400`.
Local per-component tokens also exist and are removed: `--pc-color` (`.path-choice-card`, set per node type), `--card-color` (`.card-tile`, `.action-card`, values `#d9534f`, `#d4af37`), `--polarity-glow` (`.polarity-attack/defense/buff/debuff/utility`), `--orb-hi` / `--orb-lo` (`.resource-orb`). Node-type colours from `--pc-color` become the 4px top band of section 9's Road row. Hard-coded hex gradients (for example `.garrison-bar` `#3a2318 -> #180f09` with `#8a3a2a` top border, `.th-scene` sky `#24314f ... #4a5a3e`) are replaced by materials. `border-radius` exists throughout (for example `.card-tile` 12px, `.path-choice-card` 10px, buttons 6px) and all of it goes.

### 10.2 Task sequence for ui-frontend (each is one task; sequential, index.css and App.tsx are hot spots)
1. **DL-1 Foundations.** Add fonts to `index.html`; tokens (2), typography (3), spacing, `.step`, bevel, shadow, materials (5), `.panel`, `.plaque`, `.btn`, scrollbar, `.well`, `.row`. Remove `border-radius` globally (temporary universal `* { border-radius: 0 !important }` is forbidden as a shim; replace properly per rule). Acceptance: all existing screens still work with new tokens, `border-radius` count in CSS = 0 except `0`, tsc/vitest green, screenshots of every screen attached.
2. **DL-2 Pixel icon engine.** `src/ui/pixel/` renderer, master palette, icons batch A (1-27, 51-54), replace all emoji in battle/bar (`unitIcons.ts`, `stackStatus.ts`, `heroIcons.ts` icon parts), test that every StatusType / UnitId has an icon. Emoji grep clean in these files.
3. **DL-3 Shared tooltip + modal + toast + tabs + toggles.** One `Tip` component; migrate all existing `title=` / bespoke tooltips; modal shell used by PauseMenu, Settings, UnitPopup, deck picker.
4. **DL-4 Cards + relics.** `ActionCardTile`, reward/merchant cards, relic frames with rarity; `rel_*` icons (batch B: relics, card types).
5. **DL-5 Unit tile + battle screen.** `StackTile`, battle frame, halves, hand tray, piles, End Turn, states (acted/frozen/chains), effects vocabulary from section 8 (effects can be split into DL-5b).
6. **DL-6 Bar + Road + City.** `GarrisonBar` (with relic cell change, Deck button), `WorldMapScreen` (parchment + node icons batch C), `CityScreen` (skyline + `bld_*` icons batch D + popups).
7. **DL-7 Overlays.** Reward, merchant, event, deck picker, vault background.
8. **DL-8 Title + hero/relic single screen + run end (with statistics).** (Hero/relic merge depends on the engine task for AO-D029 and stats fields for AO-D027.)
9. **DL-9 New popups.** Deck viewer, pile viewers, card info popup, hero popup (depend on AO-D040 engine/UI tasks).
10. **DL-10 Sprites (optional phase).** Unit/hero sprites 32x32 via the renderer of 7.6; unit tile switches from role icon x3 to sprite.
11. **DL-11 Polish pass + cleanup.** Delete orphaned CSS, verify checklist on every screen, a11y contrast check.

Each task ends with the ui-review checklist below and puppeteer screenshots at 1366x900 for every affected screen (viewed, not just captured).

### 10.3 Review checklist (pass/fail; run for every screen)
Tokens and material
- [ ] No hex literal outside `:root` / materials; no legacy token names.
- [ ] Every surface uses exactly one material class; no flat unexplained fills.
- [ ] `border-radius` absent; all corners `.step`/`.step-8`/`.gem`.
- [ ] Only borders of 2px or 4px; bevel light top-left, dark bottom-right everywhere.
- [ ] Shadows hard (`--shadow-1/2`); no blur except vignette; drop-shadow never on the clipped element.
- [ ] Screen root has `data-screen`; tint visible and matches section 9.
Type
- [ ] Only the three fonts; Pixel font for numbers/labels only; Display for titles/names; no sentence in Pixel.
- [ ] Sizes from the scale; nothing shrinks to fit; no text overflow/clip at 1366x900; no ellipsis on card names.
- [ ] Contrast: body >= 4.5:1, large >= 3:1 (measure the two lowest-contrast texts).
Icons
- [ ] Zero emoji/pictograph characters (grep passes).
- [ ] All icons via `<PixelIcon>`/`<PixelSprite>`, integer scale, `image-rendering: pixelated`.
- [ ] Every status / role / node / building / relic / unit id has an icon (test passes).
Components and states
- [ ] Every interactive element has hover + focus + pressed + disabled per catalogue; non-interactive things have none.
- [ ] Disabled controls explain why via shared tooltip.
- [ ] All tooltips come from `<Tip>` (no `title=`, no local bubbles), instant.
- [ ] Exactly one primary button per screen/modal.
- [ ] Units: no HP bar/number; acted = faded, frozen = ice, cannot-act = chains; selectable/selected rings correct.
- [ ] Cards: cost gem, art window, text box, rarity per 6.4; unplayable state and reason shown.
- [ ] Relics: rarity frame correct; empty slot dashed.
Motion
- [ ] Only tokenised durations; movement uses `steps()` except card travel/screen fade; nothing loops beyond the three allowed pulses; reduced-motion honoured.
Consistency
- [ ] Same component looks identical on every screen (button, pill, tooltip, modal, unit tile).
- [ ] Cross-screen test: place two screenshots side by side; only tint/material of the background differs, chrome is identical.
- [ ] No overflow, no clipped popups (portals), nothing below the fold at 1366x900.
- [ ] Orphaned CSS/props/functions from the change are deleted.

---

## 11. Drift and open owner questions

Drift noted: this document supersedes the Bible's "no emoji"/"three visual families" wording and the AO-D010/AO-D017 relic-cell size (28 -> 32). The Bible and SCREEN_SPEC must be updated by ui-ux once the owner approves (append an `AO-D###` entry).

Open questions for the owner:
1. Approve the three fonts (MedievalSharp / Silkscreen / Alegreya Sans)? If titles read poorly in play-tests, swap only MedievalSharp.
2. Relic grid cell 28 -> 32 px (needed for integer-scaled 16x16 icons); the hero column loses 8px of portrait height. Accept?
3. Card rarity naming: the engine has common/uncommon/rare/legendary for cards, relics use common/rare/epic (AO-D037). Keep both scales and map legendary -> epic frame as specified?
4. Is a code-drawn pixel castle/skyline on Title and City wanted now, or flat vignette only until the sprite phase?
5. Should the sprite phase (DL-10) be scheduled, or stay optional after all screens are converted?
