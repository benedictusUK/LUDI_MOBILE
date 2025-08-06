# replit.md

## Overview
LUDI is a full-stack sports event management platform enabling users to create and manage sports teams, organize events, and handle team communications. It aims to provide a modern, efficient, and user-friendly solution for sports enthusiasts to connect, plan, and participate in activities. The platform integrates team, event, and user management with real-time notifications and robust authentication, enhancing community engagement and streamlining sports event organization.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Core Architectural Decisions
1.  **Monorepo Structure**: Shared TypeScript types between frontend and backend for end-to-end type safety.
2.  **Session-Based Authentication**: Utilizes server-side sessions stored in PostgreSQL for enhanced security and simplified token management.
3.  **Drizzle ORM**: Chosen for its type safety, performance, and SQL-like syntax for PostgreSQL database interactions.
4.  **shadcn/ui**: Provides a highly customizable, accessible, and themeable UI component library built on Radix UI and Tailwind CSS, following a "new-york" style with a sports-focused color palette.
5.  **TanStack Query**: Manages complex server state, providing features like caching, synchronization, optimistic updates, and background refetching for optimal performance and user experience.
6.  **Neon PostgreSQL**: Leveraged as a serverless PostgreSQL database solution for automatic scaling, cost efficiency, and WebSocket support.
7.  **Activity Logging**: Implemented a comprehensive audit trail system to track user actions, particularly voting and team management activities, with IP tracking.
8.  **Responsive Design**: Mobile-first approach with Tailwind breakpoints for broad device compatibility.

### Technical Implementations
*   **Frontend**: React 18 with TypeScript and Vite, Wouter for routing, React Hook Form with Zod for form handling, and Tailwind CSS for styling.
*   **Backend**: Express.js with TypeScript, RESTful API endpoints, and Drizzle ORM for PostgreSQL.
*   **Database**: PostgreSQL (via Neon serverless) with Drizzle ORM for schema definition and Drizzle Kit for migrations.
*   **Authentication**: Replit OAuth (OIDC) with server-side sessions, HTTP-only cookies, and automatic user creation/updates. Also supports Google and Apple OAuth.
*   **Business Logic**: Comprehensive modules for user, team, and event management, including role-based access with three-tier permissions (owner/admin/captain), join requests with automatic notification management, member blocking, recurring events, reserve player system, and a real-time notification system with comprehensive event management authorization.
*   **UI/UX**: Custom sports-focused color palette (primary blue, secondary green, accent red), with `shadcn/ui` components ensuring WCAG compliance. Includes a custom loading component system and an animated logo reveal.

### Feature Specifications
*   **Authentication**: Secure Replit OAuth integration for user login and profile management, with support for Google and Apple OAuth.
*   **User Management**: Profile creation, updates (including mandatory fields like username, dateOfBirth, postcode, phoneNumber, gender), and secure session management.
*   **Team Management**: Creation, membership management, role-based access (owner/admin/captain hierarchy), join request handling, member blocking, team search, and "Leave Team" functionality.
*   **Event Management**: Creation, scheduling (with recurrence options), linking to teams, attendance tracking (three-state voting system: Can Attend, Can't Attend, Potential Players), location-based features, and "Publish All" for series. Includes a comprehensive reserve player system with admin overflow, automatic promotion queue (first-to-reserve priority), manual and automatic promotion capabilities, and real-time notifications for promotions. Features comprehensive role-based authorization for editing, series management, and deletion - accessible to team owners, admins, and captains with both backend security and frontend UI visibility controls.
*   **Notifications**: Real-time notifications for team and event updates, including specific handling for join requests, reserve promotions (manual and automatic), and comprehensive event management activities.
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
*   **Google OAuth**: For user authentication.
*   **Apple OAuth**: For user authentication.
*   **connect-pg-simple**: For PostgreSQL-backed session storage.