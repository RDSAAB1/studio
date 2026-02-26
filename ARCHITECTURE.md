# Architecture Overview

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Shadcn UI
- **Database**: Firebase Firestore (Cloud) + Dexie.js (Local/IndexedDB)
- **State Management**: React Hooks + Context + URL Search Params (for filters)
- **Authentication**: Firebase Auth

## Core Concepts

### 1. Offline-First Architecture
The application uses a hybrid data approach:
- **Dexie.js (IndexedDB)**: Primary data source for reads. All large datasets (Suppliers, Customers, Transactions) are cached locally for instant access.
- **Firestore**: Source of truth. Writes go to Firestore first, then sync back to Dexie via real-time listeners.
- **Sync Registry**: A special Firestore collection tracks changes (`sync_registry`). Clients listen to this lightweight collection to know when to fetch heavy data, reducing read costs.

### 2. Unified Page Structure
Key modules (Sales, Expenses) use a "Unified Page" pattern:
- All sub-views (tabs) are mounted simultaneously but toggled via CSS (`display: none`).
- This preserves state (scroll position, form data) when switching tabs.
- Dynamic imports are used to reduce initial bundle size.

### 3. Component Hierarchy
- **Page (`page.tsx`)**: Server Component (metadata).
- **Client Wrapper (`*-client.tsx`)**: Client Component, handles state and effects.
- **Features (`components/*`)**: Reusable logic (Tables, Forms, Dialogs).
- **UI (`components/ui/*`)**: Dumb presentation components (Buttons, Inputs).

## Directory Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── api/             # API Routes
│   ├── sales/           # Sales Module
│   ├── expense-tracker/ # Expense Module
│   └── ...
├── components/          # React Components
│   ├── ui/              # Shadcn UI primitives
│   ├── sales/           # Sales-specific components
│   └── ...
├── hooks/               # Custom React Hooks
├── lib/                 # Utilities and Helpers
└── styles/              # Global styles
```

## Data Flow

1. **Write**: User submits form -> `firestore.ts` helper writes to Firestore.
2. **Sync**: `sync-registry-listener.ts` detects change in `sync_registry`.
3. **Update**: Listener fetches new data -> Updates Dexie.js -> Updates React State (via `useLiveQuery` or Context).
4. **Read**: Components read from Context/Dexie -> UI updates.
