import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { decryptSecret, } from "@/lib/crypto";
import { getProjectByToken } from "@/lib/auth";

export const runtime = "nodejs";

function corsHeaders() {
  const origin = process.env.ALLOWED_ORIGINS?.split(",").map(s => s.trim()).filter(Boolean);
  const requested = origin?.length ? origin[0] : "*";
  return {
    "Access-Control-Allow-Origin": requested,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  try {
    const auth = request.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing Bearer token." }, { status: 401, headers: corsHeaders() });
    }

    const token = auth.slice(7).trim();
    if (!token.startsWith("px_live_")) {
      return NextResponse.json({ error: "Invalid proxy token." }, { status: 401, headers: corsHeaders() });
    }

    const project = await getProjectByToken(token);
    if (!project) return NextResponse.json({ error: "Invalid proxy token." }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const model = String(body.model ?? "").trim();
    const messages = body.messages;

    if (!model || !Array.isArray(messages)) {
      return NextResponse.json({ error: "model and messages are required." }, { status: 400, headers: corsHeaders() });
    }

    const result = await query<{
      provider_id: string;
      base_url: string;
      api_format: string;
      encrypted_api_key: string;
    }>(`
      SELECT pr.id AS provider_id, pr.base_url, pr.api_format, pr.encrypted_api_key
      FROM providers pr
      LEFT JOIN models m ON m.provider_id = pr.id
      WHERE pr.project_id = $1
        AND pr.enabled = TRUE
        AND m.enabled = TRUE
        AND (m.model_id = $2 OR m.alias = $2)
      ORDER BY pr.created_at ASC
      LIMIT 1
    `, [project.id, model]);

    const provider = result.rows[0];
    if (!provider) {
      return NextResponse.json({ error: `Model "${model}" is not configured.` }, { status: 404, headers: corsHeaders() });
    }

    if (provider.api_format !== "openai-compatible") {
      return NextResponse.json({ error: "Provider format is not supported by this MVP." }, { status: 400, headers: corsHeaders() });
    }

    const apiKey = decryptSecret(provider.encrypted_api_key);
    const upstream = `${provider.base_url.replace(/\/+$/, "")}/chat/completions`;

    const upstreamResponse = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({ ...body, model: model })
    });

    const contentType = upstreamResponse.headers.get("content-type") ?? "application/json";
    const responseBody = await upstreamResponse.arrayBuffer();

    return new NextResponse(responseBody, {
      status: upstreamResponse.status,
      headers: {
        ...corsHeaders(),
        "Content-Type": contentType,
        "Cache-Control": "no-store"
      }
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Proxy request failed." }, { status: 500, headers: corsHeaders() });
  }
}
