# Design Guidelines: Apple-Inspired Research Publications Platform

## Design Approach
**Reference-Based: Apple Human Interface Guidelines**
Justification: Explicitly requested Apple aesthetic for a content-focused research platform requiring precision, clarity, and refined interactions. Apple's design language perfectly suits scientific content presentation with clean typography, generous whitespace, and subtle motion.

## Typography System
**Font Stack:** SF Pro Display (headings), SF Pro Text (body) via Apple CDN fallback to system fonts (-apple-system, BlinkMacSystemFont)

- **Display:** 48px/56px semibold (page titles)
- **H1:** 36px/44px semibold (section headers)
- **H2:** 24px/32px medium (subsections, publication titles)
- **H3:** 18px/24px medium (card headers, labels)
- **Body Large:** 17px/26px regular (article abstracts)
- **Body:** 15px/22px regular (metadata, descriptions)
- **Caption:** 13px/18px regular (timestamps, auxiliary info)

## Layout System
**Spacing Primitives:** Tailwind units 2, 4, 6, 8, 12, 16, 24
- Component padding: p-6, p-8
- Section spacing: py-16, py-24
- Card gaps: gap-4, gap-6
- Margins: mb-2, mb-4, mb-8

**Grid:** max-w-7xl container, 12-column responsive grid

## Core Components

### Public-Facing Pages

**Hero Section (Full-width with Image)**
Large hero image showcasing research/lab environment with overlaid content container (max-w-4xl). Blurred-background button for primary CTA. Height: 75vh desktop, 60vh mobile.

**Publications Grid**
Masonry-style card layout (2 cols mobile, 3 cols desktop). Each card: white background, subtle shadow (shadow-sm hover:shadow-lg transition), rounded corners (rounded-2xl), p-6. Card structure: publication title (H2), authors list (Body), abstract preview (Body Large, 3-line clamp), metadata row (journal, date, citation count).

**Filter/Search Bar**
Floating toolbar (sticky top-4), frosted glass effect (backdrop-blur-xl bg-white/80), search input with icon, filter chips with count badges, sort dropdown.

### Admin Dashboard

**Sync Control Panel**
Card-based layout with: Large sync button (primary action), last sync timestamp, total publications count, sync frequency selector (dropdown).

**Real-Time Progress Elements**

*Toast Notifications:*
Slide-in from top-right, frosted glass (backdrop-blur-xl bg-white/90), rounded-2xl, p-4. Structure: icon (animated spinner during sync), title (medium weight), progress percentage, dismiss button. Auto-dismiss after 5s or persistent for errors.

*Status Badges:*
Inline pill badges (rounded-full px-3 py-1), subtle background fills. States: Syncing (pulsing animation), Success (static), Error (static), Idle. Monochrome with subtle tints.

*Progress Indicators:*
Linear progress bar (h-1 rounded-full) with smooth fill animation. Indeterminate shimmer for processing. Display above publication list during sync.

**Publication Management Table**
Alternating row treatment, expandable rows for full abstract, inline edit icons, bulk select checkboxes. Columns: title, authors, date, status, actions.

## Animations
**Subtle Motion Only:**
- Card hover: transform scale(1.02) + shadow transition (200ms ease)
- Status changes: fade in/out (300ms)
- Progress bars: smooth width transitions (400ms ease-out)
- Toast entry: slide + fade (250ms)
- Sync button: subtle pulse during active sync

## Navigation
**Top Navigation Bar:**
Frosted glass effect (backdrop-blur-xl), sticky. Logo left, search center, admin link right. Clean divider line (1px opacity-10).

**Footer:**
Full-width, multi-column (4 cols desktop): About Research, Quick Links, Contact, Newsletter signup. Clean typography, minimal decoration.

## Images

**Hero Image:** High-quality research laboratory or scientific imagery (microscope, data visualization, researchers collaborating). Dimensions: 2400x1350px. Subtle gradient overlay (linear-gradient from transparent to black/20 at bottom) for text readability.

**Publication Thumbnails:** Journal cover images or research graphics (400x300px) displayed in cards where available.

**Placeholder Strategy:** Use abstract geometric patterns or PubMed logo integration for publications without images.