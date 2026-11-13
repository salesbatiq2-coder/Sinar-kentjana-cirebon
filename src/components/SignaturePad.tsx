import React, { useRef, useEffect, useState } from 'react';
import { RotateCcw, Check, PenTool } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  subLabel?: string;
  nameValue: string;
  onNameChange?: (name: string) => void;
  namePlaceholder?: string;
  signatureDataUrl: string;
  onSignatureChange: (dataUrl: string) => void;
  headerPrefixText?: string; // e.g. "Cirebon, tanggal 29 bulan Oktober tahun 2026"
  readOnly?: boolean;
  canvasHeightClass?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  subLabel,
  nameValue,
  onNameChange,
  namePlaceholder = 'Nama Lengkap...',
  signatureDataUrl,
  onSignatureChange,
  headerPrefixText,
  readOnly = false,
  canvasHeightClass = 'h-[50vh] min-h-[360px] sm:h-[420px] md:h-[460px]'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [hasContent, setHasContent] = useState(Boolean(signatureDataUrl));
  const currentDataUrlRef = useRef<string>(signatureDataUrl || '');

  // Helper to draw an image onto canvas
  const drawImageOnCanvas = (dataUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    if (!dataUrl) {
      ctx.clearRect(0, 0, w, h);
      setHasContent(false);
      return;
    }

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      setHasContent(true);
    };
    img.src = dataUrl;
  };

  // Setup canvas resolution and DPI
  const setupCanvasSize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);

    // If dimensions already match, do not clear
    if (canvas.width === targetW && canvas.height === targetH) {
      return;
    }

    // Preserve existing drawing before resizing
    const prevData = currentDataUrlRef.current;

    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.lineWidth = 3.2; // Smooth and clear stroke for fingers & stylus pen
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e3a8a'; // Professional dark blue ink

    // Restore signature
    if (prevData) {
      drawImageOnCanvas(prevData);
    }
  };

  // Mount effect & ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initial setup with double-RAF to guarantee modal layout has stabilized
    requestAnimationFrame(() => {
      setupCanvasSize();
      if (signatureDataUrl) {
        drawImageOnCanvas(signatureDataUrl);
      }
    });

    let prevWidth = 0;
    let prevHeight = 0;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          // Only resize if change is significant (> 10px) to prevent sub-pixel jitter
          if (Math.abs(width - prevWidth) > 10 || Math.abs(height - prevHeight) > 10) {
            prevWidth = width;
            prevHeight = height;
            if (!isDrawingRef.current) {
              setupCanvasSize();
            }
          }
        }
      }
    });

    observer.observe(canvas);

    return () => {
      observer.disconnect();
    };
  }, []);

  // When signatureDataUrl prop changes from outside (e.g. form reset or record switch)
  useEffect(() => {
    if (signatureDataUrl !== currentDataUrlRef.current) {
      currentDataUrlRef.current = signatureDataUrl || '';
      drawImageOnCanvas(signatureDataUrl);
    }
  }, [signatureDataUrl]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    e.preventDefault();
    e.stopPropagation();

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    isDrawingRef.current = true;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e3a8a';

    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    e.preventDefault();
    e.stopPropagation();

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasContent(true);
  };

  const exportCompactSignature = (canvas: HTMLCanvasElement): string => {
    const maxW = 600;
    if (canvas.width <= maxW) {
      return canvas.toDataURL('image/png');
    }
    const scale = maxW / canvas.width;
    const out = document.createElement('canvas');
    out.width = maxW;
    out.height = Math.round(canvas.height * scale);
    const octx = out.getContext('2d');
    if (octx) {
      octx.drawImage(canvas, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    }
    return canvas.toDataURL('image/png');
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || readOnly) return;
    e.preventDefault();
    e.stopPropagation();

    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const data = exportCompactSignature(canvas);
    currentDataUrlRef.current = data;
    setHasContent(true);
    onSignatureChange(data);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }

    setHasContent(false);
    currentDataUrlRef.current = '';
    onSignatureChange('');
  };

  return (
    <div className="bg-slate-50/90 border-2 border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between h-full shadow-xs hover:border-slate-300 transition-all">
      <div>
        {/* Header label & Pengesahan clause */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 inline-flex">
                <PenTool className="w-4 h-4" />
              </span>
              {label}
            </h4>
            {subLabel && <p className="text-xs text-slate-500 mt-1 font-medium">{subLabel}</p>}
          </div>
          {hasContent ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full border border-emerald-300 shadow-2xs">
              <Check className="w-3.5 h-3.5" />
              Sudah Ditandatangani
            </span>
          ) : (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              Wajib Ditandatangani
            </span>
          )}
        </div>

        {/* Official text above signature (especially for Leader) */}
        {headerPrefixText && (
          <div className="mb-3 p-2.5 bg-amber-50 border border-amber-300/80 rounded-xl text-xs font-bold text-amber-950 text-center tracking-tight shadow-2xs">
            {headerPrefixText}
          </div>
        )}

        {/* Canvas pad - Enlarged for spacious comfortable signing on all devices */}
        <div className="relative border-2 border-slate-300 rounded-xl overflow-hidden bg-white shadow-inner">
          <canvas
            ref={canvasRef}
            className={`signature-canvas w-full ${canvasHeightClass} block touch-none cursor-crosshair`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />

          {/* Dotted baseline guide at lower portion of canvas */}
          <div className="absolute left-6 right-6 bottom-10 pointer-events-none border-b-2 border-dashed border-slate-200 flex items-center justify-between text-[11px] text-slate-400 select-none pb-1">
            <span className="font-mono text-slate-400">Tanda Tangan di atas garis ini ✕</span>
            <span className="hidden sm:inline text-[10px] text-slate-300">Format Digital Sinar Kentjana</span>
          </div>

          {!hasContent && !readOnly && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400 select-none space-y-2 p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <PenTool className="w-6 h-6 text-slate-400" />
              </div>
              <span className="text-sm font-bold text-slate-700">Area Tanda Tangan Digital</span>
              <span className="text-xs text-slate-500 max-w-xs">Goreskan tanda tangan langsung dengan jari tangan atau stylus pen pada layar</span>
            </div>
          )}
          {readOnly && !hasContent && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-slate-400 select-none italic">
              Menunggu tanda tangan dari pihak yang bersangkutan
            </div>
          )}
        </div>
      </div>

      {/* Footer tool & printed name */}
      <div className="mt-4 pt-3 border-t border-slate-200 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Nama Terang Penandatangan:
            </label>
            {onNameChange && !readOnly ? (
              <input
                type="text"
                value={nameValue}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder={namePlaceholder}
                className="w-full text-xs font-semibold px-3 py-2 bg-white border border-slate-300 rounded-lg focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none"
              />
            ) : (
              <div className="text-xs font-bold text-slate-900 bg-white px-3 py-2 border border-slate-200 rounded-lg">
                ( {nameValue || '_____________________'} )
              </div>
            )}
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={handleClear}
              title="Hapus dan ulangi tanda tangan"
              className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-red-700 bg-white hover:bg-red-50 border border-slate-300 hover:border-red-300 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-2xs shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500 hover:text-red-600" />
              <span>Hapus & Ulangi</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
