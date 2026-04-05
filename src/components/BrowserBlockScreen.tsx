import { useState } from 'react';
import { Smartphone, Check, Copy } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

const BrowserBlockScreen = () => {
    const { isDark } = useTheme();
    const [copied, setCopied] = useState(false);
    const copyLink = () => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); };
    return (
        <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-slate-950' : 'bg-surface-subtle'}`}>
            <div className={`w-full max-w-sm border rounded-2xl p-6 shadow-2xl text-center ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}>
                <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4"><Smartphone className="w-8 h-8 text-red-500" /></div>
                <h2 className={`font-bold text-xl mb-2 ${isDark ? 'text-white' : 'text-ds-text'}`}>Brug Chrome eller Safari</h2>
                <p className={`text-sm mb-6 leading-relaxed ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>Google tillader ikke login direkte i Messenger/Facebook.</p>
                <button onClick={copyLink} className={`w-full font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-surface-raised hover:bg-surface-hover text-ds-text'}`}>
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />} {copied ? "Link kopieret!" : "Kopier Link"}
                </button>
            </div>
        </div>
    );
};

export default BrowserBlockScreen;
