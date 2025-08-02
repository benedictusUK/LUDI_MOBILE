# replit.md

## Overview

SportSync is a full-stack sports event management platform that allows users to create and manage sports teams, organize events, and handle team communications. The application features a modern React frontend with shadcn/ui components, an Express.js backend with Replit authentication, and PostgreSQL database integration using Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite as the build tool
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens optimized for sports applications
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Authentication**: Replit OAuth integration with session-based authentication
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **API Design**: RESTful API endpoints with proper error handling

### Database Architecture
- **Primary Database**: PostgreSQL (via Neon serverless)
- **ORM**: Drizzle with type-safe schema definitions
- **Migration Strategy**: Drizzle Kit for schema management
- **Connection**: Neon serverless with WebSocket support for optimal performance

## Key Components

### Authentication System
- **Provider**: Replit OAuth with OIDC (OpenID Connect)
- **Session Management**: Server-side sessions stored in PostgreSQL
- **Security**: HTTP-only cookies with secure flags for production
- **User Management**: Automatic user creation/updates on authentication

### Core Business Logic
- **User Management**: Profile creation and management integrated with Replit identity
- **Team Management**: Create teams, manage memberships, role-based access
- **Event Management**: Create events, link to teams, scheduling with recurrence options
- **Notification System**: Real-time notifications for team and event updates

### UI Component System
- **Design System**: shadcn/ui with "new-york" style variant
- **Theme**: Custom sports-focused color palette with primary blue, secondary green, and accent red
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Accessibility**: Radix UI primitives ensure WCAG compliance

## Data Flow

### Authentication Flow
1. User accesses protected route
2. Express middleware checks session validity
3. If unauthenticated, redirects to Replit OAuth
4. OAuth callback creates/updates user in database
5. Session established with user context

### API Request Flow
1. Frontend makes authenticated requests with credentials
2. Express middleware validates session
3. Business logic processes request with user context
4. Database operations via Drizzle ORM
5. Response with appropriate error handling

### Client State Management
1. TanStack Query manages all server state
2. Optimistic updates for better user experience
3. Automatic background refetching for data consistency
4. Error boundaries handle unauthorized access

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL connection for Neon database
- **@radix-ui/***: Accessible UI component primitives
- **@tanstack/react-query**: Server state management
- **drizzle-orm**: Type-safe database operations
- **express**: Web server framework
- **passport**: Authentication middleware

### Development Tools
- **Vite**: Fast development server and build tool
- **TypeScript**: Type safety across the application
- **Tailwind CSS**: Utility-first styling framework
- **Zod**: Runtime schema validation
- **React Hook Form**: Form state management

### Replit-Specific Integrations
- **Replit Authentication**: OAuth provider for user management
- **Replit Database**: Environment variable configuration
- **Replit Cartographer**: Development-time code mapping

## Deployment Strategy

### Development Environment
- **Hot Reload**: Vite development server with HMR
- **Database**: Neon PostgreSQL with development connection string
- **Authentication**: Replit OAuth with development credentials
- **Asset Serving**: Vite handles static assets and bundling

### Production Build
- **Frontend**: Vite builds optimized React bundle to `dist/public`
- **Backend**: esbuild bundles Express server to `dist/index.js`
- **Database**: Production PostgreSQL connection via DATABASE_URL
- **Static Serving**: Express serves built frontend assets

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string (required)
- **SESSION_SECRET**: Secret for session encryption (required)
- **REPL_ID**: Replit environment identifier
- **ISSUER_URL**: OAuth provider URL (defaults to replit.com/oidc)

### Recent Changes

**February 2, 2025**
- **Event Editing Fix**: Resolved issue where event descriptions were being discarded during editing
- **Field Mapping Correction**: Fixed frontend-backend field mapping mismatch between 'description' and 'requirements' fields
- **Data Persistence**: Event descriptions now properly retain and display existing data when editing events
- **Critical Bug Fix**: Resolved Stripe API version configuration issue that was preventing application startup
- **Application Stability**: Fixed server crash related to invalid Stripe API version "2025-06-30.basil" by using default version
- **Deployment Success**: Application now starts successfully and serves on port 5000 with all features functional
- **Uniqueness Validation**: Implemented comprehensive username and team name uniqueness constraints
- **Enhanced Error Messages**: Added detailed validation error messages for team and event creation
- **Database Schema Updates**: Added unique constraints to team names and usernames
- **API Validation**: Added dedicated validation routes for checking username and team name availability
- **Form Improvements**: Enhanced frontend error handling to display specific validation messages
- **Team Color Theming**: Applied selected team colors across all team views including cards, modals, and headers
- **Schema Fixes**: Resolved maxPlayers field validation to properly accept null values for unlimited team size

**February 1, 2025**
- **Mobile Navigation**: Added responsive hamburger menu with all desktop navigation options
- **Event Creation Fixes**: Resolved validation schema issues and ensured created events display properly
- **Form Validation**: Made description, end date, end time, participants, and cost truly optional
- **Event-Team Association**: Fixed issue where created events weren't visible by properly linking events to teams

**January 31, 2025**
- **Audit Functionality**: Implemented complete activity logging system for voting actions
- **Reports Integration**: Moved audit functionality from Settings to Events page with role-based access
- **Database Enhancement**: Added activity_logs table to track all voting activity with timestamps
- **Event Form Fixes**: Resolved validation issues for optional fields and changed currency to £
- **UI Improvements**: Fixed ScrollArea component errors and enhanced event creation flow

### Key Architectural Decisions

1. **Monorepo Structure**: Single repository with shared TypeScript types between frontend and backend for type safety
2. **Session-Based Auth**: Chose sessions over JWT for better security and simpler token management
3. **Drizzle ORM**: Selected for type safety and performance over traditional ORMs
4. **shadcn/ui**: Provides accessible, customizable components without vendor lock-in
5. **TanStack Query**: Handles complex server state scenarios with caching and synchronization
6. **Neon PostgreSQL**: Serverless database for automatic scaling and cost optimization
7. **Activity Logging**: Comprehensive audit trail system for all voting actions with IP tracking