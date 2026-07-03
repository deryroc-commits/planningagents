import { RotateCcw } from "lucide-react";
import { usePlanning } from "@/lib/planning/store";
import { COLOR_LABELS, type ColorKey } from "@/lib/planning/types";
import { Button } from "@/components/ui/button";
import { ColorPalette } from "./ColorPalette";

// Order shown in the editor — mirrors the legend.
const KEYS: ColorKey[] = [
  "travail",
  "poste",
  "repos",
  "recup",
  "absence",
  "autre",
  "weekend",
  "holiday",
  "error",
];

// The weekend cell only uses a background color on screen.
const HAS_TEXT: Record<ColorKey, boolean> = {
  travail: true,
  poste: true,
  repos: true,
  recup: true,
  absence: true,
  autre: true,
  weekend: false,
  holiday: true,
  error: true,
};

export function ColorSettings() {
  const { colors, setColor, resetColors } = usePlanning();

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Couleurs</h3>
          <p className="text-sm text-muted-foreground">
            Choisissez les couleurs des catégories, du week-end, des jours
            fériés et des erreurs. Elles s'appliquent à la grille, à la légende,
            à l'impression et à l'export Excel.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetColors}>
          <RotateCcw /> Réinitialiser
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {KEYS.map((key) => {
          const c = colors[key];
          return (
            <div
              key={key}
              className="flex items-center gap-3 rounded-md border border-border bg-background p-2.5"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded text-xs font-bold"
                style={{ backgroundColor: c.bg, color: c.fg }}
              >
                Ab
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {COLOR_LABELS[key]}
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Fond
                    <ColorPalette
                      value={c.bg}
                      onChange={(hex) => setColor(key, "bg", hex)}
                      title={`Couleur de fond — ${COLOR_LABELS[key]}`}
                    />
                  </span>
                  {HAS_TEXT[key] && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Texte
                      <ColorPalette
                        value={c.fg}
                        onChange={(hex) => setColor(key, "fg", hex)}
                        title={`Couleur du texte — ${COLOR_LABELS[key]}`}
                      />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
