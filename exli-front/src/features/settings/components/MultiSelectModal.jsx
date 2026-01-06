import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/UI';

// Mapping from English occupation names to translation keys
const occupationKeyMap = {
    "Software Engineer": "softwareEngineer",
    "Data Scientist": "dataScientist",
    "Product Manager": "productManager",
    "Designer (UI/UX)": "designer",
    "Marketing Manager": "marketingManager",
    "Sales Representative": "salesRepresentative",
    "Customer Success": "customerSuccess",
    "Business Analyst": "businessAnalyst",
    "Doctor / Physician": "doctor",
    "Nurse": "nurse",
    "Pharmacist": "pharmacist",
    "Psychologist": "psychologist",
    "Teacher / Educator": "teacher",
    "Professor": "professor",
    "Student": "student",
    "Researcher": "researcher",
    "Lawyer": "lawyer",
    "Accountant / CPA": "accountant",
    "Financial Advisor": "financialAdvisor",
    "Real Estate Agent": "realEstateAgent",
    "Architect": "architect",
    "Civil Engineer": "civilEngineer",
    "Electrician": "electrician",
    "Plumber": "plumber",
    "Technician": "technician",
    "Chef / Cook": "chef",
    "Waiter / Bartender": "waiter",
    "Event Planner": "eventPlanner",
    "Pilot": "pilot",
    "Flight Attendant": "flightAttendant",
    "Driver": "driver",
    "Police Officer": "policeOfficer",
    "Soldier / Military": "soldier",
    "Security": "security",
    "Artist": "artist",
    "Musician": "musician",
    "Writer / Editor": "writer",
    "Content Creator": "contentCreator",
    "Entrepreneur": "entrepreneur",
    "Freelancer": "freelancer",
    "CEO / Executive": "ceo",
    "HR Manager": "hrManager",
    "Recruiter": "recruiter"
};

export const MultiSelectModal = ({ options, onClose, onConfirm, selectedValues = [] }) => {
    const { t } = useTranslation();
    const [selected, setSelected] = useState(selectedValues);
    const [searchTerm, setSearchTerm] = useState('');
    const [customJob, setCustomJob] = useState('');

    const toggle = (val) => {
        if (selected.includes(val)) setSelected(selected.filter(s => s !== val));
        else if (selected.length < 3) setSelected([...selected, val]);
        else alert(t('occupations.maxOccupations'));
    };

    const handleAddCustom = () => {
        if (customJob.trim() && !selected.includes(customJob)) {
            if (selected.length < 3) {
                toggle(customJob.trim());
                setCustomJob('');
            }
            else alert(t('occupations.maxOccupations'));
        }
    };

    // Get translated name for an occupation
    const getOccupationName = (job) => {
        const key = occupationKeyMap[job];
        if (key) {
            return t(`occupations.${key}`);
        }
        return job; // Return as-is for custom jobs
    };

    // Filter options based on search term (search in both original and translated)
    const filteredOptions = options.filter(o => {
        const originalMatch = o.toLowerCase().includes(searchTerm.toLowerCase());
        const translatedName = getOccupationName(o);
        const translatedMatch = translatedName.toLowerCase().includes(searchTerm.toLowerCase());
        return originalMatch || translatedMatch;
    });

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-xl font-bold">{t('occupations.title')}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-4 bg-slate-50 border-b space-y-3">
                    <input
                        type="text"
                        placeholder={t('occupations.searchPlaceholder')}
                        className="w-full p-3 rounded-xl border outline-none focus:border-emerald-500"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder={t('occupations.addCustomPlaceholder')}
                            className="flex-1 p-3 rounded-xl border text-sm outline-none focus:border-emerald-500"
                            value={customJob}
                            onChange={e => setCustomJob(e.target.value)}
                        />
                        <button
                            onClick={handleAddCustom}
                            className="bg-slate-900 text-white px-6 rounded-xl font-bold text-sm"
                        >
                            {t('occupations.add')}
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Show custom selected jobs first */}
                    {selected.filter(s => !options.includes(s)).map(job => (
                        <button
                            key={job}
                            onClick={() => toggle(job)}
                            className="p-3 rounded-xl text-start font-bold bg-emerald-50 border-2 border-emerald-500 text-emerald-700 flex justify-between items-center"
                        >
                            {job} <Check className="w-4 h-4" />
                        </button>
                    ))}
                    {/* Show standard options */}
                    {filteredOptions.map(job => (
                        <button
                            key={job}
                            onClick={() => toggle(job)}
                            className={`p-3 rounded-xl text-start font-bold border transition-all flex justify-between items-center ${selected.includes(job)
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                                }`}
                        >
                            {getOccupationName(job)}
                            {selected.includes(job) && <Check className="w-4 h-4" />}
                        </button>
                    ))}
                </div>
                <div className="p-4 border-t">
                    <Button onClick={() => onConfirm(selected)} className="w-full justify-center">
                        {t('occupations.confirmSelection')}
                    </Button>
                </div>
            </div>
        </div>
    );
};
