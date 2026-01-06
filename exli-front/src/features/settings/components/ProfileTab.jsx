import React from 'react';
import { User, Calendar, ChevronRight, Plus, Trash2, Globe, MapPin, GraduationCap, Receipt } from 'lucide-react';
import { Card } from '../../../components/UI';
import { LogoImage } from './LogoImage';
import { ISRAEL_TAX_CREDIT_PRESETS } from '../../../config/taxBrackets';
import { TaxCreditCalculator } from './TaxCreditCalculator';

export const ProfileTab = ({
    profile,
    onUpdateProfile,
    handleSaveProfile, // Helper to confirm/save immediately if needed, or we just rely on onUpdateProfile and parent Save button?
    // Parent SettingsNode uses handleSaveProfile to update local state AND save to DB immediately for some actions like checkboxes/workplaces
    // For text inputs it just updates state.
    // Let's pass helpers that match the logic.
    onOpenModal,
    onOpenWorkplacePicker,
    onOpenDatePicker
}) => {
    return (
        <div className="space-y-6">
            <Card className="p-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-8 flex items-center gap-2"><User className="text-emerald-500" /> Identity</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div><label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Full Name</label><input type="text" value={profile.name} onChange={e => onUpdateProfile('name', e.target.value)} className="w-full p-3 border rounded-xl font-bold outline-none focus:border-emerald-500" /></div>
                        <div><label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Birthdate</label><button onClick={onOpenDatePicker} className="w-full p-4 border rounded-2xl flex justify-between items-center font-bold hover:bg-slate-50 transition-all">{profile.birthdate} <Calendar className="w-5 h-5 text-slate-400" /></button></div>
                        <div onClick={() => onOpenModal('status')} className="cursor-pointer"><label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Family Status</label><div className="w-full p-4 border rounded-xl bg-white font-bold flex justify-between items-center">{profile.status || "Select..."} <ChevronRight className="w-4 h-4 text-slate-300" /></div></div>
                    </div>

                    <div className="space-y-6">
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Work & Career</label>
                        <button onClick={() => onOpenModal('occupation')} className="w-full p-4 border-2 border-dashed rounded-2xl text-slate-400 font-bold hover:border-emerald-400 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"><Plus /> Add Title</button>
                        <div className="space-y-3">
                            {profile.workplaces.map((w, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-white border rounded-2xl shadow-sm group">
                                    <div className="flex items-center gap-3">
                                        <LogoImage logo={w.logo} domain={w.domain} />
                                        <div><div className="text-sm font-black text-slate-700">{w.name}</div><div className="text-[10px] text-emerald-600 font-bold uppercase">{w.linkedOccupation}</div></div>
                                    </div>
                                    <button onClick={() => handleSaveProfile({ ...profile, workplaces: profile.workplaces.filter((_, idx) => idx !== i) })} className="p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 border-t pt-8">
                    <div onClick={() => onOpenModal('country')} className="cursor-pointer group">
                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Country</label>
                        <div className="w-full p-4 border rounded-xl bg-white font-bold group-hover:border-emerald-50 flex justify-between items-center transition-all">{profile.country || "Select..."} <Globe className="text-slate-300" /></div>
                    </div>
                    <div onClick={() => onOpenModal('city')} className={`cursor-pointer group ${!profile.country && 'opacity-50 pointer-events-none'}`}>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">City</label>
                        <div className="w-full p-4 border rounded-xl bg-white font-bold group-hover:border-emerald-50 flex justify-between items-center transition-all">{profile.city || "Select..."} <MapPin className="text-slate-300" /></div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 md:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <GraduationCap className={profile.isStudent ? 'text-blue-500' : 'text-slate-300'} />
                                <label htmlFor="isStudent" className="font-bold text-slate-700 cursor-pointer">I am a Student</label>
                            </div>
                            <input type="checkbox" id="isStudent" checked={profile.isStudent} onChange={e => handleSaveProfile({ ...profile, isStudent: e.target.checked })} className="w-5 h-5 rounded text-emerald-600" />
                        </div>
                        {profile.isStudent && (
                            <div onClick={() => onOpenModal('university')} className="cursor-pointer p-4 bg-white border rounded-xl font-bold flex justify-between items-center">
                                {profile.university || 'Select University...'} <ChevronRight className="text-slate-300" />
                            </div>
                        )}
                    </div>

                    {/* Tax Credit Points - Israel Only */}
                    {profile.country === 'Israel' && (
                        <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-2xl border-2 border-orange-200 md:col-span-2">
                            <div className="flex items-center gap-3 mb-6">
                                <Receipt className="w-8 h-8 text-orange-600" />
                                <div>
                                    <h3 className="font-bold text-2xl text-orange-900">Tax Credit Calculator</h3>
                                    <p className="text-sm text-orange-700">Calculate your exact credit points (נקודות זיכוי)</p>
                                </div>
                            </div>

                            <TaxCreditCalculator
                                data={profile.taxCreditData || {}}
                                onUpdate={(points, data) => {
                                    // Only update if changed to prevent infinite loops if strict equality fails
                                    // But simpler: just pass new object.
                                    // We need to be careful not to trigger save on every keypress if it causes re-renders.
                                    // The parent SettingsNode handles debouncing or manual save? 
                                    // Code says: "handleSaveProfile... save to DB immediately". 
                                    // If I update DB on every keypress in calculator, that's bad.
                                    // Ideally, TaxCreditCalculator shouldn't trigger onUpdate on every keystroke, but it does.
                                    // I should probably debounce it inside TaxCreditCalculator or here.
                                    // However, for now, let's just assume local state in SettingsNode is cheap, and DB save happens?
                                    // "handleSaveProfile" calls updateDoc?
                                    // Yes. "handleSaveProfile" in SettingsNode updates DB. 
                                    // I SHOULD update `onUpdateProfile` (local state) instead, and only `handleSaveProfile` when leaving/explicitly? 
                                    // ProfileTab uses `handleSaveProfile` for button clicks (checkboxes). 
                                    // For text inputs it uses `onUpdateProfile`.
                                    // Since Calculator is complex, I should use `onUpdateProfile` (local state) and maybe a "Save" button? 
                                    // OR, just let it update local state, and rely on the main "Save Changes" button in SettingsNode if it exists?
                                    // SettingsNode usually has a Save button? Let's check.
                                    // There is no visible Save button in the snippet I saw of ProfileTab (it has onUpdateProfile).
                                    // The parent `SettingsNode` likely has the Save Logic.
                                    // Let's use `onUpdateProfile` to update the local 'profile' state, 
                                    // expecting the user to click a main "Save" button elsewhere, OR if ProfileTab is "Live Save", it might be an issue.
                                    // The `ProfileTab` snippet passed `handleSaveProfile` which does `await updateDoc`.
                                    // Inputs use `onUpdateProfile`.
                                    // I will use `onUpdateProfile` for the calculator data to avoid spamming DB.

                                    onUpdateProfile('taxCreditPoints', points);
                                    onUpdateProfile('taxCreditData', data);
                                }}
                            />
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};
