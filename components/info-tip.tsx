"use client";

interface InfoTipProps {
  text: string;
  className?: string;
}

export function InfoTip({ text, className }: InfoTipProps) {
  return (
    <span className={`group relative inline-flex ${className || ""}`}>
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-[11px] font-semibold text-zinc-300 transition hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
        aria-label="More info"
      >
        ?
      </button>
      <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden w-56 -translate-y-1/2 rounded-xl border border-white/10 bg-zinc-950/95 p-3 text-[11px] leading-relaxed text-zinc-300 shadow-[0_20px_60px_rgba(0,0,0,0.45)] group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}
