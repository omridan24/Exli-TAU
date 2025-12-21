import React, { useState } from 'react';
import { Building2 } from 'lucide-react';

export const LogoImage = ({ logo, domain, className = "w-10 h-10" }) => {
    const [error, setError] = useState(false);
    const logoUrl = domain && domain !== 'independent' ? `https://logo.clearbit.com/${domain}` : logo;

    if (error || !logoUrl) {
        return (
            <div className={`${className} rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200`}>
                <Building2 className="w-1/2 h-1/2 text-slate-400" />
            </div>
        );
    }

    return (
        <div className={`${className} rounded-lg border border-slate-100 flex items-center justify-center bg-white overflow-hidden`}>
            <img src={logoUrl} alt="" className="w-full h-full object-contain p-1" onError={() => setError(true)} />
        </div>
    );
};
