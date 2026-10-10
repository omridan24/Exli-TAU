import React, { useRef } from 'react';
import { User, Calendar, ChevronRight, Plus, Trash2, Globe, MapPin, GraduationCap, Receipt, Wallet, CreditCard, CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/UI';
import { LogoImage } from './LogoImage';
import { ISRAEL_TAX_CREDIT_PRESETS } from '../../../config/taxBrackets';
import { TaxCreditCalculator } from './TaxCreditCalculator';

export const ProfileTab = ({
    profile,
    onUpdateProfile,
    handleSaveProfile,
    onOpenModal,
    onOpenWorkplacePicker,
    onOpenDatePicker
}) => {
    const { t } = useTranslation();
    const nameOnFocus = useRef('');

    const handlePaydayChange = (val) => {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num >= 1 && num <= 31) {
            onUpdateProfile('monthlyPayday', num);
            if (handleSaveProfile) {
                handleSaveProfile({ ...profile, monthlyPayday: num });
            }
        }
    };

    const handleChargeDayChange = (val) => {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num >= 1 && num <= 31) {
            onUpdateProfile('monthlyChargeDay', num);
            if (handleSaveProfile) {
                handleSaveProfile({ ...profile, monthlyChargeDay: num });
            }
        }
    };

    return (
        <div className="space-y-6">
            <Card className="p-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-8 flex items-center gap-2">
                    <User className="text-emerald-500" /> {t('settings.profile.identity')}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                                {t('settings.profile.fullName')}
                            </label>
                            <input
                                type="text"
                                value={profile.name}
                                onChange={e => onUpdateProfile('name', e.target.value)}
                                onFocus={e => { nameOnFocus.current = e.target.value; }}
                                onBlur={e => { if (e.target.value !== nameOnFocus.current) handleSaveProfile({ ...profile, name: e.target.value }); }}
                                className="w-full p-3 border rounded-xl font-bold outline-none focus:border-emerald-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                                {t('settings.profile.birthdate')}
                            </label>
                            <button
                                onClick={onOpenDatePicker}
                                className="w-full p-4 border rounded-2xl flex justify-between items-center font-bold hover:bg-slate-50 transition-all"
                            >
                                {profile.birthdate || <span className="text-slate-400">{t('settings.profile.select', 'Select...')}</span>}
                                <Calendar className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <div onClick={() => onOpenModal('status')} className="cursor-pointer">
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                                {t('settings.profile.familyStatus')}
                            </label>
                            <div className="w-full p-4 border rounded-xl bg-white font-bold flex justify-between items-center">
                                {profile.status || t('settings.profile.select')}
                                <ChevronRight className="w-4 h-4 text-slate-300" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                            {t('settings.profile.workCareer')}
                        </label>
                        <button
                            onClick={() => onOpenModal('occupation')}
                            className="w-full p-4 border-2 border-dashed rounded-2xl text-slate-400 font-bold hover:border-emerald-400 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus /> {t('settings.profile.addTitle')}
                        </button>
                        <div className="space-y-3">
                            {profile.workplaces.map((w, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-white border rounded-2xl shadow-sm group">
                                    <div className="flex items-center gap-3">
                                        <LogoImage logo={w.logo} domain={w.domain} />
                                        <div>
                                            <div className="text-sm font-black text-slate-700">{w.name}</div>
                                            <div className="text-[10px] text-emerald-600 font-bold uppercase">{w.linkedOccupation}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleSaveProfile({ ...profile, workplaces: profile.workplaces.filter((_, idx) => idx !== i) })}
                                        className="p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 border-t pt-8">
                    <div onClick={() => onOpenModal('country')} className="cursor-pointer group">
                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                            {t('settings.profile.country')}
                        </label>
                        <div className="w-full p-4 border rounded-xl bg-white font-bold group-hover:border-emerald-50 flex justify-between items-center transition-all">
                            {profile.country || t('settings.profile.select')}
                            <Globe className="text-slate-300" />
                        </div>
                    </div>
                    <div
                        onClick={() => onOpenModal('city')}
                        className={`cursor-pointer group ${!profile.country && 'opacity-50 pointer-events-none'}`}
                    >
                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                            {t('settings.profile.city')}
                        </label>
                        <div className="w-full p-4 border rounded-xl bg-white font-bold group-hover:border-emerald-50 flex justify-between items-center transition-all">
                            {profile.city || t('settings.profile.select')}
                            <MapPin className="text-slate-300" />
                        </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 md:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <GraduationCap className={profile.isStudent ? 'text-blue-500' : 'text-slate-300'} />
                                <label htmlFor="isStudent" className="font-bold text-slate-700 cursor-pointer">
                                    {t('settings.profile.iAmStudent')}
                                </label>
                            </div>
                            <input
                                type="checkbox"
                                id="isStudent"
                                checked={profile.isStudent}
                                onChange={e => handleSaveProfile({ ...profile, isStudent: e.target.checked })}
                                className="w-5 h-5 rounded text-emerald-600"
                            />
                        </div>
                        {profile.isStudent && (
                            <div
                                onClick={() => onOpenModal('university')}
                                className="cursor-pointer p-4 bg-white border rounded-xl font-bold flex justify-between items-center"
                            >
                                {profile.university || t('settings.profile.selectUniversity')}
                                <ChevronRight className="text-slate-300" />
                            </div>
                        )}
                    </div>

                    {/* Tax Credit Points - Israel Only */}
                    {profile.country === 'Israel' && (
                        <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-2xl border-2 border-orange-200 md:col-span-2">
                            <div className="flex items-center gap-3 mb-6">
                                <Receipt className="w-8 h-8 text-orange-600" />
                                <div>
                                    <h3 className="font-bold text-2xl text-orange-900">
                                        {t('settings.taxCredit.title')}
                                    </h3>
                                    <p className="text-sm text-orange-700">
                                        {t('settings.taxCredit.description')}
                                    </p>
                                </div>
                            </div>

                            <TaxCreditCalculator
                                data={profile.taxCreditData || {}}
                                onUpdate={(points, data) => {
                                    onUpdateProfile('taxCreditPoints', points);
                                    onUpdateProfile('taxCreditData', data);
                                }}
                            />
                        </div>
                    )}
                </div>
            </Card>

            {/* Monthly Financial Dates Card */}
            <Card className="p-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                        <CalendarClock className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
                            {t('settings.profile.financialDates', 'Monthly Financial Dates')}
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500">
                            {t('settings.profile.financialDatesDesc', 'Set your regular monthly payday and credit card billing day to align your cashflow cycles.')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    {/* Monthly Payday */}
                    <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200/80 hover:border-emerald-200 transition-all flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2.5 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
                                    <Wallet className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-slate-800">
                                        {t('settings.profile.monthlyPayday', 'Monthly Payday')}
                                    </h3>
                                    <p className="text-[11px] text-slate-400">
                                        {t('settings.profile.monthlyPaydayDesc', 'Day of the month you receive your salary')}
                                    </p>
                                </div>
                            </div>

                            {/* Dropdown Selector */}
                            <div className="mt-4">
                                <label className="text-[11px] font-bold text-slate-400 uppercase mb-1.5 block">
                                    {t('settings.profile.selectDay', 'Day of month (1-31)')}
                                </label>
                                <select
                                    value={profile.monthlyPayday || 10}
                                    onChange={(e) => handlePaydayChange(e.target.value)}
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer text-sm"
                                >
                                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                        <option key={day} value={day}>
                                            {t('settings.profile.dayOfMonth', { day, defaultValue: `Day ${day} of the month` })}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Common Presets */}
                            <div className="mt-3">
                                <span className="text-[10px] font-semibold text-slate-400 block mb-1.5">
                                    {t('settings.profile.quickSelect', 'Quick select:')}
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {[1, 9, 10, 15, 31].map((preset) => {
                                        const isSelected = (profile.monthlyPayday || 10) === preset;
                                        return (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => handlePaydayChange(preset)}
                                                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                                                    isSelected
                                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40'
                                                }`}
                                            >
                                                {preset === 31 ? t('settings.profile.lastDay', '31 (End)') : `${preset}`}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Monthly Charge Day */}
                    <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200/80 hover:border-blue-200 transition-all flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2.5 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-100/70 text-blue-700 flex items-center justify-center shrink-0">
                                    <CreditCard className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-slate-800">
                                        {t('settings.profile.monthlyChargeDay', 'Monthly Charge Day')}
                                    </h3>
                                    <p className="text-[11px] text-slate-400">
                                        {t('settings.profile.monthlyChargeDayDesc', 'Day of the month your credit card or bank charges occur')}
                                    </p>
                                </div>
                            </div>

                            {/* Dropdown Selector */}
                            <div className="mt-4">
                                <label className="text-[11px] font-bold text-slate-400 uppercase mb-1.5 block">
                                    {t('settings.profile.selectDay', 'Day of month (1-31)')}
                                </label>
                                <select
                                    value={profile.monthlyChargeDay || 10}
                                    onChange={(e) => handleChargeDayChange(e.target.value)}
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer text-sm"
                                >
                                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                        <option key={day} value={day}>
                                            {t('settings.profile.dayOfMonth', { day, defaultValue: `Day ${day} of the month` })}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Common Presets */}
                            <div className="mt-3">
                                <span className="text-[10px] font-semibold text-slate-400 block mb-1.5">
                                    {t('settings.profile.quickSelect', 'Quick select:')}
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {[1, 2, 10, 15, 20].map((preset) => {
                                        const isSelected = (profile.monthlyChargeDay || 10) === preset;
                                        return (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => handleChargeDayChange(preset)}
                                                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                                                    isSelected
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                                                }`}
                                            >
                                                {`${preset}`}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};
