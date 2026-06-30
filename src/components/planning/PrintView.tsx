import { useMemo } from "react";
import { Printer } from "lucide-react";
import { usePlanning } from "@/lib/planning/store";
import {
  agentHoursForIndices,
  codesMap,
  dateOfDayIndex,
  dayIndicesForMonth,
  dayLetter,
  fmtHours,
  isInvalid,
  isWeekend,
} from "@/lib/planning/calc";
import { MONTHS } from "@/lib/planning/calc";
import { CATEGORY_META } from "@/lib/planning/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PrintViewProps {
  month: number;
  setMonth: (m: number) => void;
}

export function PrintView({ month, setMonth }: PrintViewProps) {
  const { year, agents, codes, planning } = usePlanning();
  const map = useMemo(() => codesMap(codes), [codes]);
  const indices = useMemo(
    () => dayIndicesForMonth(year, month),
    [year, month],
  );

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Impression mensuelle</h2>
          <p className="text-sm text-muted-foreground">
            Vue formatée prête à imprimer ou exporter en PDF.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(month)}
            onValueChange={(v) => setMonth(Number(v))}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => window.print()}>
            <Printer /> Imprimer / PDF
          </Button>
        </div>
      </div>

      <div className="print-area rounded-lg border border-border bg-card p-4">
        <div className="mb-3 text-center">
          <h1 className="text-xl font-bold">Planning des agents — UCPA</h1>
          <p className="text-sm text-muted-foreground">
            {MONTHS[month]} {year}
          </p>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="border border-border bg-muted px-2 py-1 text-left">
                  Agent
                </th>
                {indices.map((i) => {
                  const d = dateOfDayIndex(year, i);
                  return (
                    <th
                      key={i}
                      className={`w-7 border border-border px-0 py-1 text-center ${isWeekend(d) ? "cell-weekend" : "bg-muted"}`}
                    >
                      <div className="text-[9px] text-muted-foreground">
                        {dayLetter(d)}
                      </div>
                      <div>{d.getDate()}</div>
                    </th>
                  );
                })}
                <th className="border border-border bg-accent px-1 py-1 text-center">
                  H
                </th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => {
                const row = planning[a.id] ?? {};
                return (
                  <tr key={a.id}>
                    <td className="border border-border px-2 py-1 font-medium">
                      {a.name}
                    </td>
                    {indices.map((i) => {
                      const v = row[i];
                      const cat = v && map[v] ? map[v].category : null;
                      const cls = isInvalid(v, map)
                        ? "cat-error"
                        : cat
                          ? CATEGORY_META[cat].cls
                          : isWeekend(dateOfDayIndex(year, i))
                            ? "cell-weekend"
                            : "";
                      return (
                        <td
                          key={i}
                          className={`border border-border px-0 py-1 text-center font-semibold ${cls}`}
                        >
                          {v ?? ""}
                        </td>
                      );
                    })}
                    <td className="border border-border bg-accent/40 px-1 text-center font-semibold tabular-nums">
                      {fmtHours(agentHoursForIndices(planning, a.id, indices, map))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Legend />
      </div>
    </div>
  );
}

function Legend() {
  const cats = Object.entries(CATEGORY_META);
  return (
    <div className="mt-4 flex flex-wrap gap-3 text-[11px]">
      {cats.map(([key, meta]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className={`inline-block size-3 rounded ${meta.cls}`} />
          {meta.label}
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <span className="inline-block size-3 rounded cat-error" />
        Erreur / code invalide
      </div>
    </div>
  );
}
