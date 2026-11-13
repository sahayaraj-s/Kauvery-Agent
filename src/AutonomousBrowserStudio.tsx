/**
 * AutonomousBrowserStudio.tsx — Autonomous Agentic Browser & Task Execution Studio
 * Comprehensive UI providing:
 * 1. Agent Task Input with multi-domain presets
 * 2. Autonomous Execution Dashboard & State Machine Monitor
 * 3. Live Browser Viewport Preview with interactive address bar & click forwarding
 * 4. Dynamic Task Planning view (generated steps, active step, verification)
 * 5. Execution Step History & Observation Log
 * 6. CAPTCHA Intelligence Monitor & Human-in-the-loop controls
 * 7. Live Element Explorer & Screenshot Evidence
 * 8. Pause / Resume / Stop execution controls
 * 9. Final Task Report & Excel Download
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Globe,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  ChevronRight,
  Eye,
  Layers,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  FileSpreadsheet,
  AlertTriangle,
  RefreshCw,
  Search,
  Check,
  Activity,
  Cpu
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AutonomousBrowserStudioProps {
  apiBase: string;
  onClose?: () => void;
  initialPrompt?: string;
  initialUrl?: string;
}

interface PlanStep {
  id: number;
  description: string;
  expected_outcome?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface LogEntry {
  id: string;
  time: string;
  agent: string;
  type: string;
  message: string;
  data?: any;
}

export const AutonomousBrowserStudio: React.FC<AutonomousBrowserStudioProps> = ({
  apiBase,
  onClose,
  initialPrompt = '',
  initialUrl = ''
}) => {
  // Input State
  const [prompt, setPrompt] = useState(initialPrompt);
  const [targetUrl, setTargetUrl] = useState(initialUrl);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Execution State
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'paused' | 'waiting_human' | 'completed' | 'error' | 'stopped'>('idle');
  const [currentThought, setCurrentThought] = useState<string>('Ready for autonomous task.');
  const [currentAction, setCurrentAction] = useState<string>('Idle');
  const [currentVerification, setCurrentVerification] = useState<string>('');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [pageTitle, setPageTitle] = useState<string>('');
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const [captchaInfo, setCaptchaInfo] = useState<any | null>(null);
  const [humanAlert, setHumanAlert] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Planning & Steps
  const [objective, setObjective] = useState<string>('');
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([]);
  const [successCriteria, setSuccessCriteria] = useState<string>('');

  // Logs & Results
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeLogFilter, setActiveLogFilter] = useState<'all' | 'thought' | 'action' | 'verification' | 'captcha'>('all');
  const [finalReport, setFinalReport] = useState<any | null>(null);
  const [downloadFiles, setDownloadFiles] = useState<Array<{ name: string; url: string }>>([]);

  // Active View Tab inside Studio
  const [activeStudioTab, setActiveStudioTab] = useState<'viewport' | 'planning' | 'elements' | 'logs'>('viewport');

  // Interactive Elements on Page
  const [pageElements, setPageElements] = useState<any[]>([]);

  // SSE Reference
  const sseRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Presets for Real Autonomous Navigation & CAPTCHA Intelligence
  const PRESETS = [
    {
      id: 'captcha_demo',
      title: 'CAPTCHA Demo Audit',
      badge: 'Multi-Page Navigation',
      prompt: 'Open trycap.dev, inspect the available CAPTCHA categories, navigate to each supported category link, observe the challenge type and evaluate OCR accuracy.',
      url: 'https://trycap.dev/'
    },
    {
      id: 'wikipedia_research',
      title: 'Wikipedia Deep Research',
      badge: 'Autonomous RPA',
      prompt: 'Navigate to Wikipedia, search for "Artificial General Intelligence", inspect the article sections, click on "History", and extract the core timeline in formatted Excel.',
      url: 'https://en.wikipedia.org/'
    },
    {
      id: 'youtube_videos',
      title: 'YouTube Video Harvester',
      badge: 'Data Extraction',
      prompt: 'Open YouTube, search for "Artificial Intelligence documentary", scroll through results, extract the top 10 video titles with channel and views, and generate an Excel spreadsheet.',
      url: 'https://www.youtube.com/'
    },
    {
      id: 'ecommerce_search',
      title: 'Amazon Product Comparator',
      badge: 'E-Commerce Agent',
      prompt: 'Go to Amazon, search for "Noise Cancelling Headphones", inspect the product listings, extract the top 8 items with prices and ratings, and export to Excel.',
      url: 'https://www.amazon.in/'
    }
  ];

  // Timer effect
  useEffect(() => {
    let timer: any;
    if (runStatus === 'running' && startTime) {
      timer = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [runStatus, startTime]);

  // Scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Append typed log
  const addLog = useCallback((agent: string, type: string, message: string, data?: any) => {
    const timeStr = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        time: timeStr,
        agent,
        type,
        message,
        data
      }
    ]);
  }, []);

  // START RUN
  const handleStartRun = async () => {
    if (!prompt.trim()) return;

    // Reset run state
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    setRunStatus('running');
    setStartTime(Date.now());
    setElapsedSeconds(0);
    setCurrentThought('Decomposing task and initializing autonomous browser session...');
    setCurrentAction('Initializing Browser');
    setCurrentVerification('');
    setHumanAlert(null);
    setFinalReport(null);
    setDownloadFiles([]);
    setPlanSteps([]);
    setLogs([]);

    addLog('main', 'status', `Launching autonomous workflow for prompt: "${prompt}"`);

    try {
      const res = await fetch(`${apiBase}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          url: targetUrl.trim() || undefined
        })
      });

      if (!res.ok) {
        throw new Error(`Failed to launch run: ${res.statusText}`);
      }

      const data = await res.json();
      const currentRunId = data.run_id;
      setRunId(currentRunId);
      addLog('main', 'status', `Run initialized with ID: ${currentRunId}`);

      // Open SSE Stream
      const es = new EventSource(`${apiBase}/api/run/${currentRunId}/events`);
      sseRef.current = es;

      es.onmessage = (event) => {
        try {
          const ev = JSON.parse(event.data);
          const evType = ev.type;
          const evAgent = ev.agent || 'system';
          const evMsg = ev.message || '';
          const evData = ev.data || {};

          if (evType === 'plan') {
            setObjective(evData.objective || prompt);
            setSuccessCriteria(evData.success_criteria || '');
            if (evData.steps && Array.isArray(evData.steps)) {
              setPlanSteps(evData.steps);
            }
            addLog(evAgent, 'plan', `Formulated ${evData.steps?.length || 0} planned steps: ${evData.objective}`);
          } else if (evType === 'step_update') {
            if (evData.steps && Array.isArray(evData.steps)) {
              setPlanSteps(evData.steps);
            }
            addLog(evAgent, 'step', evMsg);
          } else if (evType === 'page_state') {
            if (evData.url) setCurrentUrl(evData.url);
            if (evData.title) setPageTitle(evData.title);
          } else if (evType === 'thought') {
            setCurrentThought(evMsg);
            addLog(evAgent, 'thought', evMsg);
          } else if (evType === 'action') {
            setCurrentAction(evMsg);
            addLog(evAgent, 'action', evMsg, evData);
          } else if (evType === 'verification') {
            setCurrentVerification(evMsg);
            addLog(evAgent, 'verification', evMsg, evData);
          } else if (evType === 'screenshot') {
            if (evData.image) {
              setLiveScreenshot(evData.image);
            }
          } else if (evType === 'captcha_intel') {
            setCaptchaInfo(evData);
            addLog(evAgent, 'captcha', evMsg, evData);
          } else if (evType === 'need_human') {
            setRunStatus('waiting_human');
            setHumanAlert(evMsg);
            if (evData.image) setLiveScreenshot(evData.image);
            addLog(evAgent, 'need_human', `Human verification requested: ${evMsg}`);
          } else if (evType === 'file') {
            const fileName = evData.name;
            const fileUrl = `${apiBase}${evData.url}`;
            setDownloadFiles((prev) => [...prev, { name: fileName, url: fileUrl }]);
            addLog(evAgent, 'file', `Generated file: ${fileName}`, evData);
          } else if (evType === 'final') {
            setRunStatus('completed');
            setFinalReport(evData);
            if (evData.files && Array.isArray(evData.files)) {
              const files = evData.files.map((f: string) => ({
                name: f,
                url: `${apiBase}/api/files/${f}`
              }));
              setDownloadFiles(files);
            }
            addLog(evAgent, 'final', evMsg || 'Task completed successfully!', evData);
            confetti({
              particleCount: 60,
              spread: 70,
              origin: { y: 0.7 },
              colors: ['#00E5FF', '#7C4DFF', '#00E676', '#FFD600']
            });
            es.close();
            sseRef.current = null;
          } else if (evType === 'error') {
            setRunStatus('error');
            addLog(evAgent, 'error', evMsg);
            es.close();
            sseRef.current = null;
          }
        } catch (err) {
          console.error('SSE JSON error:', err);
        }
      };

      es.onerror = () => {
        addLog('system', 'status', 'SSE heartbeat or disconnect');
      };
    } catch (err: any) {
      setRunStatus('error');
      addLog('main', 'error', `Launch failed: ${err.message}`);
    }
  };

  // PAUSE RUN
  const handlePause = async () => {
    if (!runId) return;
    try {
      const res = await fetch(`${apiBase}/api/run/${runId}/pause`, { method: 'POST' });
      if (res.ok) {
        setRunStatus('paused');
        addLog('main', 'status', 'Execution paused by user.');
      }
    } catch (err) {
      console.error('Pause error:', err);
    }
  };

  // RESUME RUN
  const handleResume = async () => {
    if (!runId) return;
    try {
      const res = await fetch(`${apiBase}/api/run/${runId}/resume`, { method: 'POST' });
      if (res.ok) {
        setRunStatus('running');
        setHumanAlert(null);
        addLog('main', 'status', 'Execution resumed.');
      }
    } catch (err) {
      console.error('Resume error:', err);
    }
  };

  // STOP RUN
  const handleStop = async () => {
    if (!runId) return;
    try {
      const res = await fetch(`${apiBase}/api/run/${runId}/stop`, { method: 'POST' });
      if (res.ok) {
        setRunStatus('stopped');
        addLog('main', 'status', 'Execution stopped by user.');
        if (sseRef.current) {
          sseRef.current.close();
          sseRef.current = null;
        }
      }
    } catch (err) {
      console.error('Stop error:', err);
    }
  };

  // Forward human click on viewport image
  const handleViewportClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!runId || runStatus !== 'waiting_human') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const naturalWidth = e.currentTarget.naturalWidth || 1024;
    const naturalHeight = e.currentTarget.naturalHeight || 768;

    const scaleX = naturalWidth / rect.width;
    const scaleY = naturalHeight / rect.height;

    const clickX = Math.round((e.clientX - rect.left) * scaleX);
    const clickY = Math.round((e.clientY - rect.top) * scaleY);

    addLog('user', 'action', `Clicked viewport at (${clickX}, ${clickY})`);

    try {
      await fetch(`${apiBase}/api/run/${runId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'click',
          x: clickX,
          y: clickY
        })
      });
    } catch (err) {
      console.error('Error forwarding click:', err);
    }
  };

  // Filtered Logs
  const filteredLogs = logs.filter((l) => {
    if (activeLogFilter === 'all') return true;
    return l.type === activeLogFilter;
  });

  return (
    <div className="flex flex-col h-full w-full bg-[#0B0F19] text-gray-100 font-sans select-none overflow-hidden border border-white/10 rounded-xl shadow-2xl">
      {/* 1. TOP STUDIO HEADER */}
      <div className="h-14 px-4 bg-[#111827]/90 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 via-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Globe className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white tracking-wide">Autonomous Browser Studio</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-mono border border-cyan-500/20 font-semibold">
                AGENTIC ENGINE v2.0
              </span>
            </div>
            <p className="text-[11px] text-gray-400">Playwright Automation • Cognitive RPA • CAPTCHA Intelligence</p>
          </div>
        </div>

        {/* Status Badges & Controls */}
        <div className="flex items-center space-x-3">
          {runId && (
            <div className="flex items-center space-x-2 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] font-mono">
              <span className="text-gray-400">RUN:</span>
              <span className="text-cyan-300 font-semibold">{runId.slice(0, 10)}</span>
              <span className="text-gray-500">|</span>
              <Clock className="w-3 h-3 text-gray-400" />
              <span className="text-gray-300">{elapsedSeconds}s</span>
            </div>
          )}

          {/* Status Badge */}
          <div
            className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5 border ${
              runStatus === 'running'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : runStatus === 'paused'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : runStatus === 'waiting_human'
                ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30 animate-pulse'
                : runStatus === 'completed'
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                : runStatus === 'error'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : 'bg-white/5 text-gray-400 border-white/10'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                runStatus === 'running'
                  ? 'bg-emerald-400 animate-ping'
                  : runStatus === 'waiting_human'
                  ? 'bg-fuchsia-400 animate-bounce'
                  : 'bg-gray-400'
              }`}
            />
            <span>{runStatus === 'waiting_human' ? 'HUMAN VERIFICATION' : runStatus}</span>
          </div>

          {/* Action buttons */}
          {runStatus === 'running' && (
            <button
              onClick={handlePause}
              title="Pause execution"
              className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold flex items-center space-x-1 border border-amber-500/30 transition-all"
            >
              <Pause className="w-3 h-3" />
              <span>Pause</span>
            </button>
          )}

          {(runStatus === 'paused' || runStatus === 'waiting_human') && (
            <button
              onClick={handleResume}
              title="Resume execution"
              className="px-2.5 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center space-x-1 border border-emerald-500/30 transition-all animate-pulse"
            >
              <Play className="w-3 h-3" />
              <span>Resume</span>
            </button>
          )}

          {(runStatus === 'running' || runStatus === 'paused' || runStatus === 'waiting_human') && (
            <button
              onClick={handleStop}
              title="Stop execution"
              className="px-2.5 py-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold flex items-center space-x-1 border border-rose-500/30 transition-all"
            >
              <Square className="w-3 h-3" />
              <span>Stop</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. TASK INPUT & PRESETS BAR */}
      <div className="p-3 bg-[#131B2E] border-b border-white/10 shrink-0">
        <div className="flex flex-col space-y-2">
          {/* Quick Presets */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0 flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Workflows:</span>
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPrompt(p.prompt);
                  setTargetUrl(p.url);
                  setActivePreset(p.id);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 flex items-center space-x-1.5 transition-all border ${
                  activePreset === p.id
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                    : 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10'
                }`}
              >
                <span>{p.title}</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-gray-400">{p.badge}</span>
              </button>
            ))}
          </div>

          {/* Main Prompt Bar */}
          <div className="flex items-center space-x-2">
            <div className="flex-1 flex items-center bg-[#0B0F19] border border-white/15 rounded-lg px-3 py-1.5 focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500/50 transition-all">
              <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
              <input
                type="text"
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setActivePreset(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && runStatus !== 'running') {
                    handleStartRun();
                  }
                }}
                placeholder="Instruct the autonomous browser agent (e.g. 'Open trycap.dev, click each CAPTCHA category, evaluate OCR')..."
                className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
              />
            </div>

            <div className="w-64 flex items-center bg-[#0B0F19] border border-white/15 rounded-lg px-2.5 py-1.5 shrink-0">
              <Globe className="w-3.5 h-3.5 text-gray-400 mr-1.5 shrink-0" />
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="Starting URL (optional)"
                className="w-full bg-transparent text-xs text-gray-300 placeholder-gray-500 focus:outline-none"
              />
            </div>

            <button
              onClick={handleStartRun}
              disabled={runStatus === 'running' || !prompt.trim()}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-cyan-500/20 transition-all shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Execute Task</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. COGNITIVE REASONING & ACTIVE STEP MONITOR */}
      <div className="px-4 py-2 bg-[#0F172A] border-b border-white/10 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2 overflow-hidden flex-1 mr-4">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
          <span className="font-bold text-cyan-400 shrink-0">THOUGHT:</span>
          <span className="text-gray-200 truncate">{currentThought}</span>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-gray-400">ACTION:</span>
          <span className="px-2 py-0.5 rounded bg-white/10 font-mono text-cyan-300 text-[11px] font-semibold">
            {currentAction}
          </span>
        </div>
      </div>

      {/* 4. MAIN WORKSPACE SPLIT (Left: Viewport & Live Stream, Right: State & Tools) */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: LIVE BROWSER VIEWPORT & INTERACTION */}
        <div className="flex-1 flex flex-col border-r border-white/10 bg-[#070A12] overflow-hidden">
          {/* Browser Address Bar */}
          <div className="h-10 px-3 bg-[#111827] border-b border-white/10 flex items-center space-x-2 shrink-0">
            <div className="flex items-center space-x-1 text-gray-400">
              <button className="p-1 hover:text-white rounded hover:bg-white/5 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button className="p-1 hover:text-white rounded hover:bg-white/5 transition-colors">
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button className="p-1 hover:text-white rounded hover:bg-white/5 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 flex items-center bg-[#070A12] border border-white/10 rounded-md px-2.5 py-1 text-xs">
              <span className="text-emerald-400 mr-1.5 text-[10px] font-mono">https://</span>
              <span className="text-gray-200 font-mono truncate">{currentUrl ? currentUrl.replace(/^https?:\/\//, '') : 'about:blank'}</span>
            </div>

            {pageTitle && (
              <span className="text-[11px] text-gray-400 max-w-[180px] truncate" title={pageTitle}>
                {pageTitle}
              </span>
            )}
          </div>

          {/* Viewport Canvas / Screenshot Container */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative bg-black/40">
            {liveScreenshot ? (
              <div className="relative border border-white/20 rounded-lg shadow-2xl overflow-hidden max-w-full max-h-full">
                <img
                  src={`data:image/jpeg;base64,${liveScreenshot}`}
                  alt="Live Browser Viewport"
                  onClick={handleViewportClick}
                  className={`max-w-full max-h-[540px] object-contain rounded-lg ${
                    runStatus === 'waiting_human' ? 'cursor-crosshair ring-2 ring-fuchsia-500 animate-pulse' : ''
                  }`}
                />
                {runStatus === 'waiting_human' && (
                  <div className="absolute top-3 left-3 right-3 bg-fuchsia-950/90 border border-fuchsia-500/50 rounded-lg p-2.5 shadow-xl backdrop-blur-sm flex items-center justify-between text-xs text-fuchsia-200">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-fuchsia-400 animate-bounce" />
                      <span>{humanAlert || 'Human interaction required. Click on challenge or verify.'}</span>
                    </div>
                    <button
                      onClick={handleResume}
                      className="px-3 py-1 rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs"
                    >
                      Solved & Resume
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-8 text-gray-500 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Globe className="w-8 h-8 text-gray-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-400">Browser Viewport Standby</h4>
                  <p className="text-xs text-gray-600 max-w-sm mt-1">
                    Enter a task instruction above and press Execute Task to initiate autonomous Playwright navigation.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Verification Bar */}
          {currentVerification && (
            <div className="px-3 py-1.5 bg-[#0A101D] border-t border-white/10 flex items-center space-x-2 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-bold text-emerald-400 shrink-0">VERIFICATION:</span>
              <span className="text-gray-300 truncate">{currentVerification}</span>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: TABS (PLANNING, CAPTCHA INTEL, LOGS, RESULTS) */}
        <div className="w-[420px] flex flex-col bg-[#0F172A] shrink-0">
          {/* Sub Tabs */}
          <div className="h-10 px-2 bg-[#111827] border-b border-white/10 flex items-center space-x-1 shrink-0">
            <button
              onClick={() => setActiveStudioTab('viewport')}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                activeStudioTab === 'viewport' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Plan ({planSteps.length})</span>
            </button>
            <button
              onClick={() => setActiveStudioTab('logs')}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                activeStudioTab === 'logs' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Logs ({logs.length})</span>
            </button>
            {captchaInfo && (
              <button
                onClick={() => setActiveStudioTab('elements')}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  activeStudioTab === 'elements' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-gray-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>CAPTCHA Intel</span>
              </button>
            )}
          </div>

          {/* TAB CONTENTS */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* 1. PLANNING TAB */}
            {activeStudioTab === 'viewport' && (
              <div className="space-y-3">
                {/* Objective Card */}
                {objective && (
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 space-y-1">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Identified Objective</span>
                    <p className="text-xs text-gray-200 leading-relaxed">{objective}</p>
                    {successCriteria && (
                      <div className="mt-1 pt-1 border-t border-white/5 flex items-start space-x-1 text-[11px] text-gray-400">
                        <span className="font-semibold text-gray-300">Goal:</span>
                        <span>{successCriteria}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Steps Checklist */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Execution Plan</span>
                  {planSteps.length === 0 ? (
                    <div className="p-4 rounded-lg bg-black/20 text-center text-xs text-gray-500">
                      No plan generated yet. Start a run to formulate steps.
                    </div>
                  ) : (
                    planSteps.map((step) => {
                      const isComplete = step.status === 'completed';
                      const isInProgress = step.status === 'in_progress';
                      return (
                        <div
                          key={step.id}
                          className={`p-2.5 rounded-lg border flex items-start space-x-2.5 transition-all ${
                            isComplete
                              ? 'bg-emerald-950/20 border-emerald-500/30 text-gray-200'
                              : isInProgress
                              ? 'bg-cyan-950/30 border-cyan-500/50 text-white shadow-md shadow-cyan-500/10'
                              : 'bg-white/5 border-white/5 text-gray-400'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isComplete ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : isInProgress ? (
                              <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                            ) : (
                              <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-gray-400">
                                {step.id}
                              </span>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium leading-snug">{step.description}</p>
                            {step.expected_outcome && (
                              <p className="text-[11px] text-gray-500 mt-0.5">Expects: {step.expected_outcome}</p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Final Report & Download Card */}
                {finalReport && (
                  <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-950/40 to-cyan-950/40 border border-emerald-500/40 space-y-2">
                    <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-xs">
                      <Check className="w-4 h-4" />
                      <span>Task Completed Successfully</span>
                    </div>
                    <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-line">{finalReport.summary}</p>
                    {downloadFiles.length > 0 && (
                      <div className="pt-2 border-t border-white/10 space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Generated Files:</span>
                        {downloadFiles.map((f, i) => (
                          <a
                            key={i}
                            href={f.url}
                            download={f.name}
                            className="flex items-center justify-between p-2 rounded bg-black/40 border border-white/10 hover:border-cyan-400 text-xs text-cyan-300 font-mono transition-all group"
                          >
                            <div className="flex items-center space-x-2">
                              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                              <span>{f.name}</span>
                            </div>
                            <Download className="w-3.5 h-3.5 text-gray-400 group-hover:text-white" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. LOGS TAB */}
            {activeStudioTab === 'logs' && (
              <div className="space-y-2">
                {/* Filter pills */}
                <div className="flex items-center space-x-1 text-[10px] pb-1 overflow-x-auto no-scrollbar">
                  {(['all', 'thought', 'action', 'verification', 'captcha'] as const).map((flt) => (
                    <button
                      key={flt}
                      onClick={() => setActiveLogFilter(flt)}
                      className={`px-2 py-0.5 rounded capitalize ${
                        activeLogFilter === flt ? 'bg-cyan-500 text-white font-bold' : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      {flt}
                    </button>
                  ))}
                </div>

                <div className="font-mono text-[11px] space-y-1.5 max-h-[500px] overflow-y-auto">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-1.5 rounded bg-black/30 border border-white/5 flex flex-col space-y-0.5 leading-relaxed"
                    >
                      <div className="flex items-center justify-between text-[9px] text-gray-500">
                        <span className="text-cyan-400 font-bold uppercase">[{log.agent} / {log.type}]</span>
                        <span>{log.time}</span>
                      </div>
                      <p className="text-gray-200 whitespace-pre-wrap">{log.message}</p>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}

            {/* 3. CAPTCHA INTEL TAB */}
            {activeStudioTab === 'elements' && captchaInfo && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">CAPTCHA Intelligence Analysis</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                      {captchaInfo.is_test_env ? 'TEST BENCHMARK' : 'LIVE SITE'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-black/40">
                      <span className="text-[10px] text-gray-400 block">Type</span>
                      <span className="font-semibold text-gray-200">{captchaInfo.captcha_type || 'Unknown'}</span>
                    </div>
                    <div className="p-2 rounded bg-black/40">
                      <span className="text-[10px] text-gray-400 block">Provider</span>
                      <span className="font-semibold text-gray-200">{captchaInfo.provider || 'Generic'}</span>
                    </div>
                    <div className="p-2 rounded bg-black/40">
                      <span className="text-[10px] text-gray-400 block">Confidence</span>
                      <span className="font-semibold text-cyan-300">{Math.round((captchaInfo.confidence || 0) * 100)}%</span>
                    </div>
                    <div className="p-2 rounded bg-black/40">
                      <span className="text-[10px] text-gray-400 block">Environment</span>
                      <span className="font-semibold text-emerald-400">{captchaInfo.is_test_env ? 'Authorized Test' : 'Third-Party'}</span>
                    </div>
                  </div>

                  {captchaInfo.dom_indicators && captchaInfo.dom_indicators.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 font-bold uppercase">DOM Indicators</span>
                      <div className="space-y-1">
                        {captchaInfo.dom_indicators.map((ind: string, idx: number) => (
                          <div key={idx} className="p-1 rounded bg-white/5 font-mono text-[10px] text-gray-300 truncate">
                            {ind}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutonomousBrowserStudio;
