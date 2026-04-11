import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';

import { db } from '../config/firebase';
import { PUBLIC_DATA_PATH, USER_MAPPING } from '../config/constants';
import { getDeviceInfo } from '../utils/deviceUtils';
import { useTheme } from '../hooks/useTheme';

interface FeedbackModalProps {
  user: User;
  currentContext: string;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

const FeedbackModal = ({ user, currentContext, onClose, onShowToast }: FeedbackModalProps) => {
    const { isDark } = useTheme();
    const [text, setText] = useState('');
    const send = async () => {
        if(!text) return;
        try {
            await addDoc(collection(db, PUBLIC_DATA_PATH, 'feedback'), {
                text, user: user.email, timestamp: new Date().toISOString(), context: currentContext || 'App', status: 'new', device: getDeviceInfo(), userName: USER_MAPPING[user.email.toLowerCase()]?.name || user.email
            });
            onShowToast("Tak for feedback!");
            onClose();
        } catch(e) { console.error(e); }
    };
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
            <div className={`w-full max-w-sm rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}>
                <h3 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-ds-text'}`}>Send Feedback</h3>
                <textarea 
                    className={`w-full border rounded-xl p-3 text-sm mb-4 focus:ring-2 focus:ring-blue-600 outline-none ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-surface-subtle border-surface-border text-ds-text'}`} 
                    rows="4" 
                    placeholder="Skriv her, hvis du har feedback til træningen, teamet eller app'en."
                    value={text} 
                    onChange={e=>setText(e.target.value)}
                ></textarea>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className={`px-4 py-2 text-sm ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>Luk</button>
                    <button onClick={send} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Send</button>
                </div>
            </div>
        </div>
    );
};

export default FeedbackModal;
