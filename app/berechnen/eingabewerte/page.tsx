// app/berechnen/eingabewerte/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

type SoilLayer = {
  id: string;
  name: string;
  thickness_m: string; // Mächtigkeit [m]
  unitWeight_kN_m3: string; // Wichte γ [kN/m³]

  // Auswahl 0–15° oder >15°
  slopeMode: "0_15" | "gt_15";
  // nur wenn slopeMode === "gt_15"
  slope_deg: string;

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

// ✅ Projekt-Storage
const ACTIVE_KEY = "unien_active_project_id_v1";
const INPUTS_PREFIX = "unien_project_inputs_v1:";

// Draft (für Berechnen-Page)
const DRAFT_KEY = "unien_rammtiefe_inputs_v1";
const PROJECTS_KEY = "unien_projects_v1";

type ProjectOverview = {
  id: string;
  projectNo: string; // ✅ STRING statt number
  bauherr: string;
  adresse: string;
  createdAtISO: string;
};


function loadProjectsOverview(): ProjectOverview[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as ProjectOverview[]) : [];
  } catch {
    return [];
  }
}
function getActiveProjectId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function inputsKey(projectId: string) {
  return `${INPUTS_PREFIX}${projectId}`;
}

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
  rightNote,
  isOpen,
  onToggle,
  children,
}: {
  index: number;
  title: string;
  subtitle?: string;
  rightNote?: React.ReactNode;
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
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">
            {index}. {title}
          </div>
          {subtitle ? (
            <div className="mt-1 text-xs text-slate-600">{subtitle}</div>
          ) : null}
        </div>

        <div className="flex items-start gap-4">
          {rightNote ? (
            <div className="text-right text-xs leading-4 text-slate-900 whitespace-pre-line">
              {rightNote}
            </div>
          ) : null}

          <div className="pt-0.5 text-xs text-slate-600 select-none">
            {isOpen ? "▲" : "▼"}
          </div>
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

  function goBack() {
    router.push("/");
  }

  const [open, setOpen] = useState({
    soil: true,
    loads: true,
    factors: true,
    pile: true,
  });

  // ✅ aktives Projekt
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

const [projectOverview, setProjectOverview] = useState<{
  projectNo: string; // ✅ STRING
  bauherr: string;
  adresse: string;
}>({ projectNo: "—", bauherr: "—", adresse: "—" });


  // ✅ Defaults
  const [layers, setLayers] = useState<SoilLayer[]>(() => [
    {
      id: uid(),
      name: "Schicht S1: Sand",
      thickness_m: "1,8",
      unitWeight_kN_m3: "18,5",
      slopeMode: "0_15",
      slope_deg: "",
      shaftFriction_kN_m2: "5",
      phi_deg: "30,0",
      cohesion_kN_m2: "0",
    },
    {
      id: uid(),
      name: "Schicht S2: Geschiebelehm",
      thickness_m: "3,40",
      unitWeight_kN_m3: "20,0",
      slopeMode: "0_15",
      slope_deg: "",
      shaftFriction_kN_m2: "22",
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
      bereich: "gruen",
      stuetze: "lang",
      compression_kN: "13,76",
      tension_kN: "18,31",
      H_kN: "0,78",
      M_kNm: "1,38",
    },
    { id: uid(), bereich: "gelb", stuetze: "kurz", compression_kN: "", tension_kN: "", H_kN: "", M_kNm: "" },
    { id: uid(), bereich: "gelb", stuetze: "lang", compression_kN: "", tension_kN: "", H_kN: "", M_kNm: "" },
    { id: uid(), bereich: "rot", stuetze: "kurz", compression_kN: "", tension_kN: "", H_kN: "", M_kNm: "" },
    { id: uid(), bereich: "rot", stuetze: "lang", compression_kN: "", tension_kN: "", H_kN: "", M_kNm: "" },
  ]);

  const [gammaZ, setGammaZ] = useState("1,3");
  const [gammaD, setGammaD] = useState("1,2");
  const [alphaC, setAlphaC] = useState("0,5");
  const [eta, setEta] = useState("1,4");

  const [pileProfileId, setPileProfileId] = useState<string>("unien-g");
  const [a_m, setA_m] = useState("0,12");

  const [b_m, setB_m] = useState("0,12");
  const [U_m, setU_m] = useState("0,5978");

  // ✅ verhindert "Defaults überschreiben Storage" beim ersten Render
  const [hydrated, setHydrated] = useState(false);

  // ✅ Beim Laden: PROJEKT-Daten laden (localStorage), fallback Draft (sessionStorage)
  useEffect(() => {
    try {
      const pid = getActiveProjectId();
      setActiveProjectId(pid);

      if (pid) {
        const list = loadProjectsOverview();
        const p = list.find((x) => x.id === pid);
        // 3) Beim Laden: KEIN Number(...) mehr
if (p) {
  setProjectOverview({
    projectNo: (p.projectNo ?? "").trim() || "—", // ✅ Text übernehmen
    bauherr: p.bauherr || "—",
    adresse: p.adresse || "—",
  });
} else {
  setProjectOverview({ projectNo: "—", bauherr: "—", adresse: "—" });
}
}

      if (!pid) {
        setHydrated(true);
        router.push("/");
        return;
      }

      const rawProject = localStorage.getItem(inputsKey(pid));
      const rawDraft = sessionStorage.getItem(DRAFT_KEY);
      const raw = rawProject ?? rawDraft;

      if (!raw) {
        setHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw);

      if (parsed.layers) {
        const normalized: SoilLayer[] = (parsed.layers as any[]).map((l) => {
          const mode: SoilLayer["slopeMode"] = l.slopeMode ?? "0_15";
          return {
            ...l,
            unitWeight_kN_m3: l.unitWeight_kN_m3 ?? "19,5",
            slopeMode: mode,
            slope_deg: mode === "gt_15" ? (l.slope_deg ?? "4") : "",
          };
        });
        setLayers(normalized);
      }

      if (parsed.loads) setLoads(parsed.loads);

      if (parsed.factors?.gammaD) setGammaD(parsed.factors.gammaD);
      if (parsed.factors?.gammaZ) setGammaZ(parsed.factors.gammaZ);
      if (parsed.factors?.alphaC) setAlphaC(parsed.factors.alphaC);
      if (parsed.factors?.eta) setEta(parsed.factors.eta);

      if (parsed.pile?.b_m) setB_m(parsed.pile.b_m);
      if (parsed.pile?.U_m) setU_m(parsed.pile.U_m);
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Draft autospeichern (optional)
  useEffect(() => {
    if (!hydrated) return;

    const payload = {
      layers,
      loads,
      factors: { gammaZ, gammaD, alphaC, eta },
      pile: { b_m, U_m },
    };

    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  }, [hydrated, layers, loads, gammaZ, gammaD, alphaC, eta, b_m, U_m]);

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
        unitWeight_kN_m3: "19,5",
        slopeMode: "0_15",
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

  // ✅ NEU: Berechnen speichert IMMER zuerst ins Projekt + Draft
  function goBerechnen() {
    const payload = {
      layers,
      loads,
      factors: { gammaZ, gammaD, alphaC, eta },
      pile: { b_m, U_m },
    };

    // 1) Draft für Berechnen-Page
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));

    // 2) Projekt speichern (localStorage)
    const pid = activeProjectId ?? getActiveProjectId();
    if (!pid) {
      alert("Kein aktives Projekt gefunden. Bitte erst ein Projekt auswählen.");
      router.push("/");
      return;
    }
    localStorage.setItem(inputsKey(pid), JSON.stringify(payload));

    // 3) weiter
    router.push("/berechnen");
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-300">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold tracking-wide">
                UNIEN Rammtiefenbemessung Testversion
              </h1>
            </div>
            <div className="text-right text-xs text-slate-600"></div>
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-6 py-10 space-y-6">
        {/* Projektübersicht + Button darunter */}
        <div className="border border-slate-300 bg-slate-50 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                Projekt Nr.
              </div>
              <div className="text-sm font-semibold">
                {projectOverview.projectNo}
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                Bauherr
              </div>
              <div className="text-sm font-semibold">{projectOverview.bauherr}</div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                Adresse
              </div>
              <div className="text-sm font-semibold">{projectOverview.adresse}</div>
            </div>
          </div>

          {/* ✅ Button UNTER der Projektübersicht */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
            <Link
  href="/berechnen/eingabewerte/formular"
  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
>
  Anforderungsformular für Gutachten erzeugen
</Link>

          </div>
        </div>

        {/* 1 Bodenkennwerte */}
        <Section
          index={1}
          title="Bodenkennwerte"
          subtitle="Bodenschichten erfassen (Mächtigkeit, β, τ, φ, c)"
          isOpen={open.soil}
          onToggle={() => setOpen((s) => ({ ...s, soil: !s.soil }))}
        >
          <div className="mt-1 text-sm text-slate-700">
            Gesamte untersuchte Mächtigkeit (Σ):{" "}
            <span className="font-semibold">{totalThickness}</span>{" "}
            <span className="text-slate-500">m</span>
          </div>

          <div className="mt-4 border border-slate-300">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border-b border-slate-300 px-3 py-2 text-left">Bodenschicht</th>
                  <th className="border-b border-slate-300 px-3 py-2 text-left">Mächtigkeit [m]</th>
                  <th className="border-b border-slate-300 px-3 py-2 text-left">Wichte γ [kN/m³]</th>
                  <th className="border-b border-slate-300 px-3 py-2 text-left">Geländeneigung [°]</th>
                  <th className="border-b border-slate-300 px-3 py-2 text-left">Mantelreibung Boden [kN/m²]</th>
                  <th className="border-b border-slate-300 px-3 py-2 text-left">Reibungswinkel Boden φ [°]</th>
                  <th className="border-b border-slate-300 px-3 py-2 text-left">Kohäsion c Boden [kN/m²]</th>
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
                      <NumInput
                        value={l.unitWeight_kN_m3}
                        onChange={(v) => updateLayer(l.id, { unitWeight_kN_m3: v })}
                        placeholder="z. B. 19,5"
                      />
                    </td>

                    <td className="border-t border-slate-200 px-3 py-2">
                      <select
                        value={l.slopeMode}
                        onChange={(e) => {
                          const mode = e.target.value as SoilLayer["slopeMode"];
                          const nextSlope =
                            mode === "gt_15"
                              ? l.slope_deg?.trim()
                                ? l.slope_deg
                                : "4"
                              : "";
                          updateLayer(l.id, { slopeMode: mode, slope_deg: nextSlope });
                        }}
                        className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-slate-500"
                      >
                        <option value="0_15">0–15°</option>
                        <option value="gt_15">{"> 15°"}</option>
                      </select>

                      {l.slopeMode === "gt_15" ? (
                        <div className="mt-2">
                          <NumInput
                            value={l.slope_deg}
                            onChange={(v) => updateLayer(l.id, { slope_deg: v })}
                            placeholder="z. B. 22,5"
                          />
                          <div className="mt-1 text-[11px] text-slate-500"></div>
                        </div>
                      ) : (
                        <div className="mt-1 text-[11px] text-slate-500"></div>
                      )}
                    </td>

                    <td className="border-t border-slate-200 px-3 py-2">
                      <NumInput
                        value={l.shaftFriction_kN_m2}
                        onChange={(v) => updateLayer(l.id, { shaftFriction_kN_m2: v })}
                      />
                    </td>

                    <td className="border-t border-slate-200 px-3 py-2">
                      <NumInput value={l.phi_deg} onChange={(v) => updateLayer(l.id, { phi_deg: v })} />
                    </td>

                    <td className="border-t border-slate-200 px-3 py-2">
                      <NumInput
                        value={l.cohesion_kN_m2}
                        onChange={(v) => updateLayer(l.id, { cohesion_kN_m2: v })}
                      />
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
                  <td colSpan={8} className="border-t border-slate-300 bg-slate-50 px-3 py-3">
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
        </Section>

        {/* 2 Auflagerlasten */}
        <Section
          index={2}
          title="Auflagerlasten"
          subtitle="Auflagerlasten am Bodendurchstickpunkt"
          rightNote={
            <>
              Druck = Auflager Vertikallast (Druck Schnee){"\n"}
              Zug = Auflager Vertikallast (Zug Wind){"\n"}
              H = Auflager Horizontallast{"\n"}
              M = Auflager Moment
            </>
          }
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
                  <td colSpan={7} className="border-t border-slate-300 bg-slate-50 px-3 py-3">
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
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-6 max-w-6xl">
            <div className="border border-slate-300 p-4">
              <label className="block text-sm font-medium mb-1">
                Zugbeiwert γ<sub>Z</sub>
              </label>
              <input
                value={gammaZ}
                disabled
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 cursor-not-allowed"
              />
            </div>

            <div className="border border-slate-300 p-4">
              <label className="block text-sm font-medium mb-1">
                Druckbeiwert γ<sub>D</sub>
              </label>
              <input
                value={gammaD}
                disabled
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 cursor-not-allowed"
              />
            </div>

            <div className="border border-slate-300 p-4">
              <label className="block text-sm font-medium mb-1">
                Abminderungsfaktor Kohäsion α<sub>c</sub>
              </label>
              <input
                value={alphaC}
                disabled
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 cursor-not-allowed"
              />
            </div>

            <div className="border border-slate-300 p-4">
              <label className="block text-sm font-medium mb-1">
                Erdbeiwert η
              </label>
              <input
                value={eta}
                disabled
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 cursor-not-allowed"
              />
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
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 border border-slate-300 bg-slate-50 p-4">
              <div className="text-sm font-semibold mb-3">Pfahlprofil</div>

              <select
                value={pileProfileId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPileProfileId(id);

                  if (id === "unien-g") {
                    setB_m("0,12");
                    setA_m("0,12");
                    setU_m("0,5978");
                  }
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                <option value="unien-g">UNIEN G-Profil</option>
              </select>

              <div className="mt-4 border border-slate-300 bg-white p-2">
                <Image
                  src="/profiles/unien-g.png"
                  alt="UNIEN G-Profil"
                  width={180}
                  height={120}
                  className="mx-auto object-contain"
                />
              </div>
            </div>

            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="border border-slate-300 p-4">
                <label className="block text-sm font-medium mb-1">Pfahlbreite b [m]</label>
                <input
                  value={b_m}
                  disabled
                  className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 cursor-not-allowed"
                />
              </div>

              <div className="border border-slate-300 p-4">
                <label className="block text-sm font-medium mb-1">Pfahllänge a [m]</label>
                <input
                  value={a_m}
                  disabled
                  className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 cursor-not-allowed"
                />
              </div>

              <div className="border border-slate-300 p-4">
                <label className="block text-sm font-medium mb-1">Pfahlumfang U [m]</label>
                <input
                  value={U_m}
                  disabled
                  className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 cursor-not-allowed"
                />
              </div>
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

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={goBack}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
              >
                Zurück
              </button>

              <button
                type="button"
                onClick={goBerechnen}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
              >
                Berechnen
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
