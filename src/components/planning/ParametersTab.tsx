import { useEffect, useState } from "react";
import { Pencil, Plus, RotateCcw, Save, Trash2, Type, X } from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { ColorSettings } from "./ColorSettings";
import { ColorPalette } from "./ColorPalette";
import { BackupBar } from "./BackupBar";
import { usePlanning } from "@/lib/planning/store";
import { useWorkspace, DEFAULT_TITLES } from "@/lib/workspace/workspace-context";
import { Label } from "@/components/ui/label";
import {
  CATEGORY_META,
  codeInlineStyle,
  resolveCodeColor,
  type ColorScheme,
  type CodeCategory,
  type PlanningCode,
} from "@/lib/planning/types";
import { fmtHours, selectableYears } from "@/lib/planning/calc";
import { DEFAULT_YEAR_RANGE } from "@/lib/planning/defaults";
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
      <BackupBar scope="params" />

      <TitlesCard />

      <PrintersCard />


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

      <YearRangeSettings />

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

function YearRangeSettings() {
  const { yearRange, setYearRange } = usePlanning();
  const now = new Date().getFullYear();

  const preview = selectableYears(yearRange);
  const first = preview[0];
  const last = preview[preview.length - 1];

  const setStart = (v: string) => {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return;
    setYearRange({ ...yearRange, start: n });
  };
  const setAhead = (v: number) => {
    setYearRange({ ...yearRange, ahead: v });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold">Plage d'années</h3>
        <p className="text-sm text-muted-foreground">
          Années proposées dans les sélecteurs (planning, impression, QR
          codes). La fin s'étend automatiquement chaque nouvelle année.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-6">
        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-center gap-2 font-medium">
            Première année
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setYearRange({ ...yearRange, ahead: DEFAULT_YEAR_RANGE.ahead })}
              title="Réinitialiser le nombre d'années futures"
              className="h-6 px-2 text-xs text-muted-foreground"
            >
              <RotateCcw className="size-3" /> Réinitialiser ({yearRange.start} / +{DEFAULT_YEAR_RANGE.ahead})
            </Button>
          </span>
          <Input
            type="number"
            value={yearRange.start}
            min={1970}
            max={2100}
            onChange={(e) => setStart(e.target.value)}
            className="h-9 w-28"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            Années futures : <span className="tabular-nums">+{yearRange.ahead}</span>
          </span>
          <Slider
            min={0}
            max={30}
            step={1}
            value={[yearRange.ahead]}
            onValueChange={(v) => setAhead(v[0] ?? 0)}
            className="mt-2 w-56"
          />
        </label>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Actuellement : de{" "}
        <span className="font-semibold text-foreground tabular-nums">{first}</span>{" "}
        à{" "}
        <span className="font-semibold text-foreground tabular-nums">{last}</span>{" "}
        (année en cours {now} + {yearRange.ahead}).
      </p>
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

function TitlesCard() {
  const { activeWorkspace, updateWorkspaceTitles, isOwner } = useWorkspace();
  const [mainTitle, setMainTitle] = useState(activeWorkspace?.main_title ?? DEFAULT_TITLES.main_title);
  const [subtitle, setSubtitle] = useState(activeWorkspace?.subtitle ?? DEFAULT_TITLES.subtitle);
  const [printTitle, setPrintTitle] = useState(activeWorkspace?.print_title ?? DEFAULT_TITLES.print_title);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMainTitle(activeWorkspace?.main_title ?? DEFAULT_TITLES.main_title);
    setSubtitle(activeWorkspace?.subtitle ?? DEFAULT_TITLES.subtitle);
    setPrintTitle(activeWorkspace?.print_title ?? DEFAULT_TITLES.print_title);
  }, [activeWorkspace?.id, activeWorkspace?.main_title, activeWorkspace?.subtitle, activeWorkspace?.print_title]);

  const dirty =
    mainTitle !== (activeWorkspace?.main_title ?? DEFAULT_TITLES.main_title) ||
    subtitle !== (activeWorkspace?.subtitle ?? DEFAULT_TITLES.subtitle) ||
    printTitle !== (activeWorkspace?.print_title ?? DEFAULT_TITLES.print_title);

  const onSave = async () => {
    setSaving(true);
    try {
      await updateWorkspaceTitles({
        main_title: mainTitle,
        subtitle,
        print_title: printTitle,
      });
      toast.success("Titres enregistrés");
    } catch (err) {
      toast.error("Impossible d'enregistrer", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => {
    setMainTitle(DEFAULT_TITLES.main_title);
    setSubtitle(DEFAULT_TITLES.subtitle);
    setPrintTitle(DEFAULT_TITLES.print_title);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Type className="size-4 text-primary" /> Titres du planning
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Personnalisez le titre principal, le sous-titre et le bandeau d'impression de cette équipe.
        {!isOwner && " Seul le propriétaire peut modifier."}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ttl-main">Titre principal</Label>
          <Input
            id="ttl-main"
            value={mainTitle}
            onChange={(e) => setMainTitle(e.target.value)}
            disabled={!isOwner}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ttl-sub">Sous-titre</Label>
          <Input
            id="ttl-sub"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            disabled={!isOwner}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ttl-print">Titre d'impression (bandeau rouge)</Label>
          <Input
            id="ttl-print"
            value={printTitle}
            onChange={(e) => setPrintTitle(e.target.value)}
            disabled={!isOwner}
          />
        </div>
      </div>
      {isOwner && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onSave} disabled={!dirty || saving}>
            <Save className="mr-1.5 size-4" />
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <Button variant="outline" onClick={onReset} disabled={saving}>
            <RotateCcw className="mr-1.5 size-4" /> Valeurs par défaut
          </Button>
        </div>
      )}
    </div>
  );
}
