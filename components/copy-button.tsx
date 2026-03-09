"use client";

import { useState } from "react";

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export function CopyButton({ text, label = "Copy", className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className={`rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-white/15 ${className || ""}`}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
