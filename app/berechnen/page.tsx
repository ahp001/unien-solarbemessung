// app/berechnen/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TabelleKorrelation from "./tabellekorrelation";

type SoilLayer = {
  id: string;
  name: string;
  thickness_m: string;

  unitWeight_kN_m3: string;
  slopeMode?: "0_15" | "gt_15";
  slope_deg: string;

  shaftFriction_kN_m2: string;
  phi_deg: string;
  cohesion_kN_m2: string;
};

type LoadRow = {
  id: string;
  bereich: "gruen" | "gelb" | "rot";
  stuetze: "kurz" | "lang";
  compression_kN: string;
  tension_kN: string;
  H_kN: string;
  M_kNm: string;
};

type Payload = {
  layers: SoilLayer[];
  loads: LoadRow[];
  factors: {
    gammaZ: string;
    gammaD: string;
    alphaC?: string;
    eta?: string;
  };
  pile: {
    b_m: string;
    U_m: string;
  };
};

type TableRow = {
  positionKey: string;
  supportLabel: string;
  bereich: string;
  layer: string;
  L_h_m: string;
  L_v_m: string;
};

type VerticalRow = {
  position: string;
  layer: string;
  L_v_m: number;
};

type VerticalOk = {
  ok: true;
  rows: VerticalRow[];
};

type VerticalFail = {
  ok: false;
  message: string;
};

type SummaryRow = {
  positionKey: string;
  supportLabel: string;
  bereich: string;
  Lh: number; // max über Schichten (Vogt)
  Lv: number; // SUMME über Schichten (Korrelation)
};

function Cell({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <td
      className={
        "border-t border-slate-200 px-3 py-2 " + (right ? "text-right" : "")
      }
    >
      {children}
    </td>
  );
}

function parseDE(v: any) {
  const n = parseFloat(String(v ?? "").replace("—", "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function fmtDE(n: number, d = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(d).replace(".", ",");
}

function labelBereich(b: string) {
  if (b === "gruen") return "Grün";
  if (b === "gelb") return "Gelb";
  if (b === "rot") return "Rot";
  return b;
}

function groupRows(rows: TableRow[]) {
  const groups: Record<string, TableRow[]> = {};
  for (const r of rows) {
    const key = `${r.supportLabel}_${r.bereich}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  return groups;
}

export default function BerechnenPage() {
  const router = useRouter();
  function goEditInputs() {
  // Draft aktualisieren, damit Eingabeseite sicher dieselben Werte hat
  if (data) {
    sessionStorage.setItem("unien_rammtiefe_inputs_v1", JSON.stringify(data));
  }
  router.push("/berechnen/eingabewerte");
}

  const [data, setData] = useState<Payload | null>(null);
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingV, setLoadingV] = useState(false);
  const [loadingH, setLoadingH] = useState(false);

  const [openSummary, setOpenSummary] = useState<Record<string, boolean>>({});

  // ✅ NEU: komplette Tabelle auf/zu
  const [tableOpen, setTableOpen] = useState(false);

  // ✅ NEU: Korrelationstabelle auf/zu
  const [corrOpen, setCorrOpen] = useState(false);

  // Korrelation (optional)
  const [corrRows, setCorrRows] = useState<TableRow[]>([]);

  // ✅ FIX: nur setzen, wenn wirklich geändert -> verhindert update-loop
  const handleCorrChange = useCallback((rows: TableRow[]) => {
    setCorrRows((prev) => {
      if (prev.length !== rows.length) return rows;

      for (let i = 0; i < prev.length; i++) {
        const a = prev[i];
        const b = rows[i];
        if (
          a.positionKey !== b.positionKey ||
          a.supportLabel !== b.supportLabel ||
          a.bereich !== b.bereich ||
          a.layer !== b.layer ||
          a.L_h_m !== b.L_h_m ||
          a.L_v_m !== b.L_v_m
        ) {
          return rows;
        }
      }
      return prev; // identisch -> kein rerender-loop
    });
  }, []);

  async function runHorizontal() {
    if (!data) return;

    setLoadingH(true);
    setError(null);

    try {
      const res = await fetch(`/api/calc/horizontal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layers: data.layers.map((l) => ({
            name: l.name,
            slopeMode: (l as any).slopeMode ?? "0_15",
            slope_deg: l.slope_deg,
            unitWeight_kN_m3: (l as any).unitWeight_kN_m3,
            phi_deg: l.phi_deg,
            cohesion_kN_m2: l.cohesion_kN_m2,
          })),
          loads: data.loads.map((r) => ({
            position: `${r.stuetze}_${r.id}`,
            H_kN: r.H_kN,
            M_kNm: r.M_kNm,
          })),
          factors: {
            alphaC: data.factors.alphaC ?? "1",
            eta: (data.factors as any).eta ?? "1,4",
          },
          pile: { b_m: data.pile.b_m },
        }),
      });

      const out = await res.json();

      if (!out || out.ok !== true) {
        setError(out?.message ?? "Horizontal-Berechnung fehlgeschlagen.");
        return;
      }

      const map = new Map<string, number>();
      for (const r of out.rows as Array<any>) {
        map.set(`${r.position}||${r.layer}`, Number(r.L_h_m));
      }

      setTableRows((prev) =>
        prev.map((tr) => {
          const key = `${tr.positionKey}||${tr.layer}`;
          if (!map.has(key)) return tr;
          return { ...tr, L_h_m: fmtDE(map.get(key)!, 2) };
        })
      );
    } catch {
      setError("Horizontal-Berechnung fehlgeschlagen. Bitte neu laden.");
    } finally {
      setLoadingH(false);
    }
  }

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // 1) Inputs aus sessionStorage laden
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("unien_rammtiefe_inputs_v1");
      if (!raw) {
        setError(
          "Keine Eingaben gefunden. Bitte zuerst auf der Startseite Werte eingeben."
        );
        return;
      }
      const parsed = JSON.parse(raw) as Payload;

      if (!parsed?.layers?.length || !parsed?.loads?.length) {
        setError(
          "Eingaben unvollständig (Bodenschichten oder Lastpositionen fehlen)."
        );
        return;
      }

      setData(parsed);
    } catch {
      setError("Eingaben konnten nicht gelesen werden (Formatfehler).");
    }
  }, []);

  // 2) Tabelle als Platzhalter erzeugen
  useEffect(() => {
    if (!data) return;

    const rows: TableRow[] = [];
    for (const ld of data.loads) {
      const positionKey = `${ld.stuetze}_${ld.id}`;
      const supportLabel = ld.stuetze;

      for (const ly of data.layers) {
        rows.push({
          positionKey,
          supportLabel,
          bereich: ld.bereich,
          layer: ly.name,
          L_h_m: "—",
          L_v_m: "—",
        });
      }
    }
    setTableRows(rows);
  }, [data]);

  // Auto-Run
  useEffect(() => {
    if (!data) return;
    if (!tableRows.length) return;
    if (loadingV || loadingH) return;

    runVertical();
    runHorizontal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tableRows.length]);

  async function runVertical() {
    if (!data) return;

    setLoadingV(true);
    setError(null);

    try {
      const res = await fetch(`/api/calc/vertical`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layers: data.layers.map((l) => ({
            name: l.name,
            thickness_m: l.thickness_m,
            shaftFriction_kN_m2: l.shaftFriction_kN_m2,
          })),
          loads: data.loads.map((r) => ({
            position: `${r.stuetze}_${r.id}`,
            compression_kN: r.compression_kN,
            tension_kN: r.tension_kN,
          })),
          factors: data.factors,
          pile: { U_m: data.pile.U_m },
        }),
      });

      const out = (await res.json()) as VerticalOk | VerticalFail;

      if (!out || (out as any).ok !== true) {
        setError(
          (out as VerticalFail)?.message ??
            "Vertikal-Berechnung fehlgeschlagen."
        );
        return;
      }

      const map = new Map<string, number>();
      for (const r of (out as VerticalOk).rows) {
        map.set(`${r.position}||${r.layer}`, Number(r.L_v_m));
      }

      setTableRows((prev) =>
        prev.map((tr) => {
          const key = `${tr.positionKey}||${tr.layer}`;
          if (!map.has(key)) return tr;
          return { ...tr, L_v_m: fmtDE(map.get(key)!, 2) };
        })
      );
    } catch {
      setError(
        "Berechnung fehlgeschlagen. Bitte Seite neu laden oder später erneut versuchen."
      );
    } finally {
      setLoadingV(false);
    }
  }

  // ✅ ZUSAMMENFASSUNG: Lh aus VOGT (tableRows, max), Lv aus KORRELATION (corrRows, Summe)
  const summaryRows = useMemo<SummaryRow[]>(() => {
    const lhMaxByPos = new Map<string, number>();
    const metaByPos = new Map<string, { supportLabel: string; bereich: string }>();

    // 1) Lh = MAX über Schichten aus tableRows
    for (const r of tableRows) {
      if (!metaByPos.has(r.positionKey)) {
        metaByPos.set(r.positionKey, { supportLabel: r.supportLabel, bereich: r.bereich });
      }

      const lh = parseDE(r.L_h_m);
      if (!Number.isFinite(lh)) continue;

      const prev = lhMaxByPos.get(r.positionKey);
      lhMaxByPos.set(r.positionKey, Number.isFinite(prev as any) ? Math.max(prev!, lh) : lh);
    }

    // 2) Lv = SUMME über Schichten aus corrRows
    const lvSumByPos = new Map<string, number>();
    for (const r of corrRows) {
      const lv = parseDE(r.L_v_m);
      if (!Number.isFinite(lv)) continue;

      lvSumByPos.set(r.positionKey, (lvSumByPos.get(r.positionKey) ?? 0) + lv);

      if (!metaByPos.has(r.positionKey)) {
        metaByPos.set(r.positionKey, { supportLabel: r.supportLabel, bereich: r.bereich });
      }
    }

    // 3) Merge
    const keys = new Set<string>([
      ...Array.from(metaByPos.keys()),
      ...Array.from(lhMaxByPos.keys()),
      ...Array.from(lvSumByPos.keys()),
    ]);

    const out: SummaryRow[] = [];
    for (const positionKey of keys) {
      const meta = metaByPos.get(positionKey) ?? { supportLabel: "—", bereich: "—" };
      out.push({
        positionKey,
        supportLabel: meta.supportLabel,
        bereich: meta.bereich,
        Lh: lhMaxByPos.get(positionKey) ?? NaN,
        Lv: lvSumByPos.get(positionKey) ?? NaN,
      });
    }

    // sort: kurz/lang, bereich, key
    const orderSt: Record<string, number> = { kurz: 0, lang: 1 };
    const orderB: Record<string, number> = { gruen: 0, gelb: 1, rot: 2 };
    out.sort((a, b) => {
      const s = (orderSt[a.supportLabel] ?? 9) - (orderSt[b.supportLabel] ?? 9);
      if (s !== 0) return s;
      const br = (orderB[a.bereich] ?? 9) - (orderB[b.bereich] ?? 9);
      if (br !== 0) return br;
      return a.positionKey.localeCompare(b.positionKey);
    });

    return out;
  }, [tableRows, corrRows]);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-300">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold tracking-wide">
                UNIEN Rammtiefenbemessung – Berechnung
              </h1>
              <div className="mt-1 text-xs text-slate-600">
                VORABZUG - Testversion Stand 11.02.2026
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-6 py-10 space-y-6">
        {error ? (
          <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {/* Tabelle */}
        {tableRows.length ? (
          <div className="border border-slate-300 bg-white">
            <button
              type="button"
              onClick={() => setTableOpen((v) => !v)}
              className="w-full border-b border-slate-300 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">
                    {tableOpen ? "▼" : "▶"} Zwischenergebnisse je Bodenschicht
                  </div>
                  
                </div>

                <div className="text-xs text-slate-500 pt-0.5">
                  Klick zum {tableOpen ? "Zuklappen" : "Aufklappen"}
                </div>
              </div>
            </button>

            {tableOpen ? (
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th
                      rowSpan={2}
                      className="border-b border-slate-300 px-3 py-2 text-left align-middle"
                    >
                      Stütze
                    </th>
                    <th
                      rowSpan={2}
                      className="border-b border-slate-300 px-3 py-2 text-left align-middle"
                    >
                      Bereich
                    </th>
                    <th
                      rowSpan={2}
                      className="border-b border-slate-300 px-3 py-2 text-left align-middle"
                    >
                      Gründung angenommen in
                    </th>

                    <th className="border-b border-slate-300 px-3 py-3 text-center align-top">
                      <div className="font-semibold leading-snug">
                        Erforderliche Rammtiefe
                        <br />
                        [m] zur Aufnahme der
                        <br />
                        Horizontalkräfte und Momente 
                      </div>
                      <div className="mt-2 text-xs text-slate-700 leading-snug">
                        bei angenommener
                        <br />
                        Gründung ausschließlich
                        <br />
                        in 1 Bodenschicht
                        <br />
                        Sicherheit = 1,4
                        
                      </div>
                    </th>

                    <th className="border-b border-slate-300 px-3 py-3 text-center align-top">
                      <div className="font-semibold leading-snug">
                        Erforderliche Rammtiefe
                        <br />
                        [m] zur Aufnahme der
                        <br />
                        Vertikalkräfte
                         </div>
                      <div className="mt-2 text-xs text-slate-700 leading-snug">
                        bei angenommener
                        <br />
                        Gründung ausschließlich
                        <br />
                        in 1 Bodenschicht
                        <br />
                        Sicherheit Druck ≥ 1,2
                        <br />
                        Sicherheit Zug ≥ 1,3
                      </div>
                      <div className="mt-2 text-xs text-slate-700 leading-snug">
                        max(Lh, Lv)
                      </div>
                    </th>
                  </tr>
                  <tr>
                    <th className="border-b border-slate-300 px-3 py-2 text-center">
                      Erforderliche Rammtiefe Horizontal [m]
                    </th>
                    <th className="border-b border-slate-300 px-3 py-2 text-center">
                      Erforderliche Rammtiefe Vertikal [m]
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupRows(tableRows)).map(([groupKey, rows]) => {
                    const [stuetze, bereich] = groupKey.split("_");
                    const isOpen = openGroups[groupKey] ?? true;

                    return (
                      <React.Fragment key={groupKey}>
                        <tr
                          className="bg-slate-50 cursor-pointer hover:bg-slate-100"
                          onClick={() =>
                            setOpenGroups((prev) => ({
                              ...prev,
                              [groupKey]: !isOpen,
                            }))
                          }
                        >
                          <td colSpan={5} className="px-3 py-2 font-semibold text-sm">
                            {isOpen ? "▼" : "▶"}{" "}
                            {stuetze === "kurz" ? "Kurze" : "Lange"} Stütze –{" "}
                            {labelBereich(bereich)}er Bereich
                          </td>
                        </tr>

                        {isOpen &&
                          rows.map((r, i) => (
                            <tr key={i} className="bg-white">
                              <Cell>{r.supportLabel}</Cell>
                              <Cell>{labelBereich(r.bereich)}</Cell>
                              <Cell>{r.layer}</Cell>
                              <Cell right>{r.L_h_m}</Cell>
                              <Cell right>{r.L_v_m}</Cell>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            ) : null}
          </div>
        ) : !error ? (
          <div className="text-sm text-slate-600">Keine Tabelle vorhanden.</div>
        ) : null}

        {/* ✅ Korrelationstabelle (UI auf/zu – Berechnung bleibt aktiv, Komponente bleibt gemountet) */}
        {data?.layers?.length && tableRows.length ? (
          <div className="border border-slate-300 bg-white">
            <button
              type="button"
              onClick={() => setCorrOpen((v) => !v)}
              className="w-full border-b border-slate-300 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">
                    {corrOpen ? "▼" : "▶"} Korrelationstabelle – Lastabtrag über Schichten
                  </div>
                </div>

                <div className="text-xs text-slate-500 pt-0.5">
                  Klick zum {corrOpen ? "Zuklappen" : "Aufklappen"}
                </div>
              </div>
            </button>

            {/* bleibt IMMER gemountet -> onChange läuft auch wenn zugeklappt */}
            <div style={{ display: corrOpen ? "block" : "none" }}>
              <TabelleKorrelation
                layers={data.layers.map((l) => ({
                  name: l.name,
                  thickness_m: l.thickness_m,
                }))}
                tableRows={tableRows}
                onChange={handleCorrChange}
              />
            </div>
          </div>
        ) : null}

        {/* ✅ ZUSAMMENFASSUNG – gruppiert nach Bereich (aufklappbar) */}
        <div className="border border-slate-300 bg-white">
          <div className="border-b border-slate-300 bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold">Zusammenfassung</div>
            <div className="text-xs text-slate-600 mt-1">
              Maßgebende Rammtiefe je Position = max(Lh, Lv)
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left">Stütze</th>
                  <th className="px-3 py-2 text-right">Rammtiefe aus H und M gesamt  [m]</th>
                  <th className="px-3 py-2 text-right">Rammtiefe aus V gesamt [m]</th>
                  <th className="px-3 py-2 text-right">maßgebend [m]</th>
                </tr>
              </thead>

              <tbody>
                {(["gruen", "gelb", "rot"] as const).map((bereich) => {
                  const rows = summaryRows.filter((r) => r.bereich === bereich);
                  if (!rows.length) return null;

                  const isOpen = openSummary[bereich] ?? true;

                  // innerhalb Bereich: kurz → lang → positionKey
                  const orderSt: Record<string, number> = { kurz: 0, lang: 1 };
                  const rowsSorted = [...rows].sort((a, b) => {
                    const s = (orderSt[a.supportLabel] ?? 9) - (orderSt[b.supportLabel] ?? 9);
                    if (s !== 0) return s;
                    return a.positionKey.localeCompare(b.positionKey);
                  });

                  return (
                    <React.Fragment key={bereich}>
                      <tr
                        className="bg-slate-50 cursor-pointer hover:bg-slate-100"
                        onClick={() =>
                          setOpenSummary((prev) => ({
                            ...prev,
                            [bereich]: !isOpen,
                          }))
                        }
                      >
                        <td colSpan={4} className="px-3 py-2 font-semibold text-sm">
                          {isOpen ? "▼" : "▶"} {labelBereich(bereich)}er Bereich
                        </td>
                      </tr>

                      {isOpen &&
                        rowsSorted.map((r) => {
                          const maß =
                            Number.isFinite(r.Lh) && Number.isFinite(r.Lv)
                              ? Math.max(r.Lh, r.Lv)
                              : Number.isFinite(r.Lh)
                              ? r.Lh
                              : r.Lv;

                          return (
                            <tr key={r.positionKey} className="border-t border-slate-200">
  <td className="px-3 py-2">
    {r.supportLabel === "kurz" ? "kurz" : "lang"}
  </td>
  <td className="px-3 py-2 text-right">{fmtDE(r.Lh)}</td>
  <td className="px-3 py-2 text-right">{fmtDE(r.Lv)}</td>
  <td className="px-3 py-2 text-right font-semibold">{fmtDE(maß)}</td>
</tr>

                          );
                        })}
                    </React.Fragment>
                  );
                })}

                {!summaryRows.length && (
                  <tr className="border-t border-slate-200">
                    <td className="px-3 py-3 text-slate-600" colSpan={5}>
                      Noch keine Werte vorhanden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border border-slate-300 bg-slate-50 px-5 py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-600">
              Nächster Step: Lh aus <code className="px-1">vogt.ts</code> je Zeile füllen.
            </div>

           <div className="flex items-center gap-3">
  <button
    type="button"
    onClick={() => router.push("/")}
    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
  >
    Zurück zur Projektübersicht
  </button>

  <button
    type="button"
    onClick={goEditInputs}
    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
  >
    Eingaben ändern
  </button>
</div>

          </div>
        </div>
      </section>

      <footer className="border-t border-slate-300">
        <div className="mx-auto max-w-7xl px-6 py-4 text-xs text-slate-500">
          © {new Date().getFullYear()} ahp GmbH &amp; Co. KG
        </div>
      </footer>
    </main>
  );
}
