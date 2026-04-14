import { describe, expect, it } from "vitest";
import { mergeVisibleOutputFiles } from "@/lib/dev-studio-output";

describe("mergeVisibleOutputFiles", () => {
  it("prefers indexed files as downloadable truth source", () => {
    const files = mergeVisibleOutputFiles(
      [{ path: "/workspace/output/a.md", name: "a.md", category: "output" }],
      [{ path: "/workspace/output/a.md", filename: "a.md", content: "", tool: "write", session_title: "s1" }],
    );

    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      path: "/workspace/output/a.md",
      source: "index",
      download_ready: true,
    });
  });

  it("keeps legacy-only files visible but non-downloadable", () => {
    const files = mergeVisibleOutputFiles(
      [],
      [{ path: "/workspace/output/b.md", filename: "b.md", content: "", tool: "write", session_title: "s2" }],
    );

    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      path: "/workspace/output/b.md",
      source: "legacy",
      download_ready: false,
      exists_on_disk: false,
    });
  });

  it("allows legacy files to download when disk path is confirmed", () => {
    const files = mergeVisibleOutputFiles(
      [],
      [{
        path: "/workspace/project/output/c.md",
        filename: "c.md",
        content: "",
        tool: "write",
        session_title: "s3",
        exists_on_disk: true,
      }],
    );

    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      path: "/workspace/project/output/c.md",
      source: "legacy",
      download_ready: true,
      exists_on_disk: true,
    });
  });

  it("deduplicates legacy files against indexed files after path normalization", () => {
    const files = mergeVisibleOutputFiles(
      [{ path: "C:\\workspace\\output\\d.md", name: "d.md", category: "output" }],
      [{ path: "C:/workspace/output/d.md", filename: "d.md", content: "", tool: "write", session_title: "s4", exists_on_disk: true }],
    );

    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      path: "C:\\workspace\\output\\d.md",
      source: "index",
      download_ready: true,
    });
  });
});
