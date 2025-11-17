# Overview

This project is a research publication management system for CONNEQT Health, focused on cardiovascular research. It's a 1:1 clone of Apple's Machine Learning research page, adapted for the cardiovascular/SphygmoCor domain. The system allows users to search, filter, and browse scientific publications related to cardiovascular research. It automatically imports, categorizes, and organizes publications from PubMed based on predefined search terms, ensuring a comprehensive and up-to-date repository. The project's ambition is to provide a dedicated, user-friendly platform for accessing critical cardiovascular research, enhancing knowledge dissemination and supporting research efforts.

## Recent Updates (November 2025)

**Admin Performance Optimization (November 17, 2025):**
- Resolved freezing/blocking issues on admin page when handling large datasets (2,500+ publications)
- Memoized client-side filtering with useMemo to prevent unnecessary recomputations on every render
- Fixed sync-status query invalidation to use prefix-based matching for paginated queries
- Verified backend SQL queries use LIMIT/OFFSET at database level (not post-processing)
- Performance results: Smooth tab switching, responsive search (400ms debounce), quick pagination (<2s), API calls ~2.5-3s with non-blocking UI
- Admin page now handles thousands of publications without freezing during search, filter, tab switching, or pagination operations

**Featured Research & Sidebar Polish (November 15, 2025 - Final):**
- Redesigned Featured Research cards to match main publications list format
- Removed abstract preview from featured cards, added authors display instead
- Authors now show with proper formatting (sanitizeAuthors decodes HTML entities while preserving commas)
- Journal/date format simplified to "Journal, Year" (e.g., "Open Heart, 2025")
- Softened "Read Paper" button styling: subtle gradient (rgba blue, low opacity), font-weight 400, blue text instead of white
- Fixed sidebar collapse to fully disappear: collapsedSize=1 with forced width:0px when collapsed
- Added smooth 200ms transitions with overflow-hidden to prevent partial/broken visual states
- Sidebar height constrained to max-h-[70vh] to prevent extending beyond main content
- Updated minSize from 10% to 16% for better collapse threshold
- All E2E tests passing: featured cards, sidebar collapse/expand, and formatting working correctly

**Collapsible Sidebar with Button Controls (November 15, 2025 - Late Night):**
- Implemented button-controlled sidebar collapse/expand functionality using react-resizable-panels
- Added collapse button (ChevronLeft icon, #007AFF blue) in top-right of sidebar when expanded
- Added floating expand button (ChevronRight icon) on left edge when sidebar is collapsed
- State synchronization: React state (`isSidebarCollapsed`) syncs with panel state via `isCollapsed()` method
- Panel configuration: defaultSize=28%, minSize=10%, maxSize=40%, collapsible=true, collapsedSize=5%
- Stores last expanded size to restore sidebar to previous width when expanding
- User workflows supported:
  - Click collapse button → sidebar collapses to 5% → expand button appears
  - Click expand button → sidebar expands to last size (or 28% default) → collapse button reappears
  - Manual drag resize continues to work (ResizableHandle always visible per earlier update)
- Hero banner updated: "Arterial Intelligence©" (line 1), "Research" (line 2)
- Intro text section below hero removed for cleaner layout
- All changes maintain Apple ML aesthetic and responsive design

**UI Polish & HTML Entity Sanitization (November 15, 2025 - Evening):**
- Redesigned category badges: plain colored text with dash separators (—) replacing rounded badge backgrounds
- Added colored circular dots (●) to sidebar category filters using CATEGORY_COLORS
- Created HTML entity sanitization utility (client/src/utils/sanitizeAuthors.ts) to decode all PubMed HTML entities
- Applied sanitization to all publication text fields: titles, abstracts, journals, authors
- Common entities decoded: &#228;→ä, &#246;→ö, &#177;→±, &#215;→×, &#8208;→‐, &#8211;→–, &#8217;→'
- Enhanced ResizableHandle visibility on desktop (6px width) while keeping it hidden on mobile/tablet (lg:flex)
- All changes maintain Apple ML aesthetic with improved text clarity and mobile UX

**Featured Carousel Implementation (November 15, 2025 - Morning):**
- Replaced static ResearchHighlights section with dynamic horizontal scrolling FeaturedCarousel
- Implemented using embla-carousel-react for smooth horizontal navigation
- Responsive card display: 1 card (mobile), 2 cards (tablet), 3 cards (desktop)
- Navigation controls: top-right arrows on desktop, bottom-center arrows on mobile/tablet
- Compact featured publication cards with title, abstract preview, journal, date, categories, and Read Paper button
- Backend increased featured publications limit from 5 to 30
- Reduced vertical spacing throughout:
  - Intro section: py-12→py-8 (sm:py-16→sm:py-10)
  - Publications section top padding: 64px→48px
  - Footer margin-top: 96px→48px
- Layout flow: Navigation → Hero Banner → Intro Text (py-8) → Featured Carousel (py-8) → Publications Section (pt-48px) → Footer (mt-48px)

**Site Polish & Refinements (November 13, 2025):**
- Replaced "CONNEQT Health Research" text with company logo in navigation
- Logo sized to h-8 (32px) to maintain header proportions
- Navigation layout updated with flex justify-between to support future nav items
- Changed orange/gold gradient accent line to simple black line
- Updated hero banner heading to "CONNEQT Health Arterial Intelligence Research"
- Simplified hero banner (removed description paragraph for cleaner look)
- Added new intro text section between Navigation and ResearchHighlights
- Moved SphygmoCor technology description to intro section
- Changed pagination default from 50 to 25 items per page
- All changes maintain full responsiveness and Apple-inspired design language

**Site Restructure - Publications as Main Landing Page:**
- Publications is now the primary landing page at `/` (root route)
- New full-width HeroBanner component with gradient background and pulse-wave animation placeholder
- Navigation simplified to Apple ML style (logo only, no horizontal menu tabs)
- Deprecated routes now redirect to main page: `/overview`, `/highlights`, `/updates`, `/work-with-us`
- Admin panel remains accessible at `/admin`

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built with React 18, TypeScript, and Vite. It features a component-based architecture using Wouter for routing, TanStack React Query for server state management, and shadcn/ui components (built on Radix UI primitives) with Tailwind CSS for styling. The design emphasizes a fluid responsive CSS Grid layout without JavaScript breakpoint logic, ensuring an Apple-perfect aesthetic with horizontal navigation and consistent typography. Key features include advanced filtering (research areas, journals, years), a single-column publication list with color-coded categories, and a robust pagination system with configurable results per page.

## Backend Architecture
The backend uses Express.js with TypeScript running on Node.js, offering RESTful API endpoints for publications, categories, and PubMed integration. It includes centralized route organization, custom logging middleware, and comprehensive error handling. A key feature is the asynchronous PubMed synchronization service, which supports both full and incremental syncs, with real-time progress tracking via a `SyncTracker` singleton. An intelligent approval workflow auto-approves complete publications and marks incomplete ones for manual review.

## Data Storage
The application uses Drizzle ORM with PostgreSQL. The schema includes publications and categories with JSON fields for flexible data storage. Drizzle migrations manage schema changes.

## System Design Choices
The system prioritizes type safety, developer experience, and scalable data management. UI/UX decisions are heavily inspired by Apple's design language, including SF Pro Display font and #007AFF blue accents, consistent spacing, and a unified visual style across all pages. Responsiveness is achieved through CSS-only techniques.

# External Dependencies

## Database Integration
- **Neon Database**: PostgreSQL hosting service.
- **Drizzle ORM**: Database toolkit for type-safe operations.

## PubMed API Integration
- **NCBI PubMed eUtils API**: For publication data retrieval.
- **fast-xml-parser**: For parsing PubMed XML responses.

## UI Component Libraries
- **Radix UI**: Accessible UI primitives.
- **Lucide React**: Icon library.
- **TanStack React Query**: Server state management.

## Development and Build Tools
- **TypeScript**: For full type safety.
- **Vite**: Frontend build tool.
- **ESBuild**: Fast bundling.
- **PostCSS**: CSS processing with Tailwind CSS and Autoprefixer.

## Form and Validation
- **React Hook Form**: Form state management.
- **Zod**: Runtime type validation.
- **Drizzle Zod**: Integration for consistent validation.