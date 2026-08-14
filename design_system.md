---
name: Lumina Project Systems
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#434655'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#005a82'
  on-tertiary: '#ffffff'
  tertiary-container: '#0074a6'
  on-tertiary-container: '#e4f2ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#c9e6ff'
  tertiary-fixed-dim: '#89ceff'
  on-tertiary-fixed: '#001e2f'
  on-tertiary-fixed-variant: '#004c6e'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  sidebar-width: 260px
  container-max-width: 1200px
  gutter: 24px
  margin-mobile: 16px
  stack-gap: 12px
  section-gap: 40px
---

## Brand & Style
The design system focuses on high-efficiency project orchestration through a **Modern Minimalist** lens. The brand personality is professional, transparent, and focused, aiming to reduce the cognitive load of project management. It evokes a sense of "planned clarity" by utilizing expansive whitespace and a structured information hierarchy.

The aesthetic avoids unnecessary ornamentation, relying on precise alignment and subtle depth to guide the user's eye. The target audience includes product managers, stakeholders, and high-output teams who require a distraction-free environment for status reporting and milestone tracking.

## Colors
The palette is built on a "Bright and Airy" foundation. The primary color is a crisp **Indigo-Blue (#2563EB)**, used strategically for primary actions and active states to provide high-contrast affordance against the neutral backdrop.

- **Surface Strategy:** The main canvas is pure `#FFFFFF`. Background offsets for sidebars and secondary containers use `#F9FAFB` to create soft structural separation.
- **Accents:** Secondary Slate-Greys are used for metadata and icons, ensuring the primary blue remains the dominant signal for interaction.
- **Status:** Standard semantic colors (Success/Green, Warning/Amber, Error/Red) should be desaturated to fit the professional tone but maintain clear visibility.

## Typography
This design system utilizes **Hanken Grotesk** (as the closest high-quality alternative to Pretendard) to achieve a modern, neo-grotesque look that excels in legibility. 

- **Hierarchy:** Use `headline-xl` only for main dashboard titles. `headline-md` is the standard for card titles and section headers.
- **Readability:** Body text uses a generous 1.5x line height to ensure project updates remain scannable during long reading sessions.
- **Labels:** Small caps or bolded `label-md` should be used for table headers and category tags to differentiate them from interactive body text.

## Layout & Spacing
The layout follows a **Hybrid Fixed-Fluid Model**. 

- **Navigation:** A fixed left sidebar (`260px`) provides consistent global context. It uses a light grey background (`#F9FAFB`) to recede visually from the main workspace.
- **Main Content:** A scrollable area that centers content within a `1200px` max-width container on desktop. 
- **Rhythm:** A strict 8px-based spacing system is used. Gaps between related items (like update cards) are `12px` or `16px`, while major page sections are separated by `40px` to maintain an "airy" feel.
- **Responsive:** On mobile, the sidebar transitions to a hidden off-canvas drawer, and horizontal margins shrink to `16px`.

## Elevation & Depth
The design system employs **Tonal Layering** combined with **Ambient Shadows** to define hierarchy.

- **Level 0 (Base):** The main background (`#FFFFFF` or `#F9FAFB`).
- **Level 1 (Cards):** Raised surfaces use a very subtle shadow: `0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)`. 
- **Level 2 (Overlays/Dropdowns):** Higher elevation for menus uses a more diffused shadow: `0 10px 15px -3px rgba(0, 0, 0, 0.08)`.
- **Outlines:** Use soft `1px` borders in `#E5E7EB` for input fields and static containers to provide structure without the weight of heavy shadows.

## Shapes
The shape language is **Rounded** and friendly yet precise. 

- **Standard Radius:** 8px (`0.5rem`) for standard components like input fields, small buttons, and small cards.
- **Large Radius:** 12px (`0.75rem`) for main update feed cards and larger containers to soften the overall interface.
- **Buttons:** Primary buttons use the standard 8px radius, while "Go to page" links may use a fully rounded/pill shape if they are standalone floating actions.

## Components
- **Buttons:** 
    - *Primary:* Solid `#2563EB` with white text. High-contrast, 8px corner radius.
    - *Secondary:* Ghost style with `#2563EB` border and text.
    - *Go to Page:* Includes a trailing chevron icon to indicate navigation.
- **Update Cards:** Use a white background, 12px radius, and the Level 1 subtle shadow. Include a clear timestamp in `body-sm` grey text at the top right.
- **Sidebar Nav:** Items use a transparent background in default state, shifting to a very light blue (`#EFF6FF`) with a thick left-accent border (4px) in the active state.
- **Input Fields:** Minimum height of 44px for touch-friendliness, with a `#E5E7EB` border that transitions to `#2563EB` on focus.
- **Status Chips:** Small, semi-rounded (4px) badges with low-opacity background tints (e.g., 10% opacity of the semantic color).
- **Progress Bars:** Thin (8px height) track in light grey with a solid primary blue fill to indicate project completion.
