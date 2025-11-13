# Overview

This project is a research publication management system for CONNEQT Health, focused on cardiovascular research. It's a 1:1 clone of Apple's Machine Learning research page, adapted for the cardiovascular/SphygmoCor domain. The system allows users to search, filter, and browse scientific publications related to cardiovascular research. It automatically imports, categorizes, and organizes publications from PubMed based on predefined search terms, ensuring a comprehensive and up-to-date repository. The project's ambition is to provide a dedicated, user-friendly platform for accessing critical cardiovascular research, enhancing knowledge dissemination and supporting research efforts.

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