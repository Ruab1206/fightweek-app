// ──────────────────────────────────────────────
// TabBar — JPD-style underline tabs
// Light: Toolbox styling · Dark: slate palette
// ──────────────────────────────────────────────
import { useTheme } from '../../hooks/useTheme';

export interface Tab<K extends string = string> {
  key: K;
  label: string;
  badge?: number;
}

interface Props<K extends string> {
  tabs: Tab<K>[];
  activeTab: K;
  onTabChange: (key: K) => void;
}

export default function TabBar<K extends string>({ tabs, activeTab, onTabChange }: Props<K>) {
  const { isDark } = useTheme();
  return (
    <div className={`flex items-center gap-6 border-b -mb-4 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
      {tabs.map((t) => {
        const isActive = activeTab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors inline-flex items-center gap-1.5 ${
              isActive
                ? (isDark ? 'border-blue-500 text-white' : 'border-blue-600 text-gray-900')
                : (isDark ? 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300')
            }`}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 text-xs rounded-full ${isDark ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
