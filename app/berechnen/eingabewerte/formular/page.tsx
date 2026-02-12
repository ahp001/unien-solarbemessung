"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { NOTO_REGULAR, NOTO_BOLD } from "@/app/lib/fonts";

type ProjectOverview = {
  id: string;
  projectNo: string;
  bauherr: string;
  adresse: string;
  createdAtISO: string;
};

const ACTIVE_KEY = "unien_active_project_id_v1";
const PROJECTS_KEY = "unien_projects_v1";

function getActiveProjectId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

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

function registerFonts(doc: jsPDF) {
  doc.addFileToVFS("NotoSans-Regular.ttf", NOTO_REGULAR);
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");

  doc.addFileToVFS("NotoSans-Bold.ttf", NOTO_BOLD);
  doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");

  doc.setFont("NotoSans", "normal");
}

export default function GutachtenFormularPage() {
  const router = useRouter();

  const [project, setProject] = useState({
    projectNo: "—",
    bauherr: "—",
    adresse: "—",
  });

  useEffect(() => {
    const pid = getActiveProjectId();
    if (!pid) {
      router.push("/");
      return;
    }
    const list = loadProjectsOverview();
    const p = list.find((x) => x.id === pid);

    setProject({
      projectNo: (p?.projectNo ?? "").trim() || "—",
      bauherr: (p?.bauherr ?? "").trim() || "—",
      adresse: (p?.adresse ?? "").trim() || "—",
    });
  }, [router]);

  const fileName = useMemo(() => {
    const safe = (s: string) =>
      (s || "")
        .replace(/[^\w\-äöüÄÖÜß ]/g, "")
        .trim()
        .replace(/\s+/g, "_");
    return `Gutachten_Anforderung_${safe(project.projectNo || "Projekt")}.pdf`;
  }, [project.projectNo]);

  function generatePdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    registerFonts(doc);

    const pageW = doc.internal.pageSize.getWidth();
    const margin = 8; // ✅ kompakter, damit Kohäsion sicher passt

    // Header
    doc.setFont("NotoSans", "bold");
    doc.setFontSize(14);
    doc.text("Anforderungsformular für Gutachten", margin, 18);

    doc.setFont("NotoSans", "normal");
    doc.setFontSize(10);
    doc.text("UNIEN Rammtiefenbemessung – Gutachter-Eingabe", margin, 24);

    // Projektbox
    const boxTop = 30;
    doc.setDrawColor(180);
    doc.rect(margin, boxTop, pageW - margin * 2, 22);

    doc.setFont("NotoSans", "bold");
    doc.text("Projekt Nr.", margin + 3, boxTop + 7);
    doc.text("Bauherr", margin + 70, boxTop + 7);
    doc.text("Adresse", margin + 125, boxTop + 7);

    doc.setFont("NotoSans", "normal");
    doc.text(project.projectNo || "—", margin + 3, boxTop + 14);
    doc.text(project.bauherr || "—", margin + 70, boxTop + 14);
    doc.text(project.adresse || "—", margin + 125, boxTop + 14);

    doc.setFontSize(9);
    doc.text(`Datum: ${new Date().toLocaleDateString("de-DE")}`, margin, boxTop + 30);

    // ---------- Tabelle ----------
const startY = boxTop + 32;

// ✅ noch etwas mehr Platz rechts
const tableMargin = 8; // war 8
const tableW = pageW - tableMargin * 2;

const head = [[
  "Bodenschicht",
  "Mächtigkeit [m]",
  "Wichte γ [kN/m³]",
  "Geländeneigung\n[°]",
  "Mantelreibung\nBoden τ [kN/m²]",
  "Reibungswinkel\nBoden φ [°]",
  "Kohäsion c Boden\n[kN/m²]",
]];

const body = Array.from({ length: 10 }).map((_, i) => ([
  `Schicht S${i + 1}:`,
  "",
  "",
  "",
  "",
  "",
  "",
]));

// ✅ Spaltenbreiten kompakter (Summe <= tableW)
// A4 landscape pageW ~ 297mm => bei margin 6 => tableW ~ 285mm
const col0 = 62; // Bodenschicht
const col1 = 30; // Mächtigkeit
const col2 = 36; // Wichte
const col3 = 30; // Neigung
const col4 = 44; // Mantelreibung
const col5 = 40; // Reibungswinkel

const used = col0 + col1 + col2 + col3 + col4 + col5;

// Kohäsion bewusst etwas schmaler
const col6 = Math.max(32, tableW - used);

autoTable(doc, {
  startY,
  head,
  body,
  tableWidth: tableW,
  margin: { left: tableMargin, right: tableMargin },

  styles: {
    font: "NotoSans",
    fontSize: 8,
    cellPadding: 1.2,   // war 1.4 => kompakter
    valign: "middle",
    lineWidth: 0.2,
    lineColor: [170, 170, 170],
  },

  headStyles: {
    fillColor: [240, 246, 252],
    textColor: [0, 0, 0],
    fontStyle: "bold",
    halign: "left",
    valign: "middle",
    overflow: "linebreak",
    minCellHeight: 10,
  },

  columnStyles: {
    0: { cellWidth: col0 },
    1: { cellWidth: col1, halign: "center" },
    2: { cellWidth: col2, halign: "center" },
    3: { cellWidth: col3, halign: "center" },
    4: { cellWidth: col4, halign: "center" },
    5: { cellWidth: col5, halign: "center" },
    6: { cellWidth: col6, halign: "center" }, // Kohäsion
  },
});


    // ---------- Hinweis / Unterschrift ----------
    const finalY = (doc as any).lastAutoTable?.finalY ?? startY + 90;
    const y = Math.min(finalY + 10, 185);

    doc.setFont("NotoSans", "bold");
    doc.setFontSize(10);
    doc.text("Hinweis:", margin, y);

    doc.setFont("NotoSans", "normal");
    doc.setFontSize(9);
    doc.text(
      "Bitte Bodenkennwerte und Schichtbeschreibung durch den Gutachter eintragen.",
      margin,
      y + 6
    );

    doc.setDrawColor(150);
    doc.line(margin, y + 26, margin + 120, y + 26);
    doc.text("Unterschrift / Stempel Gutachter", margin, y + 32);

    doc.save(fileName);
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-300">
        <div className="mx-auto max-w-7xl px-6 py-6 flex items-end justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-wide">Gutachten-Formular (PDF)</h1>
            <div className="mt-1 text-xs text-slate-600">
              Projektbezogen – 10 Schichten, leere Eingabetabelle
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/berechnen/eingabewerte")}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
          >
            Zurück
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="border border-slate-300 bg-slate-50 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Projekt Nr.</div>
              <div className="text-sm font-semibold">{project.projectNo}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Bauherr</div>
              <div className="text-sm font-semibold">{project.bauherr}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Adresse</div>
              <div className="text-sm font-semibold">{project.adresse}</div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={generatePdf}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              PDF erzeugen & herunterladen
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
