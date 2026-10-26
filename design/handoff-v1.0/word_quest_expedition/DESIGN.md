---
name: Word Quest Expedition
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bec8d2'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#88929b'
  outline-variant: '#3e4850'
  surface-tint: '#89ceff'
  primary: '#89ceff'
  on-primary: '#00344d'
  primary-container: '#0ea5e9'
  on-primary-container: '#003751'
  inverse-primary: '#006591'
  secondary: '#ffb95f'
  on-secondary: '#472a00'
  secondary-container: '#ee9800'
  on-secondary-container: '#5b3800'
  tertiary: '#4ae176'
  on-tertiary: '#003915'
  tertiary-container: '#00b351'
  on-tertiary-container: '#003c16'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c9e6ff'
  primary-fixed-dim: '#89ceff'
  on-primary-fixed: '#001e2f'
  on-primary-fixed-variant: '#004c6e'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#6bff8f'
  tertiary-fixed-dim: '#4ae176'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005321'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-hero:
    fontFamily: Rubik
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 48px
  display-hero-mobile:
    fontFamily: Rubik
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 38px
  headline-lg:
    fontFamily: Rubik
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 34px
  headline-md:
    fontFamily: Rubik
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 30px
  headline-sm:
    fontFamily: Rubik
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Rubik
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Rubik
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-sm:
    fontFamily: Rubik
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  label-lg:
    fontFamily: Rubik
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  label-md:
    fontFamily: Rubik
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
  label-sm:
    fontFamily: Rubik
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-tablet: 1rem
  margin: 1rem
  margin-tablet: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system powers an immersive, mobile-first Hebrew vocabulary adventure tailored for 10-year-olds. The experience captures the feeling of an authentic expedition: an adventurous, curious explorer deciphering ancient scrolls, aligning compasses, charting trail maps, and unlocking linguistic treasures across uncharted lands.

### Brand Personality & Core Principles
- **Smart Explorer, Not a Toddler Game:** Avoid juvenile, soft-pastel tropes or casino-like skeuomorphism. The visual tone respects the intellect and agency of a 10-year-old child through tactile game elements, crisp field-journal structures, and genuine quest mechanics.
- **Dynamic Cartography & Tactile Depth:** Surfaces feel physical and deliberate, recalling compass housings, carved stone tablets, expedition badges, and parchment logbooks. Pushable interfaces feature distinct physical feedback, chunky bottom offsets, and distinct elevation tiers.
- **RTL-Native Ergonomics:** Designed from the bedrock for Right-to-Left (Hebrew) interaction on mobile portrait screens (390×844 base). Critical interactive elements (primary advance triggers, back buttons, quest trackers) match natural thumb arcs while honoring Hebrew reading mechanics.
- **Expedition Realms:** Distinctive environmental accents distinguish four progressive worlds without shattering the core navigation UI—shifting seamlessly from oceanic harbor tones, to mossy woodland canopies, alpine indigo ridges, and summit stargazing towers.

## Colors

The system uses a deep explorer base anchored in midnight slate tones, creating an ambient night-camp atmosphere that maximizes contrast and prevents eye strain during prolonged gameplay. Crisp parchment tiers nest inside dark containers to highlight interactive game cards and scrolls.

### Palette Architecture & System Tokens
- **Canvas & Backgrounds:**
  - Base Midnight: `#0f172a` (Core app canvas)
  - Expedition Slate (Container Mid): `#1e293b` (Dock, navigation bars, modal backings)
  - Field Ridge (Container High): `#334155` (Card slots, unselected options, borders)
- **Interactive Parchment & Card Surfaces:**
  - Pure Field Light: `#ffffff` (Active flashcards, quest prompts, modal sheets)
  - Parchment Tint: `#f8fafc` (Question trays, vocabulary detail cards)
  - Muted Inactive: `#f1f5f9` (Disabled inputs, secondary parchment slots)
- **Typography & Content:**
  - Text Canvas Dark: `#0f172a` (High-contrast typography on light cards)
  - Text Subdued: `#475569` (Hints, grammatical tags, etymology metadata)
  - Text On-Dark: `#f8fafc` (Headlines, counters, HUD stats)
- **Status & Progression Signals:**
  - Success / Correct Synonym: `#16a34a` (with `#15803d` bottom bevel)
  - Error / Distractor: `#dc2626` (with `#b91c1c` bottom bevel)
  - Star / XP / Discovery Gold: `#fbbf24` (with `#d97706` bottom bevel)
  - Guest / Scout Special Badge: `#8b5cf6`

### World-Specific Accents
Applied dynamically to quest headers, progress trails, and unlocked relics:
- **World 1 (נמל היסודות / Harbor of Basics):** Sea Blue `#0ea5e9` & Deep Ocean `#0369a1` with Amber `#f59e0b` rigging accents.
- **World 2 (יער ההרחבה / Forest of Expansion):** Moss Green `#22c55e` & Canopy Forest `#14532d` with Jade Lime `#84cc16`.
- **World 3 (הרי הדיוק / Mountains of Precision):** Slate Indigo `#6366f1` & Alpine Violet `#8b5cf6` with Abyssal Navy `#312e81`.
- **World 4 (מגדל המומחים / Experts' Tower):** Ancient Gold `#fbbf24` & Royal Amber `#d97706` over Celestial Navy `#1e1b4b`.

## Typography

Typography in this system serves two distinct needs: rapid, frictionless readability for 10-year-old readers and absolute clarity when rendering Hebrew diacritics (*nikud*).

### Structural Rules & Nikud Accommodation
- **Font Selection:** Powered by `Rubik` across all levels for its humanist geometry, broad counters, and native support for centered, non-colliding Hebrew vowel markings.
- **Vertical Spacing for Diacritics:** Line heights are configured with an intentional 1.45× to 1.6× buffer over typical Latin proportions. When rendering vocalized Hebrew (*menukad*), lines must never clip diacritics above or below the baseline.
- **RTL Alignment Defaults:** All typographic containers default to `text-align: right` and `direction: rtl`. Numerical displays, countdown timers, and XP badges use tabular numerals (`font-variant-numeric: tabular-nums`) to avoid layout jitter during active gameplay loops.
- **Display Weights:** Headlines and challenge keywords leverage 700 to 800 weights, maintaining legibility even against richly textured surfaces.

## Layout & Spacing

The layout is optimized for single-handed mobile portrait viewport mechanics (390×844 viewport standard), respecting hardware notches, iOS home bars, and dynamic status trays.

### Layout Mechanics
- **Grid Architecture:** 4-column fluid mobile grid spanning a safe width of 358px on a 390px viewport, expanding to an 8-column layout on tablet viewports. Outer canvas margins (`1rem` / 16px) lock content within ergonomic thumb reach.
- **Viewport Safe Anchoring:**
  - **Top HUD (Expedition Bar):** 56px fixed height pinned directly below the device status bar. Contains the Compass/World indicator, streak counter, and Star/XP gauge.
  - **Interactive Arena (Quest Canvas):** Fluid flex-column occupying central viewport space, centering challenge cards with a minimum gap of `0.75rem` (`space-md`).
  - **Bottom Action Drawer:** Fixed action zone housing primary choice cards or validation buttons, respecting a bottom safe-area offset of `1.5rem` (`space-xl`).
- **Touch Targets:** No interactive element (button, synonym chip, map node) has an active hitbox smaller than 48×48px.

## Elevation & Depth

This system avoids diffuse, blurry modern dropshadows in favor of chunky, tactile, game-inspired depth that evokes pressed physical buttons, stamped wax seals, and carved map tokens.

### The 3D Tactile Border Model
Buttons and interactive cards rely on a solid bottom-edge stroke that simulates physical extrusion:
- **Default Interactive State:** An element has a 4px solid lower border (`border-b-4`) set to a darker shade of the surface color (e.g., Primary `#0ea5e9` uses `#0284c7` or `#0369a1` on its bottom edge).
- **Active / Pressed State:** On `pointerdown` or touch, the element translates 3px vertically downward (`transform: translateY(3px)`), while the bottom border compresses from 4px to 1px. This creates instantaneous physical tactile satisfaction for young players.
- **Disabled / Depleted State:** Flat 1px border with zero vertical elevation offset and opacity reduced to 0.45.

### Elevation Hierarchy
- **Level 0 (Flat Ground):** Canvas background `#0f172a`.
- **Level 1 (Card Slots & Map Tracks):** Recessed containers using `#1e293b` with an inset shadow (`inset 0 2px 4px rgba(0,0,0,0.4)`), mimicking hollowed-out slots in a wooden expedition desk.
- **Level 2 (Tactile Quest Tiles):** Light parchment `#ffffff` with a solid 4px base border `#cbd5e1` and subtle ambient stabilization (`0 4px 6px -1px rgba(0, 0, 0, 0.2)`).
- **Level 3 (Floating HUD & Dialog Overlays):** `#1e293b` containers elevated with a crisp 1px stroke around the border and an ambient backdrop wash (`backdrop-filter: blur(8px); background: rgba(15, 23, 42, 0.85)`).

## Shapes

The shape hierarchy combines sturdy expedition gear with child-friendly geometric corners. Radii scale directly with component size to maintain visual unity.

### Geometric Rules
- **Game & Challenge Cards (16px to 24px):** Vocabulary prompt cards and synonym selection tiles use heavy rounded corners (`rounded-xl` to `rounded-2xl`). This ensures cards look like durable adventure tablets rather than stark desktop software.
- **Action Buttons & Keyboards (12px):** Quick-tap triggers, keypad buttons, and bottom CTAs use a consistent 12px radius (`rounded-lg`), balancing soft edges with precise corner definitions during rapid tapping.
- **Pills & Metagame Badges (9999px):** XP gauges, streak flames, level badges, and world chips use full continuous pill radiuses (`rounded-full`), visually categorizing them as collectable artifacts or currency tokens.

## Components

### 1. Tactile Action Buttons
- **Primary Quest Button:** High-contrast `#0ea5e9` surface with `#0284c7` 4px bottom border, white bold typography, rounded-lg (12px), min-height 52px. Full-width across mobile layouts.
- **Success Action (Validate/Next):** Emerald `#16a34a` with `#15803d` bottom lip. Animates on confirmation with micro-bounce.
- **Press Interaction:** Instantaneous 3px downward translation with audio-tactile haptic cue.

### 2. Synonym Selection Cards
- **Structure:** Parchment card (`#ffffff`), dark charcoal Hebrew text (`#0f172a`), 16px radius, bordered with 3px solid `#e2e8f0` and a 4px bottom border `#cbd5e1`.
- **Selected State:** Border shifts to World Accent (e.g., `#0ea5e9`), surface shifts to pale blue wash (`#f0f9ff`), bottom border thickens to 4px `#0284c7`.
- **Correct State:** Instant transition to `#dcfce7` surface, `#15803d` text, `#22c55e` border with `#16a34a` 4px base.
- **Incorrect/Distractor State:** Shakes laterally (4px left-right cycle), turns `#fee2e2` surface, `#dc2626` text and border.

### 3. Expedition HUD Bar
- **Placement:** Sticky top, `height: 56px`, horizontal padding `1rem`, dark slate background (`#1e293b`) with a 1px border-b `#334155`.
- **Elements:**
  - **Right (RTL Start):** Back/Exit compass button (circular 40px tactile icon button).
  - **Center:** Segmented progress bar showing quest length (e.g., 8 synonym stages) with amber trail fill.
  - **Left (RTL End):** Star currency counter with glowing `#fbbf24` gem icon and tabular number readout.

### 4. Input Fields & Text Scramble Slots
- **Letter/Word Slots:** Discrete box tiles (`48x56px`), `#1e293b` fill, 8px radius, recessed inset shadow. When filled with an explorer letter tile, transitions to white parchment tile with bold central Hebrew character.

### 5. Expedition Badges & World Chips
- **World Indicator Pill:** Dark translucent base with a glowing realm dot (e.g., Sky Blue for World 1), displaying Hebrew title (e.g., "נמל היסודות") in 12px weight-600.
- **Guest Explorer Badge:** Violet `#8b5cf6` soft badge indicating non-authenticated guest journey without interrupting play.

### 6. Quest Log Modals
- **Drawer Behavior:** Anchored to bottom edge, slides upward on completion or vocabulary explanation view.
- **Surface:** Parchment `#ffffff` card with top radius 24px, 4px top lip indicator (`#cbd5e1`), displaying synonym etymology, example sentences with nikud, and rewarding the player with expedition relics.