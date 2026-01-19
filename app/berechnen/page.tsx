// app/berechnen.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SoilLayer = {
  id: string;
  name: string;
  thickness_m: string;
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
  factors: { gammaZ: string; gammaD: string; alphaC?: string };
  pile: { b_m: string; U_m: string };
};

type TableRow = {
  positionKey: string;   // exakt wie im Request/Response
  supportLabel: string;  // nur "kurz"/"lang" fürs UI
  bereich: string;
  layer: string;
  L_h_m: string;
  L_v_m: string;
};


type VerticalRow = {
  position: string; // kommt vom Backend zurück (wir senden stuetze als position)
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
        "border-t border-slate-200 px-3 py-2 " +
        (right ? "text-right" : "")
      }
    >
      {children}
    </td>
  );
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

export default function BerechnenPage() {
  const router = useRouter();

  // ✅ Backend URL (ändern, wenn nötig)


  const [data, setData] = useState<Payload | null>(null);
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingV, setLoadingV] = useState(false);

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

  // 2) Tabelle als Platzhalter erzeugen (Stütze/Bereich × Bodenschicht)
useEffect(() => {
  if (!data) return;

  const rows: TableRow[] = [];

  for (const ld of data.loads) {
    const positionKey = `${ld.stuetze}_${ld.id}`; // MUSS identisch zum Request sein
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


  // 3) Auto-Run Vertikal, sobald Tabelle da ist
  useEffect(() => {
    if (!data) return;
    if (!tableRows.length) return;
    if (loadingV) return;

    runVertical();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tableRows.length]);

  const headerInfo = useMemo(() => {
    if (!data) return null;
    return {
      layersCount: data.layers.length,
      loadsCount: data.loads.length,
      gammaD: data.factors?.gammaD ?? "—",
      gammaZ: data.factors?.gammaZ ?? "—",
      alphaC: data.factors?.alphaC ?? "—",
      b_m: data.pile?.b_m ?? "—",
      U_m: data.pile?.U_m ?? "—",
    };
  }, [data]);

  // ✅ Vertikal (Ein-Schicht) berechnen und in Tabelle schreiben
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
          // ✅ Backend erwartet "position" -> wir senden stuetze (kurz/lang)
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
        setError((out as VerticalFail)?.message ?? "Vertikal-Berechnung fehlgeschlagen.");
        return;
      }

      // Map: "stuetze||layer" -> L_v_m
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
      setError("Berechnung fehlgeschlagen. Bitte Seite neu laden oder später erneut versuchen.");
    } finally {
      setLoadingV(false);
    }
  }

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
                VORABZUG - Testversion Stand 19.01.2026
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
              >
                ← Zurück
              </button>
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

        {headerInfo ? (
          <div className="border border-slate-300 bg-white p-4">
            <div className="text-sm font-semibold">Eingaben (Übersicht)</div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs text-slate-700">
              <div className="border border-slate-200 p-3">
                <div className="text-slate-500">Bodenschichten</div>
                <div className="font-semibold">{headerInfo.layersCount}</div>
              </div>
              <div className="border border-slate-200 p-3">
                <div className="text-slate-500">Lastzeilen</div>
                <div className="font-semibold">{headerInfo.loadsCount}</div>
              </div>
              <div className="border border-slate-200 p-3">
                <div className="text-slate-500">γD</div>
                <div className="font-semibold">{headerInfo.gammaD}</div>
              </div>
              <div className="border border-slate-200 p-3">
                <div className="text-slate-500">γZ</div>
                <div className="font-semibold">{headerInfo.gammaZ}</div>
              </div>
              <div className="border border-slate-200 p-3">
                <div className="text-slate-500">αc</div>
                <div className="font-semibold">{headerInfo.alphaC}</div>
              </div>
              <div className="border border-slate-200 p-3">
                <div className="text-slate-500">b / U</div>
                <div className="font-semibold">
                  {headerInfo.b_m} / {headerInfo.U_m}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Tabelle */}
        {tableRows.length ? (
          <div className="border border-slate-300 bg-white">
            <div className="border-b border-slate-300 bg-slate-50 px-4 py-3">
              <div className="text-sm font-semibold">
                Tabelle – Gründung je Bodenschicht
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Stütze (kurz/lang) · Bereich (Grün/Gelb/Rot) · Bodenschicht · Lh/Lv
                {loadingV ? " · Vertikal läuft…" : ""}
              </div>
            </div>
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
                      Horizontalkräfte und
                      <br />
                      Momente
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
                {tableRows.map((r, idx) => (
                  <tr key={idx} className="bg-white">
  <Cell>{r.supportLabel}</Cell>
  <Cell>{labelBereich(r.bereich)}</Cell>
  <Cell>{r.layer}</Cell>
  <Cell right>{r.L_h_m}</Cell>
  <Cell right>{r.L_v_m}</Cell>
</tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !error ? (
          <div className="text-sm text-slate-600">Keine Tabelle vorhanden.</div>
        ) : null}
        
        {/* Bottom bar */}
        <div className="border border-slate-300 bg-slate-50 px-5 py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-600">
              Nächster Step: Lh aus <code className="px-1">vogt.ts</code> je Zeile füllen.
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/")}
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
