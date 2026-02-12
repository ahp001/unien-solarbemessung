// src/lib/calc/vogt1988.ts
// Vogt 1988 (BASIC) – 1:1 Port
// Einspannlaenge eines horizontal belasteten Pfahles in Boeschung (Vogt 1988)

export type Vogt1988Input = {
  betaDeg: number;   // Böschungsneigung β [deg]
  phiDeg: number;    // Reibungswinkel φ [deg]
  c: number;         // Kohäsion c [kN/m²]
  gamma: number;     // Wichte γ [kN/m³]
  deltaDeg: number;  // Randreibungswinkel δ [deg] (BASIC Input!)
  b: number;         // Pfahlbreite b [m]
  H: number;         // Horizontalkraft H [kN] (bereits erhöht, falls nötig)
  M: number;         // Moment M [kNm] (bereits erhöht, falls nötig)

  tStart?: number;   // Start-Tiefe t [m] (BASIC: TIEF)
  dtStart?: number;  // Start-Schritt Δt [m] (BASIC: DTIEF, im Listing nicht gezeigt; üblich 1.0)
};

export type Vogt1988Result = {
  t: number;          // gefundene Drehpunkttiefe (TIEF)
  thetaDeg: number;   // θ_min bei dieser Tiefe
  Eph: number;        // Erdresultierende (BASIC: EPH)
  sigEph: number;     // σEph = 2*Eph/t
  EphErf: number;     // erforderliche Erdresultierende
  deltaTief: number;  // Zusatztiefe (BASIC: DELTATIEF)
  tErf: number;       // erforderliche Pfahltiefe = t + deltaTief
};

function deg2rad(deg: number) {
  return (deg * Math.PI) / 180;
}

function safeDiv(n: number, d: number) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || Math.abs(d) < 1e-12) return NaN;
  return n / d;
}

/**
 * BASIC Sub 1000: Berechnung von Ep/Eph bei gegebenem theta und Tiefe t
 */
function sub1000(params: {
  thetaDeg: number;
  betaRad: number;
  phiRad: number;
  deltaRad: number;
  c: number;
  gamma: number;
  b: number;
  t: number; // TIEF
}) {
  const { thetaDeg, betaRad, phiRad, deltaRad, c, gamma, b, t } = params;

  const thetaRad = deg2rad(thetaDeg);

  // 1040: A = t / (tan(theta) + tan(beta))
  const A = safeDiv(t, Math.tan(thetaRad) + Math.tan(betaRad));

  // 1050: L = A * cos(theta)
  const L = A * Math.cos(thetaRad);

  // 1060: F = A * t / 2
  const F = A * t / 2;

  // 1070:
  // KRAFTC = L*c*b ; KRAFTG = F*gamma*b
  const KC_base = L * c * b;
  const KG = F * gamma * b;

  // 1080:
  // KRAFTCR = F*c
  // KRAFTRR = F * t/3 * gamma * (1 - sin(phi)) * tan(phi)
  const KCR = F * c;
  const KRR = F * (t / 3) * gamma * (1 - Math.sin(phiRad)) * Math.tan(phiRad);

  // 1090:
  // KRAFTC = KRAFTC + 2*(KRAFTCR + KRAFTRR)
  const KC = KC_base + 2 * (KCR + KRR);

  // 1100/1110:
  const thetaPlusPhi = thetaRad + phiRad;

  const T1 =
    KC *
    (Math.cos(thetaRad) / Math.sin(thetaPlusPhi) +
      Math.sin(thetaRad) / Math.cos(thetaPlusPhi));

  const T2 = KG / Math.cos(thetaPlusPhi);

  // 1120: Nenner = cos(delta)/sin(theta+phi) - sin(delta)/cos(theta+phi)
  const nenner =
    Math.cos(deltaRad) / Math.sin(thetaPlusPhi) -
    Math.sin(deltaRad) / Math.cos(thetaPlusPhi);

  // 1130: EP=(T1+T2)/NENNER ; EPH=EP*cos(delta)
  const Ep = safeDiv(T1 + T2, nenner);
  const Eph = Ep * Math.cos(deltaRad);

  return { thetaRad, A, L, F, KC, KG, KCR, KRR, T1, T2, nenner, Ep, Eph };
}

/**
 * BASIC 320..390: "Variation von theta bis zum Minimum von Ep"
 * Port der Logik: theta startet bei 5°, dtheta startet bei 5°
 * Schritt wird halbiert bis |dtheta| <= 0.1°
 */
function findThetaMinForT(params: {
  betaRad: number;
  phiRad: number;
  deltaRad: number;
  c: number;
  gamma: number;
  b: number;
  t: number;

  thetaStartDeg?: number; // BASIC: THETA=5
  dThetaStartDeg?: number; // BASIC: DTHETA=5
}) {
  const {
    betaRad,
    phiRad,
    deltaRad,
    c,
    gamma,
    b,
    t,
    thetaStartDeg = 5,
    dThetaStartDeg = 5,
  } = params;

  let theta = thetaStartDeg;
  let dtheta = dThetaStartDeg;

  // 340: GOSUB 1000 : EPH1=EP
  let out1 = sub1000({ thetaDeg: theta, betaRad, phiRad, deltaRad, c, gamma, b, t });
  let EPH1 = out1.Ep;

  // 350..390:
  // theta = theta + dtheta; compute EP
  // if EP < EPH1: EPHMIN=EP; goto 350
  // else dtheta=dtheta/2; if abs(dtheta)>0.1 then EPHMIN=EP; goto 350
  // (wir übernehmen das Verhalten möglichst direkt)
  let best = { thetaDeg: theta, Ep: out1.Ep, Eph: out1.Eph, out: out1 };

  while (true) {
    theta = theta + dtheta;

    const out2 = sub1000({ thetaDeg: theta, betaRad, phiRad, deltaRad, c, gamma, b, t });
    const EP = out2.Ep;

    if (Number.isFinite(EP) && EP < EPH1) {
      // 370
      EPH1 = EP;
      best = { thetaDeg: theta, Ep: out2.Ep, Eph: out2.Eph, out: out2 };
      continue;
    }

    // 380
    dtheta = dtheta / 2;

    // 390
    if (Math.abs(dtheta) > 0.1) {
      // BASIC setzt hier EPHMIN=EP und läuft weiter.
      // Wir aktualisieren best nur, wenn EP sinnvoll ist und kleiner war (sonst lassen).
      if (Number.isFinite(EP) && EP < best.Ep) {
        best = { thetaDeg: theta, Ep: out2.Ep, Eph: out2.Eph, out: out2 };
      }
      continue;
    }

    // Abbruch (|dtheta| <= 0.1)
    // best enthält die beste EP-Zeile
    return best;
  }
}

/**
 * BASIC 840..870: Iteration über t bis Gleichgewicht (EPH ~ EPHERF)
 */
export function solveVogt1988(input: Vogt1988Input): Vogt1988Result {
  const {
    betaDeg,
    phiDeg,
    c,
    gamma,
    deltaDeg,
    b,
    H,
    M,
    tStart = 3,     // BASIC Probelauf: TIEF=3
    dtStart = 1.0,  // im Listing nicht gezeigt; 1.0 ist typisch/praktisch
  } = input;

  const betaRad = deg2rad(betaDeg);
  const phiRad = deg2rad(phiDeg);
  const deltaRad = deg2rad(deltaDeg);

  let t = tStart;
  let dt = dtStart;

  // 300..870 Schleife
  while (true) {
    // 320..390: theta-min für aktuelle Tiefe t bestimmen
    const th = findThetaMinForT({ betaRad, phiRad, deltaRad, c, gamma, b, t });

    // 840: EPHERF=(HKRAFT*TIEF+MOMENT)/(TIEF/3)
    const EphErf = safeDiv(H * t + M, t / 3);

    const Eph = th.Eph;

    // 850: IF DTIEF>0 AND EPH<EPHERF THEN TIEF=TIEF+DTIEF : GOTO 300
    if (dt > 0 && Eph < EphErf) {
      t = t + dt;
      continue;
    }

    // 860: IF DTIEF<0 AND EPH>EPHERF THEN TIEF=TIEF+DTIEF : GOTO 300
    if (dt < 0 && Eph > EphErf) {
      t = t + dt;
      continue;
    }

    // 870: DTIEF=-DTIEF/2 : IF ABS(DTIEF)>0.01 THEN TIEF=TIEF+DTIEF : GOTO 300
    dt = -dt / 2;
    if (Math.abs(dt) > 0.01) {
      t = t + dt;
      continue;
    }

    // fertig (|dt| <= 0.01)
    // 540: SIGEPH = 2*EPH/TIEF
    const sigEph = safeDiv(2 * Eph, t);

    // 915: DELTATIEF = 0.54*(EPH - HKRAFT)/SIGEPH
    const deltaTief = safeDiv(0.54 * (Eph - H), sigEph);

    // 935: erforderliche Pfahltiefe = TIEF + DELTATIEF
    const tErf = t + deltaTief;

    return {
      t,
      thetaDeg: th.thetaDeg,
      Eph,
      sigEph,
      EphErf,
      deltaTief,
      tErf,
    };
  }
}
