import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthPickerProps {
  pickerMonth: Date;
  setPickerMonth: (d: Date) => void;
  isDark: boolean;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
}

const MonthPicker = ({ pickerMonth, setPickerMonth, isDark, onClose, onSelectDate }: MonthPickerProps) => {
  const year = pickerMonth.getFullYear();
  const month = pickerMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < startPad; i++) cells.push(<div key={`pad-${i}`} />);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    const dateStr = date.toISOString().slice(0, 10);
    const isToday = dateStr === todayStr;
    cells.push(
      <button key={d} onClick={() => onSelectDate(date)}
        className={`w-8 h-8 mx-auto rounded-full text-xs font-medium transition-colors ${isToday ? 'bg-blue-600 text-white font-bold' : (isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-ds-text hover:bg-surface-hover')}`}>{d}</button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[25]" onClick={onClose} />
      <div className={`fixed left-0 right-0 top-[73px] z-30 mx-4 rounded-2xl border shadow-xl p-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setPickerMonth(new Date(year, month - 1, 1))} className={`p-1 rounded-lg ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-surface-hover text-ds-text-subtle'}`}><ChevronLeft className="w-5 h-5" /></button>
          <span className={`text-sm font-bold capitalize ${isDark ? 'text-white' : 'text-ds-text'}`}>{pickerMonth.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })}</span>
          <button onClick={() => setPickerMonth(new Date(year, month + 1, 1))} className={`p-1 rounded-lg ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-surface-hover text-ds-text-subtle'}`}><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'].map(d => (
            <div key={d} className={`text-[10px] font-bold py-1 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{d}</div>
          ))}
          {cells}
        </div>
      </div>
    </>
  );
};

export default MonthPicker;
