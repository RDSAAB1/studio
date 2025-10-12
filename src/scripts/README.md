# Database Migration Scripts

## Fix RTGS Payment IDs

### Problem
RTGS payments in the database have mismatched IDs:
- `paymentId` field: Contains a different ID (incorrect) 
- `rtgsSrNo` field: Contains the actual RTGS serial number (correct)

**Critical Issue**: Multiple RTGS payments may have the **same paymentId** but different `rtgsSrNo` values. This causes:
- Confusion in payment history
- Difficulty tracking individual RTGS transactions
- Reporting issues

### Solution
The migration script `fix-rtgs-payment-ids.ts` updates all RTGS payments to have matching IDs.

### How to Run

1. Navigate to the admin migrations page:
   ```
   http://localhost:3000/admin/migrations
   ```

2. Click the "Run Migration" button under "Fix RTGS Payment IDs"

3. Wait for the migration to complete

4. Check the results:
   - ✅ Green message: Migration successful
   - Shows count of updated payments
   - Check browser console for detailed logs

5. Refresh your payments/history pages to see corrected data

### What It Does

- Finds all payments where `receiptType === 'RTGS'`
- **Tracks duplicate paymentIds** to identify problem records
- Compares `paymentId` with `rtgsSrNo`
- Updates `paymentId` to match `rtgsSrNo` if they're different
- **Reports duplicate occurrences** before and after migration
- Uses Firestore batch writes for efficient updates
- Shows detailed logs for each updated payment

### Safety

- ✅ Safe to run multiple times (idempotent)
- ✅ Only updates records that need fixing
- ✅ Uses Firestore transactions for data integrity
- ✅ Logs all changes to console
- ✅ Does not modify any other fields

### After Migration

All RTGS payments will have:
- `paymentId` === `rtgsSrNo` (unique per transaction)
- Document ID === `rtgsSrNo` (Firestore document)

This ensures:
- ✅ Each RTGS payment has a **unique paymentId**
- ✅ No more duplicate paymentIds across different RTGS transactions
- ✅ Direct correlation between paymentId and RTGS serial number
- ✅ Consistency across the entire system

### Example

**Before Migration:**
```
RTGS Payment 1: paymentId="EX00123", rtgsSrNo="RT00001"  ❌ Wrong
RTGS Payment 2: paymentId="EX00123", rtgsSrNo="RT00002"  ❌ Duplicate!
RTGS Payment 3: paymentId="EX00123", rtgsSrNo="RT00003"  ❌ Duplicate!
```

**After Migration:**
```
RTGS Payment 1: paymentId="RT00001", rtgsSrNo="RT00001"  ✅ Unique
RTGS Payment 2: paymentId="RT00002", rtgsSrNo="RT00002"  ✅ Unique
RTGS Payment 3: paymentId="RT00003", rtgsSrNo="RT00003"  ✅ Unique
```







