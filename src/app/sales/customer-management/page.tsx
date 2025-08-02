import CustomerManagementClient from "./customer-management-client";

export default function CustomerManagementPage() {
  return (
    <div>
       <div className="mb-6">
        <h1 className="text-3xl font-bold font-headline text-primary">Supplier Entry</h1>
      </div>
      <CustomerManagementClient />
    </div>
  );
}
