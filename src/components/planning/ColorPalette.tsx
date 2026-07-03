import { useState } from "react";
import { Check, Pipette } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Excel-like color palette. Shows a "swatch button" that opens a grid of
 * standard theme colors (the same layout Excel uses), plus a native color
 * picker for a fully custom value.
 */

// Standard Excel-style theme palette: 10 columns (base + 5 tints/shades),
// followed by the "Standard Colors" row.
const THEME_ROWS: string[][] = [
  // Base row
  [
    "#FFFFFF", "#000000", "#E7E6E6", "#44546A", "#4472C4",
    "#ED7D31", "#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47",
  ],
  // Tint / shade variations
  [
    "#F2F2F2", "#808080", "#D0CECE", "#D6DCE5", "#D9E2F3",
    "#FBE5D6", "#EDEDED", "#FFF2CC", "#DEEBF7", "#E2EFDA",
  ],
  [
    "#D9D9D9", "#595959", "#AFABAB", "#ADB9CA", "#B4C7E7",
    "#F8CBAD", "#DBDBDB", "#FFE699", "#BDD7EE", "#C6E0B4",
  ],
  [
    "#BFBFBF", "#404040", "#757070", "#8496B0", "#8EAADB",
    "#F4B183", "#C9C9C9", "#FFD966", "#9DC3E6", "#A9D08E",
  ],
  [
    "#A6A6A6", "#262626", "#3A3838", "#333F4F", "#2E4D8E",
    "#C55A11", "#7B7B7B", "#BF9000", "#2E75B6", "#548235",
  ],
];

const STANDARD_ROW: string[] = [
  "#C00000", "#FF0000", "#FFC000", "#FFFF00", "#92D050",
  "#00B050", "#00B0F0", "#0070C0", "#002060", "#7030A0",
];

interface ColorPaletteProps {
  value: string;
  onChange: (hex: string) => void;
  /** Optional accessible label / tooltip for the trigger. */
  title?: string;
  ariaLabel?: string;
}

function norm(hex: string): string {
  return (hex || "").trim().toUpperCase();
}

export function ColorPalette({
  value,
  onChange,
  title,
  ariaLabel,
}: ColorPaletteProps) {
  const [open, setOpen] = useState(false);
  const current = norm(value);

  const pick = (hex: string) => {
    onChange(hex);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={title}
          aria-label={ariaLabel ?? title ?? "Choisir une couleur"}
          className="size-6 shrink-0 rounded border border-border shadow-sm"
          style={{ backgroundColor: value }}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="space-y-2">
          <div className="text-[11px] font-medium text-muted-foreground">
            Couleurs du thème
          </div>
          <div className="space-y-1">
            {THEME_ROWS.map((row, i) => (
              <div key={i} className="flex gap-1">
                {row.map((hex) => (
                  <Swatch
                    key={hex + i}
                    hex={hex}
                    selected={norm(hex) === current}
                    onClick={() => pick(hex)}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="text-[11px] font-medium text-muted-foreground">
            Couleurs standard
          </div>
          <div className="flex gap-1">
            {STANDARD_ROW.map((hex) => (
              <Swatch
                key={hex}
                hex={hex}
                selected={norm(hex) === current}
                onClick={() => pick(hex)}
              />
            ))}
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded border border-border px-2 py-1.5 text-xs text-foreground hover:bg-accent">
            <Pipette className="size-3.5 text-muted-foreground" />
            <span className="flex-1">Couleur personnalisée…</span>
            <span
              className="size-5 rounded border border-border"
              style={{ backgroundColor: value }}
            />
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="sr-only"
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Swatch({
  hex,
  selected,
  onClick,
}: {
  hex: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hex}
      className={`relative size-5 rounded-sm border transition-transform hover:scale-110 ${
        selected ? "border-primary ring-1 ring-primary" : "border-border/60"
      }`}
      style={{ backgroundColor: hex }}
    >
      {selected && (
        <Check
          className="absolute inset-0 m-auto size-3"
          style={{ color: contrast(hex) }}
        />
      )}
    </button>
  );
}

/** Pick black/white check mark for contrast against the swatch. */
function contrast(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#000";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#000" : "#FFF";
}
