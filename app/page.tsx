// app/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  projectNo: string; // ✅ wieder string
  bauherr: string;
  adresse: string;
  createdAtISO: string;
};


const STORAGE_KEY = "unien_projects_v1";
const ACTIVE_KEY = "unien_active_project_id_v1";

function uid() {
  return (
    Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36)
  );
}

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as Project[]) : [];
  } catch {
    return [];
  }
}

function saveProjects(items: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export default function HomeProjectsPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectNo, setProjectNo] = useState(""); // ✅ user input
  const [bauherr, setBauherr] = useState("");
  const [adresse, setAdresse] = useState("");

  // 🔎 Suche
  const [query, setQuery] = useState("");

  // 🔒 verhindert Überschreiben beim ersten Render
  const [hydrated, setHydrated] = useState(false);

  // ✏️ Bearbeiten
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProjectNo, setEditProjectNo] = useState("");
  const [editBauherr, setEditBauherr] = useState("");
  const [editAdresse, setEditAdresse] = useState("");

  // ✅ Validierung fürs Anlegen
 const canCreate = useMemo(() => {
  return (
    projectNo.trim().length > 0 &&
    bauherr.trim().length > 0 &&
    adresse.trim().length > 0
  );
}, [projectNo, bauherr, adresse]);


  // 🔹 Projekte laden
  useEffect(() => {
    const loaded = loadProjects();
    setProjects(loaded);
    setHydrated(true);
  }, []);

  // 🔹 Projekte speichern (erst nach Hydration)
  useEffect(() => {
    if (!hydrated) return;
    saveProjects(projects);
  }, [projects, hydrated]);

  function resetForm() {
    setProjectNo("");
    setBauherr("");
    setAdresse("");
  }

  function handleCreate() {
    if (!canCreate) return;

    const pn = projectNo.trim();
    const bh = bauherr.trim();
    const ad = adresse.trim();

    // optional: doppelte Projekt-Nr. verhindern
    const exists = projects.some(
  (p) => (p.projectNo ?? "").trim().toLowerCase() === pn.toLowerCase()
);

    if (exists) {
      alert(`Projekt Nr. ${pn} existiert bereits. Bitte eine andere Nr. wählen.`);
      return;
    }

    const p: Project = {
      id: uid(),
      projectNo: pn, // ✅ user number
      bauherr: bh,
      adresse: ad,
      createdAtISO: new Date().toISOString(),
    };

    setProjects((prev) => [p, ...prev]);
    resetForm();
  }

  function handleDelete(id: string) {
    const ok = confirm("Projekt wirklich löschen?");
    if (!ok) return;

    const active = localStorage.getItem(ACTIVE_KEY);
    if (active === id) localStorage.removeItem(ACTIVE_KEY);

    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (editingId === id) cancelEdit();
  }

  function openProject(p: Project) {
    localStorage.setItem(ACTIVE_KEY, p.id);
    router.push("/berechnen/eingabewerte");
  }

  function startEdit(p: Project) {
    setEditingId(p.id);
    setEditProjectNo(String(p.projectNo ?? ""));
    setEditBauherr(p.bauherr);
    setEditAdresse(p.adresse);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditProjectNo("");
    setEditBauherr("");
    setEditAdresse("");
  }

  function saveEdit(id: string) {
    const pn = editProjectNo.trim();
const bh = editBauherr.trim();
const ad = editAdresse.trim();

if (!pn || !bh || !ad) {
  alert("Bitte alle Felder korrekt ausfüllen.");
  return;
}

const exists = projects.some(
  (p) =>
    p.id !== id &&
    (p.projectNo ?? "").trim().toLowerCase() === pn.toLowerCase()
);

if (exists) {
  alert(`Projekt Nr. "${pn}" existiert bereits. Bitte eine andere Nr. wählen.`);
  return;
}

setProjects((prev) =>
  prev.map((p) =>
    p.id === id ? { ...p, projectNo: pn, bauherr: bh, adresse: ad } : p
  )
);

cancelEdit();
  }
  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;

    return projects.filter((p) => {
      const hay = `projekt ${p.projectNo} ${p.bauherr} ${p.adresse}`.toLowerCase();
      return hay.includes(q);
    });
  }, [projects, query]);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-300">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold tracking-wide">
                UNIEN Rammtiefenbemessung Testversion
              </h1>
              <div className="mt-1 text-xs text-slate-600">
                Projektübersicht – Projekt Nr. / Bauherr / Adresse
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10 space-y-6">
        {/* Projekt anlegen */}
        <div className="border border-slate-300 bg-white">
          <div className="border-b border-slate-300 bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold">Projekt anlegen</div>
          </div>

          <div className="p-4 grid gap-4 md:grid-cols-3">
            {/* ✅ Projekt Nr Eingabe */}
            <div>
              <label className="block text-xs text-slate-600">Projekt Nr.</label>
              <input
                value={projectNo}
                onChange={(e) => setProjectNo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                inputMode="numeric"
                placeholder="z.B. 7"
              />
              <div className="mt-1 text-xs text-slate-500">
                Wird manuell vergeben.
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-600">Bauherr</label>
              <input
                value={bauherr}
                onChange={(e) => setBauherr(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="z.B. UNIEN GmbH"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600">Adresse</label>
              <input
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Straße, PLZ Ort"
              />
            </div>

            <div className="md:col-span-3 flex justify-between items-center gap-3">
              <div className="text-xs text-slate-500">
                Klick auf ein Projekt öffnet die Berechnung.
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
                >
                  Leeren
                </button>

                <button
                  type="button"
                  disabled={!canCreate}
                  onClick={handleCreate}
                  className={
                    "rounded-lg px-4 py-2 text-sm font-medium " +
                    (canCreate
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "bg-slate-200 text-slate-500 cursor-not-allowed")
                  }
                >
                  Projekt anlegen
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Projektliste */}
        <div className="border border-slate-300 bg-white">
          <div className="border-b border-slate-300 bg-slate-50 px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold">Projekte</div>
                <div className="text-xs text-slate-600 mt-1">
                  Klick = Projekt öffnen (Bearbeiten/Löschen rechts)
                </div>
              </div>

              <div className="w-full md:w-[420px]">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Suchen (Projekt Nr., Bauherr, Adresse)…"
                />
              </div>
            </div>
          </div>

          {filteredProjects.length ? (
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left">Projekt Nr.</th>
                  <th className="px-3 py-2 text-left">Bauherr</th>
                  <th className="px-3 py-2 text-left">Adresse</th>
                  <th className="px-3 py-2 text-right">Aktion</th>
                </tr>
              </thead>

              <tbody>
                {filteredProjects.map((p) => {
                  const isEditing = editingId === p.id;

                  return (
                    <tr
                      key={p.id}
                      className={
                        "border-t border-slate-200 " +
                        (isEditing ? "" : "hover:bg-slate-50 cursor-pointer")
                      }
                      onClick={() => {
                        if (!isEditing) openProject(p);
                      }}
                    >
                      <td className="px-3 py-2 font-medium">
                        {isEditing ? (
                          <input
                            value={editProjectNo}
                            onChange={(e) => setEditProjectNo(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                            inputMode="numeric"
                            placeholder="z.B. 7"
                          />
                        ) : (
                        p.projectNo
                        )}
                      </td>

                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            value={editBauherr}
                            onChange={(e) => setEditBauherr(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          />
                        ) : (
                          p.bauherr
                        )}
                      </td>

                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            value={editAdresse}
                            onChange={(e) => setEditAdresse(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          />
                        ) : (
                          p.adresse
                        )}
                      </td>

                      <td
                        className="px-3 py-2 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-100"
                            >
                              Abbrechen
                            </button>
                            <button
                              type="button"
                              onClick={() => saveEdit(p.id)}
                              className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-800"
                            >
                              Speichern
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
  <button
    type="button"
    onClick={() => openProject(p)}
    className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-800"
  >
    Öffnen
  </button>

  <button
    type="button"
    onClick={() => startEdit(p)}
    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-100"
  >
    Bearbeiten
  </button>

  <button
    type="button"
    onClick={() => handleDelete(p.id)}
    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-100"
  >
    Löschen
  </button>
</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-6 text-sm text-slate-600">
              {projects.length
                ? "Keine Treffer für die Suche."
                : "Noch keine Projekte angelegt."}
            </div>
          )}
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
