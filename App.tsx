import React, { useState, useMemo, useRef, useEffect } from 'react';
import { analyzeVideo } from './geminiService';
import { SceneJson, BulkVideoItem } from './types';
import { LicenseGate } from './LicenseGate'; // Bổ sung dòng này

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const STYLES = [
  "Phân tích theo video gốc (Original Style)",
  "Synthwave, neon sunset, 80s retro",
  "Dark fantasy, dramatic lighting",
  "Kawaii chibi cute style",
  "Hyper-realistic portrait",
  "Sci-fi futuristic spaceship",
  "Disney classic 2D animation"
];

const MODELS = [
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash (Nhanh nhất)" },
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro (Chính xác cao)" }
];

const Header: React.FC<{ onSelectKey: () => void }> = ({ onSelectKey }) => (
  <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 py-4 shadow-xl">
    <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-500 p-2 rounded-lg shadow-indigo-500/20 shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-black text-white tracking-tighter uppercase leading-none">Video to <span className="text-indigo-400">Prompt VEO3</span></h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">AI Video Analysis Engine</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={onSelectKey}
          className="text-[10px] font-black text-slate-400 hover:text-indigo-400 bg-slate-800/50 border border-slate-800 px-4 py-2 rounded-full tracking-widest uppercase transition-all"
        >
          Đổi API Key
        </button>
        <div className="hidden sm:flex items-center gap-2 text-[10px] font-black text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 px-4 py-2 rounded-full tracking-widest uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Hệ thống sẵn sàng
        </div>
      </div>
    </div>
  </header>
);

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [scenes, setScenes] = useState<SceneJson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [isCustomStyle, setIsCustomStyle] = useState(false);
  const [customStyleText, setCustomStyleText] = useState("");
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [isCsvMode, setIsCsvMode] = useState(false);
  const [bulkItems, setBulkItems] = useState<BulkVideoItem[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [mergeOutputName, setMergeOutputName] = useState("merged_prompts");
  const [mergeLimit, setMergeLimit] = useState(1000000);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const currentStyle = isCustomStyle ? customStyleText : selectedStyle;

  const formattedText = useMemo(() => {
    return scenes.map(s => JSON.stringify(s)).join('\n\n');
  }, [scenes]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    if (selectedFiles.length === 0) return;

    if (isMergeMode || isCsvMode) {
      setMergeFiles(prev => [...prev, ...selectedFiles]);
      return;
    }

    if (isBulkMode) {
      const newItems: BulkVideoItem[] = selectedFiles.map(f => ({
        id: Math.random().toString(36).substring(7),
        file: f,
        previewUrl: URL.createObjectURL(f),
        status: 'idle',
        scenes: [] as SceneJson[]
      }));
      setBulkItems(prev => [...prev, ...newItems]);
    } else {
      const selected = selectedFiles[0];
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setScenes([]);
      setError(null);
    }
  };

  const downloadItem = (fileName: string, scenes: SceneJson[]) => {
    const text = scenes.map(s => JSON.stringify(s)).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video_copy_${fileName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startBulkAnalysis = async () => {
    if (bulkItems.length === 0 || isBulkProcessing) return;
    setIsBulkProcessing(true);
    for (let i = 0; i < bulkItems.length; i++) {
      const item = bulkItems[i];
      if (item.status === 'completed') continue;
      setBulkItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'processing' } : it));
      try {
        const result = await analyzeVideo(item.file, currentStyle, selectedModel, 0);
        setBulkItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'completed', scenes: result.scenes } : it));
        downloadItem(item.file.name, result.scenes);
      } catch (err: any) {
        setBulkItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'error', error: "Lỗi xử lý video." } : it));
      }
    }
    setIsBulkProcessing(false);
  };

  const downloadAllBulk = () => {
    bulkItems.filter(it => it.status === 'completed').forEach(item => {
      downloadItem(item.file.name, item.scenes);
    });
  };

  const removeBulkItem = (id: string) => {
    setBulkItems(prev => prev.filter(it => it.id !== id));
  };

  const removeMergeFile = (index: number) => {
    setMergeFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleConvertToCsv = async () => {
    if (mergeFiles.length === 0) return;
    const csvRows = ['"FileName","Content"'];
    const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
    for (const file of mergeFiles) {
      const text = await file.text();
      csvRows.push(`${escapeCsv(file.name)},${escapeCsv(text)}`);
    }
    const blob = new Blob(["\uFEFF", csvRows.join("\r\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${mergeOutputName || 'prompts'}.csv`; a.click();
    URL.revokeObjectURL(url);
    alert("Thành công!");
  };

  const handleMergeFiles = async () => {
    if (mergeFiles.length === 0) return;
    let content = "";
    for (const file of mergeFiles) {
      const text = await file.text();
      content += (content === "" ? "" : "\n\n") + text;
    }
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${mergeOutputName}.txt`; a.click();
    URL.revokeObjectURL(url);
    alert("Thành công!");
  };

  const startAnalysis = async () => {
    if (!file || (isCustomStyle && !customStyleText)) return;
    setLoading(true); setError(null);
    try {
      const result = await analyzeVideo(file, currentStyle, selectedModel, 0);
      setScenes(result.scenes);
      downloadItem(file.name, result.scenes);
    } catch (err: any) {
      setError("Lỗi xử lý video.");
    } finally {
      setLoading(false);
    }
  };

  const continueAnalysis = async () => {
    if (!file || scenes.length === 0) return;
    setContinuing(true);
    try {
      const lastId = parseInt(scenes[scenes.length - 1].scene_id);
      const result = await analyzeVideo(file, currentStyle, selectedModel, isNaN(lastId) ? scenes.length : lastId);
      if (result.scenes.length > 0) setScenes(prev => [...prev, ...result.scenes]);
    } finally {
      setContinuing(false);
    }
  };

  // --- PHẦN QUAN TRỌNG: BAO BỌC LICENSEGATE ---
  return (
    <LicenseGate>
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200">
        <Header onSelectKey={handleSelectKey} />
        
        {hasApiKey === false ? (
          <div className="flex-grow flex flex-col items-center justify-center p-6">
             <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6">
                <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Cấu hình API Key</h1>
                <p className="text-sm text-slate-400">Bạn cần chọn một API Key để sử dụng.</p>
                <button onClick={handleSelectKey} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest">Chọn API Key</button>
             </div>
          </div>
        ) : hasApiKey === null ? (
          <div className="flex-grow flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <main className="flex-grow max-w-7xl mx-auto w-full px-6 py-8">
            <div className="flex justify-center mb-8">
              <div className="bg-slate-900 p-1 rounded-2xl border border-slate-800 flex flex-wrap justify-center gap-1">
                <button onClick={() => { setIsBulkMode(false); setIsMergeMode(false); setIsCsvMode(false); }} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(!isBulkMode && !isMergeMode && !isCsvMode) ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Single Clone</button>
                <button onClick={() => { setIsBulkMode(true); setIsMergeMode(false); setIsCsvMode(false); }} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(isBulkMode && !isMergeMode && !isCsvMode) ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Bulk Prompt Clone</button>
                <button onClick={() => { setIsBulkMode(false); setIsMergeMode(true); setIsCsvMode(false); }} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(isMergeMode && !isCsvMode) ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Merge TXT</button>
                <button onClick={() => { setIsBulkMode(false); setIsMergeMode(false); setIsCsvMode(true); }} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isCsvMode ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>TXT to CSV</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    {(isMergeMode || isCsvMode) ? "Nguồn File TXT" : "Nguồn Video"}
                  </h2>
                  <div className="relative group border-2 border-dashed border-slate-800 rounded-2xl p-6 text-center hover:border-indigo-500/50 hover:bg-indigo-500/5 cursor-pointer">
                    <input type="file" multiple={isBulkMode || isMergeMode || isCsvMode} accept={isMergeMode || isCsvMode ? ".txt" : "video/*"} onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{file || bulkItems.length > 0 || mergeFiles.length > 0 ? "Đã chọn file" : "Nhấp để chọn file"}</p>
                  </div>
                  
                  {!(isMergeMode || isCsvMode) && (
                    <div className="space-y-4">
                      <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 focus:border-indigo-500 outline-none transition-all">
                        {MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <select value={isCustomStyle ? "custom" : selectedStyle} onChange={(e) => e.target.value === "custom" ? setIsCustomStyle(true) : (setIsCustomStyle(false), setSelectedStyle(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 focus:border-indigo-500 outline-none transition-all">
                        {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                        <option value="custom">Tùy chỉnh phong cách...</option>
                      </select>
                    </div>
                  )}

                  <button onClick={isCsvMode ? handleConvertToCsv : (isMergeMode ? handleMergeFiles : (isBulkMode ? startBulkAnalysis : startAnalysis))} disabled={loading || isBulkProcessing} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 shadow-xl transition-all">
                    {loading || isBulkProcessing ? "Đang xử lý..." : "Bắt đầu"}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-8 flex flex-col">
                <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl flex flex-col h-full min-h-[600px] overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dữ liệu kết quả</span>
                  </div>
                  <div className="flex-grow p-6">
                    {scenes.length > 0 ? (
                      <textarea ref={textAreaRef} readOnly value={formattedText} className="w-full h-full bg-slate-950 border border-slate-800 rounded-2xl p-6 font-mono text-[11px] text-indigo-300 outline-none resize-none leading-relaxed" />
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-700 opacity-20 uppercase font-black text-[10px] tracking-widest">Sẵn sàng phân tích dữ liệu</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}

        <footer className="py-6 text-center border-t border-slate-900 bg-slate-950">
          <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.4em]">Engineered for Content Re-creation • Private Environment</p>
        </footer>
      </div>
    </LicenseGate>
  );
}
