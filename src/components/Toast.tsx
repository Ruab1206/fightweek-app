import { useEffect } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface ToastProps {
  message: string;
  type?: 'success' | 'error';
  visible: boolean;
  onClose: () => void;
}

const Toast = ({ message, type = 'success', visible, onClose }: ToastProps) => {
    const { isDark } = useTheme();
    useEffect(() => {
        if (visible) { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }
    }, [visible, onClose]);
    if (!visible) return null;
    return (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] fade-in">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border ${type === 'success' ? (isDark ? 'bg-slate-900 border-green-900/50 text-white' : 'bg-white border-green-200 text-ds-text shadow-lg') : 'bg-red-900 border-red-800 text-white'}`}>
                {type === 'success' ? <Check className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-white" />}
                <span className="font-bold text-sm">{message}</span>
            </div>
        </div>
    );
};

export default Toast;
