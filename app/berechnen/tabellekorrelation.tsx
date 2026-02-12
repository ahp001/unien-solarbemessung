"use client";

import React, { useEffect, useMemo, useState } from "react";

type CorrInputRow = {
  positionKey: string;   // z.B. "kurz_abc123"
  supportLabel: string;  // "kurz" | "lang"
  bereich: string;       // "gruen" | "gelb" | "rot"
  layer: string;         // Schichtname
  L_h_m: string;         // "—" oder "1,98"
  L_v_m: string;         // "—" oder "8,07"
};

type SoilLayer = {
  name: string;
  thickness_m: string; // "1,80" etc
};

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

function maxFinite(a: number, b: number) {
  if (!Number.isFinite(a) && !Number.isFinite(b)) return NaN;
  if (!Number.isFinite(a)) return b;
  if (!Number.isFinite(b)) return a;
  return Math.max(a, b);
}

type CorrRow = {
  idx: number;
  layer: string;
  thickness: number;     // Dicke [m]
  governing: number;     // maßgebende Rammtiefe [m] (max(Lh,Lv))
  sharePct: number;      // anteilige Mächtigkeit [%]
  restPct: number;       // restanteil [%] nach dieser Schicht
  depthUsed: number;     // Rammtiefe in dieser Schicht [m]
};

type CorrBlock = {
  positionKey: string;
  supportLabel: string;
  bereich: string;
  rows: CorrRow[];
  totalDepth: number;
};

function computeCorrelationForPosition(params: {
  positionKey: string;
  supportLabel: string;
  bereich: string;
  layersOrdered: SoilLayer[];
  tableRowsForPosition: CorrInputRow[];
}): CorrBlock {
  const { positionKey, supportLabel, bereich, layersOrdered, tableRowsForPosition } = params;

// Map LayerName -> maßgebende Rammtiefe = max(Lh, Lv)
const govMap = new Map<string, number>();
for (const r of tableRowsForPosition) {
  const lh = parseDE(r.L_h_m);
  const lv = parseDE(r.L_v_m);
  const gov = maxFinite(lh, lv);
  govMap.set(r.layer, gov);
}



  let rest = 1.0; // 1 = 100%
  const out: CorrRow[] = [];
  let total = 0;

  for (let i = 0; i < layersOrdered.length; i++) {
    const layerName = layersOrdered[i].name;
    const thickness = parseDE(layersOrdered[i].thickness_m);
    const governing = govMap.get(layerName) ?? NaN;

    // wenn governing fehlt/0 -> nix sinnvoll zu rechnen
    if (!Number.isFinite(thickness) || thickness <= 0 || !Number.isFinite(governing) || governing <= 0 || rest <= 0) {
      out.push({
        idx: i + 1,
        layer: layerName,
        thickness: Number.isFinite(thickness) ? thickness : NaN,
        governing: Number.isFinite(governing) ? governing : NaN,
        sharePct: NaN,
        restPct: rest * 100,
        depthUsed: 0,
      });
      continue;
    }

    // benötigte Tiefe in dieser Schicht für den Restanteil:
    const needDepthHere = governing * rest;

    // tatsächlich nutzbare Tiefe in dieser Schicht:
    const depthUsed = Math.min(thickness, needDepthHere);

    // Anteil, der hier abgetragen wird:
    const share = depthUsed / governing; // (0..1)
    rest = Math.max(0, rest - share);

    total += depthUsed;

    out.push({
      idx: i + 1,
      layer: layerName,
      thickness,
      governing,
      sharePct: share * 100,
      restPct: rest * 100,
      depthUsed,
    });

    // fertig, wenn kein Rest mehr
    if (rest <= 1e-12) break;
  }

  return {
    positionKey,
    supportLabel,
    bereich,
    rows: out,
    totalDepth: total,
  };
}

export default function TabelleKorrelation(props: {
  layers: SoilLayer[];
  tableRows: CorrInputRow[];
  onChange?: (rows: CorrInputRow[]) => void;
}) {
  const { layers, tableRows, onChange } = props;


  // Positionen identifizieren (pro positionKey eine Korrelation)
  const blocks = useMemo(() => {
    const byPos = new Map<string, CorrInputRow[]>();
    for (const r of tableRows) {
      if (!byPos.has(r.positionKey)) byPos.set(r.positionKey, []);
      byPos.get(r.positionKey)!.push(r);
    }


    const result: CorrBlock[] = [];
    for (const [positionKey, rows] of byPos.entries()) {
      const first = rows[0];
      result.push(
        computeCorrelationForPosition({
          positionKey,
          supportLabel: first.supportLabel,
          bereich: first.bereich,
          layersOrdered: layers,
          tableRowsForPosition: rows,
        })
      );
    }

    // sort: kurz/lang dann bereich dann positionKey
    const orderStuetze: Record<string, number> = { kurz: 0, lang: 1 };
    const orderBereich: Record<string, number> = { gruen: 0, gelb: 1, rot: 2 };

    result.sort((a, b) => {
      const s = (orderStuetze[a.supportLabel] ?? 9) - (orderStuetze[b.supportLabel] ?? 9);
      if (s !== 0) return s;
      const br = (orderBereich[a.bereich] ?? 9) - (orderBereich[b.bereich] ?? 9);
      if (br !== 0) return br;
      return a.positionKey.localeCompare(b.positionKey);
    });

    return result;
  }, [layers, tableRows]);

  const corrRows = useMemo<CorrInputRow[]>(() => {
  const out: CorrInputRow[] = [];

  for (const b of blocks) {
    for (const r of b.rows) {
      out.push({
        positionKey: b.positionKey,
        supportLabel: b.supportLabel,
        bereich: b.bereich,
        layer: r.layer,
        L_h_m: "—",
        L_v_m: fmtDE(r.depthUsed, 2), // korrelierte Tiefe je Schicht
      });
    }
  }

  return out;
}, [blocks]);

useEffect(() => {
  onChange?.(corrRows);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [corrRows]);


  // UI: Gruppen auf/zu
  const [open, setOpen] = useState<Record<string, boolean>>({});

  function groupTitle(b: CorrBlock) {
    const st = b.supportLabel === "kurz" ? "Kurze" : "Lange";
    return `${st} Stütze – ${labelBereich(b.bereich)}er Bereich`;
  }

  return (
  
      <div className="p-0 m-0 space-y-0">

        {blocks.length === 0 ? (
          <div className="text-sm text-slate-600">Keine Daten vorhanden.</div>
        ) : null}

        {blocks.map((b) => {
          const key = b.positionKey;
          const isOpen = open[key] ?? true;

          return (
            <div key={key} className="border border-slate-200 rounded">
              <button
                type="button"
                onClick={() => setOpen((p) => ({ ...p, [key]: !isOpen }))}
                className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-slate-100 border-b border-slate-200"
              >
                <div className="text-sm font-semibold">
                  {isOpen ? "▼" : "▶"} {groupTitle(b)}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  Position: <span className="font-mono">{b.positionKey}</span>
                </div>
              </button>

              {isOpen ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border-b border-slate-200 px-3 py-2 text-left">Schicht</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left">Dicke [m]</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left">Rammtiefe Vertikal Lv [m]</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left">Anteilige Mächtigkeit [%]</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left">Restanteil [%]</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left">Rammtiefe [m]</th>
                      </tr>
                    </thead>

                    <tbody>
                      {b.rows.map((r) => (
                        <tr key={r.idx} className="bg-white">
                          <td className="border-t border-slate-200 px-3 py-2">
                            {r.idx} – {r.layer}
                          </td>
                          <td className="border-t border-slate-200 px-3 py-2">{fmtDE(r.thickness, 2)}</td>
                          <td className="border-t border-slate-200 px-3 py-2">{fmtDE(r.governing, 2)}</td>
                          <td className="border-t border-slate-200 px-3 py-2">{fmtDE(r.sharePct, 1)}</td>
                          <td className="border-t border-slate-200 px-3 py-2">{fmtDE(r.restPct, 1)}</td>
                          <td className="border-t border-slate-200 px-3 py-2 font-semibold">{fmtDE(r.depthUsed, 2)}</td>
                        </tr>
                      ))}

                      <tr className="bg-slate-50">
                        <td className="border-t border-slate-200 px-3 py-2 font-semibold" colSpan={5}>
                          Erforderliche Rammtiefe
                        </td>
                        <td className="border-t border-slate-200 px-3 py-2 font-semibold">
                          {fmtDE(b.totalDepth, 2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
  );
}
