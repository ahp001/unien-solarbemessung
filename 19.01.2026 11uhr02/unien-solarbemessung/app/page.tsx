// app/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";


type SoilLayer = {
  id: string;
  name: string;
  thickness_m: string; // Mächtigkeit [m]
  slope_deg: string; // Böschungsneigung [°]
  shaftFriction_kN_m2: string; // Mantelreibung [kN/m²]
  phi_deg: string; // Reibungswinkel φ [°]
  cohesion_kN_m2: string; // Kohäsion c [kN/m²]
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


function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function num(v: string) {
  const n = parseFloat((v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function Section({
  index,
  title,
  subtitle,
  isOpen,
  onToggle,
  children,
}: {
  index: number;
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-slate-300 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 text-left hover:bg-slate-50 flex items-start justify-between gap-4"
      >
        <div>
          <div className="text-sm font-semibold">
            {index}. {title}
          </div>
          {subtitle ? (
            <div className="mt-1 text-xs text-slate-600">{subtitle}</div>
          ) : null}
        </div>

        <div className="pt-0.5 text-xs text-slate-600 select-none">
          {isOpen ? "▲" : "▼"}
        </div>
      </button>

      {isOpen ? (
        <div className="border-t border-slate-200 px-5 py-5">{children}</div>
      ) : null}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode="decimal"
      className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-slate-500"
    />
  );
}

export default function Page() {
  const router = useRouter();

  const [open, setOpen] = useState({
    soil: true,
    loads: true,
    factors: true,
    pile: true,
  });

  // ✅ Defaults wie im Screenshot
const [layers, setLayers] = useState<SoilLayer[]>(() => [
  {
    id: uid(),
    name: "Schicht S1: Sand",
    thickness_m: "2,60",          // Gutachten: 0,5–2,6 m -> für Test 2,60
    slope_deg: "30",              // falls im Gutachten nicht anders: 30°
    shaftFriction_kN_m2: "5",     // 0,005 MN/m² = 5 kN/m²
    phi_deg: "30,0",              // φ cal.
    cohesion_kN_m2: "0",          // c'
  },
  {
    id: uid(),
    name: "Schicht S2: Geschiebelehm",
    thickness_m: "3,40",          // Gutachten: maximal sondierte Mächtigkeit 3,4 m
    slope_deg: "30",
    shaftFriction_kN_m2: "22",    // 0,022 MN/m² = 22 kN/m²
    phi_deg: "22,5",
    cohesion_kN_m2: "6",
  },
]);


const [loads, setLoads] = useState<LoadRow[]>(() => [
  {
    id: uid(),
    bereich: "gruen",
    stuetze: "kurz",
    compression_kN: "20,1",
    tension_kN: "3,06",
    H_kN: "5,13",
    M_kNm: "3,86",
  },
  {
    id: uid(),
    bereich: "gelb",
    stuetze: "lang",
    compression_kN: "13,76",
    tension_kN: "18,31",
    H_kN: "0,78",
    M_kNm: "1,38",
  },
]);



  const [gammaZ, setGammaZ] = useState("1,3");
  const [gammaD, setGammaD] = useState("1,2");
  const [alphaC, setAlphaC] = useState("0,5"); // Abminderungsfaktor Kohäsion


  const [b_m, setB_m] = useState("0,12");
  const [U_m, setU_m] = useState("0,5978");

  const totalThickness = useMemo(() => {
    let sum = 0;
    for (const l of layers) {
      const v = num(l.thickness_m);
      if (!Number.isFinite(v)) continue;
      sum += v;
    }
    return Number.isFinite(sum) ? sum.toFixed(2).replace(".", ",") : "—";
  }, [layers]);

  function updateLayer(id: string, patch: Partial<SoilLayer>) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function addLayer() {
    const nextIndex = layers.length + 1;
    setLayers((prev) => [
      ...prev,
      {
        id: uid(),
        name: `Schicht ${nextIndex}`,
        thickness_m: "",
        slope_deg: "",
        shaftFriction_kN_m2: "",
        phi_deg: "",
        cohesion_kN_m2: "",
      },
    ]);
  }
  function removeLayer(id: string) {
    setLayers((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLoad(id: string, patch: Partial<LoadRow>) {
    setLoads((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function addLoad() {
    const nextIndex = loads.length + 1;
    setLoads((prev) => [
      ...prev,
      {
  id: uid(),
  bereich: "gruen",
  stuetze: "kurz",
  compression_kN: "",
  tension_kN: "",
  H_kN: "",
  M_kNm: "",
},
    ]);
  }
  function removeLoad(id: string) {
    setLoads((prev) => prev.filter((r) => r.id !== id));
  }

  function goBerechnen() {
    // Inputs für berechnen.tsx ablegen
    const payload = {
      layers,
      loads,
      factors: { gammaZ, gammaD },
      pile: { b_m, U_m },
    };
    sessionStorage.setItem("unien_rammtiefe_inputs_v1", JSON.stringify(payload));
    router.push("/berechnen");
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-300">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-wide">UNIEN Rammtiefenbemessung Testversion</h1>
            </div>
            <div className="text-right text-xs text-slate-600">
              <div>Methodik: Vogt (1988)</div>
              <div>Version: V0.1 (Entwurf)</div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-6 py-10 space-y-6">
        {/* 1 Bodenkennwerte */}
        <Section
          index={1}
          title="Bodenkennwerte"
          subtitle="Bodenschichten erfassen (Mächtigkeit, β, τ, φ, c)"
          isOpen={open.soil}
          onToggle={() => setOpen((s) => ({ ...s, soil: !s.soil }))}
        >
          <div className="mt-1 text-sm text-slate-700">
            Gesamte Mächtigkeit (Σ):{" "}
            <span className="font-semibold">{totalThickness}</span>{" "}
            <span className="text-slate-500">m</span>
          </div>

          <div className="mt-4 border border-slate-300">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border-b border-slate-300 px-3 py-2 text-left">Bodenschicht</th>
                  <th className="border-b border-slate-300 px-3 py-2 text-left">Mächtigkeit [m]</th>
                  <th className="border-b border-slate-300 px-3 py-2 text-left">Böschungsneigung [°]</th>
                  <th className="border-b border-slate-300 px-3 py-2 text-left">Mantelreibung [kN/m²]</th>
                  <th className="border-b border-slate-300 px-3 py-2 text-left">Reibungswinkel φ [°]</th>
                  <th className="border-b border-slate-300 px-3 py-2 text-left">Kohäsion c [kN/m²]</th>
                  <th className="border-b border-slate-300 px-3 py-2 text-left">Aktion</th>
                </tr>
              </thead>

              <tbody>
                {layers.map((l) => (
                  <tr key={l.id} className="bg-white">
                    <td className="border-t border-slate-200 px-3 py-2">
                      <input
                        value={l.name}
                        onChange={(e) => updateLayer(l.id, { name: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-slate-500"
                      />
                    </td>

                    <td className="border-t border-slate-200 px-3 py-2">
                      <NumInput value={l.thickness_m} onChange={(v) => updateLayer(l.id, { thickness_m: v })} />
                    </td>
                    <td className="border-t border-slate-200 px-3 py-2">
                      <NumInput value={l.slope_deg} onChange={(v) => updateLayer(l.id, { slope_deg: v })} />
                    </td>
                    <td className="border-t border-slate-200 px-3 py-2">
                      <NumInput value={l.shaftFriction_kN_m2} onChange={(v) => updateLayer(l.id, { shaftFriction_kN_m2: v })} />
                    </td>
                    <td className="border-t border-slate-200 px-3 py-2">
                      <NumInput value={l.phi_deg} onChange={(v) => updateLayer(l.id, { phi_deg: v })} />
                    </td>
                    <td className="border-t border-slate-200 px-3 py-2">
                      <NumInput value={l.cohesion_kN_m2} onChange={(v) => updateLayer(l.id, { cohesion_kN_m2: v })} />
                    </td>

                    <td className="border-t border-slate-200 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeLayer(l.id)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50"
                      >
                        Entfernen
                      </button>
                    </td>
                  </tr>
                ))}

                <tr>
                  <td colSpan={7} className="border-t border-slate-300 bg-slate-50 px-3 py-3">
                    <button
                      type="button"
                      onClick={addLayer}
                      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
                    >
                      + Schicht hinzufügen
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-slate-500">
            Hinweis: Eingaben sind aktuell freie Werte (UI-Prototyp). Validierung und Normlogik folgen im nächsten Schritt.
          </div>
        </Section>

        {/* 2 Auflagerlasten */}
        <Section
          index={2}
          title="Auflagerlasten"
          subtitle="Lastpositionen mit Druck/Zug sowie H und M erfassen"
          isOpen={open.loads}
          onToggle={() => setOpen((s) => ({ ...s, loads: !s.loads }))}
        >
          <div className="mt-4 border border-slate-300">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="w-40 border-b border-slate-300 px-3 py-2 text-left">Bereich</th>
<th className="w-40 border-b border-slate-300 px-3 py-2 text-left">Stütze</th>
                  <th className="w-28 border-b border-slate-300 px-3 py-2 text-left">Druck [kN]</th>
                  <th className="w-28 border-b border-slate-300 px-3 py-2 text-left">Zug [kN]</th>
                  <th className="w-28 border-b border-slate-300 px-3 py-2 text-left">H [kN]</th>
                  <th className="w-28 border-b border-slate-300 px-3 py-2 text-left">M [kNm]</th>
                  <th className="w-24 border-b border-slate-300 px-3 py-2 text-left">Aktion</th>
                </tr>
              </thead>

              <tbody>
                {loads.map((r) => (
                  <tr key={r.id} className="bg-white">
                    <td className="border-t border-slate-200 px-3 py-2">
  <select
    value={r.bereich}
    onChange={(e) => updateLoad(r.id, { bereich: e.target.value as LoadRow["bereich"] })}
    className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-slate-500"
  >
    <option value="gruen">Grün</option>
    <option value="gelb">Gelb</option>
    <option value="rot">Rot</option>
  </select>
</td>

<td className="border-t border-slate-200 px-3 py-2">
  <select
    value={r.stuetze}
    onChange={(e) => updateLoad(r.id, { stuetze: e.target.value as LoadRow["stuetze"] })}
    className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-slate-500"
  >
    <option value="kurz">kurz</option>
    <option value="lang">lang</option>
  </select>
</td>
                    <td className="border-t border-slate-200 px-3 py-2">
                      <NumInput value={r.compression_kN} onChange={(v) => updateLoad(r.id, { compression_kN: v })} />
                    </td>
                    <td className="border-t border-slate-200 px-3 py-2">
                      <NumInput value={r.tension_kN} onChange={(v) => updateLoad(r.id, { tension_kN: v })} />
                    </td>
                    <td className="border-t border-slate-200 px-3 py-2">
                      <NumInput value={r.H_kN} onChange={(v) => updateLoad(r.id, { H_kN: v })} />
                    </td>
                    <td className="border-t border-slate-200 px-3 py-2">
                      <NumInput value={r.M_kNm} onChange={(v) => updateLoad(r.id, { M_kNm: v })} />
                    </td>
                    <td className="border-t border-slate-200 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeLoad(r.id)}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50"
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}

                <tr>
                  <td colSpan={6} className="border-t border-slate-300 bg-slate-50 px-3 py-3">
                    <button
                      type="button"
                      onClick={addLoad}
                      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
                    >
                      + Lastposition hinzufügen
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* 3 Beiwerte */}
        <Section
          index={3}
          title="Beiwerte"
          subtitle="Zug- und Druckbeiwerte"
          isOpen={open.factors}
          onToggle={() => setOpen((s) => ({ ...s, factors: !s.factors }))}
        >
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl">
            <div className="border border-slate-300 p-4">
              <label className="block text-sm font-medium mb-1">
                Zugbeiwert γ<sub>Z</sub>
              </label>
              <input
                value={gammaZ}
                onChange={(e) => setGammaZ(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
              <div className="mt-1 text-xs text-slate-500">z. B. 1,30</div>
            </div>

            <div className="border border-slate-300 p-4">
              <label className="block text-sm font-medium mb-1">
                Druckbeiwert γ<sub>D</sub>
              </label>
              <input
                value={gammaD}
                onChange={(e) => setGammaD(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
              <div className="mt-1 text-xs text-slate-500">z. B. 1,20</div>
            </div>
            <div className="border border-slate-300 p-4">
  <label className="block text-sm font-medium mb-1">
    Abminderungsfaktor Kohäsion α<sub>c</sub>
  </label>
  <input
    value={alphaC}
    onChange={(e) => setAlphaC(e.target.value)}
    inputMode="decimal"
    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
  />
  <div className="mt-1 text-xs text-slate-500">
    z. B. 0,50 (Gutachten). Hinweis: Vogt (1988) setzt c intern = 0.
  </div>
</div>
          </div>
        </Section>

        {/* 4 Pfahlangaben */}
        <Section
          index={4}
          title="Pfahlangaben"
          subtitle="Geometrische Kenngrößen"
          isOpen={open.pile}
          onToggle={() => setOpen((s) => ({ ...s, pile: !s.pile }))}
        >
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
            <div className="border border-slate-300 p-4">
              <label className="block text-sm font-medium mb-1">Pfahlbreite b [m]</label>
              <input
                value={b_m}
                onChange={(e) => setB_m(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div className="border border-slate-300 p-4">
              <label className="block text-sm font-medium mb-1">Pfahlumfang U [m]</label>
              <input
                value={U_m}
                onChange={(e) => setU_m(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </div>
          </div>
        </Section>

        {/* CTA Bar */}
        <div className="border border-slate-300 bg-slate-50 px-5 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold">Rammtiefenbemessung starten</div>
              <div className="text-xs text-slate-600 mt-1">
                Vertikal (Mantelreibung) + Vogt horizontal (H/M) werden getrennt gerechnet.
              </div>
            </div>

            <button
              type="button"
              onClick={goBerechnen}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
            >
              Berechnen
            </button>
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
