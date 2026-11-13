/**
 * ScrapingConsole.tsx — Web Scraping Console
 * Configuration, task management, results viewing, and export center.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Globe,
  Database,
  Download,
  Play,
  Square,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Table,
  FileText,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  Layers,
  ExternalLink,
} from 'lucide-react';
import type {
  ScrapeConfig,
  ScrapingTask,
  ScrapingRecord,
  ExportFormat,
  ScrapingMetadata,
  ExportedFile,
} from './captcha_types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ScrapingConsoleProps {
  isVisible: boolean;
  apiBase: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_DOT: Record<string, string> = {
  running: 'bg-green-400',
  done: 'bg-blue-400',
  error: 'bg-red-400',
  pending: 'bg-yellow-400',
};

const STATUS_TEXT: Record<string, string> = {
  running: 'text-green-300',
  done: 'text-blue-300',
  error: 'text-red-300',
  pending: 'text-yellow-300',
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function timeAgo(iso: string): string {
  try {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return `${Math.round(diff)}s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    return `${Math.round(diff / 3600)}h ago`;
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Toggle switch */
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({
  checked,
  onChange,
  label,
}) => (
  <label className="flex items-center gap-2 cursor-pointer select-none">
    <div
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors ${
        checked ? 'bg-kauvery-coral' : 'bg-white/15'
      }`}
    >
      <div
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </div>
    <span className="text-sm text-white/70">{label}</span>
  </label>
);

/** Form field wrapper */
const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({
  label,
  required,
  children,
}) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-white/50 uppercase tracking-wide">
      {label}
      {required && <span className="text-kauvery-coral ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-kauvery-coral/60 transition-colors';

const selectCls =
  'w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-kauvery-coral/60 transition-colors';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const ScrapingConsole: React.FC<ScrapingConsoleProps> = ({ isVisible, apiBase }) => {
  // --- Form state ---
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(5);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [tableSelector, setTableSelector] = useState('');
  const [paginationSelector, setPaginationSelector] = useState('');
  const [customSelector, setCustomSelector] = useState('');
  const [extractMetadata, setExtractMetadata] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // --- Tasks ---
  const [tasks, setTasks] = useState<ScrapingTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Results viewer ---
  const [selectedTask, setSelectedTask] = useState<ScrapingTask | null>(null);
  const [records, setRecords] = useState<ScrapingRecord[]>([]);
  const [recordsPage, setRecordsPage] = useState(0);
  const [metaExpanded, setMetaExpanded] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);

  // --- Export center ---
  const [exportTab, setExportTab] = useState<ExportFormat | 'mysql'>('json');
  const [exportedFiles, setExportedFiles] = useState<ExportedFile[]>([]);

  // --- Status bar ---
  const [statusMsg, setStatusMsg] = useState('');

  const RECORDS_PER_PAGE = 100;

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/scrape/tasks`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setTasks(data);
    } catch {
      // silent
    } finally {
      setTasksLoading(false);
    }
  }, [apiBase]);

  const fetchExportedFiles = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/scrape/exports`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setExportedFiles(data);
    } catch {
      // silent
    }
  }, [apiBase]);

  const fetchResults = useCallback(
    async (task: ScrapingTask) => {
      setResultsLoading(true);
      setRecords([]);
      setRecordsPage(0);
      try {
        const res = await fetch(`${apiBase}/api/scrape/results/${task.id}`);
        if (!res.ok) return;
        const data = await res.json();
        setRecords(Array.isArray(data.records) ? data.records : []);
      } catch {
        // silent
      } finally {
        setResultsLoading(false);
      }
    },
    [apiBase]
  );

  // --- Polling ---
  useEffect(() => {
    if (!isVisible) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    fetchTasks();
    fetchExportedFiles();
    pollRef.current = setInterval(fetchTasks, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isVisible, fetchTasks, fetchExportedFiles]);

  // --- Update status bar from running tasks ---
  useEffect(() => {
    const running = tasks.filter((t) => t.status === 'running');
    const errors = tasks.filter((t) => t.status === 'error');
    const done = tasks.filter((t) => t.status === 'done');
    if (running.length > 0) {
      const total = running.reduce((s, t) => s + (t.pages_scraped ?? 0), 0);
      setStatusMsg(`Scraping ${running.length} task(s) · ${total} pages scraped so far…`);
    } else if (errors.length > 0) {
      setStatusMsg(`⚠ ${errors.length} task(s) failed. Check task list for details.`);
    } else if (done.length > 0) {
      const totalRecs = done.reduce((s, t) => s + (t.records_count ?? 0), 0);
      setStatusMsg(`Done · ${totalRecs} records across ${done.length} task(s)`);
    } else {
      setStatusMsg('');
    }
  }, [tasks]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleStartScraping = useCallback(async () => {
    if (!url.trim()) {
      setFormError('URL is required');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      const config: Partial<ScrapeConfig> = {
        url: url.trim(),
        max_pages: maxPages,
        export_format: exportFormat,
        extract_metadata: extractMetadata,
      };
      if (tableSelector.trim()) config.table_selector = tableSelector.trim();
      if (paginationSelector.trim()) config.pagination_selector = paginationSelector.trim();
      if (customSelector.trim()) config.custom_css_selector = customSelector.trim();

      const res = await fetch(`${apiBase}/api/scrape/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError(err.detail ?? `Error ${res.status}`);
        return;
      }
      await fetchTasks();
      setUrl('');
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }, [url, maxPages, exportFormat, extractMetadata, tableSelector, paginationSelector, customSelector, apiBase, fetchTasks]);

  const handleViewResults = useCallback(
    (task: ScrapingTask) => {
      setSelectedTask(task);
      fetchResults(task);
    },
    [fetchResults]
  );

  const handleDownload = useCallback(
    (taskId: string) => {
      window.open(`${apiBase}/api/scrape/export/${taskId}`, '_blank');
    },
    [apiBase]
  );

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const pagedRecords = records.slice(
    recordsPage * RECORDS_PER_PAGE,
    (recordsPage + 1) * RECORDS_PER_PAGE
  );
  const totalRecordPages = Math.ceil(records.length / RECORDS_PER_PAGE);

  // Column keys from first record
  const columnKeys =
    records.length > 0
      ? Object.keys(records[0]).slice(0, 8) // limit columns
      : [];

  const selectedTaskMeta: ScrapingMetadata | undefined = selectedTask?.result?.metadata;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <Globe className="w-5 h-5 text-kauvery-coral" />
        <h2 className="text-base font-semibold text-white">Web Scraping Console</h2>
      </div>

      {/* ── 1. Configuration Form ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 mb-1">
          <Layers className="w-4 h-4 text-kauvery-amber" />
          <span className="text-sm font-medium text-white/80">Scrape Configuration</span>
        </div>

        <Field label="Target URL" required>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Max Pages">
            <input
              type="number"
              min={1}
              max={50}
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Export Format">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              className={selectCls}
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
          </Field>
        </div>

        <Field label="Table Selector (optional)">
          <input
            type="text"
            value={tableSelector}
            onChange={(e) => setTableSelector(e.target.value)}
            placeholder="e.g. table.data-table"
            className={inputCls}
          />
        </Field>

        <Field label="Pagination Selector (optional)">
          <input
            type="text"
            value={paginationSelector}
            onChange={(e) => setPaginationSelector(e.target.value)}
            placeholder="e.g. a.next-page"
            className={inputCls}
          />
        </Field>

        <Field label="Custom CSS Selector (optional)">
          <input
            type="text"
            value={customSelector}
            onChange={(e) => setCustomSelector(e.target.value)}
            placeholder="e.g. .product-card"
            className={inputCls}
          />
        </Field>

        <Toggle checked={extractMetadata} onChange={setExtractMetadata} label="Extract Metadata" />

        {formError && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {formError}
          </div>
        )}

        <button
          onClick={handleStartScraping}
          disabled={submitting}
          className="mt-1 w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-kauvery-coral to-kauvery-magenta hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Starting…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Start Scraping
            </>
          )}
        </button>
      </div>

      {/* ── 2. Active Tasks Panel ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-4 h-4 text-kauvery-fuchsia" />
          <span className="text-sm font-medium text-white/80">Active Tasks</span>
          <button
            onClick={fetchTasks}
            className="ml-auto p-1 rounded hover:bg-white/10 transition-colors"
            title="Refresh tasks"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-white/50 ${tasksLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center text-sm text-white/30">
            No scraping tasks yet — configure a target URL above
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((task) => {
              const progress =
                task.config?.max_pages && task.pages_scraped != null
                  ? Math.min(100, Math.round((task.pages_scraped / task.config.max_pages) * 100))
                  : 0;

              return (
                <div
                  key={task.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[task.status] ?? 'bg-white/20'} ${task.status === 'running' ? 'animate-pulse' : ''}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 justify-between">
                        <span className="text-xs font-mono text-white/60 truncate">
                          {task.config?.url ?? task.id}
                        </span>
                        <span className={`text-[10px] font-semibold ${STATUS_TEXT[task.status] ?? 'text-white/40'}`}>
                          {task.status.toUpperCase()}
                        </span>
                      </div>

                      {/* Progress bar */}
                      {task.status === 'running' && (
                        <div className="mt-1.5">
                          <div className="flex justify-between text-[10px] text-white/30 mb-0.5">
                            <span>{task.pages_scraped ?? 0} / {task.config?.max_pages ?? '?'} pages</span>
                            <span>{progress}%</span>
                          </div>
                          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-kauvery-coral to-kauvery-magenta rounded-full transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-1 text-[10px] text-white/30">
                        <span>{task.records_count ?? 0} records</span>
                        <span>·</span>
                        <Clock className="w-2.5 h-2.5" />
                        <span>{timeAgo(task.start_time)}</span>
                        {task.status === 'done' && task.result?.duration_seconds != null && (
                          <>
                            <span>·</span>
                            <span>{formatDuration(task.result.duration_seconds)}</span>
                          </>
                        )}
                      </div>

                      {task.error && (
                        <div className="mt-1 text-[10px] text-red-400 font-mono truncate">
                          ⚠ {task.error}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleViewResults(task)}
                      disabled={task.status === 'running'}
                      className="px-2.5 py-1 rounded-lg text-xs bg-white/10 hover:bg-white/15 text-white/70 disabled:opacity-30 flex items-center gap-1 transition-colors"
                    >
                      <Table className="w-3 h-3" />
                      View Results
                    </button>
                    <button
                      onClick={() => handleDownload(task.id)}
                      disabled={task.status !== 'done'}
                      className="px-2.5 py-1 rounded-lg text-xs bg-white/10 hover:bg-white/15 text-white/70 disabled:opacity-30 flex items-center gap-1 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 3. Results Viewer ── */}
      {selectedTask && (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <Table className="w-4 h-4 text-white/50" />
            <span className="text-sm font-medium text-white/80">Results</span>
            <span className="text-xs text-white/30 font-mono truncate ml-1">
              {selectedTask.config?.url}
            </span>
            <button
              onClick={() => setSelectedTask(null)}
              className="ml-auto text-white/30 hover:text-white/60 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Metadata collapsible */}
          {selectedTaskMeta && extractMetadata && (
            <div className="border-b border-white/5">
              <button
                onClick={() => setMetaExpanded((v) => !v)}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-white/50 hover:bg-white/5 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Page Metadata</span>
                {metaExpanded ? (
                  <ChevronUp className="w-3 h-3 ml-auto" />
                ) : (
                  <ChevronDown className="w-3 h-3 ml-auto" />
                )}
              </button>
              {metaExpanded && (
                <div className="px-4 pb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selectedTaskMeta.title && (
                    <div className="col-span-full bg-white/5 rounded-lg p-2">
                      <span className="text-[10px] text-white/30 uppercase">Title</span>
                      <p className="text-xs text-white/70 mt-0.5">{selectedTaskMeta.title}</p>
                    </div>
                  )}
                  {selectedTaskMeta.description && (
                    <div className="col-span-full bg-white/5 rounded-lg p-2">
                      <span className="text-[10px] text-white/30 uppercase">Description</span>
                      <p className="text-xs text-white/60 mt-0.5">{selectedTaskMeta.description}</p>
                    </div>
                  )}
                  {selectedTaskMeta.h1_count != null && (
                    <div className="bg-white/5 rounded-lg p-2">
                      <span className="text-[10px] text-white/30 uppercase">H1 Count</span>
                      <p className="text-sm font-bold text-white/80 mt-0.5">{selectedTaskMeta.h1_count}</p>
                    </div>
                  )}
                  {selectedTaskMeta.page_count != null && (
                    <div className="bg-white/5 rounded-lg p-2">
                      <span className="text-[10px] text-white/30 uppercase">Pages</span>
                      <p className="text-sm font-bold text-white/80 mt-0.5">{selectedTaskMeta.page_count}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Records table */}
          {resultsLoading ? (
            <div className="p-6 text-center text-sm text-white/30 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading records…
            </div>
          ) : records.length === 0 ? (
            <div className="p-6 text-center text-sm text-white/30">No records available</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5">
                      {columnKeys.map((k) => (
                        <th
                          key={k}
                          className="px-3 py-2 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wide whitespace-nowrap"
                        >
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRecords.map((rec, i) => (
                      <tr
                        key={i}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        {columnKeys.map((k) => (
                          <td
                            key={k}
                            className="px-3 py-2 text-white/60 max-w-[200px] truncate"
                            title={String(rec[k] ?? '')}
                          >
                            {String(rec[k] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalRecordPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2 border-t border-white/5">
                  <span className="text-xs text-white/30">
                    {recordsPage * RECORDS_PER_PAGE + 1}–
                    {Math.min((recordsPage + 1) * RECORDS_PER_PAGE, records.length)} of {records.length} records
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setRecordsPage((p) => Math.max(0, p - 1))}
                      disabled={recordsPage === 0}
                      className="px-2 py-1 rounded text-xs bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => setRecordsPage((p) => Math.min(totalRecordPages - 1, p + 1))}
                      disabled={recordsPage >= totalRecordPages - 1}
                      className="px-2 py-1 rounded text-xs bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10"
                    >
                      ›
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Download button */}
          <div className="px-4 py-3 border-t border-white/5 flex justify-end">
            <button
              onClick={() => handleDownload(selectedTask.id)}
              className="px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/15 text-white/70 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3 h-3" />
              Download Results
            </button>
          </div>
        </div>
      )}

      {/* ── 4. Export Center ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
          <Download className="w-4 h-4 text-white/50" />
          <span className="text-sm font-medium text-white/80">Export Center</span>
        </div>

        {/* Tab selector */}
        <div className="flex border-b border-white/5">
          {(['json', 'csv', 'mysql'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setExportTab(tab)}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                exportTab === tab
                  ? 'text-kauvery-coral border-b-2 border-kauvery-coral'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-4">
          {exportTab === 'mysql' ? (
            /* MySQL instructions */
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <FileText className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-300 mb-1">MySQL Setup</p>
                  <p className="text-xs text-blue-200/70">
                    Set the following environment variables before starting the backend server:
                  </p>
                </div>
              </div>
              <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-green-300 flex flex-col gap-1">
                <span>MYSQL_HOST=localhost</span>
                <span>MYSQL_PORT=3306</span>
                <span>MYSQL_USER=your_user</span>
                <span>MYSQL_PASSWORD=your_password</span>
                <span>MYSQL_DATABASE=kauvery_scraping</span>
              </div>
              <p className="text-xs text-white/40">
                Once configured, select <strong className="text-white/60">MySQL</strong> as the export format when starting a scrape.
                Each task will be inserted into a table named after the task ID.
              </p>
            </div>
          ) : (
            /* JSON / CSV file list */
            <div className="flex flex-col gap-2">
              {exportedFiles.filter((f) => f.format === exportTab).length === 0 ? (
                <p className="text-sm text-white/30 text-center py-3">
                  No exported {exportTab.toUpperCase()} files yet
                </p>
              ) : (
                exportedFiles
                  .filter((f) => f.format === exportTab)
                  .map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/10"
                    >
                      <FileText className="w-4 h-4 text-white/30 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-white/70 truncate">{file.filename}</p>
                        <p className="text-[10px] text-white/30">
                          {formatBytes(file.size_bytes)} · {timeAgo(file.created_at)}
                        </p>
                      </div>
                      <a
                        href={`${apiBase}${file.download_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 transition-colors"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href={`${apiBase}${file.download_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 transition-colors"
                        title="Open"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Status Bar ── */}
      {statusMsg && (
        <div
          className={`sticky bottom-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border ${
            statusMsg.startsWith('⚠')
              ? 'bg-red-500/10 border-red-500/20 text-red-300'
              : statusMsg.startsWith('Done')
              ? 'bg-green-500/10 border-green-500/20 text-green-300'
              : 'bg-kauvery-magenta/10 border-kauvery-magenta/20 text-kauvery-coral'
          }`}
        >
          {statusMsg.startsWith('⚠') ? (
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          ) : statusMsg.startsWith('Done') ? (
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 flex-shrink-0 animate-spin" />
          )}
          {statusMsg}
        </div>
      )}
    </div>
  );
};

export default ScrapingConsole;
