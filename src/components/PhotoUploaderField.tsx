import React, { useState } from 'react';
import { Camera, Image as ImageIcon, CheckCircle2, AlertTriangle, Eye, Trash2, X } from 'lucide-react';

interface PhotoUploaderFieldProps {
  label: string;
  fieldNumber: number; // 12, 13, 14, 15, 16
  description: string;
  photoUrl: string;
  onOpenLiveCamera: () => void;
  onFileSelected: (dataUrl: string) => void;
  onRemovePhoto: () => void;
  isRequired?: boolean;
}

export const PhotoUploaderField: React.FC<PhotoUploaderFieldProps> = ({
  label,
  fieldNumber,
  description,
  photoUrl,
  onOpenLiveCamera,
  onFileSelected,
  onRemovePhoto,
  isRequired = true
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleNativeFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress photo efficiently so up to 30 stores sync fast & reliably
        const canvas = document.createElement('canvas');
        const maxDim = 960;
        let w = img.width;
        let h = img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
          onFileSelected(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`relative border rounded-xl p-3.5 transition-all ${
      photoUrl 
        ? 'bg-emerald-50/40 border-emerald-300' 
        : 'bg-white border-slate-200 hover:border-slate-300'
    }`}>
      {/* Header with Title & Requirement Badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
            {fieldNumber}
          </span>
          <div>
            <h4 className="text-xs font-bold text-slate-900 leading-tight">
              {label}
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              {description}
            </p>
          </div>
        </div>

        {photoUrl ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Terlampir
          </span>
        ) : isRequired ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
            <AlertTriangle className="w-3 h-3 text-red-600" />
            Wajib Diisi
          </span>
        ) : null}
      </div>

      {/* Content: Photo Preview or Action Buttons */}
      {photoUrl ? (
        <div className="mt-2 flex items-center gap-3 bg-white p-2 border border-slate-200 rounded-lg">
          <div 
            onClick={() => setIsPreviewOpen(true)}
            className="relative w-20 h-16 sm:w-24 sm:h-18 rounded-md overflow-hidden bg-slate-100 border border-slate-200 shrink-0 cursor-pointer group"
          >
            <img 
              src={photoUrl} 
              alt={label} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
              <Eye className="w-4 h-4" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">
              {label}
            </p>
            <p className="text-[11px] text-emerald-700 font-medium">
              Foto terekam dengan timestamp
            </p>
            
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="text-[11px] text-slate-700 hover:text-slate-900 font-medium flex items-center gap-1 underline underline-offset-2"
              >
                <Eye className="w-3 h-3" />
                Lihat
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={onOpenLiveCamera}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1"
              >
                <Camera className="w-3 h-3" />
                Foto Ulang
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={onRemovePhoto}
                className="text-[11px] text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Hapus
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {/* Main button: Live Camera */}
          <button
            type="button"
            onClick={onOpenLiveCamera}
            className="flex-1 min-w-[140px] px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-[0.98]"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Kamera HP Langsung</span>
          </button>

          {/* Secondary fallback button: Native Camera / File picker */}
          <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
            <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>Galeri</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleNativeFileInput}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Fullscreen Preview Modal */}
      {isPreviewOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div 
            className="relative max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-slate-800 flex items-center justify-between text-white border-b border-slate-700">
              <span className="text-xs font-bold">{label}</span>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 bg-black flex items-center justify-center max-h-[75vh]">
              <img 
                src={photoUrl} 
                alt={label} 
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg" 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
