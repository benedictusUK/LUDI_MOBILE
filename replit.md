# replit.md

## Overview
LUDI is a full-stack sports event management platform enabling users to create and manage sports teams, organize events, and handle team communications. It aims to provide a modern, efficient, and user-friendly solution for sports enthusiasts to connect, plan, and participate in activities. The platform integrates team, event, and user management with real-time notifications and robust authentication, enhancing community engagement and streamlining sports event organization.

## Recent Changes
*   **Payment Collection System Complete (Aug 2025)**: Successfully implemented end-to-end payment collection functionality with Stripe integration. Features include unified attendee selection modal showing all team members with visual indicators, automatic pre-selection of attending members, proper status handling for both "can_attend" and "attending" statuses, payment capture with optional Stripe Connect transfers, and comprehensive error handling. System handles authorized payment capture, transfers to organiser accounts when available, and provides detailed success/failure reporting.
*   **Automatic Recurring Event Generation (Jan 2025)**: Implemented smart auto-generation system that maintains exactly 5 future events per recurring series. System triggers when events become "past" using the same filtering logic, creating one new event based on recurrence pattern (daily/weekly/monthly). Eliminates bulk creation in favor of on-demand generation, preserving all event settings and team associations while running efficiently in the background.
*   **Event Filtering System Fix (Jan 2025)**: Fixed critical TypeScript compilation errors that were causing server instability and preventing proper event filtering. Updated server logic so includePast=true shows ONLY past events and includePast=false shows ONLY future events (previously showed all events when includePast=true). Past events are now sorted in reverse chronological order (most recent first) while future events are sorted chronologically. Event end time calculation properly identifies when events have finished based on actual event end datetime vs current time.
*   **Event-Driven Recurring Events Maintenance (Jan 2025)**: Implemented efficient event-driven maintenance system that triggers when events expire rather than running scheduled polling. System automatically detects expired recurring events and generates new ones on-demand, maintaining continuity for daily, weekly, and monthly patterns. Features lightweight daily background check, event-triggered maintenance on getUserEvents calls, and intelligent series detection to preserve all configurations and team associations. Significantly reduces compute usage compared to hourly polling.
*   **Fixed Join Request Notification Targeting (Jan 2025)**: Resolved issue where approving/rejecting one join request incorrectly marked all team join requests as read. Now uses JSON metadata filtering to target only the specific notification for the actioned user, preserving other pending requests as unread and actionable.
*   **Fixed Team Creation Sports Selection (Jan 2025)**: Completely rebuilt sports multi-select dropdown in team creation form using Popover component instead of problematic Select component. Fixed clickable area issue where users couldn't select sports by clicking anywhere on the line. Now uses proper Checkbox components with full-line click functionality for better user experience.
*   **Database Cleanup and Dashboard Stats Fix (Jan 2025)**: Cleaned orphaned events and teams from database, fixed dashboard statistics to show accurate counts. Total Teams now correctly displays 3, Total Players shows all platform users (3), ensuring new users see clean, accurate data.
*   **Comprehensive Blocking System and UI Improvements (Jan 2025)**: Implemented automatic postcode pre-filling in flare search using user's profile postcode while keeping field editable. Fixed blocked members modal mobile experience by removing horizontal scrolling, eliminating blocked reason input box and no-entry icons to save screen real estate. Layout now uses responsive design that stacks on mobile and displays inline on desktop with proper text truncation. Enhanced team search to prevent blocked users from finding teams that have blocked them, completing comprehensive blocking protection across all platform interactions.
*   **Blocked User Flare Filtering (Jan 2025)**: Enhanced flare gun system with comprehensive blocking functionality. Blocked users are now excluded from receiving flare gun notifications and cannot see flared events from blocking teams in search results. System includes smart filtering to prevent unwanted interactions while maintaining functionality for eligible users.
*   **Unvote Notification System (Jan 2025)**: Implemented notification system for when players unvote within 48 hours of event start time. All remaining attendees receive notification: "{name} has unvoted for the event on {event date}. Can you field another player? Reach out to the organiser." Feature includes comprehensive testing and intelligent time-based triggering only for last-minute cancellations.
*   **New Sport Options with Professional Icons (Jan 2025)**: Added three new sports to the platform with professionally designed SVG icons - Walking (detailed footprint from UXWing), Hiking (professional boot from SVG Repo), and Wild Camping (stylish tent design). All sports are now available in team creation, event creation, and profile settings dropdowns with consistent icon display across all pages.
*   **Advanced Event Filtering (Jan 2025)**: Implemented comprehensive filtering system for events page including team filtering with visual dropdown, voting status filter (Attending/Can't Attend/Not Voted) with color-coded indicators, past events toggle, and accurate event counts for each filter option. Features seamless navigation from team cards/modals and smart badge display showing filtered vs total counts.
*   **Event Team Filtering (Jan 2025)**: Implemented comprehensive team filtering for events page with visual dropdown filter, automatic URL parameter handling, and seamless navigation from team cards/modals. Filter correctly applies when clicking "Events" from team tiles or team detail modals.
*   **Member Viewing Interface (Jan 2025)**: Fixed "View Members" functionality for regular team members with proper data structure handling, displaying full names prominently with usernames as subtext, and accurate role badges (Owner/Admin/Captain/Member). Both admin management modal and regular viewing modal now work correctly.
*   **Team Member Count Display**: Resolved accurate member count display showing actual numbers instead of hardcoded values, with conditional display for team limits.
*   **Flare Search Integration**: Completed flare search with working "See Event" and "Add to My Events" functionality using proper API request syntax.

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
*   **Event Management**: Creation, scheduling (with recurrence options), linking to teams, attendance tracking (three-state voting system: Can Attend, Can't Attend, Potential Players), location-based features, and "Publish All" for series. Includes a comprehensive reserve player system with admin overflow, automatic promotion queue (first-to-reserve priority), manual and automatic promotion capabilities, and real-time notifications for promotions. Features comprehensive role-based authorization for editing, series management, and deletion - accessible to team owners, admins, and captains with both backend security and frontend UI visibility controls. Auto-follow functionality ensures events are automatically added to user's "My Events" when voting to attend or becoming a reserve player.
*   **Notifications**: Real-time notifications for team and event updates, including specific handling for join requests, reserve promotions (manual and automatic), comprehensive event management activities, and flare gun functionality with streamlined search capabilities.
*   **Flare Search**: Cross-account event discovery system allowing users to search for active flare events by postcode and sport, with mobile-responsive design and full event management integration (view details, add to personal events).
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