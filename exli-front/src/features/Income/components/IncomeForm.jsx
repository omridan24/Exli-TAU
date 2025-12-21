import React from 'react';
import { Briefcase, CheckCircle, DollarSign, Wallet, Activity, Shield, Tag } from 'lucide-react';
import { Button } from '../../../components/UI.jsx';
import { LogoImage } from './LogoImage';
import { IncomeCard } from './IncomeCard';

export const IncomeForm = ({
    incomeData,
    handleInputChange,
    workplaces,
    currency,
    handleSave,
    isLoading,
    error,
    onBack
}) => {
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5" /> Income Source / Name
                </label>
                <input
                    type="text"
                    placeholder="Type source or quick select below..."
                    value={incomeData.source_name}
                    onChange={(e) => handleInputChange('source_name', e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all mb-6"
                />

                {/* Unified Quick Select Section */}
                {workplaces.length > 0 && (
                    <div className="space-y-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Quick Select Professional Identity</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {workplaces.map((w, i) => {
                                const fullName = `${w.linkedOccupation} at ${w.name}`;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => handleInputChange('source_name', fullName)}
                                        className={`flex items-center gap-3 p-3 rounded-2xl text-left border transition-all hover:shadow-md ${incomeData.source_name === fullName ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' : 'bg-white border-slate-100 hover:border-emerald-200'}`}
                                    >
                                        <LogoImage logo={w.logo} domain={w.domain} className="w-10 h-10 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <div className={`text-xs font-black truncate uppercase tracking-tighter ${incomeData.source_name === fullName ? 'text-emerald-700' : 'text-slate-400'}`}>
                                                {w.linkedOccupation}
                                            </div>
                                            <div className="text-sm font-bold text-slate-700 truncate">
                                                at {w.name}
                                            </div>
                                        </div>
                                        {incomeData.source_name === fullName && <CheckCircle className="w-4 h-4 text-emerald-500 ml-auto flex-shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <IncomeCard label="Bruto Income" field="bruto" value={incomeData.bruto} onChange={handleInputChange} currency={currency} color="border-emerald-200 text-emerald-600" icon={DollarSign} />
                <IncomeCard label="Neto (Bank)" field="neto" value={incomeData.neto} onChange={handleInputChange} currency={currency} color="border-blue-200 text-blue-600" icon={Wallet} />
                <IncomeCard label="Total Taxes" field="taxes" value={incomeData.taxes} onChange={handleInputChange} currency={currency} color="border-red-200 text-red-600" icon={Activity} />
                <IncomeCard label="Pension" field="pension" value={incomeData.pension} onChange={handleInputChange} currency={currency} color="border-purple-200 text-purple-600" icon={Shield} />
                <IncomeCard label="Other Deposits" field="other_deposits" value={incomeData.other_deposits} onChange={handleInputChange} currency={currency} color="border-orange-200 text-orange-600" icon={Tag} />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button onClick={onBack} className="px-6 py-2 text-slate-400 hover:text-slate-600 font-bold transition-all">Back</button>
                <Button onClick={handleSave} disabled={isLoading || !incomeData.source_name}>{isLoading ? 'Saving...' : 'Save Income'}</Button>
            </div>
            {error && <div className="text-red-500 text-center font-bold">{error}</div>}
        </div>
    );
};
