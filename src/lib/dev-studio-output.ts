export interface IndexedOutputFile {
  path: string;
  rel_path?: string;
  name: string;
  size?: number;
  updated_at?: string;
  category?: string;
  source?: string;
  exists_on_disk?: boolean;
}

export interface LatestSessionFile {
  path: string;
  filename: string;
  content: string;
  tool: string;
  session_title: string;
  exists_on_disk?: boolean;
  category?: string;
}

export interface DevStudioVisibleFile extends LatestSessionFile {
  source: "index" | "legacy";
  download_ready: boolean;
}

function canonicalizeVisiblePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/\/+/g, "/");
}

export function normalizeIndexedOutputFiles(items: IndexedOutputFile[]): DevStudioVisibleFile[] {
  return items.map((item) => ({
    path: item.path,
    filename: item.name,
    content: "",
    tool: "output_file",
    session_title: "",
    exists_on_disk: item.exists_on_disk ?? true,
    category: item.category,
    source: "index",
    download_ready: (item.exists_on_disk ?? true) && Boolean(item.path),
  }));
}

export function normalizeLegacyOutputFiles(items: LatestSessionFile[]): DevStudioVisibleFile[] {
  return items.map((item) => ({
    ...item,
    exists_on_disk: item.exists_on_disk ?? false,
    source: "legacy",
    download_ready: (item.exists_on_disk ?? false) && Boolean(item.path),
  }));
}

export function mergeVisibleOutputFiles(
  indexedItems: IndexedOutputFile[],
  legacyItems: LatestSessionFile[],
): DevStudioVisibleFile[] {
  const indexed = normalizeIndexedOutputFiles(indexedItems);
  const indexedPaths = new Set(indexed.map((item) => canonicalizeVisiblePath(item.path)));
  const legacy = normalizeLegacyOutputFiles(legacyItems).filter(
    (item) => !indexedPaths.has(canonicalizeVisiblePath(item.path)),
  );
  return [...indexed, ...legacy];
}
