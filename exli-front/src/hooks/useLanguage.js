import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Custom hook for managing language preferences with Firebase sync.
 * Handles RTL/LTR switching automatically based on selected language.
 * 
 * @param {string} userId - The Firebase user ID (optional - guest mode support)
 * @returns {{ language: string, setLanguage: Function, isRTL: boolean }}
 */
export const useLanguage = (userId) => {
    const { i18n } = useTranslation();

    // 1. Handle Direction (RTL vs LTR) automatically when language changes
    useEffect(() => {
        const dir = i18n.dir(i18n.language);
        document.documentElement.dir = dir;
        document.documentElement.lang = i18n.language;

        // Add class for CSS targeting if needed
        document.documentElement.classList.remove('ltr', 'rtl');
        document.documentElement.classList.add(dir);
    }, [i18n.language, i18n]);

    // 2. Sync with Firebase on Login - Load saved preference
    useEffect(() => {
        const loadPreference = async () => {
            if (userId) {
                try {
                    const ref = doc(db, 'users', userId);
                    const snap = await getDoc(ref);
                    if (snap.exists() && snap.data().language) {
                        const savedLang = snap.data().language;
                        if (savedLang !== i18n.language) {
                            await i18n.changeLanguage(savedLang);
                        }
                    }
                } catch (e) {
                    console.error('Error loading language preference:', e);
                }
            }
        };
        loadPreference();
    }, [userId, i18n]);

    // 3. Action to change language and persist to Firebase
    const setLanguage = useCallback(async (lng) => {
        await i18n.changeLanguage(lng);

        if (userId) {
            try {
                await updateDoc(doc(db, 'users', userId), { language: lng });
            } catch (e) {
                console.error('Error saving language preference:', e);
            }
        }
    }, [userId, i18n]);

    return {
        language: i18n.language,
        setLanguage,
        isRTL: i18n.dir(i18n.language) === 'rtl'
    };
};

export default useLanguage;
