import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { LayoutGrid, Lock } from 'lucide-react';

const LoginScreen = () => {
    const [error, setError] = useState(null);
    const [isChecking, setIsChecking] = useState(false);

    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        setIsChecking(true);
        setError(null);
        try {
            await signInWithPopup(auth, provider);
        } catch (err) {
            console.error("Auth Error:", err);
            setError("Login failed. Please try again.");
            setIsChecking(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-md w-full p-8 rounded-3xl shadow-xl border border-slate-100 text-center">
                <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <img src="/logo.svg" alt="Exli Logo" className="w-12 h-12" />
                </div>
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Welcome to Exli</h1>
                <p className="text-slate-500 mb-8">Your personal finance operating system.</p>
                {error && <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl text-left border border-red-100 flex gap-2"><Lock className="w-4 h-4 mt-0.5 shrink-0" /><span className="break-words">{error}</span></div>}
                <button onClick={handleGoogleLogin} disabled={isChecking} className="w-full py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 font-bold text-slate-700 disabled:opacity-50">
                    {isChecking ? "Signing in..." : <><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" /> Continue with Google</>}
                </button>
            </div>
        </div>
    );
};

export default LoginScreen;