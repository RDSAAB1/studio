// src/app/sales/supplier-profile/page.tsx

import SupplierProfileClient from './supplier-profile-client';

export default function SupplierProfilePage() {
  return (
    <div className="p-4 md:p-8">
      {/* This is the main page. It's a Server Component that renders your
        interactive Client Component below.
      */}
      <SupplierProfileClient />
    </div>
  );
}
