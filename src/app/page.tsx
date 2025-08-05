import { redirect } from 'next/navigation';

// This is a temporary type, replace with your actual data structure.
// You can create a `types.ts` or `definitions.ts` file in your `src/lib` folder.
export type Post = {
  id: number;
  title: string;
  body: string;
};

// The Home component is a server component, so you can fetch data directly.
export default async function Home() {
  // Redirect to the sales dashboard.
  redirect('/sales/customer-management');
}
