# Overview

This is a research publication management system specifically designed for SphygmoCor cardiovascular research. The application allows users to search, filter, and browse scientific publications related to SphygmoCor technology, with features for importing publications from PubMed, organizing them by medical categories, and displaying featured research.

The system provides a comprehensive interface for researchers to discover relevant cardiovascular studies, with advanced filtering capabilities by categories like Chronic Kidney Disease, Hypertension, Heart Failure, and other cardiovascular specialties. It includes statistics tracking, featured publication highlighting, and PubMed API integration for automatic data import.

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