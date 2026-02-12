import { NextResponse } from "next/server";
import { solveVogt1988 } from "@/lib/calc/vogt";

function num(v: any) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function betaFromLayer(layer: any) {
  const mode = layer.slopeMode ?? "0_15";

  // 0–15° → immer mit 15° rechnen
  if (mode === "0_15") return 15;

  // >15° → eingegebenen Wert verwenden
  if (mode === "gt_15") return num(layer.slope_deg);

  // Fallback (Sicherheit)
  return 15;
}


export async function POST(req: Request) {
  try {
    const body = await req.json();

    const layers = body.layers ?? [];
    const loads = body.loads ?? [];
    const factors = body.factors ?? {};
    const pile = body.pile ?? {};

    const b = num(pile.b_m);
    const alphaC = num(factors.alphaC ?? "1");
    const eta = num(factors.eta ?? "1.4");

    const deltaMode = String(factors.deltaMode ?? "half_phi"); // "input" | "half_phi"
    const deltaInputDeg = num(factors.delta_deg);

    const tStart = num(factors.tStart_m ?? 3);
    const dtStart = num(factors.dtStart_m ?? 1);

    if (!Number.isFinite(b) || b <= 0) {
      return NextResponse.json({ ok: false, message: "Pfahlbreite b_m fehlt/ungültig." });
    }

    // ✅ DAS erwartet deine Tabelle sehr wahrscheinlich:
    const rows: Array<{
      position: string;
      layer: string;
      L_h_m: number;       // required horizontal embedment (tErf)
      debug?: any;         // optional
    }> = [];

    for (const ld of loads) {
      const position = String(ld.position ?? "").trim();
      const H = num(ld.H_kN);
      const M = num(ld.M_kNm);
      if (!position || !Number.isFinite(H) || !Number.isFinite(M)) continue;

      // Lasten erhöhen wie Excel (γF=1,4)
      const HEd = H * eta;
      const MEd = M * eta;

      for (const ly of layers) {
        const betaDeg = betaFromLayer(ly);
        const phiDeg = num(ly.phi_deg);
        const gamma = num(ly.unitWeight_kN_m3);

        const c_raw = num(ly.cohesion_kN_m2);
        const c = Number.isFinite(c_raw) ? alphaC * c_raw : NaN;

        if (![betaDeg, phiDeg, gamma, c].every(Number.isFinite)) {
          rows.push({ position, layer: ly.name ?? "?", L_h_m: NaN });
          continue;
        }

        const deltaDeg =
          deltaMode === "input" && Number.isFinite(deltaInputDeg)
            ? deltaInputDeg
            : 0.5 * phiDeg;

        const res = solveVogt1988({
          betaDeg,
          phiDeg,
          c,
          gamma,
          deltaDeg,
          b,
          H: HEd,
          M: MEd,
          tStart: Number.isFinite(tStart) ? tStart : 3,
          dtStart: Number.isFinite(dtStart) ? dtStart : 1,
        });

        rows.push({
          position,
          layer: ly.name ?? "Bodenschicht",
          L_h_m: res.tErf, // ✅ DAS ist die Zahl, die in die Tabelle soll
          debug: {
            t: res.t,
            thetaDeg: res.thetaDeg,
            Eph: res.Eph,
            EphErf: res.EphErf,
            deltaTief: res.deltaTief,
          },
        });
      }
    }

    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    return NextResponse.json({ ok: false, message: "Vogt-Berechnung fehlgeschlagen." });
  }
}
