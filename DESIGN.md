# Design — Project Identity

> This document is project-long-lived. Tokens are not changed without
> the Architect's approval. Developers MUST use these tokens
> instead of improvising their own colors/spacings.

## Style Direction

Calm, modern, light office UI — neutral grey canvas with generous whitespace and a single calm blue accent reserved for actions and selection, Linear/Stripe-like restraint so that booking conflicts and errors read instantly.

## Colors

- `--color-bg`: **#FFFFFF**
- `--color-surface`: **#F7F8FA**
- `--color-surface-strong`: **#F1F3F5**
- `--color-fg`: **#111827**
- `--color-fg-soft`: **#374151**
- `--color-muted`: **#6B7280**
- `--color-border`: **#E5E7EB**
- `--color-border-strong`: **#D1D5DB**
- `--color-accent`: **#2563EB**
- `--color-accent-hover`: **#1D4ED8**
- `--color-accent-active`: **#1E40AF**
- `--color-accent-soft`: **#EFF4FF**
- `--color-danger`: **#DC2626**
- `--color-danger-hover`: **#B91C1C**
- `--color-danger-soft`: **#FEF2F2**
- `--color-success`: **#059669**
- `--color-success-soft`: **#ECFDF5**
- `--color-warning`: **#B45309**
- `--color-warning-soft`: **#FFFBEB**
- `--color-focus-ring`: **#93B4F8**
- `--color-overlay`: **rgba(17, 24, 39, 0.45)**

## Typography

- `font_family`: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif
- `font_mono`: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace
- `heading_weight`: 600
- `body_weight`: 400
- `label_weight`: 500
- `size_display`: 28px / 36px, weight 600, letter-spacing -0.01em
- `size_h1`: 22px / 30px, weight 600, letter-spacing -0.01em
- `size_h2`: 17px / 24px, weight 600
- `size_body`: 15px / 23px, weight 400
- `size_small`: 13px / 19px, weight 400
- `size_caption`: 12px / 17px, weight 500, letter-spacing 0.01em
- `numeric`: tabular-nums for all times, durations, seat counts and dates

## Spacing Scale

- `--space-0`: 4px
- `--space-1`: 8px
- `--space-2`: 12px
- `--space-3`: 16px
- `--space-4`: 24px
- `--space-5`: 32px
- `--space-6`: 48px

## Border-Radii

- `--radius-sm`: 6px
- `--radius-md`: 10px
- `--radius-lg`: 14px
- `--radius-pill`: 999px

## Components

### Button

min-height 44px (touch target on mobile), padding 10px 16px, radius md (10px), font 15px weight 500, gap 8px to optional 16px icon, transition 120ms ease-out. Variants: primary = bg accent #2563EB, text #FFFFFF, hover bg accent-hover #1D4ED8, active bg accent-active #1E40AF + translateY(1px), focus-visible ring 2px focus-ring offset 2px, disabled opacity .55 + cursor not-allowed. secondary = bg #FFFFFF, 1px border border-strong #D1D5DB, text fg, hover bg surface-strong; active translateY(1px). ghost = transparent, text fg-soft, hover bg surface; used in toolbars. danger = bg #FFFFFF with 1px border danger-soft and text danger #DC2626, hover bg danger-soft; only for delete. Sizes: md as above, sm = 36px min-height / padding 8px 12px (icon-only toolbar buttons keep 36px hit area with 8px extra pseudoelement padding). Every button carries a visible label or an aria-label; a disabled button is always accompanied by a one-line reason (e.g. 'Booking has already started').

### IconButton

40x40px, radius md, centered 18px icon, transparent bg, hover bg surface-strong, active bg surface, focus-visible ring. Used for day forward/back arrows and modal close. aria-label mandatory.

### Input

height 44px, padding 10px 12px, radius md, 1px border #D1D5DB, bg #FFFFFF, text fg 15px; placeholder muted #6B7280. hover border-strong; focus border accent + ring 2px accent-soft; error border danger + ring danger-soft. Never show an error state before the field is touched or submit was attempted (see FormField).

### Select

Same metrics as Input, native <select> for room and equipment choice, chevron 16px on the right, padding-right 36px. Includes an explicit empty option 'All rooms' / 'Any equipment'; never a pre-selected wrong value.

### FormField

Wrapper = label (13px weight 500 fg-soft, 8px below) + control + helper/error line (13px, 6px above). Error text colour danger, with the field id wired via aria-describedby and aria-invalid=true. Required marker is a single '*' after the label plus a legend line. Field-level server errors (422 detail for that field) render in the same slot as client errors; form-level 409 conflict renders in a ConflictBanner above the submit row.

### Card

bg #FFFFFF, 1px border #E5E7EB, radius lg (14px), padding 20px, shadow sm; hover elevation to md with border-strong only when the whole card is clickable. Section headings inside a card: 17px weight 600, 12px below.

### RoomCard

Grid item, min-width 260px. Row 1: room name 17px weight 600 fg; right-aligned seats badge '6 seats' (pill, bg surface-strong, 13px weight 500, tabular-nums). Row 2: equipment as pill chips (12px, bg accent-soft #EFF4FF, text accent-active, height 24px, padding 0 10px, radius pill, 6px gap, wrap) with a muted 'No equipment listed' fallback. Footer: 'View day' secondary button + 'Book' primary button, 8px gap, wrapping on narrow screens. Whole card becomes clickable on >=768px with a visible focus ring on the card itself.

### BookingListItem

One row per booking, min-height 64px, padding 14px 16px, radius md, 1px border border, bg #FFFFFF, 12px vertical gap between rows. Left column fixed 152px: time range in tabular-nums, 15px weight 600 fg, e.g. '09:00–10:30' plus duration '1 h 30 min' as 13px muted underneath. Right column: title 15px weight 500 fg (truncate with ellipsis at one line), 'booked by <name>' 13px muted below. Far right: 'Edit' secondary and 'Delete' danger buttons; for started bookings both are replaced by a muted pill 'Started' plus the tooltip/inline note 'Started bookings can no longer be changed'. Rows are ordered ascending by start; a thin accent-soft left border (3px) marks the booking currently in progress.

### EquipmentFilterChips

Multi-select filter row: each keyword is a toggle chip (height 32px, padding 0 12px, radius pill, border border-strong, bg #FFFFFF, text fg-soft 13px). Selected = bg accent, text #FFFFFF, border accent, check icon 14px. Hover = bg surface-strong. Always visible focus ring; chips wrap with 8px gap. A 'Clear filters' ghost button appears only when at least one filter is active.

### SeatsFilter

Label 'Minimum seats' + numeric Input (min 1, step 1, width 96px, tabular-nums) applied on change (debounced 200ms) with no submit button; a muted '≥ N seats' readout sits next to it. Empty input means no seat filter.

### DateNavigator

Single row: prev IconButton (aria-label 'Previous day'), date input type=date (width 160px, height 44px), next IconButton ('Next day'), and a ghost 'Today' button that is visibly disabled when the shown date already is today. Date input change reloads immediately; no extra confirm button.

### TimeRangeInput

Two controls in one field group (start, end): date input (type=date) plus two time inputs (type=time, step 300). Layout: 1 column below 640px, 3 equal columns above with 12px gap. Values are sent as ISO 8601 with offset; if end <= start show the error at the end field ('End must be after start'); over 8 hours show 'A booking may last at most 8 hours' in the same slot.

### NavTabs

Top navigation, one row, height 56px, sticky at the top with a 1px bottom border. Three tabs: 'Rooms', 'Day view', 'Free rooms' — each 44px min-height, padding 0 16px, 15px weight 500, inactive text muted with hover text fg, active text fg with a 2px accent underline and aria-current=page. Below 640px tabs become a horizontally scrollable row with 24px side padding; never wrap to two lines.

### EmptyState

Centered block inside the content area, max-width 420px, padding 32px, radius lg, bg surface, 1px dashed border-strong. Icon 24px muted, title 17px weight 600, one explanatory sentence 13px muted, optional secondary action. Copy is specific per context: room list 'No rooms match these filters. Try removing a filter.'; day view 'No bookings for <room> on <date>.'; free rooms 'No free room for this period. Try a shorter period or fewer seats.'; never a blank area.

### LoadingState

Skeleton mirroring the final layout (room card grid or booking row list) using surface-strong blocks with 1.4s shimmer, wrapped in aria-busy=true and a visually hidden 'Loading…' text. Appears for every API call (room list, day view, free-room search, form submit); the submit button itself gets a spinner and stays disabled while in flight.

### ErrorBanner

Inline banner above the affected content: bg danger-soft, 1px border #FECACA, radius md, padding 12px 16px, danger icon 16px, message 15px weight 500 fg, below it a 13px muted hint with the HTTP status. Always ships with a 'Retry' secondary button that re-runs the last request. Replaces the content region; never a silent empty screen.

### ConflictBanner

Special ErrorBanner inside the booking form for HTTP 409: title 'This period is already taken', body naming the conflicting booking — '<title> by <booked_by>, 09:00–10:30 (14.04.2026)' — using the details from the response. Form values stay untouched and the submit button remains usable so the user can adjust the time and resubmit. Uses warning-soft background, warning text, warning border for a clearer distinction from hard errors.

### Toast

Bottom-center on mobile, bottom-left on desktop; 12px inset, radius md, bg fg #111827, text #FFFFFF, 13px, auto-dismiss after 4s, with an undo-capable 'Undo' text button for deletes. Announced via role=status.

### ConfirmDialog

Modal for delete: overlay rgba(17,24,39,0.45), panel 480px max, radius lg, padding 24px, shadow lg, focus trap, Escape closes, focus returns to the triggering button. Title 17px weight 600, body 15px naming the room/booking, footer right-aligned 'Cancel' ghost + 'Delete' danger, 8px gap.

### HealthIndicator

Small pill in the header right: dot 8px + label 'API ok' / 'Database unreachable' / 'API offline' (12px, height 24px). success-soft/success when healthy, warning-soft/warning when the DB is unreachable, danger-soft/danger when the API itself does not answer; hover shows a tooltip with the /api/health payload.

## Layout Principles

- Container: max-width 1200px, centered, 24px horizontal padding below 640px, 32px from 640px up; content column for forms max-width 640px.
- Breakpoints: 640px (tabs become one row, room grid goes 1 -> 2 columns), 768px (forms go multi-column, sticky header active), 1024px (room grid up to 3 columns, side-by-side day view: booking list left, form right). Mobile-first: build the single-column layout first.
- Room list = CSS grid, repeat(auto-fill, minmax(260px, 1fr)), 16px gap; booking lists = single column, full width, 12px gap; the day view keeps the time column fixed at 152px and lets the title truncate.
- Sticky top navigation (56px) with a 1px bottom border; page content starts 24px below, page title block uses 8px between title and subtitle, 24px before the first card.
- Vertical rhythm strictly from the spacing scale: 4/8/12/16/24/32/48. Section gap 32px, gap between cards 16px, gap inside cards 12px, gap between label and control 8px. No arbitrary pixel values.
- Only one primary (accent) button per screen region — in the room list it is 'Book' on the card, in the day view 'New booking', in the free-room search 'Search'. All secondary actions are secondary/ghost.
- ONE format everywhere for every date, time, duration and amount in the whole product: date = DD.MM.YYYY (14.04.2026), time = 24h HH:MM (09:30), time range = '09:00–10:30' with an en dash, date+time = '14.04.2026, 09:00–10:30', duration = '1 h 30 min' (whole hours as '2 h', never '2.0 h' or '120 min'), seat count = plain integer followed by ' seats' ('6 seats'), and all of these in tabular-nums. All API timestamps come as ISO 8601 with offset and are converted to the office time zone (Europe/Berlin) before display; the raw ISO string is never shown to the user.
- Backend error codes map to stable UI slots: 409 with a conflicting booking -> ConflictBanner in the form; 409 started booking -> disabled controls plus inline note; 422 -> message at the named field via aria-describedby; 404/500/network -> ErrorBanner with Retry. No error ever renders as a bare string in a corner.
- State coverage is a layout rule, not an afterthought: every data region has exactly four designed states — loading (skeleton), error (banner + Retry), empty (contextual EmptyState) and filled — and no state may collapse into an unexplained blank area.
- Accessibility is part of the layout: every interactive element keeps a visible :focus-visible ring, all controls are reachable by keyboard in reading order, touch targets are at least 44x44px on screens below 768px, icons are decorative with the meaning in text or aria-label, and colour is never the only carrier of information (started bookings get a text badge, not just a colour).
- The design is responsive down to 360px width: tables become stacked rows, the date navigator stays one row with 44px targets, and no horizontal scrolling of the page body is allowed.
