# Auth Flow – TODO List & Step-by-Step Verification

## 📋 TODO List (Implementation Order)

### Phase 1: Intro & Landing ✅
- [x] **AUTH-1** Create Intro/Landing page – show when user not logged in
- [x] **AUTH-2** Intro page: Add two options – "Login with Company" and "Create New Company"

### Phase 2: Login with Company ✅
- [x] **AUTH-3** Login with Company: Email + Password + Company Code fields, validate and login

### Phase 3: Create New Company ✅
- [x] **AUTH-4** Create New Company: Email + Password + Company Name, signup + create in **companies** collection (company → subCompany MAIN → season)

### Phase 4: Redirect Flow ✅
- [x] **AUTH-5** Update redirect flow: Intro → Login options, not directly to /login

### Phase 5: Firestore Rules ✅
- [x] **AUTH-6** Firestore rules: Add tenantInvites, tenants, tenantMembers if needed

### Phase 6: Optional (Future)
- [ ] **INVITE-1** Invite code: Add expiry, revoke, one-time use
- [ ] **INVITE-2** Invite code: Admin UI to list/revoke codes

---

## ✅ Step-by-Step Verification Checklist

### Before Implementation – Current State Check

#### 1. Login Page
- [ ] Open app in incognito/private window
- [ ] Go to `/login`
- [ ] Verify: Email + Password fields visible
- [ ] Verify: Login and Sign Up tabs work
- [ ] Verify: Google sign-in button visible
- [ ] Try: Login with valid email/password → Should redirect to dashboard
- [ ] Try: Sign up with new email → Should create account and redirect

#### 2. Invite Code – Generate
- [ ] Login as a user who has a company
- [ ] Click Company dropdown in topbar (Building2 icon)
- [ ] Verify: "Generate join code (copied)" option visible
- [ ] Click it → Code should copy to clipboard
- [ ] Check Firestore Console → `tenantInvites` collection → New doc with that code

#### 3. Invite Code – Join
- [ ] Login as different user (or create new account)
- [ ] Click Company dropdown
- [ ] Click "Join Company"
- [ ] Enter the invite code (from step 2)
- [ ] Click Join
- [ ] Verify: User switches to that company
- [ ] Verify: Data visible is from that company

#### 4. Create Company
- [ ] Login
- [ ] Company dropdown → "New Company"
- [ ] Enter company name
- [ ] Verify: New company created and activated
- [ ] Verify: IndexedDB cleared, fresh data load

#### 5. Forgot Password
- [ ] Go to `/forgot-password`
- [ ] Enter email
- [ ] Verify: Password reset email sent (check inbox)

---

### After Implementation – New Flow Check

#### 1. Intro Page
- [ ] Open app in incognito (not logged in)
- [ ] Verify: Intro/Landing page shows first (not login)
- [ ] Verify: "Get Started" or "Continue" button
- [ ] Click → Should show two options

#### 2. Two Options Visible
- [ ] Verify: "Login with Company" option
- [ ] Verify: "Create New Company" option

#### 3. Login with Company
- [ ] Click "Login with Company"
- [ ] Verify: Email field
- [ ] Verify: Password field
- [ ] Verify: Company Code field
- [ ] Enter: valid email + password + valid invite code
- [ ] Click Login
- [ ] Verify: Login success, redirect to dashboard
- [ ] Verify: User is in that company

#### 4. Create New Company
- [ ] Click "Create New Company"
- [ ] Verify: Email field
- [ ] Verify: Password field
- [ ] Verify: Company Name field
- [ ] Enter: new email + password + company name
- [ ] Click Create
- [ ] Verify: Account created
- [ ] Verify: Company created
- [ ] Verify: Redirect to dashboard in that company

#### 5. Redirect Flow
- [ ] Not logged in → Visit `/` → Should show Intro (not login)
- [ ] Not logged in → Visit `/sales` → Should redirect to Intro or Login
- [ ] Logged in → Visit `/login` → Should redirect to `/` (dashboard)

---

## 🔧 Quick Test Commands

```bash
# Start dev server
npm run dev

# Build (to catch errors)
npm run build
```

---

## 📁 Files to Create/Modify

| Task | File | Action |
|------|------|--------|
| AUTH-1, AUTH-2 | `src/app/(public)/page.tsx` or new | Create Intro page |
| AUTH-3 | `src/app/(public)/login/page.tsx` | Add "Login with Company" with code field |
| AUTH-4 | `src/app/(public)/login/page.tsx` | Add "Create New Company" tab/section |
| AUTH-5 | `src/app/layout.tsx` | Update redirect: `/` → Intro when not logged in |
| AUTH-6 | `firestore.rules` | Add tenantInvites, tenants, tenantMembers rules |

---

## 📝 Notes

- **Intro page:** Can be `/` when not logged in, or a separate `/intro` route
- **Login:** Current `/login` can be redesigned to show both options
- **Invite code:** Already works – just need to add it to login form
