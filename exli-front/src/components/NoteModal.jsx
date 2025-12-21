import React, { useState } from 'react';
import { X, Type } from 'lucide-react';

export const NoteModal = ({ isOpen, onClose, onSave, currentNote = '' }) => {
    const [note, setNote] = useState(currentNote);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(note);
        setNote('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[130] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-6 border-b flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Type className="w-5 h-5 text-purple-500" />
                        <h3 className="font-bold text-slate-800">Add Note</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
                <div className="p-6">
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Enter your note here..."
                        className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-purple-400 transition-colors resize-none h-32"
                        autoFocus
                    />
                    <div className="text-xs text-slate-400 mt-2">{note.length} characters</div>
                </div>
                <div className="p-6 pt-0 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!note.trim()}
                        className="px-4 py-2 rounded-xl font-bold bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Save Note
                    </button>
                </div>
            </div>
        </div>
    );
};
