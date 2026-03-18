
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { analyzeVideo } from './geminiService';
import { SceneJson, BulkVideoItem } from './types';

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
        // Fallback for environments without aistudio global
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
  const [mergeLimit, setMergeLimit] = useState(1000000); // ~1MB characters

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
        
        // Auto download after completion
        downloadItem(item.file.name, result.scenes);
      } catch (err: any) {
        console.error(err);
        const errorMsg = err.message || "";
        if (errorMsg.includes("Requested entity was not found")) {
          setHasApiKey(false);
          setError("API Key không hợp lệ hoặc đã hết hạn. Vui lòng chọn lại.");
          setIsBulkProcessing(false);
          return;
        }
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

    const csvRows = [];
    // Header
    csvRows.push('"FileName","Content"');

    const escapeCsv = (str: string) => {
      return `"${str.replace(/"/g, '""')}"`;
    };

    for (const file of mergeFiles) {
      const text = await file.text();
      csvRows.push(`${escapeCsv(file.name)},${escapeCsv(text)}`);
    }

    const csvContent = csvRows.join("\r\n");
    const blob = new Blob(["\uFEFF", csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mergeOutputName || 'prompts'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert("Đã chuyển đổi sang CSV và tải về thành công!");
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
      a.download = `${mergeOutputName}${mergeFiles.length > 1 && index > 0 ? `_part${index}` : ''}.txt`;
      if (index === 0 && currentFileContent === "") return; // Should not happen
      a.click();
      URL.revokeObjectURL(url);
    };

    for (const file of mergeFiles) {
      const text = await file.text();
      const separator = currentFileContent === "" ? "" : "\n\n";
      
      if (currentFileContent.length + separator.length + text.length > mergeLimit) {
        // Download current batch if not empty
        if (currentFileContent !== "") {
          download(currentFileContent, fileIndex);
          fileIndex++;
        }
        // Start new batch with this file
        currentFileContent = text;
      } else {
        currentFileContent += separator + text;
      }
    }

    // Download the last batch
    if (currentFileContent !== "") {
      download(currentFileContent, fileIndex > 1 ? fileIndex : 0);
    }
    
    alert("Đã gộp và tải về các file thành công!");
  };

  const startAnalysis = async () => {
    if (!file || (isCustomStyle && !customStyleText)) return;
    
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeVideo(file, currentStyle, selectedModel, 0);
      setScenes(result.scenes);
      // Auto download after completion
      downloadItem(file.name, result.scenes);
    } catch (err: any) {
      console.error(err);
      const errorMsg = err.message || "";
      if (errorMsg.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setError("API Key không hợp lệ hoặc đã hết hạn. Vui lòng chọn lại.");
      } else {
        setError("Lỗi xử lý video. Vui lòng thử lại với file dung lượng nhỏ hơn hoặc model khác.");
      }
    } finally {
      setLoading(false);
    }
  };

  const continueAnalysis = async () => {
    if (!file || scenes.length === 0) return;
    setContinuing(true);
    try {
      const lastIdStr = scenes[scenes.length - 1].scene_id;
      const lastId = parseInt(lastIdStr);
      const result = await analyzeVideo(file, currentStyle, selectedModel, isNaN(lastId) ? scenes.length : lastId);
      if (result.scenes.length > 0) {
        setScenes(prev => [...prev, ...result.scenes]);
      } else {
        alert("Không tìm thấy thêm nội dung mới.");
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg = err.message || "";
      if (errorMsg.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setError("API Key không hợp lệ hoặc đã hết hạn. Vui lòng chọn lại.");
      } else {
        setError("Lỗi khi tiếp tục phân tích video.");
      }
    } finally {
      setContinuing(false);
    }
  };

  const downloadTxt = () => {
    if (scenes.length === 0) return;
    const blob = new Blob([formattedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video_copy_${file?.name || 'analysis'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    if (textAreaRef.current) {
      textAreaRef.current.select();
      document.execCommand('copy');
      alert('Đã sao chép nội dung phân tích!');
    }
  };

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-200 p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="bg-indigo-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-indigo-500/20">
            <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Cấu hình API Key</h1>
            <p className="text-sm text-slate-400">Bạn cần chọn một API Key từ dự án Google Cloud có trả phí để sử dụng các mô hình Gemini 3.</p>
          </div>
          <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl text-[11px] text-indigo-300 leading-relaxed text-left">
            <p className="font-bold mb-1">Lưu ý:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Sử dụng API Key từ tài khoản đã thiết lập thanh toán.</li>
              <li>Xem hướng dẫn thiết lập tại <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-400 transition-colors">ai.google.dev/billing</a>.</li>
            </ul>
          </div>
          <button
            onClick={handleSelectKey}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-all"
          >
            Chọn API Key
          </button>
        </div>
      </div>
    );
  }

  if (hasApiKey === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200">
      <Header onSelectKey={handleSelectKey} />
      
      <main className="flex-grow max-w-7xl mx-auto w-full px-6 py-8">
        
        {/* Mode Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-slate-900 p-1 rounded-2xl border border-slate-800 flex flex-wrap justify-center gap-1">
            <button 
              onClick={() => { setIsBulkMode(false); setIsMergeMode(false); setIsCsvMode(false); }}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(!isBulkMode && !isMergeMode && !isCsvMode) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Single Clone
            </button>
            <button 
              onClick={() => { setIsBulkMode(true); setIsMergeMode(false); setIsCsvMode(false); }}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(isBulkMode && !isMergeMode && !isCsvMode) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Bulk Prompt Clone
            </button>
            <button 
              onClick={() => { setIsBulkMode(false); setIsMergeMode(true); setIsCsvMode(false); }}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(isMergeMode && !isCsvMode) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Merge TXT Prompts
            </button>
            <button 
              onClick={() => { setIsBulkMode(false); setIsMergeMode(false); setIsCsvMode(true); }}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isCsvMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              TXT to CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Controls Panel */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
              
              <div>
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  {(isMergeMode || isCsvMode) ? "Nguồn File TXT" : "Nguồn Video"}
                </h2>
                <div className="relative group border-2 border-dashed border-slate-800 rounded-2xl p-6 text-center hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all cursor-pointer">
                  <input 
                    type="file" 
                    accept={(isMergeMode || isCsvMode) ? ".txt" : "video/*"} 
                    multiple={isBulkMode || isMergeMode || isCsvMode} 
                    onChange={handleFileChange} 
                    className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                  />
                  <div className="space-y-2">
                    <svg className="w-8 h-8 mx-auto text-slate-600 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      {(isMergeMode || isCsvMode)
                        ? (mergeFiles.length > 0 ? `Đã chọn ${mergeFiles.length} file` : "Kéo thả hoặc nhấp để chọn nhiều file TXT")
                        : isBulkMode 
                          ? (bulkItems.length > 0 ? `Đã chọn ${bulkItems.length} video` : "Kéo thả hoặc nhấp để chọn nhiều video")
                          : (file ? file.name : "Kéo thả hoặc nhấp để chọn video")
                      }
                    </p>
                  </div>
                </div>
              </div>

              {isMergeMode || isCsvMode ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Tên file đầu ra</label>
                    <input 
                      type="text"
                      value={mergeOutputName}
                      onChange={(e) => setMergeOutputName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 focus:border-indigo-500 focus:outline-none transition-all"
                      placeholder={isCsvMode ? "prompts" : "merged_prompts"}
                    />
                  </div>
                  {isMergeMode && (
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Giới hạn ký tự mỗi file</label>
                      <input 
                        type="number"
                        value={mergeLimit}
                        onChange={(e) => setMergeLimit(parseInt(e.target.value) || 1000000)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 focus:border-indigo-500 focus:outline-none transition-all"
                      />
                    </div>
                  )}
                  <button
                    onClick={isCsvMode ? handleConvertToCsv : handleMergeFiles}
                    disabled={mergeFiles.length === 0}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 shadow-xl shadow-emerald-600/20 active:scale-[0.98] transition-all"
                  >
                    {isCsvMode ? "Chuyển sang CSV" : "Gộp và Tải về"}
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      Cấu hình Sao chép
                    </h2>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">AI Model</label>
                        <select 
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 focus:border-indigo-500 focus:outline-none transition-all"
                        >
                          {MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Phong cách đích</label>
                        <select 
                          value={isCustomStyle ? "custom" : selectedStyle}
                          onChange={(e) => {
                            if (e.target.value === "custom") {
                              setIsCustomStyle(true);
                            } else {
                              setIsCustomStyle(false);
                              setSelectedStyle(e.target.value);
                            }
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 focus:border-indigo-500 focus:outline-none transition-all"
                        >
                          {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                          <option value="custom">Tùy chỉnh phong cách...</option>
                        </select>
                        {isCustomStyle && (
                          <input 
                            type="text"
                            placeholder="Ví dụ: Hoạt hình Ghibli, 3D Pixar..."
                            value={customStyleText}
                            onChange={(e) => setCustomStyleText(e.target.value)}
                            className="w-full mt-2 bg-slate-950 border border-indigo-500/30 rounded-xl px-4 py-3 text-xs font-medium text-white focus:border-indigo-500 outline-none transition-all"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {!isBulkMode && previewUrl && (
                    <div className="rounded-2xl overflow-hidden border border-slate-800 aspect-video bg-black shadow-2xl">
                      <video src={previewUrl} controls className="w-full h-full object-contain" />
                    </div>
                  )}

                  {isBulkMode ? (
                    <button
                      onClick={startBulkAnalysis}
                      disabled={bulkItems.length === 0 || isBulkProcessing || (isCustomStyle && !customStyleText)}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-all"
                    >
                      {isBulkProcessing ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Đang xử lý hàng loạt...</span>
                        </div>
                      ) : "Bắt đầu Clone hàng loạt"}
                    </button>
                  ) : (
                    <button
                      onClick={startAnalysis}
                      disabled={!file || loading || continuing || (isCustomStyle && !customStyleText)}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-all"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Đang trích xuất dữ liệu...</span>
                        </div>
                      ) : "Bắt đầu Sao chép nội dung"}
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
              <h3 className="text-indigo-400 font-black text-[10px] uppercase tracking-widest mb-2 italic">Thông tin công cụ</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Hệ thống sẽ chia nhỏ video thành các phân đoạn 8 giây để phân tích chi tiết về nhân vật, bối cảnh, hành động và phong cách hình ảnh. 
                Kết quả trả về định dạng JSON kỹ thuật dùng để tái tạo video trên các nền tảng AI Video Generation.
              </p>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-8 flex flex-col">
            <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl flex flex-col h-full min-h-[600px] overflow-hidden">
              {isMergeMode || isCsvMode ? (
                <>
                  <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${mergeFiles.length > 0 ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`}></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Danh sách file ({mergeFiles.length})</span>
                    </div>
                    {mergeFiles.length > 0 && (
                      <button onClick={() => setMergeFiles([])} className="text-[10px] font-bold text-red-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all border border-transparent hover:border-red-500/20">XÓA TẤT CẢ</button>
                    )}
                  </div>
                  <div className="flex-grow p-6 overflow-y-auto space-y-4 max-h-[700px] scrollbar-thin scrollbar-thumb-slate-800">
                    {mergeFiles.length > 0 ? (
                      mergeFiles.map((f, idx) => (
                        <div key={idx} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 group hover:border-slate-700 transition-all">
                          <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center border border-indigo-500/20">
                            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-grow min-w-0">
                            <h4 className="text-[11px] font-bold text-slate-300 truncate uppercase tracking-tight">{f.name}</h4>
                            <p className="text-[9px] text-slate-600 font-bold uppercase mt-1">{(f.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <button 
                            onClick={() => removeMergeFile(idx)}
                            className="p-2 text-slate-700 hover:text-red-400 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-700 space-y-4 py-20">
                        <div className="p-8 bg-slate-950 rounded-full border border-slate-900">
                          <svg className="w-16 h-16 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-20">Chưa có file TXT trong danh sách</p>
                      </div>
                    )}
                  </div>
                </>
              ) : isBulkMode ? (
                <>
                  <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${bulkItems.some(it => it.status === 'processing') ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`}></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Danh sách xử lý hàng loạt ({bulkItems.length})</span>
                    </div>
                    {bulkItems.some(it => it.status === 'completed') && (
                      <button onClick={downloadAllBulk} className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all border border-transparent hover:border-emerald-500/20">TẢI VỀ TẤT CẢ (.TXT)</button>
                    )}
                  </div>
                  <div className="flex-grow p-6 overflow-y-auto space-y-4 max-h-[700px] scrollbar-thin scrollbar-thumb-slate-800">
                    {bulkItems.length > 0 ? (
                      bulkItems.map((item) => (
                        <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 group hover:border-slate-700 transition-all">
                          <div className="w-20 h-12 bg-black rounded-lg overflow-hidden border border-slate-800 flex-shrink-0">
                            <video src={item.previewUrl} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-grow min-w-0">
                            <h4 className="text-[11px] font-bold text-slate-300 truncate uppercase tracking-tight">{item.file.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              {item.status === 'processing' && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 border border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                  <span className="text-[9px] text-indigo-400 font-bold uppercase">Đang phân tích...</span>
                                </div>
                              )}
                              {item.status === 'completed' && <span className="text-[9px] text-emerald-500 font-bold uppercase">Hoàn thành ({item.scenes.length} scenes)</span>}
                              {item.status === 'error' && <span className="text-[9px] text-red-500 font-bold uppercase">{item.error}</span>}
                              {item.status === 'idle' && <span className="text-[9px] text-slate-600 font-bold uppercase">Chờ xử lý</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.status === 'completed' && (
                              <button 
                                onClick={() => {
                                  const text = item.scenes.map(s => JSON.stringify(s)).join('\n\n');
                                  const blob = new Blob([text], { type: 'text/plain' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `video_copy_${item.file.name}.txt`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                                className="p-2 text-slate-500 hover:text-emerald-400 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              </button>
                            )}
                            <button 
                              onClick={() => removeBulkItem(item.id)}
                              disabled={item.status === 'processing'}
                              className="p-2 text-slate-700 hover:text-red-400 transition-colors disabled:opacity-0"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-700 space-y-4 py-20">
                        <div className="p-8 bg-slate-950 rounded-full border border-slate-900">
                          <svg className="w-16 h-16 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-20">Chưa có video trong danh sách</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${scenes.length > 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-slate-700'}`}></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dữ liệu nội dung (JSON)</span>
                    </div>
                    <div className="flex gap-2">
                      {scenes.length > 0 && (
                        <>
                          <button onClick={copyToClipboard} className="text-[10px] font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all border border-transparent hover:border-slate-700">SAO CHÉP</button>
                          <button onClick={downloadTxt} className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all border border-transparent hover:border-emerald-500/20">TẢI VỀ .TXT</button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex-grow p-6 flex flex-col">
                    {scenes.length > 0 ? (
                      <>
                        <div className="flex-grow relative">
                          <textarea
                            ref={textAreaRef}
                            readOnly
                            value={formattedText}
                            className="absolute inset-0 w-full h-full bg-slate-950 border border-slate-800 rounded-2xl p-6 font-mono text-[11px] text-indigo-300 focus:outline-none resize-none leading-relaxed shadow-inner scrollbar-thin scrollbar-thumb-slate-800"
                          />
                        </div>
                        <div className="mt-6 flex justify-center">
                          <button
                            onClick={continueAnalysis}
                            disabled={continuing || loading}
                            className="group flex items-center gap-3 bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                          >
                            {continuing ? (
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                              <svg className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                            )}
                            Phân tích đoạn tiếp theo
                          </button>
                        </div>
                      </>
                    ) : loading ? (
                      <div className="flex-grow flex flex-col items-center justify-center space-y-6 text-center">
                        <div className="relative">
                          <div className="w-20 h-20 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 border-2 border-indigo-500/20 rounded-full"></div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest animate-pulse">Đang giải mã cấu trúc video...</p>
                          <p className="text-[9px] text-slate-500 max-w-[200px] leading-relaxed">AI đang quan sát và trích xuất từng chi tiết nhỏ trong video của bạn.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-grow flex flex-col items-center justify-center text-slate-700 space-y-4">
                        <div className="p-8 bg-slate-950 rounded-full border border-slate-900">
                          <svg className="w-16 h-16 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-20">Sẵn sàng phân tích dữ liệu</p>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {error && (
                <div className="mx-6 mb-6 p-4 bg-red-950/30 border border-red-500/30 rounded-2xl text-red-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center border-t border-slate-900 bg-slate-950">
        <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.4em]">Engineered for Content Re-creation • Private Environment</p>
      </footer>
    </div>
  );
}
