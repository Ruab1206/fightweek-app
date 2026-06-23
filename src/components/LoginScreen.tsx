import { ShieldCheck, AlertCircle, MousePointerClick } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface LoginScreenProps {
  onLoginPopup: () => void;
  onLoginRedirect: () => void;
  isMobile?: boolean;
  error: string | null;
}

const LoginScreen = ({ onLoginPopup, onLoginRedirect, isMobile = false, error }: LoginScreenProps) => {
    const { isDark } = useTheme();
    const getFriendlyError = (msg) => {
        if (!msg) return null;
        if (msg.includes("popup-closed-by-user") || msg.includes("cancelled-popup-request")) return "Login afbrudt af bruger (Popup).";
        if (msg.includes("network-request-failed")) return "Netværksfejl.";
        if (msg.includes("unauthorized-domain")) return "Domæne ikke godkendt.";
        return msg;
    };
    
    const friendlyError = getFriendlyError(error);

    // On mobile, popup sign-in is unreliable (the OAuth window can't return the
    // result to the page), so the primary button uses redirect. Desktop keeps
    // popup. The secondary link always offers the other method as a fallback.
    const onPrimaryLogin = isMobile ? onLoginRedirect : onLoginPopup;
    const onAlternativeLogin = isMobile ? onLoginPopup : onLoginRedirect;

    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${isDark ? 'bg-slate-950' : 'bg-surface-subtle'}`}>
        <div className={`p-8 rounded-2xl border shadow-2xl max-w-sm w-full text-center relative ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
          <div className={`absolute top-2 right-2 text-[10px] font-mono ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}>v1.76</div>
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-900/30">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-ds-text'}`}>FightWeek</h1>
          <p className={`mb-8 text-sm ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>Log ind for at se din træningsplan</p>
          
          {friendlyError && (
            <div className="bg-red-900/50 border border-red-800 rounded-lg p-3 mb-6 text-xs text-red-200 text-left">
                <p className="font-bold mb-1 flex items-center"><AlertCircle className="w-3 h-3 mr-1"/> Fejl:</p>
                <p>{friendlyError}</p>
            </div>
          )}

          <button onClick={onPrimaryLogin} className={`w-full font-bold py-3.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 mb-4 ${isDark ? 'bg-white text-slate-900 hover:bg-slate-100' : 'bg-brand-500 text-white hover:bg-brand-600'}`}>
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Log ind med Google
          </button>

          <button onClick={onAlternativeLogin} className={`text-xs underline flex items-center justify-center w-full mt-2 ${isDark ? 'text-slate-500 hover:text-blue-400' : 'text-ds-text-subtlest hover:text-brand-500'}`}>
            <MousePointerClick className="w-3 h-3 mr-1" />
            {isMobile ? 'Alternativ Login (Popup)' : 'Alternativ Login (Redirect)'}
          </button>
        </div>
      </div>
    );
};

export default LoginScreen;
