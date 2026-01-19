import { NextResponse } from "next/server";
import { calcVerticalSingleLayerTable } from "@/backend/src/calc/vertical";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const out = calcVerticalSingleLayerTable(body);
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
