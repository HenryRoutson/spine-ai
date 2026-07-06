import { NextRequest, NextResponse } from "next/server";

type SpineApiUrl = string;

function spineApiUrl(): SpineApiUrl {
  return (
    process.env.SPINE_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://www.spine-ai-app.dev")
  ).replace(/\/$/, "");
}

function unreachableError(host: SpineApiUrl): string {
  return `Couldn't reach the Spine app at ${host}. The landing page calls that server to build your pipeline — start it from combined_full_stack (npm run dev, usually port 3000). If the app runs elsewhere, set SPINE_API_URL on the landing page to match.`;
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() ?? "127.0.0.1";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const host = spineApiUrl();
  const url = `${host}/api/landing-demo/build-pipeline`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": clientIp(req),
      },
      body: await req.text(),
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ error: unreachableError(host) }, { status: 502 });
  }
}
