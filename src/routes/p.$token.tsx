import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  MONTHS,
  codesMap,
  dateOfDayIndex,
  dayIndicesForMonth,
  dayLetter,
  fmtHours,
  holidaysForYear,
  isWeekend,
} from "@/lib/planning/calc";
import { DEFAULT_COLORS } from "@/lib/planning/defaults";
import {
  resolveCodeColor,
  type Agent,
  type ColorScheme,
  type PlanningCode,
  type YearPlanning,
} from "@/lib/planning/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SharedPlanning {
  ok: boolean;
  reason?: string;
  mode?: "perso" | "general";
  workspaceName?: string;
  year?: number;
  codes?: PlanningCode[];
  colors?: ColorScheme | null;
  agents?: Agent[];
  planning?: YearPlanning;
}

type Search = { y: number; mo: number; ms: number[] };

export const Route = createFileRoute("/p/$token")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => {
    const now = new Date();
    const y = Number(search.y);
    const mo = Number(search.mo);
    const rawMs = typeof search.ms === "string" ? search.ms : "";
    const ms = rawMs
      .split(",")
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v) && v >= 0 && v <= 11);
    const uniqueMs = Array.from(new Set(ms)).sort((a, b) => a - b);
    return {
      y: Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : now.getFullYear(),
      mo: Number.isFinite(mo) && mo >= 0 && mo <= 11 ? mo : now.getMonth(),
      ms: uniqueMs.length
        ? uniqueMs
        : Array.from({ length: 12 }, (_, i) => i),
    };
  },
  head: () => ({
    meta: [
      { title: "Mon planning" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedPlanningPage,
});

function SharedPlanningPage() {
  const { token } = Route.useParams();
  const { y, mo } = Route.useSearch();
  const [year] = useState(y);
  const [month, setMonth] = useState(mo);
  const [data, setData] = useState<SharedPlanning | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: res, error } = await supabase.rpc("get_shared_planning", {
        _token: token,
        _year: year,
      });
      if (cancelled) return;
      if (error) {
        setData({ ok: false, reason: "error" });
      } else {
        setData(res as unknown as SharedPlanning);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, year]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || !data.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">Lien indisponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ce lien de planning n'existe plus ou a été régénéré. Demandez un
            nouveau QR code à votre responsable.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/">Retour à l'accueil</Link>
          </Button>
        </div>
      </div>
    );
  }

  const colors = { ...DEFAULT_COLORS, ...(data.colors ?? {}) } as ColorScheme;
  const codes = data.codes ?? [];
  const agents = data.agents ?? [];
  const planning = data.planning ?? {};

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarDays className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold leading-tight">
              {data.mode === "perso" && agents[0]
                ? agents[0].name
                : "Planning de l'équipe"}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {data.workspaceName}
              {data.mode === "general" ? " — planning général" : ""}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4">
        <div className="mb-4 flex items-center justify-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth((m: number) => (m + 11) % 12)}
            aria-label="Mois précédent"
          >
            <ChevronLeft />
          </Button>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i)}>
                  {m} {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth((m: number) => (m + 1) % 12)}
            aria-label="Mois suivant"
          >
            <ChevronRight />
          </Button>
        </div>

        {data.mode === "perso" ? (
          <PersonalMonth
            agent={agents[0]}
            planning={planning}
            codes={codes}
            colors={colors}
            year={year}
            month={month}
          />
        ) : (
          <GeneralMonth
            agents={agents}
            planning={planning}
            codes={codes}
            colors={colors}
            year={year}
            month={month}
          />
        )}
      </main>
    </div>
  );
}

function PersonalMonth({
  agent,
  planning,
  codes,
  colors,
  year,
  month,
}: {
  agent?: Agent;
  planning: YearPlanning;
  codes: PlanningCode[];
  colors: ColorScheme;
  year: number;
  month: number;
}) {
  const map = useMemo(() => codesMap(codes), [codes]);
  const holidays = useMemo(() => holidaysForYear(year), [year]);
  const indices = useMemo(() => dayIndicesForMonth(year, month), [year, month]);
  const row = agent ? (planning[agent.id] ?? {}) : {};

  if (!agent) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Agent introuvable.
      </p>
    );
  }

  const total = indices.reduce((sum, i) => {
    const c = map[row[i] ?? ""];
    return sum + (c ? c.hours : 0);
  }, 0);

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {indices.map((i) => {
          const date = dateOfDayIndex(year, i);
          const value = row[i];
          const code = value ? map[value] : undefined;
          const holiday = holidays[i];
          const weekend = isWeekend(date);
          const style = code
            ? (() => {
                const c = resolveCodeColor(code, colors);
                return { backgroundColor: c.bg, color: c.fg };
              })()
            : holiday
              ? { backgroundColor: colors.holiday.bg, color: colors.holiday.fg }
              : weekend
                ? { backgroundColor: colors.weekend.bg }
                : undefined;
          return (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-0"
              style={style}
            >
              <div className="w-10 shrink-0 text-center">
                <div className="text-base font-bold leading-none">
                  {date.getDate()}
                </div>
                <div className="text-[10px] uppercase opacity-70">
                  {dayLetter(date)}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                {code ? (
                  <>
                    <span className="font-semibold">{code.code}</span>
                    <span className="ml-2 opacity-80">{code.label}</span>
                  </>
                ) : holiday ? (
                  <span className="italic opacity-80">{holiday}</span>
                ) : (
                  <span className="opacity-40">—</span>
                )}
              </div>
              {code && code.hours > 0 && (
                <div className="shrink-0 text-xs font-medium opacity-80">
                  {fmtHours(code.hours)} h
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between rounded-lg border border-border bg-muted px-3 py-2 text-sm font-semibold">
        <span>Total du mois</span>
        <span>{fmtHours(total)} h</span>
      </div>
    </div>
  );
}

function GeneralMonth({
  agents,
  planning,
  codes,
  colors,
  year,
  month,
}: {
  agents: Agent[];
  planning: YearPlanning;
  codes: PlanningCode[];
  colors: ColorScheme;
  year: number;
  month: number;
}) {
  const map = useMemo(() => codesMap(codes), [codes]);
  const holidays = useMemo(() => holidaysForYear(year), [year]);
  const indices = useMemo(() => dayIndicesForMonth(year, month), [year, month]);

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border-b border-r border-border bg-muted px-2 py-1.5 text-left font-semibold">
              Agent
            </th>
            {indices.map((i) => {
              const date = dateOfDayIndex(year, i);
              const weekend = isWeekend(date);
              const holiday = holidays[i];
              return (
                <th
                  key={i}
                  className="border-b border-border px-1 py-1 text-center font-medium"
                  style={
                    holiday
                      ? { backgroundColor: colors.holiday.bg, color: colors.holiday.fg }
                      : weekend
                        ? { backgroundColor: colors.weekend.bg }
                        : undefined
                  }
                >
                  <div className="font-bold leading-none">{date.getDate()}</div>
                  <div className="text-[9px] uppercase opacity-70">
                    {dayLetter(date)}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => {
            const row = planning[a.id] ?? {};
            return (
              <tr key={a.id}>
                <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-border bg-card px-2 py-1 font-medium">
                  {a.name}
                </td>
                {indices.map((i) => {
                  const date = dateOfDayIndex(year, i);
                  const value = row[i];
                  const code = value ? map[value] : undefined;
                  const holiday = holidays[i];
                  const weekend = isWeekend(date);
                  const style = code
                    ? (() => {
                        const c = resolveCodeColor(code, colors);
                        return { backgroundColor: c.bg, color: c.fg };
                      })()
                    : holiday
                      ? { backgroundColor: colors.holiday.bg }
                      : weekend
                        ? { backgroundColor: colors.weekend.bg }
                        : undefined;
                  return (
                    <td
                      key={i}
                      className="border-b border-border px-1 py-1 text-center"
                      style={style}
                    >
                      {value ?? ""}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
