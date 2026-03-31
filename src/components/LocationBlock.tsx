import { MapPin, ExternalLink } from 'lucide-react';

interface LocationBlockProps {
  company: {
    name?: string;
    address?: string;
    address_number?: string;
    district?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    google_maps_url?: string;
  };
  isDark?: boolean;
}

export const buildFullAddress = (company: LocationBlockProps['company']) => {
  const line1 = [company.address, company.address_number].filter(Boolean).join(', ');
  const line1WithDistrict = [line1, company.district].filter(Boolean).join(' - ');
  const line2 = [company.city, company.state].filter(Boolean).join(' - ');
  return { line1: line1WithDistrict, line2, full: [line1WithDistrict, line2].filter(Boolean).join(', ') };
};

export const buildMapsUrl = (company: LocationBlockProps['company']) => {
  if (company.google_maps_url) return company.google_maps_url;
  const parts = [company.address, company.address_number, company.district, company.city].filter(Boolean).join(', ');
  return parts ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}` : null;
};

export function LocationBlock({ company, isDark = true }: LocationBlockProps) {
  const addr = buildFullAddress(company);
  const mapsUrl = buildMapsUrl(company);

  if (!addr.line1 && !addr.line2) return null;

  const T = isDark
    ? { card: '#111827', text: '#FFFFFF', textSec: '#9CA3AF', border: '#1F2937', accent: '#F59E0B' }
    : { card: '#FFFFFF', text: '#1F2937', textSec: '#6B7280', border: '#E5E7EB', accent: '#D97706' };

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5" style={{ color: '#EF4444' }} />
        <h2 className="text-lg font-bold" style={{ color: T.text }}>Localização</h2>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
        <div className="p-4" style={{ background: T.card }}>
          <p className="text-sm font-medium" style={{ color: T.text }}>📍 {company.name}</p>
          {addr.line1 && (
            <p className="text-xs mt-1" style={{ color: T.textSec }}>{addr.line1}</p>
          )}
          {addr.line2 && (
            <p className="text-xs mt-0.5" style={{ color: T.textSec }}>{addr.line2}</p>
          )}
          {company.postal_code && (
            <p className="text-xs mt-0.5" style={{ color: T.textSec }}>CEP: {company.postal_code}</p>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-xs font-medium"
              style={{ color: T.accent }}
            >
              <ExternalLink className="w-3 h-3" />
              Ver no mapa
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
