---
name: Kinetic Transmission
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#5c3f40'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#906f70'
  outline-variant: '#e5bdbe'
  surface-tint: '#be0037'
  primary: '#b80035'
  on-primary: '#ffffff'
  primary-container: '#e11d48'
  on-primary-container: '#fffaf9'
  inverse-primary: '#ffb3b6'
  secondary: '#545f73'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f8'
  on-secondary-container: '#586377'
  tertiary: '#585c5d'
  on-tertiary: '#ffffff'
  tertiary-container: '#717476'
  on-tertiary-container: '#f9fbfd'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdada'
  primary-fixed-dim: '#ffb3b6'
  on-primary-fixed: '#40000c'
  on-primary-fixed-variant: '#920028'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '450'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  stack-xs: 4px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
  stack-xl: 48px
---

## Brand & Style

The design system is engineered for a high-performance SMTP and email delivery SaaS. The brand personality is rooted in **Reliability, Velocity, and Precision**. It targets DevOps engineers and product owners who require enterprise-grade stability without the friction of legacy software.

The visual style is **Corporate Modern with a Performance Edge**. It utilizes a "Clean & High-Trust" aesthetic, characterized by generous whitespace, a strict adherence to grid systems, and a focused color palette. The emotional response should be one of "effortless scale"—the user should feel that the infrastructure is robust enough to handle millions of requests while remaining intuitively manageable. 

Key stylistic markers include:
- **High-Velocity Accents:** Using the vibrant primary red to draw the eye to critical actions and delivery status.
- **Data Clarity:** Prioritizing legibility and structural hierarchy to make complex delivery logs and API configurations digestible.
- **Technical Sophistication:** Subtle use of monospaced elements for technical identifiers to reinforce the developer-centric nature of the product.

## Colors

The palette is anchored by **Vibrant Crimson (#E11D48)**, a color that denotes urgency and action, repurposed here to represent the "pulse" of live delivery. 

- **Primary:** Used for primary call-to-actions, active navigation states, and critical success indicators.
- **Secondary (Deep Charcoal):** Used for primary headings and sidebars to provide a grounded, high-contrast frame for the UI.
- **Tertiary (Cloud Grey):** Used for subtle backgrounds and grouping containers to separate content without adding visual noise.
- **Neutral (Slate):** Used for body text and secondary icons, ensuring long-term readability and a professional tone.

Surface colors follow a strict hierarchy: `#FFFFFF` for the main content area, `#F8FAFC` for secondary interface regions (like sidebars or tables), and `#E2E8F0` for subtle borders.

## Typography

This design system utilizes **Inter** for all UI elements to ensure maximum legibility and a modern, neutral tone. The scale is built on a tight 4px baseline grid.

- **Headlines:** Use a tighter letter-spacing and heavier weights to create a sense of authority. 
- **Data Display:** For API keys, logs, and SMTP settings, use **JetBrains Mono**. This provides the necessary character distinction (e.g., between '0' and 'O') required for technical environments.
- **Hierarchy:** Maintain a clear distinction between "Interface" text (labels, buttons) and "Content" text (descriptions, documentation). Labels should frequently use the `label-caps` style to define section headers within sidebars and cards.

## Layout & Spacing

The layout utilizes a **12-column fluid grid** for the main dashboard content, with a fixed-width left navigation bar (240px). 

- **Desktop:** 32px outer margins with 24px gutters. Elements typically span 3, 4, 6, or 12 columns.
- **Tablet:** 24px outer margins. The 12-column grid persists, but sidebars may collapse into an icon-only "rail."
- **Mobile:** 16px outer margins. The layout collapses into a single column. 

A vertical "stack" rhythm is used to maintain consistency:
- **8px (sm):** Between labels and inputs.
- **16px (md):** Between related elements in a card.
- **24px (lg):** Between separate cards or sections.
- **48px (xl):** Major page section breaks.

## Elevation & Depth

To maintain a professional, enterprise-grade feel, this design system avoids heavy shadows in favor of **Tonal Layers** and **Precise Outlines**.

- **Level 0 (Background):** `#F8FAFC`. Used for the main application canvas.
- **Level 1 (Cards/Surface):** `#FFFFFF` with a 1px solid border in `#E2E8F0`. This is the standard container for all dashboard widgets.
- **Level 2 (Overlays):** Used for dropdowns and popovers. These utilize a subtle, diffused shadow: `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`.
- **Level 3 (Modals):** High-impact depth. `0 20px 25px -5px rgb(0 0 0 / 0.1)`.

Interactive elements (like buttons) do not use elevation to denote state; instead, they use background color shifts and subtle scale transforms (98%) on press.

## Shapes

The shape language is **Structured and Sophisticated**. A standard radius of **8px (0.5rem)** is applied to most UI components, including input fields, buttons, and small cards. 

- **Small Components:** 8px (standard).
- **Large Containers:** 16px (rounded-lg) for main dashboard cards and modals.
- **Search Bars / Badges:** 9999px (pill) to distinguish them from functional action buttons.

Borders are kept to a consistent 1px width, except for focused states which increase to 2px using the primary red color.

## Components

### Buttons
- **Primary:** Solid `#E11D48` with white text. High contrast, 8px radius.
- **Secondary:** White background with `#E2E8F0` border and `#1E293B` text. 
- **Ghost:** No background/border, primary red text. Used for secondary actions in tables.

### Inputs
- **Text Fields:** 8px radius, `#F8FAFC` background, 1px border. On focus, the border transitions to 2px `#E11D48` with a subtle glow.
- **Monospace Inputs:** Specifically for API tokens and SMTP secrets, using the `code-sm` typography.

### Data Visualization
- **Charts:** Use a palette of Primary Red, Slate Blue, and Emerald Green for "Success" metrics. Lines should be 2px thick with subtle area gradients.
- **Status Chips:** Small, semi-transparent backgrounds with high-saturation text (e.g., "Delivered" in green, "Bounced" in red).

### Cards
- Dashboard cards should always have a 1px border and 16px of internal padding. Header areas within cards should be separated by a light 1px horizontal rule.

### Lists & Tables
- Data tables use a "Zebra" striping on hover rather than fixed row colors. Header cells are `label-caps` with a light grey background (`#F1F5F9`).