# ERP Migration – Database Structure

## Jab Company Structure Create Hoga, Firestore Mein Kya Dikhega

### Step 1: Company Setup Success Hone Par

Firebase Console → Firestore Database mein ye structure banta hai:

```
companies (collection)
└── {companyId} (document)     ← e.g. "jrmd-agro" (Company Name se slug)
    ├── name: "JRMD Agro"
    ├── createdAt: timestamp
    ├── updatedAt: timestamp
    └── createdBy: "migration"

    subCompanies (subcollection)
    └── {subCompanyId} (document)   ← e.g. "main" (Sub Company se slug)
        ├── name: "MAIN"
        ├── companyId: "jrmd-agro"
        ├── createdAt: timestamp
        ├── updatedAt: timestamp
        └── createdBy: "migration"

        seasons (subcollection)
        └── {seasonKey} (document)   ← e.g. "2025_A" (Season Name se slug)
            ├── seasonKey: "2025_A"
            ├── seasonName: "2025 A"
            ├── companyId: "jrmd-agro"
            ├── subCompanyId: "main"
            ├── createdAt: timestamp
            ├── updatedAt: timestamp
            └── createdBy: "migration"
```

### Example Paths

| Input | Firestore Path |
|-------|----------------|
| Company: "JRMD Agro" | `companies/jrmd-agro` |
| Sub Company: "MAIN" | `companies/jrmd-agro/subCompanies/main` |
| Season: "2025 A" | `companies/jrmd-agro/subCompanies/main/seasons/2025_A` |

### Step 2: Data Migration Ke Baad

Har migrated collection season ke andar subcollection ban jati hai:

```
companies/jrmd-agro/subCompanies/main/seasons/2025_A/
├── suppliers/     (migrated docs)
├── customers/
├── payments/
├── incomes/
├── expenses/
└── ... (30 collections)
```

---

## Loading Atakne Ka Reason: Firestore Rules

**Problem:** `companies` collection ke liye Firestore rules mein koi allow rule nahi tha. Default rule sab kuch deny karta hai.

**Fix:** `firestore.rules` mein ye add kiya gaya hai:

```
match /companies/{path=**} {
  allow read, write: if request.auth != null;
}
```

### Rules Deploy Kaise Karein

1. Firebase CLI install ho:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. Project root par (studio folder ke andar ya parent):
   ```bash
   firebase deploy --only firestore:rules
   ```

3. Agar `firebase.json` nahi hai, pehle init karein:
   ```bash
   firebase init firestore
   ```

---

## Debug Checklist

1. **Logged in ho?** – Rules `request.auth != null` check karte hain.
2. **Rules deploy hue?** – Firebase Console → Firestore → Rules tab check karein.
3. **Error dikh raha hai?** – Browser DevTools → Console mein error check karein.
4. **Network tab** – Firestore API calls fail ho rahe hain ya nahi.
