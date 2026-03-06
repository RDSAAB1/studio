
### Multitenant + Multiuser Enablement

**Goal:** Ek hi software ko multiple companies (tenants) aur multiple users ke liye safe banana.

**Status:** 🟡 In Progress | **Progress:** 0/8 tasks

- [ ] Tenants aur tenant-membership model implement karo
- [ ] Login par default tenant auto-create/resolve karo
- [ ] Active tenant switcher (UI) add karo
- [ ] Tenant switch par local cache/IndexedDB reset karo
- [ ] Firestore reads/writes ko tenant-aware banao (root vs tenant storage mode)
- [ ] Settings/options ko tenant-aware banao (companyDetails, options docs, etc.)
- [ ] Multiuser join/invite flow add karo (join code ya membership add)
- [ ] Lint + typecheck run karke sab errors fix karo
