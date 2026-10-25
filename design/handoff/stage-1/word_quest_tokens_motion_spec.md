# מסע המילים — Design Tokens & Motion Specification (v1.0)
## System Tokens (JSON & CSS Variables)

```json
{
  "theme": "Word Quest Expedition (מסע המילים)",
  "target_device": "Mobile Portrait (390x844 responsive down to 360x640)",
  "direction": "rtl",
  "colors": {
    "base": {
      "bg_dark": "#0a0f1d",
      "bg_card_dark": "#131c31",
      "surface_elevated": "#1e293b",
      "parchment_light": "#f8fafc",
      "text_primary": "#f8fafc",
      "text_secondary": "#94a3b8",
      "text_dark_primary": "#0f172a",
      "text_dark_secondary": "#475569",
      "border_dark": "#2a3754"
    },
    "worlds": {
      "world1_harbor": {
        "id": "harbor_of_basics",
        "name": "נמל היסודות",
        "primary": "#0ea5e9",
        "deep": "#0369a1",
        "light": "#e0f2fe",
        "accent": "#f59e0b",
        "gradient": "linear-gradient(180deg, #0284c7 0%, #0369a1 100%)"
      },
      "world2_forest": {
        "id": "forest_of_expansion",
        "name": "יער ההרחבה",
        "primary": "#22c55e",
        "deep": "#15803d",
        "light": "#dcfce7",
        "accent": "#84cc16",
        "gradient": "linear-gradient(180deg, #16a34a 0%, #14532d 100%)"
      },
      "world3_mountains": {
        "id": "mountains_of_precision",
        "name": "הרי הדיוק",
        "primary": "#8b5cf6",
        "deep": "#5b21b6",
        "light": "#ede9fe",
        "accent": "#ec4899",
        "gradient": "linear-gradient(180deg, #7c3aed 0%, #4c1d95 100%)"
      },
      "world4_tower": {
        "id": "experts_tower",
        "name": "מגדל המומחים",
        "primary": "#f59e0b",
        "deep": "#92400e",
        "light": "#fef3c7",
        "accent": "#6366f1",
        "gradient": "linear-gradient(180deg, #d97706 0%, #451a03 100%)"
      }
    },
    "feedback": {
      "success": "#16a34a",
      "success_glow": "#4ade80",
      "error": "#ef4444",
      "error_glow": "#f87171",
      "warning": "#f59e0b",
      "xp_gold": "#fbbf24",
      "guest_badge": "#a855f7"
    }
  },
  "typography": {
    "font_family_display": "'Rubik', 'Secular One', sans-serif",
    "font_family_body": "'Rubik', 'Heebo', sans-serif",
    "scale": {
      "display_hero": { "size": "32px", "weight": "800", "line_height": "1.2" },
      "word_card_target": { "size": "26px", "weight": "700", "line_height": "1.2" },
      "word_chip_option": { "size": "20px", "weight": "600", "line_height": "1.3" },
      "body_lg": { "size": "17px", "weight": "500", "line_height": "1.4" },
      "body_md": { "size": "15px", "weight": "400", "line_height": "1.4" },
      "caption_badge": { "size": "13px", "weight": "700", "line_height": "1.2" }
    }
  },
  "radii": {
    "card": "20px",
    "chip": "14px",
    "button": "16px",
    "badge": "9999px",
    "modal": "28px"
  },
  "shadows": {
    "tactile_button": "0 4px 0 var(--border-depth)",
    "tactile_button_pressed": "0 1px 0 var(--border-depth)",
    "card_glow_world1": "0 10px 25px -5px rgba(14, 165, 233, 0.25)",
    "feedback_success": "0 0 20px rgba(74, 222, 128, 0.45)",
    "feedback_error": "0 0 20px rgba(239, 68, 68, 0.45)"
  },
  "motion": {
    "drag_snap": { "duration": "180ms", "easing": "cubic-bezier(0.34, 1.56, 0.64, 1)" },
    "card_flip": { "duration": "280ms", "easing": "ease-out" },
    "bubble_pop": { "duration": "220ms", "easing": "cubic-bezier(0.175, 0.885, 0.32, 1.275)" },
    "ladder_reorder": { "duration": "240ms", "easing": "ease-in-out" },
    "correct_burst": { "duration": "350ms", "easing": "cubic-bezier(0.19, 1, 0.22, 1)" },
    "wrong_shake": { "duration": "300ms", "easing": "ease-in-out" },
    "xp_count_up": { "duration": "600ms", "easing": "ease-out" },
    "star_reveal": { "duration": "400ms", "delay_per_star": "200ms", "easing": "cubic-bezier(0.34, 1.56, 0.64, 1)" },
    "rank_up": { "duration": "800ms", "easing": "cubic-bezier(0.16, 1, 0.3, 1)" },
    "sticker_placement": { "duration": "320ms", "easing": "cubic-bezier(0.34, 1.56, 0.64, 1)" },
    "world_unlock": { "duration": "900ms", "easing": "cubic-bezier(0.25, 1, 0.5, 1)" }
  }
}
```

## CSS Custom Properties
```css
:root {
  --color-world-harbor: #0ea5e9;
  --color-world-harbor-deep: #0369a1;
  --color-world-forest: #22c55e;
  --color-world-mountains: #8b5cf6;
  --color-world-tower: #f59e0b;
  
  --color-success: #16a34a;
  --color-error: #ef4444;
  --color-xp: #fbbf24;
  --color-guest: #a855f7;

  --radius-card: 20px;
  --radius-button: 16px;
  --radius-chip: 14px;
  
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
}
```
