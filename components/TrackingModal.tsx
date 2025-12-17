import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

interface TrackingModalProps {
    isOpen: boolean;
    onClose: () => void;
    trackingNo: string;
}

const TrackingModal: React.FC<TrackingModalProps> = ({ isOpen, onClose, trackingNo }) => {
    const [copiedTrack, setCopiedTrack] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedTrack(text);
        setTimeout(() => setCopiedTrack(null), 2000);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-4 py-3 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-semibold text-gray-700">Tracking Numbers</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-2">
                        {trackingNo.split(',').map((track, idx) => {
                            const cleanTrack = track.trim();
                            const isCopied = copiedTrack === cleanTrack;
                            return (
                                <div
                                    key={idx}
                                    className={`p-3 border rounded-lg cursor-pointer flex items-center justify-between group transition-all duration-200
                                                    ${isCopied
                                            ? 'bg-green-50 border-green-200'
                                            : 'bg-gray-50 hover:bg-blue-50 border-gray-100 hover:border-blue-200'
                                        }`}
                                    onClick={() => handleCopy(cleanTrack)}
                                >
                                    <span className={`font-mono font-medium ${isCopied ? 'text-green-700' : 'text-gray-700'}`}>
                                        {cleanTrack}
                                    </span>
                                    <div className="flex items-center gap-2 text-xs">
                                        {isCopied ? (
                                            <>
                                                <span className="text-green-600 font-medium">Copied!</span>
                                                <Check className="w-4 h-4 text-green-600" />
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-2 text-gray-400 group-hover:text-blue-600">
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity">Copy</span>
                                                <Copy className="w-4 h-4" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="px-4 py-3 bg-gray-50 text-xs text-center text-gray-400 border-t">
                    Click any tracking number to copy
                </div>
            </div>
        </div>
    );
};

export default TrackingModal;
