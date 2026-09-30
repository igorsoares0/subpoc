# Handoff: Supertitle redesign — "Editorial studio"

Repo: `igorsoares0/subpoc` (Next.js App Router, Tailwind v4 `@theme inline`, lucide-react, next/font).

## Overview
Visual + UX redesign of the whole app (light theme by default, dark optional): login/register, dashboard, upload modal, billing and the subtitle editor. Goals: give the product an identity (warm paper light theme + warm near-black dark theme, one lime accent, serif display type), make the editor task-oriented (rail with one panel per task instead of one long "Styles" scroll), and treat the transcript as a document.

## About the design files
The `.dc.html` files in this bundle are **design references built in HTML** — they show intended look and behavior, they are not production code. Recreate them inside the existing Next.js/Tailwind codebase using its patterns (Tailwind classes, lucide-react icons, next/font, existing state/hooks). Open the files in a browser (keep `support.js` and `uploads/` next to them).

- `Supertitle Redesign v2.dc.html` — static boards. Turn **3**: light mode (3a tokens, 3b–3h light versions of every screen). Turn **1**: 1a direction/tokens, 1b editor, 1c editor panels, 1d editor states. Turn **2**: 2a dashboard, 2b empty dashboard + upload modal states, 2c billing, 2d login/register/check-email.
- `Supertitle Prototype.dc.html` — clickable flow (light theme): login → dashboard → upload → editor (transcribe, edit, style, render, preview, download) → billing.
- `globals.css` — drop-in replacement for `app/globals.css` with all tokens.

Items tagged **PROPOSTA** (Portuguese for "proposal") in the boards are new UX that does not exist in the app today. Implement them only if approved; everything else maps 1:1 to existing functionality.

## Fidelity
**High-fidelity.** Final colors, type, spacing and states. Match values exactly.

## Design tokens
All defined in `globals.css` (`@theme inline`), usable as Tailwind utilities (`bg-surface`, `text-ink-3`, `bg-accent`, `font-serif`…).

**Colors**
| Token | Hex | Use |
|---|---|---|
| canvas | #0E0E0C | App background |
| stage | #0A0A09 | Video stage; dot grid `radial-gradient(rgba(242,239,230,.07) 1px, transparent 1px)` 20×20px |
| surface | #151513 | Inputs, cards, segmented tracks |
| elevated | #1D1D1A | Selected block, active rail item, menus, toasts, floating toolbar |
| hover | #252521 | Hover inside elevated; active segment |
| track | #2A2A26 | Toggle-off track, disabled primary, avatar |
| paper | #F2EFE6 | Primary text, slider fill/thumb |
| ink-2 | #C9C6BB | Secondary text, icon buttons |
| ink-3 | #A6A398 | Labels, meta, inactive rail |
| ink-4 | #75736B | Placeholders, hints, disabled text |
| accent | #D6FF3D | Primary buttons, selection, playhead, focus, active state |
| accent-hover | #E3FF70 | Primary hover |
| danger | #FF5A4E | Errors, destructive hover (bg `rgba(255,90,78,.14)`) |
| danger-surface | #2A1614 | Error banner bg (border `rgba(255,90,78,.4)`) |

Borders: hairline `rgba(242,239,230,.08)` (dividers, cards) · field `.10` (inputs) · control `.14` (ghost buttons). Accent tints: `rgba(214,255,61,.08)` bg, `.35–.5` border.

Rule: lime is the **only** accent. Never use it for body text on dark except short labels; text on lime is always `#0E0E0C`.

**Typography**
| Role | Font | Size / weight / line-height |
|---|---|---|
| Display (page titles) | Instrument Serif 400 | 52px / 1.02, letter-spacing -0.01em. Italic for the second phrase ("Welcome back, *Igor*") |
| Panel titles | Instrument Serif 400 | 30px / 1 |
| Modal titles / empty states | Instrument Serif 400 | 26–44px / 1.05 |
| Wordmark | Instrument Serif 400 | 24–30px, "Supertitle" + lime "." |
| UI body | Geist 400/500 | 13–15px; transcript text 15.5px / 1.55 |
| Buttons | Geist 500 (ghost) / 600 (primary) | 12.5–14px |
| Labels | Geist 500 | 12.5–13px, sentence case (**no** uppercase tracking labels) |
| Timecodes, numbers, kbd | Geist Mono 400/500 | 10.5–13px, `tabular-nums` |

Add to `app/layout.tsx`:
```ts
import { Instrument_Serif } from "next/font/google";
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
// add instrumentSerif.variable to <body className>
```
Subtitle fonts (Montserrat, Poppins, Inter, Roboto) stay as they are — they must match the worker renderer.

**Radii**: 4 (kbd/chips) · 6 (icon buttons 26px, timeline blocks) · 8 (buttons 32–34px) · 10 (primary buttons 40–44px, panel cards, banners) · 12 (transcript blocks, project cards) · 14 (modals, billing cards). Pills/toggles: full.

**Spacing**: 4px base. Panel padding 20px (header 22px top). Page padding 40px/48px. Grid gaps 16–20px. Stack gaps 6/8/10/12/14/18px.

**Shadows**: video frame `0 20px 60px rgba(0,0,0,.6)` · modal `0 30px 80px rgba(0,0,0,.6)` · menu/toast `0 8px 24px rgba(0,0,0,.5)` · status pill `0 2px 8px rgba(0,0,0,.35)`.

**Icons**: lucide-react (already a dependency), stroke 1.5–2, 14–16px in UI, 19px in the editor rail. Every icon-only button needs a `title` including its shortcut.

## Themes — LIGHT IS THE DEFAULT (boards 3a–3h)
**Light mode is the app's default theme.** Implement from boards 3a–3h; dark (turns 1–2) is the optional alternative. Same components and layout; only token values change. `globals.css` defines light on `:root` and dark on `[data-theme="dark"]`; Tailwind tokens point at them, so utilities (`bg-surface`, `text-ink-3`…) switch automatically. Default to light regardless of `prefers-color-scheme`; the user can pick Light / Dark / System in the user menu (persist in localStorage, apply in an inline script before paint to avoid flash). Note: the Design tokens tables above list dark values — for the default theme use the Light column below.

| Token | Light (default) | Dark |
|---|---|---|
| canvas | #F4F2EC | #0E0E0C |
| stage | #E9E6DD | #0A0A09 |
| surface | #FFFFFF | #151513 |
| elevated | #ECE9E1 | #1D1D1A |
| hover | #E2DED4 | #252521 |
| track | #DAD6CC | #2A2A26 |
| paper (primary text) | #16150F | #F2EFE6 |
| ink-2 / ink-3 / ink-4 | #45433C / #6B685E / #8F8C82 | #C9C6BB / #A6A398 / #75736B |
| accent (fill) | #D6FF3D | #D6FF3D |
| accent-ink (text/icons) | #4F6300 | #D6FF3D |
| ring (selection, playhead, current plan) | #16150F | #D6FF3D |
| danger-ink / surface / text | #C8372B / #FDECEA / #B3261E | #FF5A4E / #2A1614 / #FF8A80 |
| hairline rgb | 22,21,15 | 242,239,230 |

Rules: (1) lime is fill-only in light — any lime text/icon uses `accent-ink`; (2) text on lime is always #0E0E0C; (3) selection rings, playhead and the current-plan border use `ring`; (4) inverted pills ("Ready to edit", logo tile) are `bg-paper text-canvas`; (5) video frames, subtitle rendering and template previews never change with theme; (6) shadows use `--shadow-*` vars (lighter in light). Add a theme switch (Light / Dark / System) to the user menu.

## Core components
- **Primary button**: bg accent, text #0E0E0C, 600, radius 10, h 40 (44 in auth), px 18; hover accent-hover. Compact variant h 34, radius 8.
- **Ghost button**: transparent, 1px border `.14`, text paper, 500; hover bg elevated.
- **Icon button**: 26–32px square, transparent, text ink-2; hover bg elevated/hover. Destructive: hover bg `rgba(255,90,78,.14)`, text danger.
- **Input**: h 44 (auth/dashboard) or 34 (panels), bg surface, border `.10`, radius 10/7, leading icon ink-4 15px, text 14px.
- **Segmented control**: track bg surface + hairline border, padding 3, radius 8; active segment bg hover (#252521) text paper; inactive ink-3.
- **Toggle**: 34×20 track (on: accent, off: track #2A2A26), 16px knob #0E0E0C (off knob ink-4).
- **Swatch**: 20–22px circle, ring `0 0 0 1px rgba(242,239,230,.15)`; selected `0 0 0 2px #0E0E0C, 0 0 0 3.5px #D6FF3D`.
- **Status pill** (dashboard, replaces `getStatusBadge`): h 24, radius 12, 11.5px/500, 6px dot.
  - uploading / transcribing / rendering → bg elevated, text paper, dot accent · labels "Uploading", "Transcribing", "Rendering"
  - ready → bg paper, text/dot #0E0E0C · "Ready to edit"
  - completed → bg accent, text/dot #0E0E0C · "Rendered"
  - failed → bg danger-surface, text #FF8A80, dot danger · "Failed"
- **Toast** (`components/Toaster.tsx`): bg elevated, border `.12`, radius 10, 20px circular icon badge (success accent / error danger, glyph #0E0E0C); action button text accent. Bottom-center in the editor.
- **Kbd**: Geist Mono 10.5px, text ink-2, 1px border `.14`, radius 4, padding 2px 5px.

## Screens

### Editor (`app/editor/[id]/editor-client.tsx`) — boards 1b, 1c, 1d
Grid: `64px rail | 340–360px panel (resizable, keep existing handle) | 1fr stage`, header 56px, timeline ~184px.
- **Header**: back arrow · wordmark · divider · "Projects / {title}" · "Saved" (cloud-check). Center: segmented group with format select (Original/16:9/9:16/1:1/4:3) + Undo/Redo. Right: "Export subtitles" ghost (menu: Export SRT / Export VTT with sub-lines "Universal subtitle format" / "Web video text tracks"), primary "Render video" → while rendering disabled "Rendering…" (spinner) → after a render exists, accent-outline "Preview render".
- **Rail** (replaces the Subtitles/Styles tabs): Subtitles · Style · Text · Overlays. Active: bg elevated, icon+label accent; inactive ink-3. Label 10.5px under a 19px icon.
- **Subtitles panel**: title "Transcript", meta "4 blocks · 0:18". Buttons "Auto-highlight keywords" (sparkles accent) + icon "Clear highlights". Blocks: grid `58px timecodes | text`. Inactive block = plain text 15.5px (ink-2); a "pause 0.48s" hairline divider between blocks when gap > 0.05s. Selected block: bg elevated radius 12; timecodes become editable mono inputs (start border accent .5); text editable; actions Edit · Split (split at playhead) · Merge (with next) · spacer · Delete. Footer: shortcut legend (Space Play, ←/→ Seek, I/O Trim in/out, ⌘Z Undo).
- **Style panel**: "Style", "Previewed on your own video". Template grid 2 cols, 104px tiles rendered on a video frame; selected ring `0 0 0 2px accent` + check badge. Sections "Word by word · animated" and "Full sentence" (group by `animationMode`). Footer note: templates set font, colors, outline and animation.
- **Text & animation panel**: Font select (Montserrat, Arial, Helvetica, Inter, Roboto, Poppins) · Size slider · Color swatches · Background swatches (none/black/white/…) + Opacity slider · Entry animation (None, Pop, Scale, Slide-up, Fade) as 5 tiles + Intensity segmented (Subtle/Medium/Strong) · Grouping: Words per group (stepper 1–6), Max characters (10–40), Pause split (seconds).
- **Position & overlays panel**: Position — keep drag-on-video (hint "Or drag it on the video"); 3×3 grid is PROPOSTA; Block width slider. Keywords: color swatch, Auto-highlight / Clear, hint "Highlights keywords in a fixed color (heuristic). Requires word-by-word data." Overlays cards: **Hook** (toggle, text input, color, Uppercase "AA", Size 16–96, Vertical position 2–98%) and **Logo / watermark** (moved here from the header button: toggle, file row with thumb + "PNG/JPG · up to 5 MB" + remove, Corner segmented ↖↗↙↘, Size, Opacity).
- **Stage**: stage bg + dot grid, video centered with shadow. Selected subtitle shows accent 1.5px outline + square handles. Floating toolbar above the subtitle (Font · size · color · "Style →") is PROPOSTA. Bottom-left hint "Drag subtitle to reposition".
- **Timeline**: toolbar (Trim video — active state bg elevated + accent text; Split · transport ⏪ ▶ ⏩ with 36px accent play button · mono "0:01.20 / 0:18.00" · right: "trim 0:00.50 → 0:17.00" + "Clear trim"). Tracks: ruler (mono 10px), **Subtitles track** (PROPOSTA — blocks as 6px-radius chips, selected = accent), Video filmstrip with trim overlay (outside area `rgba(14,14,12,.8)`, 2px accent frame, 10px accent handles). Playhead 2px accent with a 12×14 cap. **No audio/waveform track.**
- **States (1d)**: empty ("Your video has *no subtitles yet*" + primary "Auto transcribe"); job overlay on the video (spinner accent, serif title "Transcribing audio" / "Rendering your video", copy from code, indeterminate/progress bar accent); error banner pinned to top of stage (danger-surface, "Rendering failed." + danger "Try again" + dismiss); success toast; rendered modal ("Rendered *video*", preview, meta mono, "Re-render" ghost + "Download video" primary).

### Dashboard (`app/dashboard/dashboard-client.tsx`) — 2a, 2b
Grid `248px sidebar | 1fr`. Sidebar: wordmark 28px · nav Dashboard, Billing (active bg elevated + accent icon) · plan card (PROPOSTA: "Free plan", usage bar, "6 / 10 min this month", primary "Upgrade plan") · user row (avatar, name, email, sign-out icon). Main padding 40/48: "Welcome back, *{name}*" 52px serif + "{n} projects"; right: search input 280px + primary "New project". Cards grid 3 cols gap 20: 196px thumbnail (status pill top-left, mono duration bottom-right), title 14/500 ellipsis, date 12px ink-3, "More" icon button. Hover: border accent .4. Empty state: 60px icon tile, "No projects *yet*" 40px serif, copy from code, primary "Upload video".
- Remove the Profile and Settings links — `/dashboard/profile` and `/dashboard/settings` do not exist.
- **Bug**: `formatDuration` treats seconds as minutes (18s → "18:00"). Fix: `const m = Math.floor(s / 60), r = Math.round(s % 60); return \`${m}:${String(r).padStart(2,'0')}\``.

### Upload modal (`components/new-project-modal.tsx`) — 2b
460px, bg surface, radius 14, padding 22/20/24. Title "Upload *video*" 30px serif + close. Drop zone 250px, 1.5px dashed `.18`, radius 12; icon tile 52px; "Drag & drop your video here" / "or browse files" (underlined) / mono "MP4 · WebM · MOV — up to 500 MB". Dragging: border accent, bg `rgba(214,255,61,.06)`, copy "Drop to upload". Uploading: file row (icon tile, name, mono size·duration, % right), 6px progress accent, "Uploading… you'll land in the editor when it's done." Error: danger banner above the zone. Full-width ghost "Cancel" (hidden while uploading).

### Billing (`app/dashboard/billing/billing-client.tsx`) — 2c
Same sidebar (Billing active; plan card shows the real current plan). "Billing" 52px serif + "Manage your plan and usage." Usage card: Current plan + ghost "Manage subscription" (only with Paddle sub); two bars side by side — Minutes and Videos in library (mono "18 / 30"), 6px paper fill; ≥80% warn, ≥100% danger; "Resets {date}". Plans 3 cols: name, "Current" accent pill, price 64px serif + "/ month", features with accent check icons, primary "Upgrade to X" / "Switch to X". Current plan card: 1px accent border. Keep the activating/error banners (accent-tint / danger styles).

### Auth (`app/login`, `app/register`, `app/verify-email`, `forgot-password`, `reset-password`) — 2d
Login split screen (PROPOSTA; fallback = right column centered alone): left stage panel with dot grid, wordmark, product preview frame and headline "Subtitles that *keep them* watching." 52px serif; right column max 400: "Sign in" 44px serif, "Welcome back to your projects.", notice banner (accent tint) for verified/reset/registered, error banner (danger), Email / Password inputs (44px, leading icons), "Forgot password?" underlined link, primary "Sign in →", "or" divider, ghost Google button, "Don't have an account? Sign up". Register: same fields as code (Name, Email, Password "At least 8 characters"), "Create your *account*". Check-email state: icon tile, "Check your *email*", copy, ghost "Back to sign in". Apply the same pattern to forgot/reset/verify pages.

## Interactions & behavior
- Keyboard (existing): Space play/pause, ←/→ seek 1s, I/O trim start/end, ⌘Z / ⇧⌘Z undo/redo. Show them in tooltips and the transcript footer.
- Clicking a subtitle chip in the timeline seeks to its start and selects the block. Clicking the ruler seeks.
- Split requires the playhead inside the selected block; otherwise toast "Move the playhead inside this subtitle to split it".
- Transitions: 150ms ease on hover colors; toast enter 200ms ease-out (opacity + 8px translate); slider thumb scale 1.15 on hover.
- Transcript: the block under the playhead shows timecode in accent and text in paper.
- Min width ~1180px for the editor; dashboard grid is `repeat(auto-fill, minmax(280px, 1fr))`.

## State
No new data. New UI state only: `activePanel: 'subtitles' | 'style' | 'text' | 'overlays'` (replaces `activeTab`), and the Logo modal state moves into the Overlays panel. Everything else maps to existing state in `editor-client.tsx`.

## Assets
- Fonts: Instrument Serif (new, Google Fonts via next/font), Geist / Geist Mono (existing).
- Icons: lucide (existing).
- `uploads/pasted-1790206875121-0.png` is a screenshot used only as stand-in video imagery in the mocks — not a product asset.

## Files
- `Supertitle Redesign v2.dc.html` — boards (source of truth for visuals)
- `Supertitle Prototype.dc.html` — interaction reference
- `globals.css` — tokens / base styles to replace `app/globals.css`
- `support.js` — runtime needed to open the `.dc.html` files locally
- `screenshots/light/` — PNG exports of the **default light theme** (3a–3h). Start here.
- `screenshots/` — PNG exports of the dark boards (1a–1d, 2a–2d). The capture tool occasionally wraps short single-line labels (e.g. "Export subtitles", "Clear trim", status pills) onto two lines; in the live HTML they are single-line (`white-space: nowrap`). The HTML files are the source of truth.
