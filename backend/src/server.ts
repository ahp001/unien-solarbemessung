import express from "express";
import cors from "cors";
import { calcVerticalSingleLayerTable as calcVertical } from "./calc/vertical";
import { calcHorizontalVogt } from "./calc/vogt"; // ✅ NEU


const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, name: "unien-backend", ts: new Date().toISOString() });
});

// ✅ Vertikal: besser immer 200 liefern, ok:false wird im Frontend angezeigt
app.post("/calc/vertical", (req, res) => {
  try {
    const out = calcVertical(req.body);
    return res.status(200).json(out);
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      message: e?.message ?? "Internal error",
      protokoll: [],
    });
  }
});

// ✅ Vogt 1988 Horizontal (H/M) – Endpoint den dein UI sucht
app.post("/calc/vogt-horizontal", (req, res) => {
  try {
    const out = calcHorizontalVogt(req.body);
    return res.status(200).json(out);
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      method: "Vogt (1988) horizontal",
      message: e?.message ?? "Internal error",
      protokoll: [],
    });
  }
});

const PORT = Number(process.env.PORT ?? 8080);
app.listen(PORT, () => {
  console.log(`Backend listening on http://127.0.0.1:${PORT}`);
});
