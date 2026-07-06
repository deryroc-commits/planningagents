import { useState } from "react";
import { Pencil, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { ColorSettings } from "./ColorSettings";
import { ColorPalette } from "./ColorPalette";
import { BackupBar } from "./BackupBar";
import { usePlanning } from "@/lib/planning/store";
import {
  CATEGORY_META,
  codeInlineStyle,
  resolveCodeColor,
  type ColorScheme,
  type CodeCategory,
  type PlanningCode,
} from "@/lib/planning/types";
import { fmtHours } from "@/lib/planning/calc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATS = Object.keys(CATEGORY_META) as CodeCategory[];

const EMPTY: PlanningCode = {
  code: "",
  label: "",
  hours: 0,
  category: "travail",
};

export function ParametersTab() {
  const { codes, upsertCode, removeCode, colors } = usePlanning();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlanningCode>(EMPTY);
  const [adding, setAdding] = useState(false);

  const startEdit = (c: PlanningCode) => {
    setAdding(false);
    setEditing(c.code);
    setDraft({ ...c });
  };
  const startAdd = () => {
    setEditing(null);
    setAdding(true);
    setDraft(EMPTY);
  };
  const cancel = () => {
    setEditing(null);
    setAdding(false);
    setDraft(EMPTY);
  };
  const save = () => {
    const code = draft.code.trim().toUpperCase();
    if (!code) return;
    upsertCode({ ...draft, code }, editing ?? undefined);
    cancel();
  };

  // Quick per-code color change directly from the list (no edit mode needed).
  const setCodeColor = (c: PlanningCode, part: "bg" | "fg", hex: string) => {
    const base = resolveCodeColor(c, colors);
    upsertCode({ ...c, color: { ...base, [part]: hex } }, c.code);
  };
  const clearCodeColor = (c: PlanningCode) => {
    const { color, ...rest } = c;
    void color;
    upsertCode(rest, c.code);
  };

  return (
    <div className="space-y-4">
      <BackupBar />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Codes & paramètres</h2>
          <p className="text-sm text-muted-foreground">
            Liste contrôlée des valeurs autorisées dans le planning et leurs
            heures.
          </p>
        </div>
        {!adding && (
          <Button onClick={startAdd} size="sm">
            <Plus /> Nouveau code
          </Button>
        )}
      </div>

      <ColorSettings />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-left">
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Libellé</th>
              <th className="px-3 py-2 font-medium">Heures</th>
              <th className="px-3 py-2 font-medium">Catégorie</th>
              <th className="px-3 py-2 font-medium">Couleur</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {adding && (
              <CodeEditorRow
                draft={draft}
                setDraft={setDraft}
                onSave={save}
                onCancel={cancel}
                colors={colors}
              />
            )}
            {codes.map((c) =>
              editing === c.code ? (
                <CodeEditorRow
                  key={c.code}
                  draft={draft}
                  setDraft={setDraft}
                  onSave={save}
                  onCancel={cancel}
                  colors={colors}
                />
              ) : (
                <tr key={c.code} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex min-w-9 justify-center rounded px-1.5 py-0.5 text-xs font-semibold ${CATEGORY_META[c.category].cls}`}
                      style={codeInlineStyle(c)}
                    >
                      {c.code}
                    </span>
                  </td>
                  <td className="px-3 py-2">{c.label}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtHours(c.hours)} h</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {CATEGORY_META[c.category].label}
                  </td>
                  <td className="px-3 py-2">
                    {(() => {
                      const eff = resolveCodeColor(c, colors);
                      return (
                        <div className="flex items-center gap-1.5">
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            Fond
                            <ColorPalette
                              value={eff.bg}
                              onChange={(hex) => setCodeColor(c, "bg", hex)}
                              title={`Couleur de fond — ${c.code}`}
                            />
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            Texte
                            <ColorPalette
                              value={eff.fg}
                              onChange={(hex) => setCodeColor(c, "fg", hex)}
                              title={`Couleur du texte — ${c.code}`}
                            />
                          </span>
                          {c.color && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground"
                              title="Revenir à la couleur de la catégorie"
                              onClick={() => clearCodeColor(c)}
                            >
                              <RotateCcw className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => startEdit(c)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => removeCode(c.code)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CodeEditorRow({
  draft,
  setDraft,
  onSave,
  onCancel,
  colors,
}: {
  draft: PlanningCode;
  setDraft: (c: PlanningCode) => void;
  onSave: () => void;
  onCancel: () => void;
  colors: ColorScheme;
}) {
  const eff = resolveCodeColor(draft, colors);
  return (
    <tr className="border-b border-border bg-accent/30">
      <td className="px-3 py-2">
        <Input
          value={draft.code}
          onChange={(e) => setDraft({ ...draft, code: e.target.value })}
          placeholder="Code"
          className="h-8 w-20 uppercase"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          placeholder="Libellé"
          className="h-8"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          step="0.5"
          value={draft.hours}
          onChange={(e) =>
            setDraft({ ...draft, hours: Number(e.target.value) || 0 })
          }
          className="h-8 w-20"
        />
      </td>
      <td className="px-3 py-2">
        <Select
          value={draft.category}
          onValueChange={(v) =>
            setDraft({ ...draft, category: v as CodeCategory })
          }
        >
          <SelectTrigger className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATS.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_META[c].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            Fond
            <ColorPalette
              value={eff.bg}
              onChange={(hex) =>
                setDraft({ ...draft, color: { ...eff, bg: hex } })
              }
              title="Couleur de fond du code"
            />
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            Texte
            <ColorPalette
              value={eff.fg}
              onChange={(hex) =>
                setDraft({ ...draft, color: { ...eff, fg: hex } })
              }
              title="Couleur du texte du code"
            />
          </span>
          {draft.color && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              title="Revenir à la couleur de la catégorie"
              onClick={() => {
                const { color, ...rest } = draft;
                void color;
                setDraft(rest);
              }}
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-1">
          <Button size="icon" className="size-8" onClick={onSave}>
            <Save />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onCancel}
          >
            <X />
          </Button>
        </div>
      </td>
    </tr>
  );
}
