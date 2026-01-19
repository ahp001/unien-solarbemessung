// src/calc/vertical.ts
// Vertikal – EIN-SCHICHT-Ansatz (Tabelle wie im Gutachten: "Gründung ausschließlich in 1 Bodenschicht")
// -> Für jede Lastposition und jede Bodenschicht: L_v berechnen und als Zeilen zurückgeben.

export type Input = {
  layers: Array<{
    name: string;
    thickness_m: string; // bleibt drin, aber wird hier NICHT verwendet (weil "nur 1 Schicht" Ansatz)
    shaftFriction_kN_m2: string; // τ
  }>;
  loads: Array<{
    position: string;
    compression_kN: string;
    tension_kN: string;
  }>;
  factors: {
    gammaD: string;
    gammaZ: string;
  };
  pile: {
    U_m: string; // Umfang
  };
};

export type VerticalSingleLayerRow = {
  position: string; // Stütze/Lastposition
  layer: string; // Bodenschicht
  NEd_druck_kN: number; // Nd * gammaD
  L_D_m: number; // NEdD / (tau*U)
  NEd_zug_kN: number; // Nz * gammaZ
  L_Z_m: number; // NEdZ / (tau*U)
  massgebend: "Druck" | "Zug" | "-";
  L_v_m: number; // max(L_D, L_Z)
};

export type VerticalSingleLayerOk = {
  ok: true;
  rows: VerticalSingleLayerRow[];
  protokoll: string[];
};

export type VerticalSingleLayerFail = {
  ok: false;
  message: string;
  protokoll?: string[];
};

function toNum(s: any): number {
  if (s === null || s === undefined) return NaN;
  const v = String(s).trim().replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function safeDiv(num: number, den: number): number {
  if (!Number.isFinite(num) || !Number.isFinite(den) || Math.abs(den) < 1e-12) return NaN;
  return num / den;
}

function fmt(n: number, d = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(d);
}
const fmt1 = (n: number) => fmt(n, 1);
const fmt2 = (n: number) => fmt(n, 2);

/**
 * Berechnet die Tabelle "Vertikal – ausschließlich in 1 Bodenschicht"
 * Output: rows (für UI-Tabelle) + protokoll (prüffähige Textausgabe)
 */
export function calcVerticalSingleLayerTable(
  body: Input
): VerticalSingleLayerOk | VerticalSingleLayerFail {
  const prot: string[] = [];
  prot.push("Vertikallasten – EIN-SCHICHT-Ansatz (ausschließlich in 1 Bodenschicht)");
  prot.push("L = N_Ed / (τ * U)");
  prot.push("");

  const gammaD = toNum(body?.factors?.gammaD);
  const gammaZ = toNum(body?.factors?.gammaZ);
  const U = toNum(body?.pile?.U_m);

  if (!(gammaD > 0) || !(gammaZ > 0) || !(U > 0)) {
    return {
      ok: false,
      message: "Bitte alles ausfüllen (γD, γZ, Umfang U).",
      protokoll: prot,
    };
  }

  const layers = (body.layers ?? [])
    .map((l, idx) => ({
      idx: idx + 1,
      name: (l.name ?? "").trim() || `Schicht ${idx + 1}`,
      tau: toNum(l.shaftFriction_kN_m2),
    }))
    .filter((l) => l.tau > 0);

  if (layers.length === 0) {
    return {
      ok: false,
      message: "Bitte Bodenschichten ausfüllen (τ > 0).",
      protokoll: prot,
    };
  }

  const loads = (body.loads ?? []).map((r, idx) => ({
    idx: idx + 1,
    position: (r.position ?? "").trim() || `Position ${idx + 1}`,
    Nd: Math.max(0, toNum(r.compression_kN)),
    Nz: Math.max(0, toNum(r.tension_kN)),
  }));

  if (loads.length === 0) {
    return {
      ok: false,
      message: "Bitte mindestens eine Lastposition eingeben.",
      protokoll: prot,
    };
  }

  prot.push("Eingaben:");
  prot.push(`- Umfang U = ${fmt2(U)} m`);
  prot.push(`- γD = ${fmt2(gammaD)}   γZ = ${fmt2(gammaZ)}`);
  prot.push("");
  prot.push("Schichten (τ):");
  layers.forEach((l) => prot.push(`- ${l.name}: τ = ${fmt1(l.tau)} kN/m²`));
  prot.push("");

  const rows: VerticalSingleLayerRow[] = [];

  prot.push("==============================================");
  prot.push("Tabelle (je Lastposition × je Bodenschicht)");
  prot.push("==============================================");
  prot.push("");

  for (const r of loads) {
    const NEdD = r.Nd * gammaD;
    const NEdZ = r.Nz * gammaZ;

    prot.push(`Lastposition: ${r.position}`);
    prot.push(`  Nd = ${fmt1(r.Nd)} kN -> NEd,D = ${fmt1(NEdD)} kN`);
    prot.push(`  Nz = ${fmt1(r.Nz)} kN -> NEd,Z = ${fmt1(NEdZ)} kN`);

    for (const l of layers) {
      const R_per_m = l.tau * U; // kN/m
      const L_D = NEdD > 0 ? safeDiv(NEdD, R_per_m) : 0;
      const L_Z = NEdZ > 0 ? safeDiv(NEdZ, R_per_m) : 0;

      let mass: "Druck" | "Zug" | "-" = "-";
      let L_v = 0;

      if (NEdD <= 0 && NEdZ <= 0) {
        mass = "-";
        L_v = 0;
      } else if (L_D >= L_Z) {
        mass = "Druck";
        L_v = L_D;
      } else {
        mass = "Zug";
        L_v = L_Z;
      }

      rows.push({
        position: r.position,
        layer: l.name,
        NEd_druck_kN: Number.isFinite(NEdD) ? NEdD : 0,
        L_D_m: Number.isFinite(L_D) ? L_D : 0,
        NEd_zug_kN: Number.isFinite(NEdZ) ? NEdZ : 0,
        L_Z_m: Number.isFinite(L_Z) ? L_Z : 0,
        massgebend: mass,
        L_v_m: Number.isFinite(L_v) ? L_v : 0,
      });

      prot.push(
        `  - ${l.name}: τ=${fmt1(l.tau)} => R'=${fmt1(R_per_m)} kN/m | ` +
          `L_D=${fmt2(L_D)} m | L_Z=${fmt2(L_Z)} m | maßgebend=${mass} | L_v=${fmt2(L_v)} m`
      );
    }

    prot.push("");
  }

  prot.push("==============================================");
  prot.push("Ende Tabelle (Ein-Schicht-Ansatz)");
  prot.push("==============================================");

  return { ok: true, rows, protokoll: prot };
}
