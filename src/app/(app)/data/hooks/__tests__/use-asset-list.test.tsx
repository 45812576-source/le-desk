import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { useAssetList } from "../use-asset-list";
import { fetchAssetTables } from "../../components/shared/api";

vi.mock("../../components/shared/api", () => ({
  fetchAssetTables: vi.fn(),
}));

const mockedFetchAssetTables = vi.mocked(fetchAssetTables);

describe("useAssetList", () => {
  beforeEach(() => {
    mockedFetchAssetTables.mockReset();
    mockedFetchAssetTables.mockResolvedValue({ items: [], total: 0 });
  });

  it("passes bucket through to fetchAssetTables", async () => {
    renderHook(() => useAssetList({ bucket: "shared", folder_id: 12 }));

    await waitFor(() => {
      expect(mockedFetchAssetTables).toHaveBeenCalledWith({ bucket: "shared", folder_id: 12 });
    });
  });
});
