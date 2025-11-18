# Overview

This project is a research publication management system for CONNEQT Health, specifically tailored for cardiovascular research. It functions as a clone of Apple's Machine Learning research page, adapted to the cardiovascular/SphygmoCor domain. The system enables users to search, filter, and browse scientific publications, and it automatically imports, categorizes, and organizes content from PubMed based on predefined search terms. The primary goal is to provide a user-friendly platform for accessing critical cardiovascular research, thereby enhancing knowledge dissemination and supporting research efforts. Key capabilities include an ML-powered category suggestion system (using OpenAI GPT-5 nano for cost-effective classification) and a robust admin workflow for reviewing and managing publications.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built with React 18, TypeScript, and Vite, utilizing a component-based architecture. It uses Wouter for routing, TanStack React Query for server state management, and shadcn/ui components (based on Radix UI primitives) with Tailwind CSS for styling. The design emphasizes a fluid, responsive CSS Grid layout, consistent with Apple's aesthetic, featuring horizontal navigation and refined typography. Key features include advanced filtering by research areas, journals, and years, a single-column publication list with color-coded categories, and a robust pagination system. Recent enhancements include a dynamic Featured Carousel, a collapsible sidebar with button controls, and comprehensive HTML sanitization.

## Backend Architecture
The backend is developed with Express.js and TypeScript on Node.js, providing RESTful API endpoints for publications, categories, and PubMed integration. It features centralized route organization, custom logging, and comprehensive error handling. A core component is the asynchronous PubMed synchronization service, supporting both full and incremental syncs with real-time progress tracking. An intelligent approval workflow automates approval for complete publications and flags incomplete ones for manual review. An ML-powered Category Suggestion Service, integrated with OpenAI GPT-5 nano (optimized for classification tasks), analyzes publication abstracts to suggest relevant research areas, supported by a hybrid keyword-based fallback system. All category suggestions are automatically normalized to lowercase slugs (e.g., "eva", "ckd", "copd") for consistent data storage.

## Data Storage
The application utilizes Drizzle ORM with PostgreSQL for data persistence. The schema includes tables for publications and categories, leveraging JSON fields for flexible data storage. Drizzle migrations manage schema changes and ensure database evolution.

## System Design Choices
The system prioritizes type safety, developer experience, and scalable data management. UI/UX design balances Apple's aesthetic principles with practical full-width responsive layout, incorporating SF Pro Display font, #007AFF blue accents, consistent spacing, and a unified visual style. Responsiveness is achieved primarily through CSS-only techniques, avoiding JavaScript for layout adjustments. All text fields are subject to a comprehensive HTML sanitization process during import and display to ensure data cleanliness and prevent rendering issues.

**Category Normalization System:**
- All research area categories are stored as lowercase slugs in the database (e.g., "eva", "ckd", "copd", "heart-failure")
- Display logic automatically converts slugs to uppercase abbreviations (EVA, COPD, CKD) or proper names (Heart Failure, Hypertension)
- Case-insensitive matching ensures "eva", "EVA", and "Early Vascular Aging (EVA)" are treated identically
- Comprehensive normalization utilities in `shared/schema.ts` handle all format conversions
- ML categorization pipeline returns normalized slugs automatically
- Database contains 2,867+ publications with fully normalized category values

**Mobile Responsiveness & Zoom Behavior:**
- All content sections (Hero, Featured Carousel, Publications, Footer) use full-width layouts without max-width constraints
- Viewport meta tag allows unrestricted pinch-to-zoom for accessibility
- Sidebar auto-collapses on mobile viewports (< 640px) to maximize content space
- Content properly reflows and fills available width when users zoom in/out on mobile devices
- Desktop maintains intentional two-column layout (sidebar + publications) for optimal filtering UX

# External Dependencies

## Database Integration
- **Neon Database**: PostgreSQL hosting service.
- **Drizzle ORM**: Type-safe database toolkit.

## AI/ML Integration
- **OpenAI GPT-5 nano**: Cost-effective model optimized for classification tasks in the category suggestion system ($0.05/1M input tokens, $0.40/1M output tokens).

## PubMed API Integration
- **NCBI PubMed eUtils API**: For retrieving publication data.
- **fast-xml-parser**: For parsing PubMed XML responses.

## UI Component Libraries
- **Radix UI**: Accessible UI primitives.
- **Lucide React**: Icon library.
- **TanStack React Query**: Server state management.
- **embla-carousel-react**: For smooth horizontal carousels.
- **react-resizable-panels**: For resizable and collapsible UI elements.

## Development and Build Tools
- **TypeScript**: For static typing across the codebase.
- **Vite**: Frontend build tool.
- **ESBuild**: Fast bundling.
- **PostCSS**: CSS processing, including Tailwind CSS and Autoprefixer.

## Form and Validation
- **React Hook Form**: Form state management.
- **Zod**: Runtime type validation.
- **Drizzle Zod**: Integration for consistent validation with Drizzle ORM.