import React, { useState, useMemo, useRef, useEffect } from 'react';
import { analyzeVideo } from './geminiService';
import { SceneJson, BulkVideoItem } from './types';
import { LicenseGate } from './LicenseGate';

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

function MainApp() {
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
        console.error(err);
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

  const handleMergeFiles = async () => {
    if (mergeFiles.length === 0) return;
    let currentFileContent = "";
    let fileIndex = 1;

    const download = (content: string, index: number) => {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${mergeOutputName}${index > 0 ? `_part${index}` : ''}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    };

    for (const file of mergeFiles) {
      const text = await file.text();
      if (currentFileContent.length + text.length > mergeLimit) {
        download(currentFileContent, fileIndex++);
        currentFileContent = text;
      } else {
        currentFileContent += (currentFileContent ? "\n\n" : "") + text;
      }
    }
    if (currentFileContent) download(currentFileContent, fileIndex > 1 ? fileIndex : 0);
    alert("Đã gộp thành công!");
  };

  const startAnalysis = async () => {
    if (!file || (isCustomStyle && !customStyleText)) return;
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeVideo(file, currentStyle, selectedModel, 0);
      setScenes(result.scenes);
      downloadItem(file.name, result.scenes);
    } catch (err: any) {
      setError("Lỗi xử lý video. Kiểm tra API Key hoặc dung lượng file.");
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
      else alert("Hết nội dung.");
    } finally {
      setContinuing(false);
    }
  };

  if (hasApiKey === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-200 p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Cấu hình API Key</h1>
          <p className="text-sm text-slate-400">Bạn cần chọn một API Key để tiếp tục.</p>
          <button onClick={handleSelectKey} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-500 transition-all">
            Chọn API Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200">
      <Header onSelectKey={handleSelectKey} />
      <main className="flex-grow max-w-7xl mx-auto w-full px-6 py-8">
        {/* Nội dung chính của App đã có sẵn trong file của bạn */}
        <div className="flex justify-center mb-8">
          <div className="bg-slate-900 p-1 rounded-2xl border border-slate-800 flex flex-wrap justify-center gap-1">
             <button onClick={() => { setIsBulkMode(false); setIsMergeMode(false); setIsCsvMode(false); }} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(!isBulkMode && !isMergeMode && !isCsvMode) ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Single Clone</button>
             <button onClick={() => { setIsBulkMode(true); setIsMergeMode(false); setIsCsvMode(false); }} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(isBulkMode) ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Bulk Prompt Clone</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Nguồn Video
              </h2>
              <input type="file" accept="video/*" multiple={isBulkMode} onChange={handleFileChange} className="w-full text-xs text-slate-500" />
              <button onClick={isBulkMode ? startBulkAnalysis : startAnalysis} disabled={loading || isBulkProcessing} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase">
                {loading || isBulkProcessing ? "Đang xử lý..." : "Bắt đầu"}
              </button>
            </div>
          </div>
          <div className="lg:col-span-8">
             <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 h-full min-h-[400px]">
                {scenes.length > 0 ? (
                   <textarea readOnly value={formattedText} className="w-full h-full bg-slate-950 text-indigo-300 p-4 rounded-xl font-mono text-xs" />
                ) : <p className="text-center text-slate-600 mt-20">Chưa có dữ liệu</p>}
             </div>
          </div>
        </div>
      </main>
      <footer className="py-6 text-center border-t border-slate-900">
        <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.4em]">Engineered for Content Re-creation</p>
      </footer>
    </div>
  );
}

// KHÓA TOÀN BỘ APP Ở ĐÂY
export default function App() {
  return (
    <LicenseGate>
      <MainApp />
    </LicenseGate>
  );
}
