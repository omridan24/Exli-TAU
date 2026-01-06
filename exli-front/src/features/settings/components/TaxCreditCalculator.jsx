import React, { useState, useEffect } from 'react';
import { User, Baby, GraduationCap, Medal, Plane, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/UI';

export const TaxCreditCalculator = ({ data, onUpdate }) => {
    const { t } = useTranslation();

    const [localData, setLocalData] = useState({
        children: [],
        degrees: [],
        military: { served: false, endYear: null, months: 0 },
        aliyah: { isOleh: false, date: null },
        combatReservist: { isCombat: false, days: 0 },
        gender: 'male',
        ...data
    });

    const [calculatedPoints, setCalculatedPoints] = useState(2.25);
    const [currentYear] = useState(new Date().getFullYear());

    useEffect(() => {
        let p = 2.25;
        if (localData.gender === 'female') p += 0.5;

        localData.children.forEach(child => {
            const by = parseInt(child.birthYear);
            if (isNaN(by)) return;
            const age = currentYear - by;

            if (age < 0) return;

            if (age === 0) p += 2.5;
            else if (age >= 1 && age <= 5) p += 2.5;
            else if (age >= 6 && age <= 17) {
                p += (localData.gender === 'female' ? 2 : 1);
            }
            else if (age === 18) {
                if (localData.gender === 'female') p += 0.5;
            }
        });

        localData.degrees.forEach(deg => {
            const end = parseInt(deg.endYear);
            if (isNaN(end)) return;
            const yearsSince = currentYear - end;

            if (yearsSince >= 1) {
                if (deg.type === 'ba' && yearsSince <= 3) p += 1.0;
                if (deg.type === 'ma' && yearsSince <= 2) p += 0.5;
            }
        });

        if (localData.military.served && localData.military.endYear) {
            const end = parseInt(localData.military.endYear);
            const yearsSince = currentYear - end;
            if (yearsSince >= 0 && yearsSince <= 3) {
                const m = localData.military.months;
                if (localData.gender === 'female') {
                    if (m >= 22) p += 2;
                    else if (m >= 12) p += 1;
                } else {
                    if (m >= 23) p += 2;
                    else if (m >= 12) p += 1;
                }
            }
        }

        if (localData.aliyah.isOleh && localData.aliyah.date) {
            const aliyahDate = new Date(localData.aliyah.date);
            const diffTime = Math.abs(new Date() - aliyahDate);
            const monthsSince = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));

            if (monthsSince <= 12) p += 1;
            else if (monthsSince <= 30) p += 3;
            else if (monthsSince <= 42) p += 2;
            else if (monthsSince <= 42) p += 2;
            else if (monthsSince <= 54) p += 1;
        }

        // Iron Swords Combat Reservist
        if (localData.combatReservist?.isCombat) {
            const days = parseInt(localData.combatReservist.days) || 0;
            if (days >= 50) {
                const extra = Math.floor((days - 50) / 5) * 0.25;
                p += Math.min(4, 1 + extra);
            } else if (days >= 40) {
                p += 0.75;
            } else if (days >= 30) {
                p += 0.5;
            }
        }

        setCalculatedPoints(p);
        onUpdate(p, localData);

    }, [localData, currentYear]);

    const update = (field, val) => setLocalData(prev => ({ ...prev, [field]: val }));

    const addChild = () => update('children', [...localData.children, { id: Date.now(), birthYear: currentYear }]);
    const removeChild = (id) => update('children', localData.children.filter(c => c.id !== id));
    const updateChild = (id, year) => update('children', localData.children.map(c => c.id === id ? { ...c, birthYear: year } : c));

    const addDegree = () => update('degrees', [...localData.degrees, { id: Date.now(), type: 'ba', endYear: currentYear - 1 }]);
    const removeDegree = (id) => update('degrees', localData.degrees.filter(d => d.id !== id));
    const updateDegree = (id, field, val) => update('degrees', localData.degrees.map(d => d.id === id ? { ...d, [field]: val } : d));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-6">
                <div>
                    <h3 className="text-emerald-900 font-bold text-lg">{t('settings.taxCredit.totalCredits')}</h3>
                    <p className="text-emerald-600 text-xs">{t('settings.taxCredit.basedOn')}</p>
                </div>
                <div className="text-4xl font-black text-emerald-600">
                    {calculatedPoints.toFixed(2)}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. GENDER CARD */}
                <Card className={`p-4 border-2 transition-all cursor-pointer ${localData.gender ? 'border-indigo-100 bg-indigo-50/50' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2 mb-3">
                        <User className="text-indigo-500 w-5 h-5" />
                        <h4 className="font-bold text-slate-700">{t('settings.taxCredit.gender')}</h4>
                    </div>
                    <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                        {['male', 'female'].map(g => (
                            <button
                                key={g}
                                onClick={() => update('gender', g)}
                                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${localData.gender === g
                                    ? 'bg-indigo-500 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-indigo-500'}`}
                            >
                                {t(`settings.taxCredit.${g}`)}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 text-center">
                        {localData.gender === 'female' ? t('settings.taxCredit.femaleNote') : t('settings.taxCredit.maleNote')}
                    </p>
                </Card>

                {/* 2. CHILDREN CARD */}
                <Card className={`p-4 border-2 transition-all ${localData.children.length > 0 ? 'border-pink-100 bg-pink-50/50' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Baby className="text-pink-500 w-5 h-5" />
                            <h4 className="font-bold text-slate-700">{t('settings.taxCredit.children')}</h4>
                        </div>
                        <button onClick={addChild} className="p-1 bg-pink-100 text-pink-600 rounded-full hover:bg-pink-200">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-2 max-h-32 overflow-y-auto pe-1">
                        {localData.children.length === 0 && (
                            <div className="text-xs text-slate-400 italic">{t('settings.taxCredit.noChildren')}</div>
                        )}
                        {localData.children.map(child => (
                            <div key={child.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-pink-100">
                                <span className="text-xs font-bold text-slate-500">{t('settings.taxCredit.born')}</span>
                                <input
                                    type="number"
                                    value={child.birthYear}
                                    onChange={(e) => updateChild(child.id, e.target.value)}
                                    className="w-20 p-1 text-sm font-bold border rounded"
                                />
                                <button onClick={() => removeChild(child.id)} className="ms-auto text-slate-300 hover:text-red-500">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* 3. ACADEMIC DEGREE CARD */}
                <Card className={`p-4 border-2 transition-all ${localData.degrees.length > 0 ? 'border-cyan-100 bg-cyan-50/50' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <GraduationCap className="text-cyan-500 w-5 h-5" />
                            <h4 className="font-bold text-slate-700">{t('settings.taxCredit.degrees')}</h4>
                        </div>
                        <button onClick={addDegree} className="p-1 bg-cyan-100 text-cyan-600 rounded-full hover:bg-cyan-200">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-2 max-h-32 overflow-y-auto pe-1">
                        {localData.degrees.length === 0 && (
                            <div className="text-xs text-slate-400 italic">{t('settings.taxCredit.noDegrees')}</div>
                        )}
                        {localData.degrees.map(deg => (
                            <div key={deg.id} className="bg-white p-2 rounded-lg border border-cyan-100 text-xs">
                                <div className="flex justify-between mb-2">
                                    <select
                                        value={deg.type}
                                        onChange={(e) => updateDegree(deg.id, 'type', e.target.value)}
                                        className="font-bold border rounded p-1"
                                    >
                                        <option value="ba">{t('settings.taxCredit.bachelor')}</option>
                                        <option value="ma">{t('settings.taxCredit.master')}</option>
                                    </select>
                                    <button onClick={() => removeDegree(deg.id)} className="text-slate-300 hover:text-red-500 ms-2">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span>{t('settings.taxCredit.endYear')}</span>
                                    <input
                                        type="number"
                                        value={deg.endYear}
                                        onChange={(e) => updateDegree(deg.id, 'endYear', e.target.value)}
                                        className="w-16 p-1 border rounded font-bold"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* 4. MILITARY CARD */}
                <Card className={`p-4 border-2 transition-all ${localData.military.served ? 'border-green-100 bg-green-50/50' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Medal className="text-green-600 w-5 h-5" />
                            <h4 className="font-bold text-slate-700">{t('settings.taxCredit.military')}</h4>
                        </div>
                        <input
                            type="checkbox"
                            checked={localData.military.served}
                            onChange={(e) => update('military', { ...localData.military, served: e.target.checked })}
                            className="w-4 h-4 text-green-600"
                        />
                    </div>
                    {localData.military.served ? (
                        <div className="space-y-3 bg-white p-3 rounded-lg border border-green-100">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                    {t('settings.taxCredit.releaseYear')}
                                </label>
                                <input
                                    type="number"
                                    value={localData.military.endYear || ''}
                                    onChange={(e) => update('military', { ...localData.military, endYear: e.target.value })}
                                    className="w-full p-2 border rounded font-bold text-sm"
                                    placeholder="e.g. 2023"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                    {t('settings.taxCredit.monthsServed')}
                                </label>
                                <input
                                    type="number"
                                    value={localData.military.months}
                                    onChange={(e) => update('military', { ...localData.military, months: parseInt(e.target.value) })}
                                    className="w-full p-2 border rounded font-bold text-sm"
                                    placeholder="e.g. 36"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-slate-400 italic">{t('settings.taxCredit.noMilitary')}</div>
                    )}
                </Card>

                {/* 5. ALIYAH CARD */}
                <Card className={`p-4 border-2 transition-all ${localData.aliyah.isOleh ? 'border-orange-100 bg-orange-50/50' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Plane className="text-orange-500 w-5 h-5" />
                            <h4 className="font-bold text-slate-700">{t('settings.taxCredit.aliyah')}</h4>
                        </div>
                        <input
                            type="checkbox"
                            checked={localData.aliyah.isOleh}
                            onChange={(e) => update('aliyah', { ...localData.aliyah, isOleh: e.target.checked })}
                            className="w-4 h-4 text-orange-600"
                        />
                    </div>
                    {localData.aliyah.isOleh ? (
                        <div className="bg-white p-3 rounded-lg border border-orange-100">
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                {t('settings.taxCredit.dateOfAliyah')}
                            </label>
                            <input
                                type="date"
                                value={localData.aliyah.date || ''}
                                onChange={(e) => update('aliyah', { ...localData.aliyah, date: e.target.value })}
                                className="w-full p-2 border rounded font-bold text-sm"
                            />
                        </div>
                    ) : (
                        <div className="text-xs text-slate-400 italic">{t('settings.taxCredit.notNewImmigrant')}</div>
                    )}
                </Card>

                {/* 6. COMBAT RESERVIST (IRON SWORDS) */}
                <Card className={`p-4 border-2 transition-all ${localData.combatReservist?.isCombat ? 'border-red-100 bg-red-50/50' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Medal className="text-red-500 w-5 h-5" />
                            <h4 className="font-bold text-slate-700">{t('settings.taxCredit.combatReservist')}</h4>
                        </div>
                        <input
                            type="checkbox"
                            checked={localData.combatReservist?.isCombat}
                            onChange={(e) => update('combatReservist', { ...localData.combatReservist, isCombat: e.target.checked })}
                            className="w-4 h-4 text-red-600"
                        />
                    </div>
                    {localData.combatReservist?.isCombat ? (
                        <div className="bg-white p-3 rounded-lg border border-red-100">
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                {t('settings.taxCredit.daysServed')}
                            </label>
                            <input
                                type="number"
                                value={localData.combatReservist.days}
                                onChange={(e) => update('combatReservist', { ...localData.combatReservist, days: parseInt(e.target.value) })}
                                className="w-full p-2 border rounded font-bold text-sm"
                                placeholder="e.g. 60"
                            />
                        </div>
                    ) : (
                        <div className="text-xs text-slate-400 italic">{t('settings.taxCredit.notCombatReservist')}</div>
                    )}
                </Card>
            </div>
        </div>
    );
};
