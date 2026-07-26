import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-black text-indigo-400">404 - Page Not Found</h1>
      <p className="text-sm text-slate-400 mt-2">The page you are looking for does not exist.</p>
      <Link
        href="/"
        className="mt-6 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all"
      >
        Return to Home
      </Link>
    </div>
  );
}
