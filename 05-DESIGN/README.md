# Design — for the UI/UX designer

ملفات التصميم
Everything a designer needs to work on this product.

---

## أول حاجة لازم تعرفها / Read this first

**There is no `.fig` file, and none can be produced.** Figma's file format is a
closed binary with no external writer. The original build came out of Figma Make,
which means the Figma source lives in whoever's account generated it — it was
never part of the handover.

So instead of a file that cannot exist, this folder gives you three things that
**do** work, in the order you will want them:

| # | What | Use it for |
|---|---|---|
| 1 | `figma-plugin/` | Run it once in Figma and it **builds** the design system there: paint styles, text styles, and components. This is the closest thing to a real design file. |
| 2 | `/design-system` in the app | A live gallery of every component in every state, rendered by the real code. Cannot go stale. |
| 3 | `screens/` | 22 full-page screenshots at 2×, every screen and every role. |
| — | `design-tokens.json` | Machine-readable tokens for Tokens Studio or any pipeline. |

---

## 1. Build the design system inside Figma

```
figma-plugin/
├── manifest.json
└── code.js
```

**To run it:**

1. Open the Figma desktop app (plugins cannot be imported from the browser).
2. Menu → **Plugins → Development → Import plugin from manifest…**
3. Pick `figma-plugin/manifest.json`.
4. Open or create a file, then **Plugins → Development → GEOTECH HR — Design System Builder**.

It creates a new page called *GEOTECH HR — Design System* containing:

- **39 paint styles** in three groups — `Implemented/`, `GEOTECH Brand/`, `Status/`
- **8 text styles** matching the app's type scale exactly
- **Components** for buttons (4 variants × 3 sizes), inputs (3 states), status
  badges (5), alerts (4), the balance card, the permission chip, and the four
  approval-chain step states

Every value is read out of `src/styles/theme.css` and `src/app/App.tsx`, so what
appears in Figma is what ships.

**Font note:** the plugin builds in Inter because Graphik is not on Figma's font
list. Once Graphik is installed on your machine, change the family on the eight
text styles and everything inherits it.

---

## 2. The live gallery

Run the app and open **`/design-system`** — no sign-in needed.

```bash
cd 02-SOURCE/frontend
npm install && npm run dev
# then http://localhost:5173/design-system
```

Or open `01-DEMO/START-DEMO.bat` and add `/design-system` to the address.

This page imports the same components the product uses. If a developer changes a
button, this page changes with it. Treat it as the source of truth over any
screenshot or Figma frame.

---

## 3. Screens

`screens/` holds 22 full-page PNGs at 2× device pixel ratio, 1440 × 900 viewport.
Drag them straight into Figma as reference.

| Prefix | Role |
|---|---|
| `00`–`01` | Public — login, design system |
| `10`–`16` | Employee |
| `20`–`23` | Direct manager |
| `30`–`31` | Technical manager |
| `40`–`41` | General manager |
| `50`–`54` | HR |

---

## 4. Tokens

`design-tokens.json` follows the W3C Design Tokens format, so the Tokens Studio
plugin imports it directly. It carries 28 implemented colours, 5 brand colours,
6 status colours, the type scale, radii and the spacing ramp.

---

## ⚠ قرار لازم يتاخد قبل ما تبدأ / A decision to make before you start

The application and the brand **disagree**, and the audit flagged it:

| | The app renders | The brand actually is |
|---|---|---|
| Primary colour | `#1D4E89` corporate blue | `#A0840D` gold |
| Neutral | slate greys | `#626366` graphite / `#231F20` charcoal |
| Typeface | Inter (Google Fonts) | Graphik, with Neo Sans Arabic |

Both palettes are in the plugin, in the tokens file, and on the `/design-system`
page, side by side — so you can see them together rather than take my word for it.

The brand source materials are at
`C:\Users\pc\Desktop\geo-branding\` (extracted from *GEO EGYPT BRANDING
MATERIALS*), including the full Graphik and Neo Sans Arabic families, logo
artwork in AI/PDF/SVG, and business-card and letterhead templates.

**Pick one before doing design work.** Re-skinning later is cheap — every colour
is a CSS custom property in `src/styles/theme.css` — but redrawing screens twice
is not.

---

## Two more things the audit raised

- **No Arabic, no RTL.** `dir=` and `lang=` appear zero times in the codebase,
  and the loaded Inter subset carries no Arabic glyphs. For an Egyptian company
  this is a design decision, not just an engineering one.
- **The calendar is Monday-first.** The Egyptian working week is Sunday to
  Thursday. The logic now counts working days correctly, but the date-picker grid
  still starts on Monday.
