import { useEffect, useState } from 'react';
import { getStandards } from '../api';
import type { CountryItem, StandardsData } from '../types';
import { circuitSummaries, roomRuleSummaries, summarizeStandards } from '../standardsSummary';

const FLAG: Record<string, string> = {
  LV: '\u{1F1F1}\u{1F1FB}',
  LT: '\u{1F1F1}\u{1F1F9}',
  EE: '\u{1F1EA}\u{1F1EA}',
};

// Standards are static reference data — cache per country for the page session
const cache = new Map<string, StandardsData>();

interface StandardSelectorProps {
  countries: CountryItem[];
  value: string;
  onChange?: (code: string) => void;
  standards?: StandardsData | null;
  onStandardsLoaded?: (code: string, standards: StandardsData) => void;
  showCountrySelect?: boolean;
}

export function StandardSelector({
  countries,
  value,
  onChange,
  standards,
  onStandardsLoaded,
  showCountrySelect = true,
}: StandardSelectorProps) {
  const external = standards && standards.country_code === value ? standards : null;
  const [loaded, setLoaded] = useState<StandardsData | null>(
    () => external || cache.get(value) || null,
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (external) {
      setLoaded(external);
      setLoadError('');
      return;
    }
    const cached = cache.get(value);
    if (cached) {
      setLoaded(cached);
      setLoadError('');
      onStandardsLoaded?.(value, cached);
      return;
    }
    let cancelled = false;
    setLoaded(null);
    setLoading(true);
    setLoadError('');
    getStandards(value)
      .then((std) => {
        cache.set(value, std);
        if (cancelled) return;
        setLoaded(std);
        onStandardsLoaded?.(value, std);
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded(null);
        setLoadError('Standards unavailable — defaults will be used.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [value, external]);

  const summary = summarizeStandards(loaded, value);
  const rooms = roomRuleSummaries(loaded);
  const circuits = circuitSummaries(loaded);

  return (
    <>
      {showCountrySelect && (
        <label className="form-field">
          <span>Country</span>
          <select value={value} onChange={(e) => onChange?.(e.target.value)} aria-label="Country">
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.country}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="std-panel">
        <button
          type="button"
          className="std-toggle"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="std-flag">{FLAG[value] || '🌍'}</span>
          <span className="std-name">
            {loading ? 'Loading standards…' : loadError ? summary.country : summary.standard}
          </span>
          <span className="std-caret">{open ? '▲' : '▼'}</span>
        </button>

        {loadError && <p className="muted sm std-error">{loadError}</p>}

        {open && loading && (
          <div className="std-details">
            <p className="muted sm">Loading standards…</p>
          </div>
        )}

        {open && !loading && !loadError && (
          <div className="std-details">
            <ul className="std-facts">
              <li>
                <span>Country</span>
                <strong>{summary.country}</strong>
              </li>
              <li>
                <span>Standard</span>
                <strong>{summary.standard}</strong>
              </li>
              <li>
                <span>Voltage</span>
                <strong>{summary.voltage}</strong>
              </li>
              <li>
                <span>Frequency</span>
                <strong>{summary.frequency}</strong>
              </li>
              <li>
                <span>Socket type</span>
                <strong>{summary.socketType}</strong>
              </li>
            </ul>

            {rooms.length > 0 && (
              <>
                <h4 className="std-subtitle">Minimum sockets per room</h4>
                <ul className="std-rooms">
                  {rooms.map((r) => (
                    <li key={r.key} title={r.notes || undefined}>
                      <span>{r.label}</span>
                      <strong>{r.minimumSockets ?? '—'}</strong>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {circuits.length > 0 && (
              <>
                <h4 className="std-subtitle">Circuit requirements</h4>
                <ul className="std-circuits">
                  {circuits.map((c) => (
                    <li key={c.key}>
                      <span>{c.label}</span>
                      <strong>
                        {c.breaker} · {c.cable}
                      </strong>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
