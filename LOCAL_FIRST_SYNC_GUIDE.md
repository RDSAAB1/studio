# Local-First Sync Implementation Guide

## Overview
सभी operations अब **Local-First** pattern पर काम करते हैं:

### Core Rules:
1. ✅ **सभी writes local में पहले** (IndexedDB)
2. ✅ **Local changes Firestore में sync होती हैं** - सिर्फ user events पर (click, input, blur, etc.)
3. ✅ **Firestore से local sync** - सिर्फ user events पर (idle state में नहीं)
4. ✅ **अगर local में कोई change नहीं** → Firestore में भी change नहीं
5. ✅ **Quota exceed की problem नहीं** होगी क्योंकि reads local से होंगे

---

## Implementation Details

### 1. Local-First Sync Manager
**File:** `src/lib/local-first-sync.ts`

#### Features:
- Event-based sync triggers (click, input, change, blur, focus, submit, keydown)
- Sync cooldown: 5 seconds minimum between syncs
- Conflict resolution: Last write wins (timestamp-based)
- Pending changes queue
- Bidirectional sync (local ↔ Firestore)

#### Key Functions:
```typescript
// Write to local first
writeLocalFirst(collection, operation, id, data?, changes?)

// Read from local
readLocalFirst(collection, id?)

// Check pending changes
hasPendingChanges()
getPendingChangesCount()

// Force sync (for testing)
forceSyncToFirestore()
forceSyncFromFirestore()
```

### 2. Updated Functions

#### Suppliers:
- ✅ `addSupplier()` - Local-first
- ✅ `updateSupplier()` - Local-first
- ⚠️ `deleteSupplier()` - Complex logic with payments (needs local-first update)

#### Customers:
- ✅ `addCustomer()` - Local-first
- ✅ `updateCustomer()` - Local-first
- ✅ `deleteCustomer()` - Local-first

### 3. Event Listeners
**Initialized in:** `src/app/layout.tsx`

```typescript
// Events that trigger sync:
- click
- input
- change
- blur
- focus
- submit
- keydown
- visibilitychange (when tab becomes visible)
```

### 4. Sync Flow

#### Write Flow:
```
User Action → writeLocalFirst()
    ↓
Write to IndexedDB (immediate)
    ↓
Add to pending changes queue
    ↓
Schedule sync to Firestore (on next user event)
    ↓
User Event Triggered
    ↓
Sync to Firestore
```

#### Read Flow:
```
User Action → readLocalFirst()
    ↓
Read from IndexedDB (immediate, no Firestore read)
    ↓
User Event Triggered
    ↓
Sync from Firestore to local (background)
```

---

## Benefits

1. **Zero Quota Issues:**
   - Reads are from local IndexedDB (no Firestore reads)
   - Writes happen only when user interacts

2. **Fast Performance:**
   - Instant writes (local)
   - Instant reads (local)
   - Background sync (non-blocking)

3. **Offline Support:**
   - Works offline
   - Syncs when online + user interacts

4. **Multi-Device Sync:**
   - Changes sync on user events only
   - No idle reads = no quota waste
   - Conflict resolution prevents data loss

---

## Usage Examples

### Writing Data:
```typescript
// Old way (direct Firestore):
await addSupplier(supplierData);

// New way (local-first) - already implemented in addSupplier():
// Automatically writes to local first, syncs on user events
await addSupplier(supplierData);
```

### Reading Data:
```typescript
// Old way (Firestore read):
const supplier = await getDoc(doc(suppliersCollection, id));

// New way (local-first):
import { readLocalFirst } from '@/lib/local-first-sync';
const supplier = await readLocalFirst('suppliers', id);
```

---

## Remaining Tasks

1. **Update remaining write functions:**
   - [ ] `deleteSupplier()` - Complex with payment deletion
   - [ ] Payment functions
   - [ ] KantaParchi functions
   - [ ] CustomerDocument functions

2. **Update read functions:**
   - [ ] Replace Firestore reads with `readLocalFirst()`
   - [ ] Update realtime listeners to read from local

3. **Testing:**
   - [ ] Test multi-device sync
   - [ ] Test conflict resolution
   - [ ] Test offline functionality

---

## Important Notes

⚠️ **Sync Behavior:**
- Sync happens **ONLY** when user interacts
- Idle tabs/systems won't sync automatically
- This prevents quota waste

⚠️ **Conflict Resolution:**
- Last write wins (timestamp-based)
- Local changes older than Firestore data are discarded
- Newer local changes override Firestore data

⚠️ **Pending Changes:**
- Stored in memory during session
- Synced on user events
- Survives page reloads (stored in IndexedDB)

---

## Monitoring

Check pending changes:
```typescript
import { hasPendingChanges, getPendingChangesCount } from '@/lib/local-first-sync';

if (hasPendingChanges()) {
    console.log(`${getPendingChangesCount()} changes pending sync`);
}
```

Force sync:
```typescript
import { forceSyncToFirestore, forceSyncFromFirestore } from '@/lib/local-first-sync';

// Manual sync (for testing)
await forceSyncToFirestore();
await forceSyncFromFirestore();
```

