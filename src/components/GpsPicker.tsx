import React, { useState } from 'react';
import { MapPin, Navigation, ExternalLink, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { buildGoogleMapsUrl } from '../utils/formatters';

interface GpsPickerProps {
  latitude: string;
  longitude: string;
  accuracy?: number;
  onCoordinatesChange: (lat: string, lng: string, accuracy?: number) => void;
}

export const GpsPicker: React.FC<GpsPickerProps> = ({
  latitude,
  longitude,
  accuracy,
  onCoordinatesChange
}) => {
  const [isLocating, setIsLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Browser atau perangkat ini tidak mendukung sensor GPS broo.');
      return;
    }

    setIsLocating(true);
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        const acc = Math.round(position.coords.accuracy);

        onCoordinatesChange(lat, lng, acc);
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        let msg = 'Gagal mengambil titik koordinat GPS.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Izin lokasi ditolak. Harap izinkan akses lokasi (GPS) pada browser/HP kamu broo.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Waktu permintaan GPS habis. Pastikan sinyal GPS aktif broo.';
        }
        setErrorMessage(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10000
      }
    );
  };

  const hasCoordinates = Boolean(latitude && longitude);
  const googleMapsUrl = buildGoogleMapsUrl(latitude, longitude);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-700" />
            <span>11. Koordinat GPS Toko (Otomatis GPS HP / TAB KAMU BROO)</span>
          </label>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Tekan &quot;Ambil Titik GPS Sekarang&quot; saat berada di depan lokasi toko outlet baru broo
          </p>
        </div>

        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={isLocating}
          className="self-start sm:self-auto px-3.5 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg flex items-center gap-1.5 shadow-2xs transition-all disabled:opacity-60 shrink-0"
        >
          {isLocating ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Mencari Satelit PALAPA...</span>
            </>
          ) : (
            <>
              <Navigation className="w-3.5 h-3.5" />
              <span>Ambil Titik GPS</span>
            </>
          )}
        </button>
      </div>

      {errorMessage && (
        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Inputs grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Latitude (Garis Lintang)
          </label>
          <input
            type="text"
            value={latitude}
            onChange={(e) => onCoordinatesChange(e.target.value, longitude, accuracy)}
            placeholder="Contoh: -6.721245"
            className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-300 rounded-lg focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Longitude (Garis Bujur)
          </label>
          <input
            type="text"
            value={longitude}
            onChange={(e) => onCoordinatesChange(latitude, e.target.value, accuracy)}
            placeholder="Contoh: 108.541289"
            className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-300 rounded-lg focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
          />
        </div>
      </div>

      {/* GPS Status feedback & Google Maps verification link */}
      {hasCoordinates && (
        <div className="mt-3 pt-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>Koordinat Terkunci: {latitude}, {longitude}</span>
            {accuracy !== undefined && (
              <span className="text-[11px] text-slate-500 font-normal">
                (Akurasi ±{accuracy} m)
              </span>
            )}
          </div>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-semibold hover:underline"
          >
            <span>Buka di Google Maps</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
};
