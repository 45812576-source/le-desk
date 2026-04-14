export const NORMALIZE_SESSION_API_PATH_PATTERN =
  String.raw`^\/(?:(?!session\/).)+(\/session\/[^?#]+(?:[?#].*)?)$`;

export function normalizeSessionApiPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("/api/")) return path;
  return path.replace(new RegExp(NORMALIZE_SESSION_API_PATH_PATTERN), "$1");
}
