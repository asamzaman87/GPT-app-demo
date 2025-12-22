// Theme-aware class helpers
export const theme = {
  // Containers
  card: (isDark: boolean) =>
    isDark
      ? "bg-slate-900/80 border-slate-800 shadow-sm"
      : "bg-white border-slate-200 shadow-sm",

  cardInner: (isDark: boolean) =>
    isDark
      ? "bg-slate-950/40 border-slate-800/80"
      : "bg-slate-50 border-slate-200",

  surface: (isDark: boolean) =>
    isDark ? "bg-slate-950/60" : "bg-slate-100",

  // Text
  textPrimary: (isDark: boolean) =>
    isDark ? "text-white" : "text-slate-900",

  textSecondary: (isDark: boolean) =>
    isDark ? "text-black" : "text-slate-600",

  textMuted: (isDark: boolean) =>
    isDark ? "text-slate-400/80" : "text-slate-500",

  // Icon chips
  iconBg: (isDark: boolean) =>
    isDark ? "bg-sky-500/12" : "bg-sky-100/70",

  iconBgSuccess: (isDark: boolean) =>
    isDark ? "bg-emerald-500/12" : "bg-emerald-100/70",

  // Spinners
  spinner: (isDark: boolean) =>
    isDark ? "border-slate-700" : "border-slate-300",
};

