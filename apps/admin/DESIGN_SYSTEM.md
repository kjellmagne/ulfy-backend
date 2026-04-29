# Ulfy Admin Portal Design System

This document is the source of truth for the internal admin UI visual system. It is intentionally compact, operational, and suited for an admin control plane rather than a public marketing surface.

## Visual Identity

### Typography

- Primary font: Plus Jakarta Sans from Google Fonts.
- Weights: 400 regular, 500 medium, 600 semibold, 700 bold.
- Monospace: JetBrains Mono, Fira Code, monospace fallback.

Type scale:

- Page titles: 22px, 700, line-height 1.2, letter-spacing -0.02em.
- Panel headers: 13px, 600.
- Panel descriptions: 11px, 400, `#94a3b8`.
- Body text: 13px, 400-500.
- Field labels: 11px, 600, uppercase, letter-spacing 0.06em.
- Buttons: 13px, 500.
- Table headers: 11px, 600, uppercase, letter-spacing 0.06em.
- Badges: 11px, 700, letter-spacing 0.03em.
- Code: 12px monospace.

## Color System

Core tokens:

```css
--bg: #f1f5f9;
--panel: #ffffff;
--ink: #0f172a;
--muted: #64748b;
--line: #e2e8f0;
--line-strong: #cbd5e1;
```

Accent tokens:

```css
--accent: #0d9488;
--accent-strong: #0f766e;
--accent-soft: #f0fdfa;
```

Semantic tokens:

```css
--danger: #ef4444;
--danger-soft: #fee2e2;
--success: #15803d;
--success-soft: #dcfce7;
```

Sidebar tokens:

```css
--sidebar-bg: #0c1524;
--sidebar-text: #94a3b8;
--sidebar-active: #2dd4bf;
```

## Navigation Sidebar

- Width: 220px.
- Position: sticky, full viewport height.
- Background: `#0c1524`.
- Padding: 22px 18px 14px.
- Links use 9px 14px padding, 8px radius, 13px medium text, 10px icon/text gap.
- Hover background: `rgba(255,255,255,0.06)`.
- Active background: `rgba(13,148,136,0.15)`.
- Active text: `#2dd4bf`.
- Focus state: 2px teal outline with 2px offset.

Brand:

- 32px rounded-square mark, 8px radius.
- Gradient: teal to cyan.
- White `U`, 15px, 700.
- Title: Ulfy, 14px, 700, white.
- Subtitle: Admin Portal, 10px, uppercase, `#4b6179`.

Session block:

- Avatar: 32px circle with initials.
- Name: 12px, 600, `#e2e8f0`.
- Email: 10px, `#4b6179`.
- Role badge: 10px, 700, uppercase, teal tint.
- Logout: compact secondary button.

## Page Layout

- Main container max width: 1100px.
- Main padding: 32px desktop, 20px mobile.
- Page header bottom margin: 20px.
- Page stack gap: 16px.
- Multi-column grid gap: 14px.

Page header:

- Title: 22px, 700.
- Description: 13px, `#64748b`, 4px top margin, max-width 640px.
- Meta area: flex, 8px gap, wrapping.

## Panels And Cards

- Background: white.
- Border: 1px solid `#f1f5f9`.
- Radius: 12px.
- Shadow: `0 1px 4px rgba(0,0,0,0.04)`.
- Overflow: hidden.

Panel header:

- Padding: 16px 20px.
- Bottom border: 1px solid `#f8fafc`.
- Title: 13px, 600, `#0f172a`.
- Description: 11px, `#94a3b8`.
- Actions: right aligned, 8px gap, wraps.

## Stat Cards

- Grid: three or four columns, collapses to one column on mobile.
- Card padding: 18px 20px.
- Icon: 18px, 9px padded, 10px radius, `#f8fafc` background.
- Label: 11px, 600, uppercase, `#94a3b8`.
- Value: 30px, 700, line-height 1.
- Subtitle: 11px, `#64748b`.

## Tables

- Wrapper uses horizontal overflow.
- Table font size: 13px.
- Header cells: 10px 14px padding, 11px uppercase semibold, `#94a3b8`, `#fafbfc` background.
- Body cells: 12px 14px padding, `#f8fafc` row dividers.
- Row hover: `#fafbfc`.
- Clickable row hover: `#f0fdfa`.
- Actions column: width 1%, nowrap, right aligned.

## Buttons

Primary:

- Background: `#0d9488`.
- Hover: `#0f766e`.
- Text: white.
- Padding: 7px 14px.
- Radius: 8px.
- Font: 13px, 500.
- Icon gap: 6px.
- Active: translateY(1px).
- Disabled: 45% opacity and no press effect.

Secondary:

- Background: white.
- Text: `#374151`.
- Border: 1px solid `#d1d5db`.
- Hover: `#f9fafb`.

Danger:

- Background: `#ef4444`.
- Hover: `#dc2626`.

Icon button:

- Size: 38px square.
- Radius: 7px.
- Border: `#e2e8f0`.
- Hover background: `#f8fafc`.

## Forms

- Field layout: column, 5px gap, 14px bottom margin.
- Labels: 11px, 600, uppercase, `#64748b`.
- Inputs: 8px 10px padding, 1.5px `#e2e8f0` border, 8px radius.
- Focus: teal border and `0 0 0 3px rgba(13,148,136,0.1)`.
- Placeholder: `#94a3b8`.
- Textareas: vertical resize, min-height 100px, 12px monospace, line-height 1.7.
- Checkboxes sit in a flex label with 8px gap.

## Badges

- Display: inline-flex.
- Padding: 2px 8px.
- Radius: 99px.
- Font: 11px, 700.
- Default background: `#f1f5f9`, text `#475569`, border `#e2e8f0`.
- Active/published: green tint, `#15803d`.
- Revoked/disabled/archived: red tint, `#ef4444`.
- Inactive/draft: slate tint, `#64748b`.

## Modals

Avoid centered modals for primary resource workflows. They are reserved only for rare, short interruptions that cannot be handled inline or by a slide-in panel.

- Backdrop: fixed full-screen, z-index 500, `rgba(15,23,42,0.35)`, blur 2px.
- Default width: `min(560px, 95vw)`.
- Wide width: `min(720px, 95vw)`.
- Max height: 90vh.
- Radius: 16px.
- Shadow: `0 24px 64px rgba(0,0,0,0.18)`.
- Header padding: 20px 24px 16px.
- Body padding: 20px 24px with vertical scroll.
- Footer padding: 14px 24px, `#fafbfc` background.

## Slide-In Resource Panels

Use right-side slide-in panels for create, edit, and detail flows on core admin resources. This includes license keys, tenants, config profiles, admin users, solution partners, and long inspection flows such as license metadata or device activation lists.

- Backdrop: fixed full-screen, z-index 500, `rgba(15,23,42,0.28)`, blur 2px.
- Alignment: panel enters from the right edge.
- Width: `min(760px, 100vw)`.
- Height: 100vh.
- Background: white.
- Left border: 1px solid `#f1f5f9`.
- Shadow: `-24px 0 64px rgba(0,0,0,0.18)`.
- Entry animation: 180ms right-to-left slide.
- Header padding: 20px 24px 16px.
- Body padding: 20px 24px 28px with vertical scroll.
- Footer padding: 14px 24px when present.
- Mobile: panel takes the full viewport width.

## Data Visualization

Donut chart:

- SVG: 160px.
- Circle radius: 58.
- Stroke width: 20.
- Background circle: `#f1f5f9`.
- Data colors: teal and slate.
- Transition: 500ms stroke-dasharray.

Progress bars:

- Track height: 5px.
- Track background: `#f1f5f9`.
- Fill: teal.
- Transition: 400ms width.

Hero sparklines:

- Height: 40px.
- Gap: 3px.
- Bar color: teal.
- Rounded top corners.

## Responsive Behavior

Breakpoint: 820px.

- Shell becomes a single-column layout.
- Sidebar becomes horizontal and auto-height.
- Nav labels are hidden.
- Main padding drops to 20px.
- Multi-column grids collapse to one column.
- Page and panel headers stack vertically.
- Dashboard hero, donut layout, and detail grids collapse to single-column layouts.

## Interaction Standards

- Buttons and sidebar links transition in 130ms.
- Table rows transition in 100ms.
- Inputs transition in 150ms.
- Data visualization transitions use 400-500ms.
- Loading spinner rotates at 900ms linear infinite.
- Focus states must remain visible on keyboard navigation.

## Design Principles

- Clarity over cleverness.
- Consistent patterns across modules.
- Strong visual hierarchy for operational scanning.
- Enough breathing room to avoid crowding.
- Immediate feedback for every interaction.
- Smooth but lightweight transitions.
- Accessible focus states and readable contrast.
