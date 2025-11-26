# replit.md

## Overview
LUDI is a full-stack sports event management platform designed to streamline the creation and management of sports teams and events. Its core purpose is to provide a modern, efficient, and user-friendly solution for sports enthusiasts to connect, plan, and participate in activities. Key capabilities include comprehensive team, event, and user management, real-time notifications, and robust authentication. LUDI aims to enhance community engagement and simplify the organization of sports events, fostering a vibrant and active sports community.

**Mobile App**: LUDI now includes a complete React Native mobile application built with Expo, providing native iOS and Android experiences with full feature parity to the web platform. The mobile app uses JWT token authentication and provides native mobile UI components for optimal performance and user experience.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Core Architectural Decisions
*   **Monorepo Structure**: Shared TypeScript types between frontend and backend for end-to-end type safety.
*   **Session-Based Authentication**: Utilizes server-side sessions stored in PostgreSQL for enhanced security and simplified token management.
*   **Drizzle ORM**: Chosen for its type safety, performance, and SQL-like syntax for PostgreSQL database interactions.
*   **shadcn/ui**: Provides a highly customizable, accessible, and themeable UI component library built on Radix UI and Tailwind CSS, following a "new-york" style with a sports-focused color palette.
*   **TanStack Query**: Manages complex server state, providing features like caching, synchronization, optimistic updates, and background refetching for optimal performance and user experience.
*   **Neon PostgreSQL**: Leveraged as a serverless PostgreSQL database solution for automatic scaling, cost efficiency, and WebSocket support.
*   **Activity Logging**: Implemented a comprehensive audit trail system to track user actions, particularly voting and team management activities, with IP tracking.
*   **Responsive Design**: Mobile-first approach with Tailwind breakpoints for broad device compatibility.

### Technical Implementations
*   **Web Frontend**: React 18 with TypeScript and Vite, Wouter for routing, React Hook Form with Zod for form handling, and Tailwind CSS for styling.
*   **Mobile Frontend**: React Native with Expo, React Navigation for routing, native mobile UI components, JWT authentication, and Stripe React Native SDK for payments.
*   **Backend**: Express.js with TypeScript, RESTful API endpoints, CORS enabled for cross-origin requests, and Drizzle ORM for PostgreSQL. Dual authentication system supporting web sessions and mobile JWT tokens.
*   **Database**: PostgreSQL (via Neon serverless) with Drizzle ORM for schema definition and Drizzle Kit for migrations.
*   **Authentication**: 
    - Web: Replit OAuth (OIDC) with server-side sessions, HTTP-only cookies, and automatic user creation/updates. Also supports Google and Apple OAuth.
    - Mobile: JWT token-based authentication with secure token storage and refresh mechanisms.
*   **Business Logic**: Comprehensive modules for user, team, and event management, including role-based access with three-tier permissions (owner/admin/captain), join requests with automatic notification management, member blocking, recurring events, reserve player system, and a real-time notification system with comprehensive event management authorization. Payment collection and authorization with Stripe integration for secure transactions.
*   **UI/UX**: 
    - Web: Custom sports-focused color palette with `shadcn/ui` components ensuring WCAG compliance.
    - Mobile: Native mobile UI with emoji icons, tab navigation, floating action buttons, pull-to-refresh, and platform-optimized components.

### Feature Specifications
*   **Authentication**: Secure Replit, Google, and Apple OAuth integration for user login and profile management.
*   **User Management**: Profile creation, updates (including mandatory fields), and secure session management.
*   **Team Management**: Creation, membership management, role-based access, join request handling, member blocking, team search, and "Leave Team" functionality.
*   **Event Management**: Creation, scheduling (with recurrence options), linking to teams, attendance tracking (three-state voting system: Can Attend, Can't Attend, Potential Players), location-based features, and "Publish All" for series. Includes a comprehensive reserve player system with automatic promotion queue, manual and automatic promotion capabilities, and real-time notifications. Features comprehensive role-based authorization for editing, series management, and deletion. Auto-follow functionality adds events to "My Events" upon voting or becoming a reserve. Includes automated recurring event generation.
*   **Notifications**: Real-time notifications for team and event updates, including specific handling for join requests, reserve promotions, event management activities, and flare gun functionality. Includes notifications for unvoting attendees and payment authorizations.
*   **Flare Search**: Cross-account event discovery system allowing users to search for active flare events by postcode and sport, with mobile-responsive design and full event management integration. Blocked users are excluded from flare notifications and search results.
*   **Payment System**: End-to-end payment collection with Stripe integration, including attendee selection, payment capture, transfers to organizer accounts, and comprehensive authorization/release mechanisms for holds. Prevents multiple payment collections for the same event.
*   **Data Validation**: Robust validation for all input fields, including uniqueness checks for usernames and team names.

## External Dependencies

### Web Dependencies
*   **@neondatabase/serverless**: For connecting to the Neon PostgreSQL database.
*   **@radix-ui/***: Provides accessible UI component primitives.
*   **@tanstack/react-query**: Utilized for server state management.
*   **drizzle-orm**: ORM for type-safe database interactions with PostgreSQL.
*   **express**: Core web framework for the backend.
*   **passport**: Authentication middleware.
*   **Vite**: Frontend build tool and development server.
*   **TypeScript**: Used across both frontend and backend.
*   **Tailwind CSS**: Utility-first CSS framework.
*   **Zod**: Schema validation library.
*   **React Hook Form**: Library for efficient form state management.
*   **Replit Authentication**: OAuth provider.
*   **Google OAuth**: For user authentication.
*   **Apple OAuth**: For user authentication.
*   **connect-pg-simple**: For PostgreSQL-backed session storage.
*   **Stripe**: Payment processing.

### Mobile Dependencies
*   **React Native**: Mobile app framework.
*   **Expo**: Development platform and toolchain for React Native.
*   **@react-navigation/native**: Navigation library for React Native.
*   **@react-navigation/bottom-tabs**: Tab navigation component.
*   **@react-navigation/native-stack**: Stack navigation component.
*   **@stripe/stripe-react-native**: Native Stripe SDK for mobile payments.
*   **@expo/vector-icons**: Icon library for Expo applications.
*   **expo-secure-store**: Secure storage for sensitive data like tokens.
*   **@react-native-async-storage/async-storage**: Local storage for React Native.
*   **jsonwebtoken**: JWT token handling for mobile authentication.
*   **@react-native-picker/picker**: Native picker component for mobile forms.