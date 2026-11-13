import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onPhotoCaptured: (dataUrl: string) => void;
  metadataStoreName?: string;
  metadataGps?: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  title,
  onPhotoCaptured,
  metadataStoreName,
  metadataGps
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);

  // Start video stream when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startCamera = async () => {
    setIsLoadingCamera(true);
    setErrorMsg(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser tidak mendukung akses kamera langsung WebRTC.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: unknown) {
      console.warn('Camera stream error:', err);
      const message = err instanceof Error ? err.message : 'Kamera tidak dapat diakses.';
      setErrorMsg(`${message} Anda tetap dapat menggunakan tombol "Pilih / Kamera HP" di bawah.`);
    } finally {
      setIsLoadingCamera(false);
    }
  };

  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    const rawW = video.videoWidth || 1280;
    const rawH = video.videoHeight || 960;
    const maxDim = 960;
    let w = rawW;
    let h = rawH;
    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Add professional watermark stamp (Date, Store Name, GPS)
    const now = new Date();
    const dateStr = now.toLocaleString('id-ID');
    const storeLabel = metadataStoreName ? `Toko: ${metadataStoreName}` : 'Sinar Kentjana NOO';
    const gpsLabel = metadataGps ? `GPS: ${metadataGps}` : 'Koordinat Toko';

    // Bottom dark gradient strip for text legibility
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, canvas.height - 44, canvas.width, 44);

    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${storeLabel} • ${dateStr}`, 14, canvas.height - 24);

    ctx.font = '11px monospace';
    ctx.fillStyle = '#34d399'; // emerald accent
    ctx.fillText(`${gpsLabel} • Verifikasi Lapangan`, 14, canvas.height - 8);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.74);
    onPhotoCaptured(dataUrl);
    onClose();
  };

  // Fallback native file capture (works on all mobile devices with native camera trigger)
  const handleFallbackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress image via canvas
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

          // Add watermark stamp
          const now = new Date();
          const dateStr = now.toLocaleString('id-ID');
          const storeLabel = metadataStoreName ? `Toko: ${metadataStoreName}` : 'Sinar Kentjana NOO';
          const gpsLabel = metadataGps ? `GPS: ${metadataGps}` : 'Koordinat Toko';

          ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
          ctx.fillRect(0, canvas.height - 44, canvas.width, 44);

          ctx.font = 'bold 13px sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`${storeLabel} • ${dateStr}`, 14, canvas.height - 24);

          ctx.font = '11px monospace';
          ctx.fillStyle = '#34d399';
          ctx.fillText(`${gpsLabel} • Terverifikasi`, 14, canvas.height - 8);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.74);
          onPhotoCaptured(dataUrl);
          onClose();
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold truncate">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewfinder Area */}
        <div className="relative bg-black flex-1 flex items-center justify-center min-h-[300px] sm:min-h-[380px] overflow-hidden">
          {errorMsg ? (
            <div className="p-6 text-center text-slate-300 max-w-md">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="text-xs text-amber-300 mb-4 font-medium">{errorMsg}</p>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-md transition-all">
                <Camera className="w-4 h-4" />
                <span>Buka Kamera HP Langsung</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFallbackFile}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover max-h-[460px]"
              />

              {/* Viewfinder Target Framing Guide */}
              <div className="absolute inset-6 border border-white/30 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                <div className="flex justify-between">
                  <div className="w-4 h-4 border-t-2 border-l-2 border-emerald-400"></div>
                  <div className="w-4 h-4 border-t-2 border-r-2 border-emerald-400"></div>
                </div>
                <div className="text-center text-[11px] text-white/80 bg-black/40 backdrop-blur-xs py-1 px-3 rounded-full mx-auto font-medium">
                  Posisikan objek dengan pencahayaan jelas
                </div>
                <div className="flex justify-between">
                  <div className="w-4 h-4 border-b-2 border-l-2 border-emerald-400"></div>
                  <div className="w-4 h-4 border-b-2 border-r-2 border-emerald-400"></div>
                </div>
              </div>

              {/* Flip camera button */}
              <button
                onClick={handleFlipCamera}
                title="Putar Kamera"
                className="absolute top-3 right-3 p-2.5 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white border border-white/20 backdrop-blur-xs transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </>
          )}

          {isLoadingCamera && (
            <div className="absolute inset-0 bg-slate-950 flex items-center justify-center text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Menginisialisasi Kamera...</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Controls Bottom Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
          <label className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer flex items-center gap-1.5 transition-colors">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Pilih dari Galeri / Dokumen</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFallbackFile}
              className="hidden"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Batal
            </button>

            {!errorMsg && (
              <button
                onClick={capturePhoto}
                disabled={isLoadingCamera}
                className="px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                <span>Ambil Foto</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
