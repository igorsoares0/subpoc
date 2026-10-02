# Handoff: Supertitle redesign — "Caption" (direction 1b)

## Overview
This is a visual redesign of the whole Supertitle web app (repo `igorsoares0/subpoc`): the editor, dashboard, upload modal, billing and auth. It replaces the "Editorial studio" look (lime accent, Instrument Serif italics, paper beige) with **Caption**. Caption is creator-oriented, typographic, with one cobalt accent. Its signature motif is the **highlight block**: one key word sits on a solid accent rectangle, like a burned-in subtitle keyword. That motif appears in the logo, page titles, the active script word and selected states. Layout changes are moderate. Flows and data stay the same as in the current code.

## About the design files
The files in `design/` are **design references built in HTML**. They are not production code. The task is to **recreate them in the existing Next.js + Tailwind v4 codebase**, using its components (`components/ui/*`, `components/editor/*`, `AuthShell`, etc.) and patterns. Each `.dc.html` file opens directly in a browser. Open `Direction B v2.dc.html` to see every screen on one canvas. Screens are 1440×900.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii and copy are final. Recreate them pixel-accurately with the existing libraries (lucide-react icons, stroke width 2).

## Step 1 — tokens (do this first)
`globals.tokens.css` is a drop-in replacement for the `:root`, `[data-theme="dark"]` and `@theme inline` blocks in `app/globals.css`. **Token names are unchanged**, so most of the app restyles from this step alone. Breaking differences:
- The accent is now **themed**: `#2B3BFF` in light, `#4D5BFF` in dark. **Text on accent is white** (`on-accent`). Previously it was near-black on lime.
- New tokens: `accent-tint`, `highlight` (#FFE14D), `ok`, `ok-surface`, plus radii `3xl` and `4xl`.
- Fonts in `app/layout.tsx`:
  - **Archivo** (variable, `axes:["wdth"]`) replaces both Geist Sans and Instrument Serif.
  - **DM Mono** (400/500) replaces Geist Mono.
  - Display headings use Archivo at `font-stretch:125%` (class `.stretch-wide`). Remove all `italic` / `<em>` styling in headings. The emphasized word becomes the highlight block instead (see Components).
- Default theme stays **light**. Dark is `data-theme="dark"` (ThemeMenu already handles this).

## Design tokens

**Colors — light / dark**
- canvas (page bg): `#FFFFFF` / `#0C0C0F`
- surface ("panel": filled buttons, inputs, selected line, cards): `#F2F2EF` / `#18181D`
- elevated ("raise": rails, tracks): `#E7E7E3` / `#24242B`
- line (hairline): `#E2E2DE` / `#2A2A31`
- paper (text): `#0D0D0D` / `#F4F4F1`
- ink-2: `#3F3F3C` / `#C4C4BF`
- ink-3: `#6D6D68` / `#8E8E89`
- accent: `#2B3BFF` / `#4D5BFF`
- accent-ink: `#2B3BFF` / `#8C95FF`
- accent-tint: `rgba(43,59,255,.09)` / `rgba(77,91,255,.16)`
- highlight: `#FFE14D` in both themes. Text on it is always `#0D0D0D`.
- danger fill: `#E5322D` / `#FF5A4E`
- danger-ink: `#C4231F` / `#FF7A70`
- danger-surface: `#FDECEB` / `#2A1514`
- ok: `#16A34A` / `#4ADE80`
- ok-surface: `#E8F6EC` / `#12261A`
- backdrop: `rgba(13,13,13,.55)`
- Video content (frames, subtitle previews, look tiles) never changes with theme.

**Typography** (Archivo unless noted)
- Display XL: 64px / 800 / stretch 125% / lh .95 / ls −0.035em. Used for page titles: "Your videos", "Your plan".
- Display L: 48px / 800 / 125% / lh 1 / ls −0.035em. Used for auth headings.
- Display M: 40px (modals), 34px (dialogs), 28px ("Script" panel title). All 800 / 125% / ls −0.02…−0.03em.
- Hero numbers: upload % at 96px and plan price at 64px. Both 800 / 125% / ls −0.045…−0.05em.
- Script line text: 20px / 600 / lh 1.35 / ls −0.01em.
- Body: 14–15px / 400–600. Small: 12.5–13px.
- Button: 13.5–15px / 700 for primary, 600 for secondary.
- Mono (DM Mono): timecodes 12–15px / 500 and metadata 11–12.5px. Always tabular.
- Wordmark: `super` + `title`, 20–26px / 900 / 125% / ls −0.02em. "title" sits on an accent block with 4px horizontal padding.

**Spacing.** 4px base. Common values: 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 40. Page gutter is 40px (dashboard and billing) and 20px in the editor chrome.

**Radii.**
- pill (999): buttons, segmented controls, chips, toasts
- 10: script line, timeline blocks, tiles
- 12: inputs, thumbnails
- 14: banners, drop zones, video preview
- 16: stage container
- 18: plan cards, job dialog
- 20: modals

**Shadows.**
- Menu: `0 0 0 1px line, 0 18px 40px rgba(0,0,0,.16)`
- Toast: `0 12px 30px rgba(0,0,0,.2)`
- Job dialog: `0 24px 60px rgba(0,0,0,.25)`
- Cards and panels have **no** shadow and **no** border. Separation comes from fill (`surface` on `canvas`).

## Components (shared)
- **Highlight block.** Inline `<span>` with `bg-accent text-on-accent px-[0.15em]` (6–10px at display sizes) and no radius. Use it on exactly one word per heading. Use the danger fill for destructive dialogs ("Delete this **project?**") and the highlight yellow for the auth tagline ("**watching.**").
- **Buttons.** All are pills.
  - Primary: `bg-accent text-on-accent`, h-40 (header), h-44 (page), h-46/52 (forms, modals).
  - Secondary: `bg-surface text-paper` / 600.
  - Inverse: `bg-paper text-canvas`, used for the active nav pill, "Trim" chip and toasts.
  - Destructive: `bg-danger text-white`.
  - Hover: primary → accent-hover; secondary → hover token.
  - Focus: `outline 2px ring, offset 2px`.
  - Disabled: `bg-elevated text-ink-3`, or opacity .45 while a request is in flight.
- **Segmented control.** Container `bg-surface p-1 rounded-full gap-1`. Active item is `bg-canvas` (panel tabs) or `bg-paper text-canvas` (aspect ratio, nav). Items are h-32.
- **Input.** h-50, `bg-surface`, radius 12, px-16, 15px text, no border. Focus: `inset 0 0 0 2px accent`. Error: `inset 0 0 0 2px danger`. The label sits above at 13px / 600 with an 8px gap. No leading icons; the old Mail/Lock icons are removed.
- **Banner.** Radius 14, padding `10px 10px 10px 16px`, 18px icon, bold lead sentence plus a 500-weight ink-2 follow-up, and an optional pill action on the right. Variants:
  - danger: `danger-surface` / `danger-ink`
  - accent: `accent-tint` / `accent-ink`, for "Updating your subscription…"
  - ok: `ok-surface` / `ok`, for "Email verified!"
- **Toast.** Inverse pill, h-44, with a 24px accent circle check on the left and an optional `rgba(255,255,255,.14)` pill action. Centered at the bottom with 32px offset (in the editor: above the timeline). Uses the existing `toast-in` animation.
- **Slider.** 6px rail (`elevated`) with fill `paper`. Thumb is 18px: `bg-canvas` with `inset 0 0 0 2.5px paper`.
- **Status tag** (dashboard thumbnails). Square-cornered label at top-left, 11.5px / 700 uppercase, padding 4px 8px:
  - RENDERED: accent on white text
  - READY TO EDIT: white on `#0D0D0D` text
  - RENDERING / TRANSCRIBING: `#0D0D0D` on white text
  - FAILED: danger fill
  - Progress shows as a 4px bar at the thumbnail's bottom edge.

## Screens

### 1. Editor (`B Editor.dc.html`, props `panel`, `state`, `theme`) → `app/editor/[id]/editor-client.tsx`, `components/editor/*`, `components/timeline/VideoTimeline.tsx`
Grid: rows `64px / 1fr / 236px`; middle columns `420px / 1fr / 360px`. **The left icon rail (EditorRail) is removed.** Transcript is always on the left. Style/Text/Overlays become tabs in the right column.

**Header** (h-64, px-20, gap-16):
- back circle (36, surface), wordmark, 1px×22 divider, filename 15/600, "saved" mono 12 ink-3
- spacer, then an aspect-ratio segmented control with 9:16 / 16:9 / 1:1 / 4:3 / Original (active item inverse)
- undo/redo icon buttons (36)
- spacer, then "Export .srt / .vtt" (secondary), "Render video →" (primary) and the avatar (36, inverse, initials 12/700)

**Script (left):**
- Title "Script" (Display M 28) with mono meta "4 lines · 0:18".
- Lines are stacked with a 4px gap and 12px padding.
- The active line gets `bg-surface rounded-10 p-[14px_12px]`, which contains:
  - timecode chips: mono 12, `bg-canvas rounded-6 px-7 py-3`; the in-point chip being edited gets `inset 0 0 0 1.5px accent`
  - duration on the right
  - line text 20/600, where the currently spoken word is a highlight block and keywords use `bg-highlight text-#0D0D0D px-2`
  - action pills: Split / Merge / Edit (h-30, bg-canvas) and Delete (icon, ink-3)
- Inactive lines show the timecode range (mono 12 ink-3) above the text in ink-2.
- Footer row: "✨ Auto-highlight keywords" (accent-tint pill), "Clear" (secondary), and on the right a round "+" for add at playhead.

**Stage (center):** `bg-stage rounded-16`. The 9:16 preview is 300×533, radius 14. The selected subtitle shows a `2px accent` outline with offset 2. A floating inverse pill toolbar sits at the bottom center: font ▾ · size (mono) · color dot · "Drag to move" (accent pill).

**Right panel:** tabs Looks / Text / Overlays (segmented, active = bg-canvas). Contents per tab:
- **Looks:** 2-column tiles (h-96, radius 10) showing the real video frame darkened to 65% with a sample caption.
  - Groups: "Word by word" (Hormozi / Karaoke / Beast / Neon) and "Full sentence" (Cinema / Light).
  - Selected tile: `0 0 0 2.5px accent` ring plus an 18px accent check at top-right.
  - These map to the existing `TEMPLATES`.
- **Text:**
  - Font: 3×2 grid of tiles (h-44) showing "Aa" in each font. Selected tile is inverse.
  - Size: slider plus mono value.
  - Color: 24px swatch circles; selected = `0 0 0 2px canvas, 0 0 0 4px paper`.
  - Box: "none" swatch (diagonal danger line) plus color swatches.
  - Entry animation: 5 tiles (None / Pop / Scale / Slide-up / Fade); selected = accent fill. Strength (Subtle / Medium / Strong) is a segmented control.
  - Grouping: words-per-group stepper pill, then Max characters and Pause split sliders.
  - Field order and values are the same as in TextPanel.
- **Overlays:**
  - Position: 3×3 grid (96px), active cell accent, with a helper text next to it.
  - Block width slider.
  - Keywords: color plus Auto-highlight / Clear.
  - "Hook" card: toggle, text input, color, AA uppercase, size and vertical sliders.
  - "Logo / watermark" card: toggle, thumbnail, corner picker (4 icon pills, active inverse).
  - Cards use `bg-surface rounded-14 p-12`.

**Timeline** (h-236, border-top line, px-20):
- Transport row (h-52), a 3-column grid `1fr auto 1fr`:
  - left: "Split at playhead" (secondary) and the Trim chip (inverse pill: "Trim 0:00.50 → 0:17.00" with a round ✕ to clear)
  - **center: current time (mono 15, right-aligned, w-120) · rewind · play (42 circle, inverse) · fast-forward · duration (mono 15 ink-3) · volume**
  - right: zoom pill (− Fit +)
- Track labels column is 104px wide, with an icon and 12/600 label: Subtitles, Overlays, Video.
- Ruler: 22px tall, mono 10.5 ink-3, ticks every 1s and labels every 2s.
- Subtitles lane (44px): blocks radius 10, 12.5/600 text, inactive `bg-surface + inset 1px line`.
  - The selected block is accent with white text, shows word-boundary ticks (`rgba(255,255,255,.28)` 1px lines), and has 6px white pill trim handles inside both edges.
  - Gaps between blocks show their duration in mono 9.5 (e.g. ".48").
- Overlays lane (26px, new): two 12px pills (`bg-elevated`, 10/700 ink-2), "Hook · …" and "Logo · bottom right", spanning the trimmed range.
- Video lane (50px, radius 10): filmstrip. Trimmed-out areas get a `rgba(255,255,255,.78)` wash (dark: scrim). The kept range has a 3px paper border with 14px paper pill handles (two vertical grip lines).
- Playhead: 2px accent line plus an accent timecode flag (mono 10.5, white, pill) at the top.

**Editor states** (`state` prop):
- `empty`
  - Script area: "No subtitles **yet**" (Display 40), explainer, a primary "Auto transcribe" (h-48), and "Uses 1 of your 4 remaining minutes" ⚠ new copy, confirm it.
  - Header: Export and Render are disabled.
  - Subtitles lane: hatched placeholder.
- `transcribing`: skeleton lines in the script (fading opacity 1 → .25); the video is dimmed with a 62% scrim; centered job dialog (340w, radius 18): spinner, "Transcribing audio", copy, progress bar, "0:18 of audio · step 1 of 2"; subtitles lane shows a partial accent-tint fill "Transcribing… 38%".
- `toast`: "Transcription complete · Review" toast above the timeline.
- `rendering`: the header Render button becomes "Rendering… 42%" with an accent-tint fill growing inside it, plus the same job dialog with "Rendering your video" and "~1 min left".
- `error`: danger banner across the top of the stage: "Rendering failed. Your edits are saved." with "Try again" (danger pill) and dismiss.
- `rendered`: full modal (460w, radius 20) "Rendered **video**", a 232×412 preview with a play button, filename meta in mono, and "Re-render" (secondary) + "Download video" (primary). The header button becomes "▶ Preview render" (accent outline).

### 2. Dashboard (`B Screens.dc.html` `screen="dashboard"`) → `app/dashboard/dashboard-client.tsx`, `components/app-shell/Sidebar.tsx`
- **The sidebar is removed.** Top bar (h-72, px-40): wordmark, nav pills (Projects / Billing, active = inverse), spacer, usage pill (`6/10 min` mono, 64px bar, "Upgrade" accent mini-pill), avatar.
- Title row: "Your **videos**" (Display XL) with a mono count superscript, search pill (240×44), primary "+ New video".
- Filter chips (h-32, inactive `inset 0 0 0 1.5px line`, active inverse): All / Ready / Rendered / In progress / Failed, each with a count. ⚠ Filtering is new; it needs client-side filtering by status.
- Grid: 6 columns, gap 16. The card is a 9:16 thumbnail (radius 12) with a status tag, duration chip bottom-right (mono 11 on `rgba(0,0,0,.6)`), and below it the filename 14/700 (ellipsis), date 12.5 ink-3 and a "⋯" button.
  - Rendered cards preview the burned-in caption.
  - Uploading shows a big "58%" on surface.
  - Failed is grayscale at 35% opacity with a centered white "↻ Retry" pill ⚠ (Retry is new).
- States:
  - `empty`: a large surface panel, "Drop your first video. **We'll caption it.**", explainer, "Upload video" (h-52) and a tilted (3°) sample frame.
  - `dragging`: a full-viewport accent overlay at 88% with a dashed white 3px inset border, white circle arrow, and "Drop it." (88px / 900) plus the file name. This is a page-level dropzone (new).
  - `error`: danger banner under the title, "<file> is 14 minutes long. Free plan videos can be up to 2 minutes." with "See plans".
  - `menu`: the "⋯" becomes an inverse circle and opens a 200px menu above it (radius 14, shadow-menu) with "Open in editor" and a danger "Delete". Same actions as the current MoreMenu.
  - `delete`: **replaces `window.confirm`** with a 440px dialog showing the thumbnail and meta, "Delete this **project?**" (danger highlight), the copy "The video, subtitles and rendered file are removed for good. This can't be undone.", and Cancel / "Delete project" (danger).
  - `deleted`: toast "Project deleted".

### 3. Upload modal (`screen="upload"`) → `components/new-project-modal.tsx`
560w, radius 20, p-28, over the backdrop. The title is Display 40 and changes per state; there is a close circle.
- `default`: drop zone 300h (surface, `inset 2px line`) with a 64px inverse circle arrow, "Drag your video in", "or browse files", and mono "mp4 · webm · mov — up to 2 min on Free". The limit comes from `plan.maxVideoMinutes`.
- `dragging`: the zone turns solid accent at scale 1.02 with "Release to upload" and the file name.
- `uploading`: file row (40×64 thumb, name, size · duration), a 96px percentage and an 8px accent bar. Footer: "You'll land in the editor when it's done." and "Cancel upload".
- `error`: danger-surface zone showing "This video is too long for Free." and the upgrade copy, with "Choose another file" / "See plans →".

### 4. Billing (`screen="billing"`) → `app/dashboard/billing/billing-client.tsx`, `lib/plans.ts`
- Same top bar (Billing active). "Your **plan**" title; "Manage subscription ↗" (secondary) only when `hasPaddleSubscription`.
- Usage strip (surface, radius 18, p-26/28): a 3-column grid with Current plan (Display 40 plus resets/renews line), then Minutes and Videos in library meters (10px bars, mono values, 1px line dividers).
  - The minutes bar turns danger above 80%; the videos bar turns danger at 100%.
- Plans: 3 columns, gap 16, from `PLANS`. Card is radius 18, p-24, `bg-surface`. The current plan card is `bg-canvas` with `inset 0 0 0 2px paper` and a "Current" inverse badge.
  - Price: `$12` in Display 64 plus "/ month".
  - Features list with accent-ink checks.
  - CTA: "Upgrade to X" or, when subscribed, "Switch to X". It is inverse, except Starter, which is the accent hero for free users and gets a "Most picked" accent-tint badge ⚠ (new marketing copy).
  - The Free current card shows "You're on this plan".
- Footer note: the Paddle line (unchanged).
- States:
  - `activating`: accent banner "Updating your subscription… This takes a few seconds."; CTAs at .45 opacity.
  - `pastdue`: danger banner "Payment past due. Update your card to keep Pro — renders pause after Oct 8." with "Update payment" ⚠ (date and consequence copy need product confirmation).

### 5. Auth → `components/auth/AuthShell.tsx`, `app/login`, `app/register`, `app/forgot-password`, `app/reset-password`, `app/verify-email`
- AuthShell keeps its `1.1fr / 1fr` split.
  - **Left panel is solid accent** (no dots) with a white wordmark ("title" on a white block in accent text), tagline "Subtitles / that keep / them **watching.**" (76px / 900 / 125%, "watching." on the highlight yellow), the sub-line at 17px (88% opacity), and the real video frame (250×444, radius 18, rotated 6°, partly off the right edge).
  - Right panel: a column with max-width 400 and gap 22.
- Headings: Display L with one highlight word: "Create your **account**", "Reset your **password**", "Choose a new **password**", "Check your **email**". "Sign in" has no highlight.
- **Google button is now first**, then the "or with email" divider, then the fields ⚠ (order change). The Google button is a pill h-50 with `inset 0 0 0 1.5px line`.
- AuthState (centered state): the icon badge becomes a 64px solid circle (accent; danger for invalid links) with a white icon. The title includes a highlight word (danger fill for "Invalid **link**"). Copy is 16px ink-2. Action is primary (Verify email / Go to sign in) or secondary (Back to sign in / Request a new link).
- Copy is unchanged from the code except:
  - Login subtitle: "Your projects are waiting."
  - Register subtitle: "10 free minutes every month. No card needed." ⚠
  - Invalid link: "This reset link is invalid or has expired."

## Interactions & behavior
- Transitions: 150ms ease-out on background, color and box-shadow. Modals and the job dialog fade and scale from .98. Toasts use the existing `toast-in`. The page dropzone overlay fades in over 120ms on `dragenter` at window level and hides on `dragleave` / `drop`.
- Script ↔ timeline ↔ preview stay synced as they are today. The active line, the accent timeline block and the outlined subtitle all represent the same selection.
- The playhead flag always shows the current time and follows the playhead.
- Disabled header actions in the `empty` state; Render is replaced by progress while a render job is running.
- Validation is unchanged: password ≥ 8 characters, confirm must match, and the upload is checked against `maxVideoMinutes` and the 500 MB limit before upload starts.

## State additions
- Dashboard: `statusFilter: 'all'|'ready'|'rendered'|'in_progress'|'failed'`, `isDraggingFile`, `pendingDelete: VideoProject|null` (drives the dialog, replacing `window.confirm`).
- Editor: the right-panel tab `'looks'|'text'|'overlays'` replaces EditorRail selection; `renderResult` drives the Rendered modal.

## Assets
- `uploads/video-frame.png`: a sample frame cropped from an old screenshot, for mock purposes only. Use real thumbnails from the API.
- Icons: lucide (already a dependency). The Google "G" in the mocks is a stand-in; keep the existing `GoogleButton` logo.

## Files
- `design/Direction B v2.dc.html`: canvas with every screen (turns 1–4, ids 2a–4l)
- `design/B Editor.dc.html`: editor with `panel`, `state` and `theme` props
- `design/B Screens.dc.html`: dashboard, upload, billing and auth with `screen`, `state` and `theme` props
- `design/Direction B - Caption.dc.html`: the original 1b direction board
- `globals.tokens.css`: token drop-in for `app/globals.css`
- `screenshots/`: 40 PNGs, one per screen/state (01–10 editor, 11–18 dashboard, 19–22 upload, 23–26 billing, 27–40 auth). Rendered from the HTML at 1440×900 and scaled down for preview — the HTML is the source of truth for exact values.
