/**
 * CaptchaDashboard.tsx — CAPTCHA Intelligence Dashboard
 * Displays detection status, provider cards, detection logs, metrics, and analysis tools.
 * Does NOT solve or bypass any CAPTCHA.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Eye,
  Cpu,
  BarChart2,
  RefreshCw,
  ChevronDown,
  XCircle,
  Info,
  Zap,
  Globe,
  Clock,
  Activity,
  Filter,
  Download,
} from 'lucide-react';
import type {
  CaptchaType,
  CaptchaLog,
  CaptchaMetrics,
  CaptchaDetectionResult,
  CaptchaProviderInfo,
  CaptchaAnalyzeResult,
} from './captcha_types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CaptchaDashboardProps {
  runId?: string;
  isVisible: boolean;
  apiBase: string;
}

// ---------------------------------------------------------------------------
// Helpers / constants
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
  RECAPTCHA_V2: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  RECAPTCHA_V3: 'bg-blue-400/20 text-blue-200 border-blue-400/30',
  HCAPTCHA: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  CLOUDFLARE_TURNSTILE: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  TEXT: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  IMAGE_GRID: 'bg-green-500/20 text-green-300 border-green-500/30',
  AUDIO: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  SLIDER_PUZZLE: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  INTERACTIVE_PUZZLE: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  ENTERPRISE_AUTH: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  UNKNOWN: 'bg-white/10 text-white/50 border-white/20',
  NONE: 'bg-white/5 text-white/30 border-white/10',
};

const PROVIDERS = [
  {
    id: 'recaptcha',
    name: 'reCAPTCHA',
    icon: '🔵',
    types: ['RECAPTCHA_V2', 'RECAPTCHA_V3'],
    testSupport: true,
    liveDetection: true,
    description: 'Google reCAPTCHA v2 / v3',
  },
  {
    id: 'hcaptcha',
    name: 'hCaptcha',
    icon: '🟡',
    types: ['HCAPTCHA'],
    testSupport: true,
    liveDetection: true,
    description: 'hCaptcha image challenges',
  },
  {
    id: 'turnstile',
    name: 'Cloudflare Turnstile',
    icon: '🟠',
    types: ['CLOUDFLARE_TURNSTILE'],
    testSupport: false,
    liveDetection: true,
    description: 'Cloudflare Turnstile widget',
  },
  {
    id: 'text',
    name: 'Text CAPTCHA',
    icon: '🔤',
    types: ['TEXT'],
    testSupport: true,
    liveDetection: true,
    description: 'Distorted text challenges',
  },
  {
    id: 'image_grid',
    name: 'Image Grid',
    icon: '🖼️',
    types: ['IMAGE_GRID'],
    testSupport: true,
    liveDetection: true,
    description: 'Select-all-matching-images',
  },
  {
    id: 'puzzle',
    name: 'Puzzle / Slider',
    icon: '🧩',
    types: ['SLIDER_PUZZLE', 'INTERACTIVE_PUZZLE'],
    testSupport: true,
    liveDetection: true,
    description: 'Drag-to-fit puzzle sliders',
  },
];

function truncate(str: string, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function confidenceColor(c: number): string {
  if (c >= 0.8) return 'text-green-400';
  if (c >= 0.5) return 'text-yellow-400';
  return 'text-red-400';
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString();
  } catch {
    return ts;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Confidence meter bar */
const ConfidenceMeter: React.FC<{ value: number }> = ({ value }) => {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-mono ${confidenceColor(value)}`}>{pct}%</span>
    </div>
  );
};

/** Type badge pill */
const TypeBadge: React.FC<{ type: CaptchaType }> = ({ type }) => {
  const cls = TYPE_COLORS[type] ?? TYPE_COLORS.UNKNOWN;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {type.replace(/_/g, ' ')}
    </span>
  );
};

/** Metric card */
const MetricCard: React.FC<{ label: string; value: number | string; icon: React.ReactNode; accent?: string }> = ({
  label,
  value,
  icon,
  accent = 'text-white',
}) => (
  <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-1">
    <div className="flex items-center gap-1.5 text-white/40 text-xs">
      {icon}
      <span>{label}</span>
    </div>
    <div className={`text-xl font-bold font-mono ${accent}`}>{value}</div>
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const CaptchaDashboard: React.FC<CaptchaDashboardProps> = ({ runId, isVisible, apiBase }) => {
  // --- State ---
  const [latestDetection, setLatestDetection] = useState<CaptchaLog | null>(null);
  const [logs, setLogs] = useState<CaptchaLog[]>([]);
  const [metrics, setMetrics] = useState<CaptchaMetrics | null>(null);
  const [providers, setProviders] = useState<CaptchaProviderInfo[]>([]);
  const [analyzeResult, setAnalyzeResult] = useState<CaptchaAnalyzeResult | null>(null);
  const [analyzeExpanded, setAnalyzeExpanded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [logsPage, setLogsPage] = useState(0);
  const [providersExpanded, setProvidersExpanded] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('ALL');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const LOGS_PER_PAGE = 10;

  // --- Data fetching ---
  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/captcha/logs?limit=1`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) setLatestDetection(data[0]);
    } catch {
      // silent
    }
  }, [apiBase]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/captcha/logs?limit=50`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setLogs(data);
    } catch {
      // silent
    } finally {
      setLogsLoading(false);
    }
  }, [apiBase]);

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/captcha/metrics`);
      if (!res.ok) return;
      const data = await res.json();
      setMetrics(data);
    } catch {
      // silent
    } finally {
      setMetricsLoading(false);
    }
  }, [apiBase]);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/captcha/providers`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setProviders(data);
    } catch {
      // silent
    }
  }, [apiBase]);

  const handleAnalyze = useCallback(async () => {
    if (!runId) return;
    setAnalyzing(true);
    setAnalyzeExpanded(true);
    try {
      const res = await fetch(`${apiBase}/api/captcha/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: runId, adapter_type: 'auto' }),
      });
      const data = await res.json();
      setAnalyzeResult(data);
    } catch (e: unknown) {
      setAnalyzeResult({
        action: 'none',
        reason: e instanceof Error ? e.message : 'Network error',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setAnalyzing(false);
    }
  }, [apiBase, runId]);

  // --- Polling ---
  useEffect(() => {
    if (!isVisible) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    fetchLatest();
    fetchLogs();
    fetchMetrics();
    fetchProviders();
    pollRef.current = setInterval(fetchLatest, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isVisible, fetchLatest, fetchLogs, fetchMetrics, fetchProviders]);

  // --- Filtered logs ---
  const filteredLogs =
    filterType === 'ALL' ? logs : logs.filter((l) => l.captcha_type === filterType);
  const pagedLogs = filteredLogs.slice(logsPage * LOGS_PER_PAGE, (logsPage + 1) * LOGS_PER_PAGE);
  const totalPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE);

  const uniqueTypes = Array.from(new Set(logs.map((l) => l.captcha_type)));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-kauvery-magenta" />
        <h2 className="text-base font-semibold text-white">CAPTCHA Intelligence Dashboard</h2>
        <span className="ml-auto text-xs text-white/30 italic">Detection only — no solving</span>
      </div>

      {/* ── 1. Detection Status Card ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-kauvery-coral" />
          <span className="text-sm font-medium text-white/80">Current Detection Status</span>
          <div className="ml-auto flex items-center gap-1 text-xs text-white/30">
            <Clock className="w-3 h-3" />
            <span>Live · 3s poll</span>
          </div>
        </div>

        {latestDetection ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <TypeBadge type={latestDetection.captcha_type} />
              {latestDetection.is_test_env ? (
                <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-300 border border-green-500/30">
                  🧪 Test Env
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  🌐 Live Site
                </span>
              )}
              <span className="text-xs text-white/40 ml-auto">{formatTimestamp(latestDetection.timestamp)}</span>
            </div>
            <div>
              <div className="text-xs text-white/40 mb-1">Confidence</div>
              <ConfidenceMeter value={latestDetection.confidence} />
            </div>
            <div className="text-xs text-white/40 font-mono truncate">{latestDetection.page_url}</div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-white/30">
            <Eye className="w-4 h-4" />
            <span>No detection data yet — waiting for a page scan…</span>
          </div>
        )}
      </div>

      {/* ── 2. Provider Cards ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="w-4 h-4 text-kauvery-amber" />
          <span className="text-sm font-medium text-white/80">Supported Providers</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROVIDERS.map((p) => (
            <div
              key={p.id}
              className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-1.5 hover:bg-white/8 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-base">{p.icon}</span>
                <span className="text-xs font-semibold text-white/80 leading-tight">{p.name}</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {p.testSupport && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/15 text-green-300 border border-green-500/20">
                    Test ✓
                  </span>
                )}
                {p.liveDetection && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/20">
                    Live detect
                  </span>
                )}
              </div>
              <p className="text-[10px] text-white/30 leading-tight">{p.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Performance Metrics ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 className="w-4 h-4 text-kauvery-fuchsia" />
          <span className="text-sm font-medium text-white/80">Performance Metrics</span>
          {metricsLoading && <RefreshCw className="w-3 h-3 text-white/30 animate-spin ml-auto" />}
        </div>
        {metrics ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MetricCard
              label="Total Detections"
              value={metrics.total_detections}
              icon={<Shield className="w-3 h-3" />}
              accent="text-white"
            />
            <MetricCard
              label="Avg Confidence"
              value={`${Math.round((metrics.avg_confidence ?? 0) * 100)}%`}
              icon={<Activity className="w-3 h-3" />}
              accent="text-green-400"
            />
            <MetricCard
              label="Test Env"
              value={metrics.test_env_detections ?? 0}
              icon={<Zap className="w-3 h-3" />}
              accent="text-yellow-400"
            />
            <MetricCard
              label="Live Site"
              value={metrics.live_site_detections ?? 0}
              icon={<Globe className="w-3 h-3" />}
              accent="text-blue-400"
            />
            <MetricCard
              label="Human Handoffs"
              value={metrics.human_handoffs ?? 0}
              icon={<AlertTriangle className="w-3 h-3" />}
              accent="text-orange-400"
            />
            <MetricCard
              label="F1 Score"
              value={metrics.f1 !== undefined ? metrics.f1.toFixed(2) : '—'}
              icon={<Cpu className="w-3 h-3" />}
              accent="text-kauvery-magenta"
            />
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white/30 text-center">
            {metricsLoading ? 'Loading metrics…' : 'No metrics available'}
          </div>
        )}
      </div>

      {/* ── 4. Analyze Current Page ── */}
      {runId && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-kauvery-coral" />
            <span className="text-sm font-medium text-white/80">Analyze Active Page</span>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-kauvery-coral to-kauvery-magenta hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {analyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Analyze Active Page
              </>
            )}
          </button>

          {analyzeResult && (
            <div className="mt-3">
              <button
                onClick={() => setAnalyzeExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${analyzeExpanded ? 'rotate-180' : ''}`}
                />
                {analyzeExpanded ? 'Hide' : 'Show'} result
              </button>

              {analyzeExpanded && (
                <div className="mt-2 rounded-lg bg-black/30 border border-white/10 p-3">
                  {analyzeResult.action === 'human_handoff' ? (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/30">
                      <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-orange-300">
                          Live site — human verification required
                        </p>
                        {analyzeResult.reason && (
                          <p className="text-xs text-orange-200/70 mt-0.5">{analyzeResult.reason}</p>
                        )}
                      </div>
                    </div>
                  ) : analyzeResult.action === 'classified' ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-green-300 font-medium">Classified</span>
                      </div>
                      {analyzeResult.detected_type && (
                        <TypeBadge type={analyzeResult.detected_type} />
                      )}
                      {analyzeResult.confidence !== undefined && (
                        <ConfidenceMeter value={analyzeResult.confidence} />
                      )}
                      {analyzeResult.is_test_env !== undefined && (
                        <span className="text-xs text-white/40">
                          {analyzeResult.is_test_env ? '🧪 Test environment' : '🌐 Live site'}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-white/40" />
                      <span className="text-sm text-white/50">{analyzeResult.reason ?? 'No CAPTCHA detected'}</span>
                    </div>
                  )}
                  <div className="mt-2 text-[10px] text-white/20 font-mono">
                    {formatTimestamp(analyzeResult.timestamp)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 5. Detection Logs Table ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-white/50" />
          <span className="text-sm font-medium text-white/80">Detection Logs</span>
          <div className="ml-auto flex items-center gap-2">
            {/* Filter */}
            <div className="relative flex items-center gap-1">
              <Filter className="w-3 h-3 text-white/30" />
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value); setLogsPage(0); }}
                className="bg-transparent text-xs text-white/60 border-none outline-none cursor-pointer pr-1"
              >
                <option value="ALL">All Types</option>
                {uniqueTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <button
              onClick={fetchLogs}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title="Refresh logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-white/50 ${logsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-7 gap-1 px-3 py-2 text-[10px] font-semibold text-white/30 uppercase tracking-wide border-b border-white/5">
            <span>Time</span>
            <span className="col-span-2">URL</span>
            <span>Type</span>
            <span>Provider</span>
            <span>Conf</span>
            <span>Action</span>
          </div>

          {/* Rows */}
          {pagedLogs.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-white/30">
              {logsLoading ? 'Loading…' : 'No log entries found'}
            </div>
          ) : (
            pagedLogs.map((log, i) => (
              <div
                key={log.id ?? i}
                className="grid grid-cols-7 gap-1 px-3 py-2 text-[11px] text-white/60 border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                <span className="font-mono text-white/40">{formatTimestamp(log.timestamp)}</span>
                <span className="col-span-2 font-mono truncate text-white/50" title={log.page_url}>
                  {truncate(log.page_url, 30)}
                </span>
                <span>
                  <TypeBadge type={log.captcha_type} />
                </span>
                <span className="truncate">{log.provider || '—'}</span>
                <span className={`font-mono ${confidenceColor(log.confidence)}`}>
                  {Math.round(log.confidence * 100)}%
                </span>
                <span className={log.action_taken === 'human_handoff' ? 'text-orange-400' : 'text-white/40'}>
                  {log.action_taken || '—'}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-2 px-1">
            <span className="text-xs text-white/30">
              {logsPage * LOGS_PER_PAGE + 1}–{Math.min((logsPage + 1) * LOGS_PER_PAGE, filteredLogs.length)} of {filteredLogs.length}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setLogsPage((p) => Math.max(0, p - 1))}
                disabled={logsPage === 0}
                className="px-2 py-1 rounded text-xs bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10"
              >
                ‹
              </button>
              <button
                onClick={() => setLogsPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={logsPage >= totalPages - 1}
                className="px-2 py-1 rounded text-xs bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 6. Supported Types Reference ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <button
          onClick={() => setProvidersExpanded((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors"
        >
          <Info className="w-4 h-4 text-white/40" />
          <span>Supported Types Reference</span>
          <ChevronDown className={`w-4 h-4 ml-auto text-white/30 transition-transform ${providersExpanded ? 'rotate-180' : ''}`} />
        </button>

        {providersExpanded && (
          <div className="border-t border-white/10 p-3 flex flex-col gap-2">
            {providers.length > 0 ? (
              providers.map((p, i) => (
                <div key={i} className="flex flex-col gap-1 p-2 rounded-lg bg-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white/80">{p.name}</span>
                    {p.test_support && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/15 text-green-300 border border-green-500/20">
                        Test ✓
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {(p.captcha_types ?? []).map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </div>
                  {p.description && (
                    <p className="text-xs text-white/40">{p.description}</p>
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col gap-2">
                {/* Static fallback when API not available */}
                {[
                  { type: 'RECAPTCHA_V2' as CaptchaType, desc: 'Checkbox + image challenge from Google' },
                  { type: 'RECAPTCHA_V3' as CaptchaType, desc: 'Invisible score-based challenge from Google' },
                  { type: 'HCAPTCHA' as CaptchaType, desc: 'Privacy-focused image challenge' },
                  { type: 'CLOUDFLARE_TURNSTILE' as CaptchaType, desc: 'Cloudflare proof-of-work / JS challenge' },
                  { type: 'TEXT' as CaptchaType, desc: 'Distorted alphanumeric text input' },
                  { type: 'IMAGE_GRID' as CaptchaType, desc: 'Select all images matching a category' },
                  { type: 'AUDIO' as CaptchaType, desc: 'Spoken characters for accessibility' },
                  { type: 'SLIDER_PUZZLE' as CaptchaType, desc: 'Drag slider to fit puzzle piece' },
                  { type: 'INTERACTIVE_PUZZLE' as CaptchaType, desc: 'Click-based interactive puzzle' },
                  { type: 'ENTERPRISE_AUTH' as CaptchaType, desc: 'Enterprise SSO / advanced auth flow' },
                ].map(({ type, desc }) => (
                  <div key={type} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                    <TypeBadge type={type} />
                    <span className="text-xs text-white/40">{desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CaptchaDashboard;
