"use client";

import React, { useMemo } from "react";

export type CorrInputRow = {
  positionKey: string;   // z.B. "kurz_abc123" oder "S37" etc.
  supportLabel: string;  // "kurz" | "lang"
  bereich: string;       // "gruen" | "gelb" | "rot" (oder was du nutzt)
  layer: string;         // z.B. "S1", "S2"
  L_h_m: string;         // "—" oder "1,98"
  L_v_m: string;         // "—" oder "8,07"
};

function parseDE(v: any) {
  const s = String(v ?? "").trim();
  if (!s || s === "—" || s === "-") return NaN;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function fmtDE(n: number, d = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(d).replace(".", ",");
}

function labelBereich(b: string) {
  if (b === "gruen") return "grün";
  if (b === "gelb") return "gelb";
  if (b === "rot") return "rot";
  return b || "—";
}

function worstBereich(bs: string[]) {
  // rot > gelb > gruen
  if (bs.includes("rot")) return "rot";
  if (bs.includes("gelb")) return "gelb";
  if (bs.includes("gruen")) return "gruen";
  return bs[0] ?? "—";
}

export default function ZusammenfassungTable({
  rows,
  extraSafety_m = 0, // optional: wenn du später einen pauschalen Zuschlag geben willst
}: {
  rows: CorrInputRow[];
  extraSafety_m?: number;
}) {
  const summary = useMemo(() => {
    const map = new Map<
      string,
      {
        positionKey: string;
        supportLabel: string;
        bereich: string;
        Lh: number;
        Lv: number;
      }
    >();

    for (const r of rows) {
      const key = `${r.positionKey}__${r.supportLabel}`;
      const cur =
        map.get(key) ??
        ({
          positionKey: r.positionKey,
          supportLabel: r.supportLabel,
          bereich: r.bereich,
          Lh: 0,
          Lv: 0,
        } as const);

      const lh = parseDE(r.L_h_m);
      const lv = parseDE(r.L_v_m);

      const next = {
        ...cur,
        bereich: cur.bereich, // wird unten final "worst" gesetzt
        Lh: cur.Lh + (Number.isFinite(lh) ? lh : 0),
        Lv: cur.Lv + (Number.isFinite(lv) ? lv : 0),
      };

      map.set(key, next as any);

      // bereich merken (wir sammeln separat über rows)
    }

    // Bereich "worst case" je Gruppe bestimmen
    const bereichByKey = new Map<string, string>();
    for (const r of rows) {
      const k = `${r.positionKey}__${r.supportLabel}`;
      const prev = bereichByKey.get(k);
      bereichByKey.set(k, worstBereich([prev ?? "", r.bereich].filter(Boolean)));
    }

    const out = Array.from(map.entries()).map(([k, v]) => {
      const bereich = bereichByKey.get(k) ?? v.bereich ?? "—";
      const Lh = v.Lh > 0 ? v.Lh : NaN;
      const Lv = v.Lv > 0 ? v.Lv : NaN;

      let governing: "Horizontal/Moment" | "Vertikal" | "—" = "—";
      let Lreq = NaN;

      if (Number.isFinite(Lh) && Number.isFinite(Lv)) {
        if (Lv >= Lh) {
          governing = "Vertikal";
          Lreq = Lv;
        } else {
          governing = "Horizontal/Moment";
          Lreq = Lh;
        }
      } else if (Number.isFinite(Lh)) {
        governing = "Horizontal/Moment";
        Lreq = Lh;
      } else if (Number.isFinite(Lv)) {
        governing = "Vertikal";
        Lreq = Lv;
      }

      const Lempf = Number.isFinite(Lreq) ? Lreq + (extraSafety_m || 0) : NaN;

      return {
        positionKey: v.positionKey,
        supportLabel: v.supportLabel,
        bereich,
        Lh,
        Lv,
        governing,
        Lreq,
        Lempf,
      };
    });

    // optional sort: kurz/lang + key
    out.sort((a, b) => {
      if (a.supportLabel !== b.supportLabel) return a.supportLabel.localeCompare(b.supportLabel);
      return a.positionKey.localeCompare(b.positionKey);
    });

    return out;
  }, [rows, extraSafety_m]);

  if (!rows?.length) {
    return (
      <div className="mt-10 rounded-xl border p-4 text-sm text-slate-600">
        Keine Daten für die Zusammenfassung — erst Korrelation berechnen.
      </div>
    );
  }

  return (
    <div className="mt-10 rounded-2xl border bg-white">
      <div className="flex items-center justify-between gap-4 p-4">
        <div>
          <h2 className="text-lg font-semibold">Zusammenfassung</h2>
          <p className="text-sm text-slate-600">
            Pro Position: Gesamtrammtiefe aus Korrelation, maßgebend = max(Lh, Lv)
          </p>
        </div>

        {extraSafety_m > 0 ? (
          <div className="text-sm text-slate-700">
            Zuschlag: <span className="font-semibold">{fmtDE(extraSafety_m, 2)} m</span>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr className="text-left">
              <th className="px-4 py-3">Position</th>
              <th className="px-4 py-3">Stütze</th>
              <th className="px-4 py-3">Bereich</th>
              <th className="px-4 py-3">Lh gesamt [m]</th>
              <th className="px-4 py-3">Lv gesamt [m]</th>
              <th className="px-4 py-3">maßgebend</th>
              <th className="px-4 py-3">Lreq [m]</th>
              <th className="px-4 py-3">L empfohlen [m]</th>
            </tr>
          </thead>

          <tbody>
            {summary.map((s) => (
              <tr key={`${s.positionKey}__${s.supportLabel}`} className="border-t">
                <td className="px-4 py-3 font-medium">{s.positionKey}</td>
                <td className="px-4 py-3">{s.supportLabel}</td>
                <td className="px-4 py-3">{labelBereich(s.bereich)}</td>
                <td className="px-4 py-3">{fmtDE(s.Lh)}</td>
                <td className="px-4 py-3">{fmtDE(s.Lv)}</td>
                <td className="px-4 py-3">{s.governing}</td>
                <td className="px-4 py-3 font-semibold">{fmtDE(s.Lreq)}</td>
                <td className="px-4 py-3 font-semibold">{fmtDE(s.Lempf)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
