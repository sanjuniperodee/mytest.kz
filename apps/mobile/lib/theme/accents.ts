/** Semantic tints used for small status chips and icon tiles. */
export function accentPalette(resolved: "light" | "dark") {
  if (resolved === "dark") {
    return {
      emerald: { bg: "rgba(16,185,129,0.22)", fg: "#6EE7B7" },
      blue: { bg: "rgba(59,130,246,0.22)", fg: "#93C5FD" },
      amber: { bg: "rgba(245,158,11,0.22)", fg: "#FCD34D" },
      orange: { bg: "rgba(249,115,22,0.22)", fg: "#FDBA74" },
      rose: { bg: "rgba(244,63,94,0.22)", fg: "#FDA4AF" },
    }
  }
  return {
    emerald: { bg: "#D1FAE5", fg: "#047857" },
    blue: { bg: "#DBEAFE", fg: "#1D4ED8" },
    amber: { bg: "#FEF3C7", fg: "#B45309" },
    orange: { bg: "#FFEDD5", fg: "#C2410C" },
    rose: { bg: "#FFE4E6", fg: "#BE123C" },
  }
}
