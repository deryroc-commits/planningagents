import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import type { PlanningCode } from "@/lib/planning/types";
import { CATEGORY_META, codeInlineStyle } from "@/lib/planning/types";
import { fmtHours } from "@/lib/planning/calc";

interface CodePickerProps {
  anchor: DOMRect;
  codes: PlanningCode[];
  current?: string;
  onSelect: (code: string | null) => void;
  onClose: () => void;
}

export function CodePicker({
  anchor,
  codes,
  current,
  onSelect,
  onClose,
}: CodePickerProps) {
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return codes;
    return codes.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.label.toLowerCase().includes(q),
    );
  }, [codes, query]);

  const top = Math.min(anchor.bottom + 4, window.innerHeight - 320);
  const left = Math.min(anchor.left, window.innerWidth - 268);

  return createPortal(
    <div
      ref={ref}
      style={{ position: "fixed", top, left, width: 256 }}
      className="z-50 rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
    >
      <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
        <Search className="size-3.5 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un code…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="max-h-64 overflow-y-auto p-1">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
        >
          <X className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Vider la cellule</span>
        </button>
        {filtered.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => onSelect(c.code)}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${
              current === c.code ? "ring-1 ring-primary" : ""
            }`}
          >
            <span
              className={`inline-flex min-w-9 justify-center rounded px-1.5 py-0.5 text-xs font-semibold ${CATEGORY_META[c.category].cls}`}
              style={codeInlineStyle(c)}
            >
              {c.code}
            </span>
            <span className="flex-1 truncate">{c.label}</span>
            <span className="text-xs text-muted-foreground">
              {fmtHours(c.hours)}h
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="px-2 py-3 text-center text-sm text-muted-foreground">
            Aucun code
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
