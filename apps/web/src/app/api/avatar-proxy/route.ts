import { NextRequest } from "next/server";

function IsAllowedGoogleAvatarUrl(value: string): boolean {
  try {
    const parsedUrl = new URL(value);
    if (parsedUrl.protocol !== "https:") {
      return false;
    }
    const hostName = parsedUrl.hostname.toLowerCase();
    return hostName === "lh3.googleusercontent.com" || hostName.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const avatarUrl = request.nextUrl.searchParams.get("url") ?? "";
  if (!avatarUrl || !IsAllowedGoogleAvatarUrl(avatarUrl)) {
    return new Response("invalidAvatarUrl", { status: 400 });
  }

  try {
    const upstreamResponse = await fetch(avatarUrl, {
      cache: "no-store"
    });
    if (!upstreamResponse.ok) {
      return new Response("avatarNotAvailable", { status: upstreamResponse.status });
    }
    const contentType = upstreamResponse.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new Response("avatarContentTypeInvalid", { status: 400 });
    }
    const arrayBuffer = await upstreamResponse.arrayBuffer();
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=1800",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return new Response("avatarProxyFailed", { status: 502 });
  }
}
