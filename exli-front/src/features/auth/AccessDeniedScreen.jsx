import React from 'react';
import { Lock } from 'lucide-react';
import { Button } from '../../components/UI';

const AccessDeniedScreen = ({ email, onLogout, onRetry }) => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-8 rounded-3xl shadow-xl border border-slate-100 text-center animate-fade-in">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500">
                <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Restricted</h2>
            <p className="text-slate-500 mb-6">Email <span className="font-mono font-bold text-slate-800">{email}</span> is not on the whitelist.</p>
            <div className="flex gap-2">
                <Button onClick={onRetry} variant="primary" className="flex-1 justify-center">Retry Check</Button>
                <Button onClick={onLogout} variant="secondary" className="flex-1 justify-center">Sign Out</Button>
            </div>
        </div>
    </div>
);

export default AccessDeniedScreen;