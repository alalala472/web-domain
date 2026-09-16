import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await query<{
    project_id: string;
    project_name: string;
    token_prefix: string;
    created_at: string;
    provider_id: string;
    provider_name: string;
    base_url: string;
    api_format: string;
    provider_enabled: boolean;
    model_id: string | null;
    model_name: string | null;
    model_alias: string | null;
    model_enabled: boolean | null;
  }>(`
    SELECT p.id AS project_id, p.name AS project_name, p.token_prefix, p.created_at,
           pr.id AS provider_id, pr.name AS provider_name, pr.base_url, pr.api_format,
           pr.enabled AS provider_enabled,
           m.id AS model_id, m.model_id AS model_name, m.alias AS model_alias,
           m.enabled AS model_enabled
    FROM projects p
    LEFT JOIN providers pr ON pr.project_id = p.id
    LEFT JOIN models m ON m.provider_id = pr.id
    ORDER BY p.created_at DESC, pr.created_at ASC, m.created_at ASC
  `);

  if (!result.rows.length) {
    return NextResponse.json({ project: null });
  }

  const first = result.rows[0];
  const providers = new Map<string, any>();

  for (const r of result.rows) {
    if (!r.provider_id) continue;
    if (!providers.has(r.provider_id)) {
      providers.set(r.provider_id, {
        id: r.provider_id,
        name: r.provider_name,
        base_url: r.base_url,
        api_format: r.api_format,
        enabled: r.provider_enabled,
        models: []
      });
    }
    if (r.model_id) {
      providers.get(r.provider_id).models.push({
        id: r.model_id,
        model_id: r.model_name,
        alias: r.model_alias,
        enabled: r.model_enabled
      });
    }
  }

  return NextResponse.json({
    project: {
      id: first.project_id,
      name: first.project_name,
      token_prefix: first.token_prefix,
      created_at: first.created_at,
      providers: [...providers.values()]
    }
  });
}
