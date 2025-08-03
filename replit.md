# replit.md

## Overview
LUDI is a full-stack sports event management platform enabling users to create and manage sports teams, organize events, and handle team communications. It aims to provide a modern, efficient, and user-friendly solution for sports enthusiasts to connect, plan, and participate in activities. The platform integrates team, event, and user management with real-time notifications and robust authentication, enhancing community engagement and streamlining sports event organization.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes

**February 3, 2025 - Enhanced LUDI Startup Animation**
- **Complete Logo Reveal Animation**: Implemented full logo reveal animation during app startup with extended 5-second minimum duration
- **Elaborate Animation Sequence**: Trophy spin with glow → Letter-by-letter LUDI reveal → Underline animation → "Don't just watch" tagline → Sparkle effects
- **Optimized Timing**: Extended step timing (1.5s → 1.3s → 1.5s) to ensure complete animation playback before dashboard display
- **Data Preloading Integration**: Background loading of dashboard stats, teams, and events during animation for instant dashboard display
- **Enhanced User Experience**: Guaranteed complete animation sequence on every app startup with seamless transition to dashboard

## System Architecture
### Core Architectural Decisions
1. **Monorepo Structure**: Shared TypeScript types between frontend and backend for end-to-end type safety.
2. **Session-Based Authentication**: Utilizes server-side sessions stored in PostgreSQL for enhanced security and simplified token management, integrated with Replit OAuth.
3. **Drizzle ORM**: Chosen for its type safety, performance, and SQL-like syntax for PostgreSQL database interactions.
4. **shadcn/ui**: Provides a highly customizable, accessible, and themeable UI component library built on Radix UI and Tailwind CSS, following a "new-york" style with a sports-focused color palette.
5. **TanStack Query**: Manages complex server state, providing features like caching, synchronization, optimistic updates, and background refetching for optimal performance and user experience.
6. **Neon PostgreSQL**: Leveraged as a serverless PostgreSQL database solution for automatic scaling, cost efficiency, and WebSocket support.
7. **Activity Logging**: Implemented a comprehensive audit trail system to track user actions, particularly voting and team management activities, with IP tracking.
8. **Responsive Design**: Mobile-first approach with Tailwind breakpoints for broad device compatibility.

### Technical Implementations
*   **Frontend**: React 18 with TypeScript and Vite, Wouter for routing, React Hook Form with Zod for form handling, and Tailwind CSS for styling.
*   **Backend**: Express.js with TypeScript, RESTful API endpoints, and Drizzle ORM for PostgreSQL.
*   **Database**: PostgreSQL (via Neon serverless) with Drizzle ORM for schema definition and Drizzle Kit for migrations.
*   **Authentication**: Replit OAuth (OIDC) with server-side sessions, HTTP-only cookies, and automatic user creation/updates.
*   **Business Logic**: Comprehensive modules for user, team, and event management, including role-based access, join requests, member blocking, and a real-time notification system.
*   **UI/UX**: Custom sports-focused color palette (primary blue, secondary green, accent red), with `shadcn/ui` components ensuring WCAG compliance. Includes a custom loading component system and an animated logo reveal.

### Feature Specifications
*   **Authentication**: Secure Replit OAuth integration for user login and profile management.
*   **User Management**: Profile creation, updates (including mandatory fields like username, dateOfBirth, postcode, phoneNumber, gender), and secure session management.
*   **Team Management**: Creation, membership management, role-based access (owner/admin hierarchy), join request handling, member blocking, and team search functionality.
*   **Event Management**: Creation, scheduling (with recurrence options), linking to teams, attendance tracking (three-state voting system: Can Attend, Can't Attend, Potential Players), and location-based features (address, postcode). Gender preferences for teams and events to facilitate appropriate matchups.
*   **Notifications**: Real-time notifications for team and event updates, including specific handling for join requests.
*   **Data Validation**: Robust validation for all input fields, including uniqueness checks for usernames and team names.

## External Dependencies
*   **@neondatabase/serverless**: For connecting to the Neon PostgreSQL database.
*   **@radix-ui/***: Provides accessible UI component primitives used by shadcn/ui.
*   **@tanstack/react-query**: Utilized for server state management in the frontend.
*   **drizzle-orm**: ORM for type-safe database interactions with PostgreSQL.
*   **express**: Core web framework for the backend.
*   **passport**: Authentication middleware used in the Express.js backend.
*   **Vite**: Frontend build tool and development server.
*   **TypeScript**: Used across both frontend and backend for type safety.
*   **Tailwind CSS**: Utility-first CSS framework for styling.
*   **Zod**: Schema validation library used for form and API validation.
*   **React Hook Form**: Library for efficient form state management.
*   **Replit Authentication**: OAuth provider for user authentication.
*   **connect-pg-simple**: For PostgreSQL-backed session storage.