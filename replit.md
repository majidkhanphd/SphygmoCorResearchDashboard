# Overview

This is a research publication management system specifically designed for CONNEQT Health's cardiovascular research. The application is a 1:1 clone of Apple's Machine Learning research page, adapted for cardiovascular/SphygmoCor research domain. 

Users can search, filter, and browse scientific publications related to cardiovascular research including hypertension, arterial stiffness, pulse wave analysis, and related fields. The system automatically imports publications from PubMed based on predefined cardiovascular search terms, with backend processing to categorize and organize research.

## Current Status (October 2025)

**Completed:**
- ✅ Apple-perfect frontend design with horizontal navigation matching Apple ML research site
- ✅ Complete navigation structure: Overview, Research Highlights, Publications, Events, Work With Us
- ✅ PostgreSQL database with 2,616 SphygmoCor-specific research publications from PubMed Central
- ✅ Automatic PubMed synchronization service with configurable search terms
- ✅ Advanced filtering: research areas, journals, years, search, sort
- ✅ Backend API integration with real-time data display
- ✅ Publication approval workflow with auto-approval by default
- ✅ Frontend filters to display only approved publications
- ✅ Configurable SphygmoCor-specific search terms
- ✅ Fluid responsive CSS Grid layout (minmax) with natural text wrapping
- ✅ Single-column publication list with color-coded category badges
- ✅ Full author names with em-dash separators
- ✅ CSS-only responsive design without JavaScript breakpoint logic

**Admin Functions:**

*PubMed Sync:*
- `POST /api/admin/sync-pubmed` with `{"maxPerTerm": 5000}` parameter
- Configurable search terms in `server/config/search-terms.ts`
- Current query: `sphygmocor*[body]` (searches full text in PubMed Central)
- Searches in 5-year chunks from 2000 to present to capture all historical publications
- All synced publications auto-approved by default (status="approved")
- Auto-categorizes by research area and extracts keywords
- Rate-limited to respect PubMed API guidelines (350ms delay between requests)

*Publication Approval:*
- `GET /api/admin/publications/pending` - View all pending publications
- `POST /api/admin/publications/:id/approve` - Approve a publication for public display
- `POST /api/admin/publications/:id/reject` - Reject a publication
- Only approved publications appear on the website
- Backend-only workflow (no frontend UI for admin)

**Database Status:**
- 2,616 SphygmoCor-specific publications synced from PubMed Central
- Auto-approval enabled by default for all imported publications
- 96.5% auto-categorization success rate across 11 research areas

**Recent Changes (October 2025):**
- Removed JavaScript-driven responsive breakpoint logic (isMobile state and useEffect resize listener)
- Removed mobile filter modal and Filter icon in favor of always-visible sidebar
- Implemented CSS-only fluid responsive design using CSS Grid with minmax()
- Applied comprehensive min-w-0 to all flex container hierarchy levels for proper text wrapping
- Fixed navigation component to avoid nested anchor tags (wouter Link pattern)
- Changed label from "Venues" to "Journals" throughout UI
- Cleaned up unused imports (Dialog components, Filter icon, useEffect)

**Future Improvements:**
- Add authentication/authorization to admin endpoints
- Implement scheduled monthly automatic sync
- Add automated testing for approval workflow
- Category management interface

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built with **React 18** using **TypeScript** and **Vite** as the build tool. The application follows a modern component-based architecture with:

- **Routing**: Uses Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management and caching
- **UI Framework**: shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling
- **Component Structure**: Organized into reusable components with clear separation between UI components, page components, and business logic
- **Styling**: Tailwind CSS with CSS variables for theming, supporting both light and dark modes

## Backend Architecture
The backend uses **Express.js** with **TypeScript** running on Node.js:

- **API Design**: RESTful API endpoints for publications, categories, and PubMed integration
- **Route Organization**: Centralized route registration with clean separation of concerns
- **Middleware**: Custom logging middleware for API request tracking
- **Error Handling**: Centralized error handling with proper HTTP status codes
- **Development Setup**: Vite middleware integration for development with HMR support

## Data Storage
The application uses **Drizzle ORM** with **PostgreSQL** as the primary database:

- **Database**: PostgreSQL configured for production deployment
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Design**: Two main entities - publications and categories with JSON fields for flexible data storage
- **Migrations**: Drizzle migrations for database schema management
- **Development Storage**: In-memory storage implementation for development/testing with the same interface as production storage

## External Dependencies

### Database Integration
- **Neon Database**: PostgreSQL hosting service via `@neondatabase/serverless`
- **Drizzle ORM**: Database toolkit with PostgreSQL dialect
- **Connection Pooling**: Built-in connection management through Neon serverless driver

### PubMed API Integration
- **External API**: Direct integration with NCBI PubMed eUtils API for publication data
- **Data Processing**: XML parsing using `fast-xml-parser` for PubMed XML responses
- **Search Capabilities**: Publication search, retrieval, and automatic import functionality
- **Rate Limiting**: Built-in respect for PubMed API guidelines and rate limits

### UI Component Libraries
- **Radix UI**: Comprehensive set of accessible UI primitives including dialogs, dropdowns, navigation, and form controls
- **Lucide React**: Icon library for consistent iconography
- **TanStack React Query**: Server state management with caching, background updates, and optimistic updates

### Development and Build Tools
- **Replit Integration**: Custom plugins for Replit development environment including cartographer and dev banner
- **TypeScript**: Full type safety across frontend and backend
- **ESBuild**: Fast bundling for production builds
- **PostCSS**: CSS processing with Tailwind CSS and Autoprefixer

### Form and Validation
- **React Hook Form**: Form state management with performance optimization
- **Zod**: Runtime type validation and schema definition
- **Drizzle Zod**: Integration between Drizzle ORM and Zod for consistent validation

The architecture prioritizes type safety, developer experience, and scalable data management while providing a smooth user interface for browsing cardiovascular research publications.