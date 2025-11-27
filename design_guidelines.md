# LUDI Sports Event Management App - Design Guidelines

## Design Approach
**Hybrid Reference Strategy**: Drawing from Strava (sports engagement), Eventbrite (event discovery), and iOS Health app (clean data presentation). The app balances visual discovery of events with efficient management tools.

## Typography

**Primary Font**: SF Pro (iOS native)
- Hero/Event Titles: 28-32pt, Bold
- Section Headers: 20-22pt, Semibold
- Card Titles: 16-18pt, Semibold
- Body Text: 15pt, Regular
- Captions/Meta: 13pt, Regular
- Buttons: 16pt, Semibold

## Layout System

**Spacing Primitives**: Use consistent units of 4, 8, 12, 16, 24, 32, 48
- Screen padding: 16-20px horizontal
- Card padding: 16px internal
- Section spacing: 24-32px vertical
- Element gaps: 8-12px between related items
- Safe area: Native iOS handling with appropriate insets

**Screen Architecture**:
- Tab bar navigation (fixed bottom, 5 tabs max)
- Scrollable content areas with pull-to-refresh
- Floating action buttons (FAB) for primary actions (green, bottom-right, 56px diameter)

## Core Components

**Event Cards** (Primary UI Element):
- Large format: Full-width, 240px height minimum
- Rounded corners: 16px radius
- Event image: 160px tall, top position, covers full card width
- Text overlay on image: Semi-transparent dark gradient (40% opacity) with white text
- Details section: White background, 80px tall, includes event name, date/time, location, participant count
- Status badges: Small pills in top-right (12px from edge) - "Upcoming", "Live", "Full"
- Action button: Green with blur backdrop when overlaying image

**Compact Event Cards**:
- Horizontal scroll lists
- 280px width × 180px height
- Same design language, condensed layout

**Navigation Tabs**:
- Icons: 24×24px SF Symbols
- Labels: 11pt below icons
- Active state: Green icon + label
- Inactive: Gray (70% opacity)

**Search & Filter Bar**:
- Sticky header position
- 48px height
- Search input: Rounded pill shape (24px radius), light gray background
- Filter chips: Horizontal scroll, 32px height, green when active

**List Items** (Participants, Teams):
- 64px height rows
- Avatar: 40×40px circle, left-aligned with 16px margin
- Two-line text: Name (16pt) + metadata (13pt gray)
- Right chevron or action button

**Stats Display**:
- Grid layout: 2 or 3 columns
- Cards: 100px height, centered content
- Large number: 32pt bold green
- Label: 13pt gray below

**Forms**:
- Native iOS inputs with 12px corner radius
- Labels: 13pt above field
- Input fields: 48px height, light gray border
- Green focus state (2px border)
- Helper text: 12pt gray below

**Bottom Sheets**:
- Draggable handle at top
- White background with 24px top radius
- Sheet content padding: 20px horizontal

## Images

**Hero Image Requirements**:
- Event detail screens: Full-width hero, 280-320px height, covers top of screen
- Main feed header: Optional featured event banner, 200px height
- Event thumbnails: 16:9 aspect ratio preferred
- Profile images: Circular, 80×80px for profiles, 40×40px for lists

Image placement strategy:
- Event browsing: Image-led cards dominate the feed
- Event details: Large hero image establishing context
- Create event: Camera/upload prompt with preview
- User profiles: Header photo + avatar combination

**Blur Treatment**: All buttons overlaying images use 20% blur backdrop with 80% opacity white background for light buttons, or dark semi-transparent (40% black) for contrast.

## Animations

**Minimal Motion**:
- Card press: Subtle scale (0.98) with haptic feedback
- Tab switching: Crossfade only
- Pull-to-refresh: Native iOS spinner
- Loading states: Skeleton screens for cards
- No page transitions beyond native navigation

## Key Screens Structure

**Home/Discover**: Search bar + filter chips + large event cards (scrollable vertical feed) + floating create button

**Event Detail**: Hero image + floating back button + scroll content (description, participants grid, action buttons, map card)

**My Events**: Segmented control (Upcoming/Past) + compact card list + empty state illustration

**Create Event**: Step indicator + full-screen form with image upload prominent at top + sticky bottom action bar

**Profile**: Header (cover photo + avatar) + stats row + tabs (created events, joined events, following)

This design ensures visual richness through imagery while maintaining iOS-native patterns and efficient information hierarchy for sports event management.