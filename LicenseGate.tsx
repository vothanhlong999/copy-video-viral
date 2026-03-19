import React, { useState, useEffect } from 'react';

export const LicenseGate = ({ children }: { children: React.ReactNode }) => {
  const [key, setKey] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  // Kiểm tra xem máy này đã kích hoạt chưa (lưu trong trình duyệt)
  useEffect(() => {
    if (localStorage.getItem("license_status") === "active") {
      setIsVerified(true);
    }
  }, []);

  const handleActive = async () => {
    if (!key) return alert("Vui lòng nhập mã!");
    setLoading(true);
    
    // THAY URL NÀY BẰNG URL APPS SCRIPT CỦA BẠN (Ảnh 2 bạn gửi)
    const scriptUrl = "https://script.google.com/macros/s/AKfycbxKB2i_iFbU01uDteJ04pegospZeIp34NCMG9pxK5_Z0aj9XnCA0OuMqKz-2yxwPStz-w/exec"; 
    const deviceId = window.navigator.userAgent + window.screen.width;

    try {
      const res = await fetch(`${scriptUrl}?key=${key}&deviceId=${encodeURIComponent(deviceId)}`);
      const status = await res.text();
      
      if (status === "SUCCESS") {
        localStorage.setItem("license_status", "active");
        setIsVerified(true);
      } else {
        alert("Lỗi: " + status);
      }
    } catch (e) {
      alert("Không thể kết nối máy chủ xác thực!");
    } finally {
      setLoading(false);
    }
  };

  if (isVerified) return <>{children}</>;

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <div style={{ padding: '40px', background: '#1e293b', borderRadius: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '10px', color: '#818cf8' }}>VIDEO TO PROMPT VEO3</h1>
        <p style={{ color: '#94a3b8', marginBottom: '20px' }}>Vui lòng nhập License Key để sử dụng hệ thống</p>
        
        <input 
          type="text" 
          value={key} 
          onChange={(e) => setKey(e.target.value)} 
          placeholder="Ví dụ: APP-999-XXXX"
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: 'white', marginBottom: '15px', outline: 'none' }}
        />
        
        <button 
          onClick={handleActive} 
          disabled={loading}
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: loading ? '#475569' : '#6366f1', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? "ĐANG KIỂM TRA..." : "KÍCH HOẠT NGAY"}
        </button>
        {/* Thông báo hỗ trợ Zalo */}
<div className="mt-8 pt-6 border-t border-slate-800 space-y-3 text-center">
  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Hỗ trợ kích hoạt</p>
  
  <div className="flex flex-col gap-2">
    <a 
      href="https://zalo.me/0888649819" 
      target="_blank" 
      rel="noopener noreferrer"
      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
    >
      📞 Liên hệ: <span className="font-black">0888649819</span> (Cô Thơm)
    </a>
    
    <a 
      href="https://zalo.me/g/pudpsm858" 
      target="_blank" 
      rel="noopener noreferrer"
      className="inline-block px-4 py-2 bg-slate-800/50 hover:bg-indigo-500/10 border border-slate-700 hover:border-indigo-500/30 rounded-xl text-[10px] text-slate-300 transition-all"
    >
      💬 Group hỗ trợ: <span className="text-indigo-400 font-bold">[ 999 Tool ]</span>
    </a>
  </div>
</div>
      </div>
    </div>
  );
};
