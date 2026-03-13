export const dynamic = "force-dynamic";

const DefaultApiTarget = "http://localhost:3000/battle";
const AllowedProxyPrefixes = [
  "auth/google",
  "auth/local-auto",
  "auth/refresh",
  "users/",
  "battles",
  "pokemon/",
  "battles/",
  "progression/",
  "social/"
];

function BuildTargetUrl(pathSegments: string[], search: string) {
  const base = (process.env.API_PROXY_TARGET ?? DefaultApiTarget).replace(/\/+$/, "");
  const path = pathSegments.map((segment) => encodeURIComponent(segment)).join("/");
  return `${base}/${path}${search}`;
}

function IsAllowedPath(pathSegments: string[]) {
  const joined = pathSegments.join("/");
  return AllowedProxyPrefixes.some((prefix) => joined === prefix || joined.startsWith(prefix));
}

async function ProxyRequest(request: Request, pathSegments: string[]) {
  if (!IsAllowedPath(pathSegments)) {
    return new Response("proxyPathNotAllowed", { status: 403 });
  }
  const targetUrl = BuildTargetUrl(pathSegments, new URL(request.url).search);
  const incomingHeaders = new Headers(request.headers);
  const headers = new Headers();
  const authorization = incomingHeaders.get("authorization");
  const contentType = incomingHeaders.get("content-type");
  const accept = incomingHeaders.get("accept");
  const requestId = incomingHeaders.get("x-request-id");
  const cookie = incomingHeaders.get("cookie");
  if (authorization) {
    headers.set("authorization", authorization);
  }
  if (contentType) {
    headers.set("content-type", contentType);
  }
  if (accept) {
    headers.set("accept", accept);
  }
  if (requestId) {
    headers.set("x-request-id", requestId);
  }
  if (cookie) {
    headers.set("cookie", cookie);
  }
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;
  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body
  });
  const proxyResponseHeaders = new Headers();
  const responseContentType = response.headers.get("content-type");
  if (responseContentType) {
    proxyResponseHeaders.set("content-type", responseContentType);
  }
  const setCookieHeader = response.headers.get("set-cookie");
  if (setCookieHeader) {
    proxyResponseHeaders.set("set-cookie", setCookieHeader);
  }
  proxyResponseHeaders.set("cache-control", "no-store, private");
  proxyResponseHeaders.set("x-content-type-options", "nosniff");
  return new Response(response.body, {
    status: response.status,
    headers: proxyResponseHeaders
  });
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return ProxyRequest(request, path);
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return ProxyRequest(request, path);
}

export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return ProxyRequest(request, path);
}

export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return ProxyRequest(request, path);
}

export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return ProxyRequest(request, path);
}

export async function OPTIONS(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return ProxyRequest(request, path);
}
