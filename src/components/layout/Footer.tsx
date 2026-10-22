import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white/60 text-xs text-slate-500 py-6 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Tensor School</span>
          <span aria-hidden>·</span>
          <span>Typing Championship</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://tensorschool.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-indigo-700 transition-colors"
          >
            tensorschool.com
          </a>
          <Link href="/admin" className="hover:text-indigo-700 transition-colors">
            Host
          </Link>
        </div>
      </div>
    </footer>
  );
}
