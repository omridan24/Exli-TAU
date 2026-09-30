/**
 * Group types — see docs/groups/02-phase2-ui-and-splits-plan.md §2.
 * Names/descriptions come from i18n (`groups.types.<id>.*`), never hardcoded here,
 * per I18N_RULES.md. This file only holds the id/icon/color/maxMembers, mirroring
 * exli-backend/services/split_catalog.py's GROUP_TYPES.
 */
import { Heart, Home, Plane, Users, Sparkles } from 'lucide-react';

export const GROUP_TYPES = [
  { id: 'partner', icon: Heart, color: 'pink', maxMembers: 2 },
  { id: 'household', icon: Home, color: 'amber', maxMembers: null },
  { id: 'trip', icon: Plane, color: 'sky', maxMembers: null },
  { id: 'friends', icon: Users, color: 'emerald', maxMembers: null },
  { id: 'other', icon: Sparkles, color: 'slate', maxMembers: null },
];

export const getGroupType = (id) => GROUP_TYPES.find((t) => t.id === id) || GROUP_TYPES[GROUP_TYPES.length - 1];

// Tailwind class maps for each type color, matching the dashboard card style
// (bg-*-100 tile + text-*-600 icon, e.g. App.jsx's existing module cards).
export const GROUP_TYPE_COLOR_CLASSES = {
  pink: { bgLight: 'bg-pink-100', text: 'text-pink-600', bgGradient: 'bg-gradient-to-br from-pink-500 to-pink-400' },
  amber: { bgLight: 'bg-amber-100', text: 'text-amber-600', bgGradient: 'bg-gradient-to-br from-amber-500 to-amber-400' },
  sky: { bgLight: 'bg-sky-100', text: 'text-sky-600', bgGradient: 'bg-gradient-to-br from-sky-500 to-sky-400' },
  emerald: { bgLight: 'bg-emerald-100', text: 'text-emerald-600', bgGradient: 'bg-gradient-to-br from-emerald-500 to-emerald-400' },
  slate: { bgLight: 'bg-slate-100', text: 'text-slate-600', bgGradient: 'bg-gradient-to-br from-slate-500 to-slate-400' },
};
