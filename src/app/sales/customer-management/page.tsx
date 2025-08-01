import CustomerManagementClient from "./customer-management-client";

export default function CustomerManagementPage() {
  return (
    <div>
       <div className="mb-6">
        <h1 className="text-3xl font-bold font-headline text-primary">Customer Management</h1>
        <p className="text-muted-foreground">Add, edit, and manage customer transaction entries.</p>
      </div>
      <CustomerManagementClient />
    </div>
  );
}
