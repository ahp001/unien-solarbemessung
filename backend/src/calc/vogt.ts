// src/calc/vogt.ts
// Vogt (1988) – Horizontal belasteter Pfahl in Böschung
// Portierung aus BASIC (Smoltczyk & Partner / Dr.-Ing. Vogt, 1988)
// Hinweis: Das ist eine prüfbare Prototyp-Implementierung nach dem gegebenen BASIC-Ablauf.

export type VogtHorizontalInput = {
  beta_deg: string;   // Böschungsneigung β [°]
  phi_deg: string;    // Reibungswinkel φ [°]
  cohesion_kN_m2: string; // Kohäsion c [kN/m²]
  gamma_kN_m3: string;    // Wichte γ [kN/m³]
  delta_deg: string;  // Randreibungswinkel δ [°]
  b_m: string;        // Pfahlbreite b [m]
  H_kN: string;       // Horizontalkraft H [kN]
  M_kNm: string;      // Moment M [kNm]
  t_start_m?: string; // Starttiefe t [m] (default 3.0)
};

export type VogtHorizontalOutput = {
  ok: boolean;
  method: "Vogt (1988) horizontal";

  message?: string;

  // Ergebnis
  t_m?: number;          // Drehpunkttiefe t [m]
  deltaT_m?: number;     // Zusatztiefe Δt [m]
  L_total_m?: number;    // erforderliche Pfahltiefe = t + Δt [m]

  // maßgebende Zwischenwerte
  theta_min_deg?: number; // Gleitflächenwinkel θ [°]
  A_m?: number;           // Hilfslinie a [m]
  l_m?: number;           // Fugenlänge l [m]
  F_m2?: number;          // Fläche F [m²]
  Eph_kN?: number;        // vorhandener Erdwiderstand Eph [kN]
  sigmaEph_kN_m2?: number;// σEph = 2*Eph/t [kN/m²]
  EphErf_kN?: number;     // erforderlicher Erdwiderstand Epherf [kN]
  Eph2_kN?: number;       // Zusatz-Gleichgewichtskraft Eph2 [kN]

  protokoll: string[];
};

function parseDE(v: any): number {
  if (v === null || v === undefined) return NaN;
  let s = String(v).trim();
  if (!s) return NaN;

  // Leerzeichen raus
  s = s.replace(/\s+/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma) {
    // DE: 1.234,56 -> 1234.56
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    // EN: 1,234.56 oder 1234.56 -> 1234.56
    // Falls jemand 1,234.56 schreibt: entferne Tausender-Kommas
    s = s.replace(/,/g, "");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}


function rad(deg: number) {
  return (deg * Math.PI) / 180;
}

function deg(radVal: number) {
  return (radVal * 180) / Math.PI;
}

function round(n: number, digits = 3) {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

function safeDiv(num: number, den: number): number {
  if (!Number.isFinite(num) || !Number.isFinite(den) || Math.abs(den) < 1e-12) return NaN;
  return num / den;
}

/**
 * Unterprogramm BASIC 1000..1180:
 * Berechnet Ep und daraus Eph für gegebenes t und theta.
 */
function calcEphForTheta(args: {
  t: number;
  theta_deg: number;

  beta: number;  // rad
  phi: number;   // rad
  delta: number; // rad

  c: number;     // kN/m²
  gamma: number; // kN/m³
  b: number;     // m
}) {
  const { t, theta_deg, beta, phi, delta, c, gamma, b } = args;

  const theta = rad(theta_deg);

  // A = t / (tanθ + tanβ)
  const A = safeDiv(t, Math.tan(theta) + Math.tan(beta));
  const l = A * Math.cos(theta);
  const F = (A * t) / 2;

  // Kräfte nach BASIC:
  // KRAFTC = L*c*b
  // KRAFTG = F*gamma*b
  // KRAFTCR = F*c
  // KRAFTRR = F*(t/3)*gamma*(1-sin(phi))*tan(phi)
  // KRAFTC = KRAFTC + 2*(KRAFTCR + KRAFTRR)
  const KraftC_L = l * c * b;
  const KraftG = F * gamma * b;
  const KraftCR = F * c;
  const KraftRR = F * (t / 3) * gamma * (1 - Math.sin(phi)) * Math.tan(phi);
  const KraftC = KraftC_L + 2 * (KraftCR + KraftRR);

  // TEIL1 = KC*(cosθ/sin(θ+φ) + sinθ/cos(θ+φ))
  const s1 = safeDiv(Math.cos(theta), Math.sin(theta + phi));
  const s2 = safeDiv(Math.sin(theta), Math.cos(theta + phi));
  const Teil1 = KraftC * (s1 + s2);

  // TEIL2 = KG / cos(θ+φ)
  const Teil2 = safeDiv(KraftG, Math.cos(theta + phi));

  // NENNER = cosδ/sin(θ+φ) - sinδ/cos(θ+φ)
  const n1 = safeDiv(Math.cos(delta), Math.sin(theta + phi));
  const n2 = safeDiv(Math.sin(delta), Math.cos(theta + phi));
  const Nenner = n1 - n2;

  const Ep = safeDiv(Teil1 + Teil2, Nenner);
  const Eph = Ep * Math.cos(delta);

  return {
    theta_deg,
    A,
    l,
    F,
    KraftG,
    KraftC,
    KraftCR,
    KraftRR,
    Ep,
    Eph,
  };
}
/**
 * BASIC 320..390:
 * Variation von θ bis Minimum von Ep (genau wie BASIC: solange Ep kleiner wird -> weiter; dann Schritt halbieren).
 */
function findThetaMinEp(args: {
  t: number;
  beta: number;
  phi: number;
  delta: number;
  c: number;
  gamma: number;
  b: number;
  prot: string[];
}) {
  const { t, beta, phi, delta, c, gamma, b, prot } = args;

  let theta = 5;      // Start 5°
  let dTheta = 5;     // Schritt 5°

  let best = calcEphForTheta({ t, theta_deg: theta, beta, phi, delta, c, gamma, b });

  while (Math.abs(dTheta) > 0.1 && theta < 89) {
    const nextTheta = theta + dTheta;
    if (nextTheta >= 89) break;

    const next = calcEphForTheta({ t, theta_deg: nextTheta, beta, phi, delta, c, gamma, b });

    // BASIC: IF EP < EPH1 THEN ... GOTO 350
    if (Number.isFinite(next.Ep) && Number.isFinite(best.Ep) && next.Ep < best.Ep) {
      theta = nextTheta;
      best = next;
      continue;
    }

    // BASIC: dTheta = dTheta/2; IF ABS(dTheta)>0.1 THEN ...
    dTheta = dTheta / 2;
  }

  prot.push(`θ-Minimierung (Ep): θ_min ≈ ${round(best.theta_deg, 2)}°`);
  return best;
}
/**
 * Hauptfunktion: Vogt Horizontal (BASIC 300..940)
 */
export function calcHorizontalVogt(input: VogtHorizontalInput): VogtHorizontalOutput {
  const prot: string[] = [];
  prot.push("Vogt (1988) – horizontal belasteter Pfahl in Böschung (Portierung aus BASIC).");

  const beta_deg = parseDE(input.beta_deg);
  const phi_deg = parseDE(input.phi_deg);
  const c = parseDE(input.cohesion_kN_m2);
  const gamma = parseDE(input.gamma_kN_m3);
  const delta_deg = parseDE(input.delta_deg);
  const b = parseDE(input.b_m);
  const H = parseDE(input.H_kN);
  const M = parseDE(input.M_kNm);
  const tStart = Number.isFinite(parseDE(input.t_start_m)) ? parseDE(input.t_start_m) : 3.0;

  if (![beta_deg, phi_deg, c, gamma, delta_deg, b, H, M].every(Number.isFinite)) {
    return { ok: false, method: "Vogt (1988) horizontal", message: "Eingaben unvollständig/ungültig.", protokoll: prot };
  }
  if (!(b > 0) || !(gamma > 0) || !(tStart > 0)) {
    return { ok: false, method: "Vogt (1988) horizontal", message: "b, γ oder Starttiefe t ungültig.", protokoll: prot };
  }

  const beta = rad(beta_deg);
  const phi = rad(phi_deg);
  const delta = rad(delta_deg);

  prot.push(`Eingabe: β=${beta_deg}° φ=${phi_deg}° c=${c} kN/m² γ=${gamma} kN/m³ δ=${delta_deg}° b=${b} m`);
  prot.push(`Lasten: H=${H} kN, M=${M} kNm, Start t=${tStart} m`);
  prot.push("");

  // BASIC 820..870: Iteration über t
  let t = tStart;
  let dt = 0.5; // im BASIC ist DTIEF nicht explizit gesetzt; 0.5 m ist praktikabel für Prototyp
  let iter = 0;

  // Wir iterieren bis |dt| <= 0.01 m wie BASIC
  let lastTheta = 0;
  let last: ReturnType<typeof calcEphForTheta> | null = null;
  let EphErf = NaN;

  while (Math.abs(dt) > 0.01 && iter < 500) {
    iter++;

    // (BASIC 320..390) θ-Minimierung für aktuelle t
    const bestTheta = findThetaMinEp({ t, beta, phi, delta, c, gamma, b, prot });
    lastTheta = bestTheta.theta_deg;
    last = bestTheta;

    const Eph = bestTheta.Eph;
    EphErf = safeDiv(H * t + M, t / 3); // BASIC 840: (H*t + M)/(t/3)

    prot.push(`t=${round(t, 3)} m: Eph=${round(Eph, 2)} kN | Eph_erf=${round(EphErf, 2)} kN | dt=${round(dt, 3)} m`);

    // BASIC 850/860 Logik
    if (dt > 0 && Eph < EphErf) {
      t = t + dt; // tiefer
      continue;
    }
    if (dt < 0 && Eph > EphErf) {
      t = t + dt; // höher
      continue;
    }

    // BASIC 870: Richtung umkehren & halbieren
    dt = -dt / 2;
    if (Math.abs(dt) > 0.01) {
      t = t + dt;
      continue;
    }
  }

  if (!last || !Number.isFinite(last.Eph) || !Number.isFinite(EphErf)) {
    return { ok: false, method: "Vogt (1988) horizontal", message: "Iteration numerisch fehlgeschlagen.", protokoll: prot };
  }

  // BASIC 540: σEph = 2*Eph/t
  const sigmaEph = safeDiv(2 * last.Eph, t);

  // BASIC 915: Δt = 0,54*(Eph - H)/σEph
  const deltaT = 0.54 * safeDiv(last.Eph - H, sigmaEph);

  // BASIC 920: Eph2 = σEph*2*Δt
  const Eph2 = sigmaEph * 2 * deltaT;

  const L_total = t + deltaT;

  prot.push("");
  prot.push(`σEph = 2*Eph/t = ${round(sigmaEph, 2)} kN/m²`);
  prot.push(`Δt = 0,54*(Eph - H)/σEph = ${round(deltaT, 3)} m`);
  prot.push(`Eph2 = 2*σEph*Δt = ${round(Eph2, 2)} kN`);
  prot.push(`Erforderliche Pfahltiefe: t + Δt = ${round(L_total, 3)} m`);
  prot.push("");

  return {
    ok: true,
    method: "Vogt (1988) horizontal",

    t_m: round(t, 3),
    deltaT_m: round(deltaT, 3),
    L_total_m: round(L_total, 3),

    theta_min_deg: round(lastTheta, 2),
    A_m: Number.isFinite(last.A) ? round(last.A, 3) : undefined,
    l_m: Number.isFinite(last.l) ? round(last.l, 3) : undefined,
    F_m2: Number.isFinite(last.F) ? round(last.F, 3) : undefined,

    Eph_kN: round(last.Eph, 2),
    sigmaEph_kN_m2: round(sigmaEph, 2),
    EphErf_kN: round(EphErf, 2),
    Eph2_kN: round(Eph2, 2),

    protokoll: prot,
  };
}
