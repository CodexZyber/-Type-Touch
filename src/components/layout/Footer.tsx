import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/40 text-zinc-500 text-xs py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-zinc-300">TENSOR MACtober</span>
          <span>•</span>
          <span>Typing Championship '26</span>
          <span>•</span>
          <span className="font-mono text-[11px] text-zinc-400">180 Concurrent Seats</span>
        </div>
        <div className="flex items-center space-x-4 text-[11px]">
          <span>60 Seconds • 85% Min Accuracy • Server Authoritative</span>
          <span>•</span>
          <span className="text-zinc-400">Crafted for Apple Silicon & Desktop</span>
        </div>
      </div>
    </footer>
  );
}
