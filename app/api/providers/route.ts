import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { newProxyToken, requireAdmin, hashToken } from "@/lib/auth";

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const provider = String(body.provider ?? "").trim();
    const baseUrl = String(body.baseUrl ?? "").trim().replace(/\/+$/, "");
    const apiKey = String(body.apiKey ?? "").trim();
    const model = String(body.model ?? "").trim();
    const alias = String(body.alias ?? "").trim() || null;

    if (!provider || !baseUrl || !apiKey || !model) {
      return NextResponse.json({ error: "Provider, Base URL, API Key, dan Model wajib diisi." }, { status: 400 });
    }
    if (!/^https:\/\//i.test(baseUrl)) {
      return NextResponse.json({ error: "Base URL harus HTTPS." }, { status: 400 });
    }

    let project = (await query<{ id: string; token_prefix: string }>(
      "SELECT id, token_prefix FROM projects ORDER BY created_at ASC LIMIT 1"
    )).rows[0];

    let proxyToken: string | undefined;

    if (!project) {
      proxyToken = newProxyToken();
      const prefix = proxyToken.slice(0, 14);
      project = (await query<{ id: string; token_prefix: string }>(
        "INSERT INTO projects(name, proxy_token_hash, token_prefix) VALUES($1,$2,$3) RETURNING id, token_prefix",
        [String(body.projectName ?? "My AI App"), hashToken(proxyToken), prefix]
      )).rows[0];
    }

    const providerRow = (await query<{ id: string }>(
      `INSERT INTO providers(project_id, name, base_url, api_format, encrypted_api_key)
       VALUES($1,$2,$3,'openai-compatible',$4) RETURNING id`,
      [project.id, provider, baseUrl, encryptSecret(apiKey)]
    )).rows[0];

    await query(
      `INSERT INTO models(provider_id, model_id, alias) VALUES($1,$2,$3)`,
      [providerRow.id, model, alias]
    );

    return NextResponse.json({ ok: true, proxyToken });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Gagal menyimpan provider." }, { status: 500 });
  }
}
