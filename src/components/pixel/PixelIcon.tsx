"use client";

export interface PixelIconProps {
  pattern: readonly string[];
  colors: Readonly<Record<string, string>>;
  size?: number;
}

export function PixelIcon({ pattern, colors, size = 14 }: PixelIconProps) {
  const rows = pattern;
  const cols = rows[0].length;
  const px = Math.floor(size / cols);
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: size,
        height: size,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${px}px)`,
        gridTemplateRows: `repeat(${rows.length}, ${px}px)`,
        gap: 0,
      }}
    >
      {rows.map((row, r) =>
        row.split("").map((cell, c) =>
          cell === "." ? (
            <div key={`${r}-${c}`} style={{ width: px, height: px }} />
          ) : (
            <div
              key={`${r}-${c}`}
              style={{ width: px, height: px, backgroundColor: colors[cell] }}
            />
          )
        )
      )}
    </div>
  );
}

// All pixel icon definitions, ported from universal-kb
export const ICONS = {
  chat: {
    pattern: [".BBBBB.", "BWWWWWB", "BWWWWWB", "BWWWWWB", "BWBBWWB", ".BBBBB.", "..BBB...", "...B..."],
    colors: { B: "#00A3C4", W: "#CCF2FF" },
  },
  confirmations: {
    pattern: [".......", "..YYY..", ".YYYYY.", ".YYYYY.", ".YYYYY.", ".YYYYY.", "..YYY..", "..YYY.."],
    colors: { Y: "#D69E2E" },
  },
  knowledgeMy: {
    pattern: [".YYYYY.", ".YYYYYN", ".YYYYNN", ".YYYYYY", ".YYYYYY", ".YYYYYY", ".YYYYYY", ".YYYYYY"],
    colors: { Y: "#D69E2E", N: "#F6E05E" },
  },
  skills: {
    pattern: ["CC.....", "..CC...", "....CC.", "......C", "......C", "....CC.", "..CC...", ".CC...."],
    colors: { C: "#00A3C4" },
  },
  data: {
    pattern: ["BBBBBBB", "BWBWBWB", "BBBBBBB", "BWBWBWB", "BBBBBBB", "BWBWBWB", "BBBBBBB", "BWBWBWB"],
    colors: { B: "#3182CE", W: "#BEE3F8" },
  },
  intelSource: {
    pattern: [".TTTTT.", "TTWWWTT", "TW...WT", "TW.T.WT", "TW...WT", "TTWWWTT", ".TTTTT.", "......."],
    colors: { T: "#319795", W: "#B2F5EA" },
  },
  webApps: {
    pattern: ["PPP.PPP", "PPP.PPP", "PPP.PPP", ".......", "PPP.PPP", "PPP.PPP", "PPP.PPP", "......."],
    colors: { P: "#D53F8C" },
  },
  intel: {
    pattern: [".......", "..TTT..", "TTWWWTT", "TWWBBWT", "TTWWWTT", "..TTT..", ".......", "......."],
    colors: { T: "#319795", W: "#B2F5EA", B: "#1A202C" },
  },
  review: {
    pattern: [".......", "......G", ".....GG", "....GG.", "G..GG..", "GGGG...", ".GGG...", "..G...."],
    colors: { G: "#38A169" },
  },
  skillsAdmin: {
    pattern: ["CC.....", "..CC...", "....CC.", "......C", "......C", "....CC.", "..CC...", ".CC...."],
    colors: { C: "#00A3C4" },
  },
  models: {
    pattern: ["PPPPPPP", "PWWWWWP", "PWWWWWP", "PWWWWWP", "PPPPPPP", "..PPP..", ".PPPPP.", "......."],
    colors: { P: "#805AD5", W: "#E9D8FD" },
  },
  bizTable: {
    pattern: [".BBBBB.", "BBBBBBB", "BWWWWWB", ".BBBBB.", "BWWWWWB", "BWWWWWB", ".BBBBB.", "......."],
    colors: { B: "#2B6CB0", W: "#BEE3F8" },
  },
  tools: {
    pattern: ["..GGG..", ".GGGGG.", "GWWWWWG", "GWWWWWG", "GWWWWWG", ".GGGGG.", "..GGG...", "......."],
    colors: { G: "#718096", W: "#E2E8F0" },
  },
  skillMarket: {
    pattern: ["CCCCCCC", "CWWWWWC", "CCCCCCC", "CWWCWWC", "CWWCWWC", "CCCCCCC", "CWWWWWC", "CCCCCCC"],
    colors: { C: "#00A3C4", W: "#CCF2FF" },
  },
  mcpToken: {
    pattern: ["..CCCCC", ".CWWWWC", "CC....C", "C.....C", "CC....C", ".CWWWWC", "..CCCCC", "......."],
    colors: { C: "#00A3C4", W: "#CCF2FF" },
  },
  intelAdmin: {
    pattern: ["TTTTTTT", "TWWWWWT", "TTTTTTT", "TWWWWWT", "TTTTTTT", "TWWWWWT", "TTTTTTT", "......."],
    colors: { T: "#319795", W: "#B2F5EA" },
  },
  workspaceAdmin: {
    pattern: ["PPPPPPP", "PWWWWWP", "PPPPPPP", "PWWWWWP", "PPPPPPP", ".......", ".......", "......."],
    colors: { P: "#553C9A", W: "#E9D8FD" },
  },
  audit: {
    pattern: ["RRRRRRR", "RWWWWWR", "RWWWWWR", "RRRRRRR", "RWWWWWR", "RWWWWWR", "RRRRRRR", "......."],
    colors: { R: "#C53030", W: "#FED7D7" },
  },
  contrib: {
    pattern: ["......G", "....GGG", "....GGG", "..GGGGG", "..GGGGG", "GGGGGGG", "GGGGGGG", "GGGGGGG"],
    colors: { G: "#B7791F" },
  },
  users: {
    pattern: ["..CCC..", "..CCC..", ".CCCCC.", "CCCCCCC", "CWWWWWC", "CWWWWWC", "CCCCCCC", "......."],
    colors: { C: "#00A3C4", W: "#CCF2FF" },
  },
  tasks: {
    pattern: ["GGGGGGG", "G.....G", "GWWWWWG", "G.WWW.G", "G..W..G", "G.....G", "GGGGGGG", "......."],
    colors: { G: "#38A169", W: "#C6F6D5" },
  },
  files: {
    pattern: ["BBBBB..", "BWWWBB.", "BWWWWWB", "BWWWWWB", "BWWWWWB", "BWWWWWB", "BWWWWWB", "BBBBBBB"],
    colors: { B: "#4A5568", W: "#E2E8F0" },
  },
  chevronDown: {
    pattern: [".......", ".......", ".CCCCC.", "..CCC..", "...C...", ".......", ".......", "......."],
    colors: { C: "#00A3C4" },
  },
  chevronRight: {
    pattern: [".C.....", "..CC...", "...CCC.", "....CC.", "...CCC.", "..CC...", "..C....", "......."],
    colors: { C: "#00A3C4" },
  },
} as const;
