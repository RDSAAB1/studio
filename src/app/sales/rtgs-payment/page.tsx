import RtgspaymentClient from "./rtgs-payment-client";

export default function RtgspaymentPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-headline text-primary">
          RTGS Payment
        </h1>
        <p className="text-muted-foreground">
          Process RTGS payments, and manage customer bank details.
        </p>
      </div>
      <RtgspaymentClient />
    </div>
  );
}