import { HelpCircle } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal = ({ title, message, onConfirm, onCancel }: ConfirmModalProps) => {
  const { isDark } = useTheme();
  return (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 fade-in">
    <div className={`w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden p-6 text-center ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}>
      <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDark ? 'bg-blue-900/30' : 'bg-brand-50'}`}><HelpCircle className="w-6 h-6 text-blue-500" /></div>
      <h3 className={`font-bold text-lg mb-2 ${isDark ? 'text-white' : 'text-ds-text'}`}>{title}</h3>
      <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>{message}</p>
      <div className="flex space-x-3">
        <button onClick={onCancel} className={`flex-1 py-3 rounded-xl font-bold transition-colors ${isDark ? 'text-slate-400 bg-slate-800 hover:bg-slate-700' : 'text-ds-text-subtle bg-surface-raised hover:bg-surface-hover'}`}>Annuller</button>
        <button onClick={onConfirm} className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg">Bekræft</button>
      </div>
    </div>
  </div>
  );
};

export default ConfirmModal;
