export const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

export function appPath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalizedPath}`;
}

function normalizeBasePath(value?: string) {
  if (!value) return "";
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed || trimmed === "/") return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
