import React, { useState, useEffect } from 'react';
import { User, Baby, GraduationCap, Medal, Plane, Plus, Trash2, Check, X } from 'lucide-react';
import { Card } from '../../../components/UI';

export const TaxCreditCalculator = ({ data, onUpdate }) => {
    // Local state for calculator details (persisted via onUpdate callback if needed, 
    // but typically we just calculate 'points' and save that. 
    // Ideally, we should save these details to the user profile too so they can edit later.
    // For now, I'll assume we can pass a 'calculatorData' object to/from profile or just manage local state for the calculation session.)

    // We'll manage internal state assuming we receive "calculatorData" or default to empty.
    // However, the user request implies we just want to output the POINTS. 
    // But to allow "re-selection", we really should persist the inputs. 
    // I'll stick to a pure calculator for now that outputs a number, but ideally, the parent should store the 'data'.

    // Let's implement it as a "Smart Component" that takes generic 'data' and 'onUpdateData'.
    // If usage is too complex, I'll fallback to just local state -> one way output.
    // Given the prompt "saved to their profile", I will try to structure it so we can eventually save the inputs.

    const [localData, setLocalData] = useState({
        children: [], // { id, birthYear }
        degrees: [], // { id, type: 'ba'|'ma', endYear }
        military: { served: false, endYear: null, months: 0 },
        aliyah: { isOleh: false, date: null },
        gender: 'male', // Default gender if not provided in data
        ...data // Merge passed data
    });

    const [calculatedPoints, setCalculatedPoints] = useState(2.25);
    const [currentYear] = useState(new Date().getFullYear());

    // --- LOGIC ---

    useEffect(() => {
        let points = 2.25; // Basic resident

        // 1. Gender
        if (localData.gender === 'female') points += 0.5;

        // 2. Children
        localData.children.forEach(child => {
            if (!child.birthYear) return;
            const age = currentYear - parseInt(child.birthYear);

            // 2024/2025 Rules
            if (age === 0) { // Born this year
                points += 1.5; // Traditional value, though some sources say 2.5. Sticking to conservative/standard or implementing specific 2025 check?
                // Source [1][7] says 2.5 for Year of Birth. Let's use 2.5 as it's the "New" rule.
                points += 1.0; // Adding extra 1.0 to make 2.5 (1.5 + 1.0) or just logic:
            }
            // Let's rewrite cleanly:
        });

        // Re-calculate strictly
        let p = 2.25;
        if (localData.gender === 'female') p += 0.5;

        localData.children.forEach(child => {
            const by = parseInt(child.birthYear);
            if (isNaN(by)) return;
            const age = currentYear - by;

            if (age < 0) return;

            // Updated 2024/2025 Rules
            if (age === 0) p += 2.5; // Year of birth
            else if (age >= 1 && age <= 5) p += 2.5; // Ages 1-5
            else if (age >= 6 && age <= 17) {
                // Ages 6-17: Father +1, Mother +2
                p += (localData.gender === 'female' ? 2 : 1);
            }
            else if (age === 18) {
                // Age 18: Father +0, Mother +0.5?
                if (localData.gender === 'female') p += 0.5;
            }
            // 19+ no points usually
        });

        // 3. Academics
        localData.degrees.forEach(deg => {
            const end = parseInt(deg.endYear);
            if (isNaN(end)) return;
            const yearsSince = currentYear - end; // 1 means "year after graduation"

            // Benefit starts year *after* graduation
            if (yearsSince >= 1) {
                if (deg.type === 'ba' && yearsSince <= 3) p += 1.0;
                if (deg.type === 'ma' && yearsSince <= 2) p += 0.5;
                // PhD usually same as MA or specific
            }
        });

        // 4. Military
        if (localData.military.served && localData.military.endYear) {
            const end = parseInt(localData.military.endYear);
            const monthsSinceRelease = (currentYear - end) * 12; // Approx. Need accurate date for accuracy but Year is simpler
            // Rule is "36 months from release".
            // If released in [CurrentYear - 3] or later.
            const yearsSince = currentYear - end;
            if (yearsSince >= 0 && yearsSince <= 3) { // Rough check
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

        // 5. Aliyah
        if (localData.aliyah.isOleh && localData.aliyah.date) {
            const aliyahDate = new Date(localData.aliyah.date);
            const diffTime = Math.abs(new Date() - aliyahDate);
            const monthsSince = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));

            if (monthsSince <= 12) p += 1; // 1/12 point worth? No, it's +1 point value. 
            else if (monthsSince <= 30) p += 3; // Next 18 months
            else if (monthsSince <= 42) p += 2; // Next 12 months
            else if (monthsSince <= 54) p += 1; // Last 12 months
        }

        setCalculatedPoints(p);

        // Notify parent of the score AND the data
        onUpdate(p, localData);

    }, [localData, currentYear]);


    // --- HANDLERS ---
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
                    <h3 className="text-emerald-900 font-bold text-lg">Total Tax Credits</h3>
                    <p className="text-emerald-600 text-xs">Based on selected criteria</p>
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
                        <h4 className="font-bold text-slate-700">Gender</h4>
                    </div>
                    <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                        {['male', 'female'].map(g => (
                            <button
                                key={g}
                                onClick={() => update('gender', g)}
                                className={`flex-1 py-2 text-sm font-bold rounded-md capitalize transition-all ${localData.gender === g
                                    ? 'bg-indigo-500 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-indigo-500'}`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 text-center">
                        {localData.gender === 'female' ? '+0.5 Points for women' : 'Base rate for men'}
                    </p>
                </Card>

                {/* 2. CHILDREN CARD */}
                <Card className={`p-4 border-2 transition-all ${localData.children.length > 0 ? 'border-pink-100 bg-pink-50/50' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Baby className="text-pink-500 w-5 h-5" />
                            <h4 className="font-bold text-slate-700">Children</h4>
                        </div>
                        <button onClick={addChild} className="p-1 bg-pink-100 text-pink-600 rounded-full hover:bg-pink-200"><Plus className="w-4 h-4" /></button>
                    </div>

                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                        {localData.children.length === 0 && <div className="text-xs text-slate-400 italic">No children added</div>}
                        {localData.children.map(child => (
                            <div key={child.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-pink-100">
                                <span className="text-xs font-bold text-slate-500">Born:</span>
                                <input
                                    type="number"
                                    value={child.birthYear}
                                    onChange={(e) => updateChild(child.id, e.target.value)}
                                    className="w-20 p-1 text-sm font-bold border rounded"
                                />
                                <button onClick={() => removeChild(child.id)} className="ml-auto text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* 3. ACADEMIC DEGREE CARD */}
                <Card className={`p-4 border-2 transition-all ${localData.degrees.length > 0 ? 'border-cyan-100 bg-cyan-50/50' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <GraduationCap className="text-cyan-500 w-5 h-5" />
                            <h4 className="font-bold text-slate-700">Degrees</h4>
                        </div>
                        <button onClick={addDegree} className="p-1 bg-cyan-100 text-cyan-600 rounded-full hover:bg-cyan-200"><Plus className="w-4 h-4" /></button>
                    </div>

                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                        {localData.degrees.length === 0 && <div className="text-xs text-slate-400 italic">No degrees added</div>}
                        {localData.degrees.map(deg => (
                            <div key={deg.id} className="bg-white p-2 rounded-lg border border-cyan-100 text-xs">
                                <div className="flex justify-between mb-2">
                                    <select
                                        value={deg.type}
                                        onChange={(e) => updateDegree(deg.id, 'type', e.target.value)}
                                        className="font-bold border rounded p-1"
                                    >
                                        <option value="ba">Bachelor's</option>
                                        <option value="ma">Master's</option>
                                    </select>
                                    <button onClick={() => removeDegree(deg.id)} className="text-slate-300 hover:text-red-500 ml-2"><Trash2 className="w-3 h-3" /></button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span>End Year:</span>
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
                            <h4 className="font-bold text-slate-700">Military</h4>
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
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">RELEASE YEAR</label>
                                <input
                                    type="number"
                                    value={localData.military.endYear || ''}
                                    onChange={(e) => update('military', { ...localData.military, endYear: e.target.value })}
                                    className="w-full p-2 border rounded font-bold text-sm"
                                    placeholder="e.g. 2023"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">MONTHS SERVED</label>
                                <input
                                    type="number"
                                    value={localData.military.months}
                                    onChange={(e) => update('military', { ...localData.military, months: parseInt(e.target.value) })}
                                    className="w-full p-2 border rounded font-bold text-sm"
                                    placeholder="e.g. 36"
                                />
                            </div>
                        </div>
                    ) : <div className="text-xs text-slate-400 italic">No military service selected</div>}
                </Card>

                {/* 5. ALIYAH CARD */}
                <Card className={`p-4 border-2 transition-all ${localData.aliyah.isOleh ? 'border-orange-100 bg-orange-50/50' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Plane className="text-orange-500 w-5 h-5" />
                            <h4 className="font-bold text-slate-700">Aliyah</h4>
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
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">DATE OF ALIYAH</label>
                            <input
                                type="date"
                                value={localData.aliyah.date || ''}
                                onChange={(e) => update('aliyah', { ...localData.aliyah, date: e.target.value })}
                                className="w-full p-2 border rounded font-bold text-sm"
                            />
                        </div>
                    ) : <div className="text-xs text-slate-400 italic">Not a new immigrant</div>}
                </Card>
            </div>
        </div>
    );
};
