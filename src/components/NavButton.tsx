import { LucideIcon } from 'lucide-react';

interface NavButtonProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  isDark?: boolean;
}

const NavButton = ({ icon: Icon, label, active, onClick, isDark = true }: NavButtonProps) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center p-2 rounded-xl w-16 transition-colors ${active ? 'text-blue-500' : (isDark ? 'text-slate-500' : 'text-ds-text-subtlest')}`}>
        <Icon className="w-6 h-6 mb-1" />
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
    </button>
);

export default NavButton;
