// Story Map color utilities — shared between dark and light themes

export const ACTIVITY_COLORS_LIGHT: Record<string, { bg: string; border: string; header: string; tint: string }> = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    header: 'bg-blue-100 text-blue-800',       tint: '#eff6ff' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', header: 'bg-emerald-100 text-emerald-800', tint: '#ecfdf5' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   header: 'bg-amber-100 text-amber-800',     tint: '#fffbeb' },
  purple:  { bg: 'bg-purple-50',  border: 'border-purple-200',  header: 'bg-purple-100 text-purple-800',   tint: '#faf5ff' },
  rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',    header: 'bg-rose-100 text-rose-800',       tint: '#fff1f2' },
  gray:    { bg: 'bg-gray-50',    border: 'border-gray-200',    header: 'bg-gray-100 text-gray-700',       tint: '#f9fafb' },
};

export const ACTIVITY_COLORS_DARK: Record<string, { bg: string; border: string; header: string; tint: string }> = {
  blue:    { bg: 'bg-blue-950',    border: 'border-blue-800',    header: 'bg-blue-900 text-blue-200',       tint: '#172554' },
  emerald: { bg: 'bg-emerald-950', border: 'border-emerald-800', header: 'bg-emerald-900 text-emerald-200', tint: '#022c22' },
  amber:   { bg: 'bg-amber-950',   border: 'border-amber-800',   header: 'bg-amber-900 text-amber-200',     tint: '#451a03' },
  purple:  { bg: 'bg-purple-950',  border: 'border-purple-800',  header: 'bg-purple-900 text-purple-200',   tint: '#3b0764' },
  rose:    { bg: 'bg-rose-950',    border: 'border-rose-800',    header: 'bg-rose-900 text-rose-200',       tint: '#4c0519' },
  gray:    { bg: 'bg-slate-800',   border: 'border-slate-700',   header: 'bg-slate-700 text-slate-200',     tint: '#1e293b' },
};

export const SLICE_COLORS: Record<string, string> = {
  blue: 'border-l-blue-400', emerald: 'border-l-emerald-400', amber: 'border-l-amber-400',
  purple: 'border-l-purple-400', rose: 'border-l-rose-400', gray: 'border-l-gray-300',
};

export const CYCLE_COLORS = ['blue', 'emerald', 'amber', 'purple', 'rose', 'gray'];

export function getColor(c: string, isDark: boolean) {
  const palette = isDark ? ACTIVITY_COLORS_DARK : ACTIVITY_COLORS_LIGHT;
  return palette[c] || palette.gray;
}
