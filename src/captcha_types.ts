/**
 * captcha_types.ts — Shared TypeScript types for CAPTCHA Intelligence & Web Scraping
 * Mirrors the Python dataclasses in captcha_engine.py and scraping_engine.py
 */

// ---------------------------------------------------------------------------
// CAPTCHA Types
// ---------------------------------------------------------------------------

export type CaptchaType =
  | 'TEXT'
  | 'IMAGE_GRID'
  | 'RECAPTCHA_V2'
  | 'RECAPTCHA_V3'
  | 'HCAPTCHA'
  | 'CLOUDFLARE_TURNSTILE'
  | 'AUDIO'
  | 'SLIDER_PUZZLE'
  | 'INTERACTIVE_PUZZLE'
  | 'ENTERPRISE_AUTH'
  | 'UNKNOWN'
  | 'NONE';

export interface CaptchaDetectionResult {
  captcha_type: CaptchaType;
  provider: string;
  confidence: number;       // 0.0 – 1.0
  is_test_env: boolean;
  page_url: string;
  frame_urls: string[];
  dom_indicators: string[];
  timestamp: string;        // ISO 8601
  raw_signals: Record<string, unknown>;
}

export interface CaptchaLog {
  id: string;
  run_id?: string;
  captcha_type: CaptchaType;
  provider: string;
  confidence: number;
  is_test_env: boolean;
  page_url: string;
  timestamp: string;
  action_taken: string;     // e.g. "human_handoff" | "classified" | "none"
  adapter_type?: string;
}

export interface CaptchaMetrics {
  total_detections: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  precision: number;
  recall: number;
  f1: number;
  // Derived / aggregated fields returned by GET /api/captcha/metrics
  avg_confidence: number;
  test_env_detections: number;
  live_site_detections: number;
  human_handoffs: number;
}

export interface CaptchaProviderInfo {
  name: string;
  captcha_types: CaptchaType[];
  test_support: boolean;
  live_detection: boolean;
  description: string;
  icon?: string;
}

export interface CaptchaAnalyzeResult {
  action: 'human_handoff' | 'classified' | 'none';
  reason?: string;
  detected_type?: CaptchaType;
  provider?: string;
  confidence?: number;
  is_test_env?: boolean;
  analysis?: Record<string, unknown>;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Scraping Types
// ---------------------------------------------------------------------------

export type ExportFormat = 'json' | 'csv' | 'mysql';
export type TaskStatus = 'running' | 'done' | 'error' | 'pending';

export interface ScrapeConfig {
  url: string;
  selectors?: Record<string, string>;
  pagination_selector?: string;
  max_pages: number;              // default 10
  delay_between_pages?: number;   // seconds, default 1.5
  export_format: ExportFormat;
  table_selector?: string;
  extract_metadata: boolean;
  extract_text?: boolean;
  custom_css_selector?: string;
  custom_headers?: Record<string, string>;
}

export interface ScrapingRecord {
  [key: string]: unknown;
}

export interface ScrapingMetadata {
  title?: string;
  description?: string;
  h1_count?: number;
  page_count?: number;
  scraped_at?: string;
  source_url?: string;
  [key: string]: unknown;
}

export interface ScrapingResult {
  url: string;
  records: ScrapingRecord[];
  metadata: ScrapingMetadata;
  page_count: number;
  total_records: number;
  errors: string[];
  duration_seconds: number;
  exported_to?: string;
}

export interface ScrapingTask {
  id: string;
  config: ScrapeConfig;
  status: TaskStatus;
  pages_scraped: number;
  records_count: number;
  start_time: string;        // ISO 8601
  end_time?: string;
  error?: string;
  result?: ScrapingResult;
  export_path?: string;
}

export interface ExportedFile {
  filename: string;
  format: ExportFormat;
  task_id: string;
  size_bytes: number;
  created_at: string;
  download_url: string;
}
