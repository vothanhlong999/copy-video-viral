import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, SceneJson } from "./types";

// Ensure we don't try to overwrite fetch if it's read-only
const getFetch = () => {
  if (typeof window !== 'undefined' && window.fetch) return window.fetch.bind(window);
  if (typeof globalThis !== 'undefined' && globalThis.fetch) return globalThis.fetch.bind(globalThis);
  throw new Error("Fetch is not available in this environment.");
};

const SYSTEM_INSTRUCTION = (style: string) => {
  const isOriginal = style.includes("video gốc") || style.includes("Original Style");
  const styleDescription = isOriginal 
    ? "mô tả chính xác phong cách nghệ thuật, ánh sáng và chất liệu nguyên bản từ video"
    : `áp dụng và mô tả theo phong cách: "${style}"`;

  return `Vai trò: Bạn là chuyên gia phân tích video cao cấp cho mô hình Veo 3. 
Nhiệm vụ: Phân tích video đầu vào thành các đoạn (scenes) dựa trên sự thay đổi cảnh quay thực tế.

QUY TẮC THỜI GIAN QUAN TRỌNG (ANTI-OVERLAP):
1. KHÔNG chia mặc định 8s. Hãy chia theo "Scene Cut" thực tế của video.
2. Mỗi scene dài TỐI ĐA 8 giây. Nếu một cảnh quay kết thúc ở giây thứ 6, hãy đóng Scene đó tại giây thứ 6.
3. Scene tiếp theo PHẢI bắt đầu chính xác tại thời điểm Scene trước kết thúc (ví dụ: Scene 1: 0s-6s, Scene 2: 6s-14s).
4. TUYỆT ĐỐI không mô tả lặp lại nội dung đã xuất hiện ở Scene trước.

YÊU CẦU PHONG CÁCH:
- Video phải được ${styleDescription}.
- Trường "visual_style" phải nhất quán và chi tiết về Lighting, Camera lens, và Texture.

ĐỊNH DẠNG ĐẦU RA:
- MỖI SCENE LÀ MỘT DÒNG JSON DUY NHẤT.
- CÁCH NHAU BỞI MỘT DÒNG TRỐNG.`;
};

const GET_USER_PROMPT = (style: string, lastSceneId: number = 0) => {
  const isOriginal = style.includes("video gốc") || style.includes("Original Style");
  const startInstruction = lastSceneId > 0 
    ? `Tiếp tục phân tích từ Scene ${lastSceneId + 1}. Bắt đầu từ mốc thời gian kết thúc của Scene trước.`
    : `Bắt đầu phân tích từ giây 0:00 của video.`;

  const styleAction = isOriginal
    ? "giữ nguyên phong cách gốc"
    : `tái hiện theo phong cách "${style}"`;

  return `${startInstruction} Hãy ${styleAction}. 
Yêu cầu: Xác định chính xác start_time và end_time cho mỗi scene để tránh chồng lấn nội dung.

Mẫu JSON bắt buộc (PHẢI VIẾT TRÊN 1 DÒNG):
{"scene_id":"[Số]","timestamp":"[Start]s - [End]s","duration_sec":"[Độ dài thực tế]","visual_style":"[Mô tả kỹ thuật]","character_lock":{"CHAR_1":{"id":"CHAR_1","name":"[Tên]","species":"[Loài]","gender":"[Giới tính]","age":"[Tuổi]","voice_personality":"[Tính cách]","body_build":"[Dáng]","face_shape":"[Mặt]","hair":"[Tóc]","skin_or_fur_color":"[Màu]","signature_feature":"[Đặc điểm]","outfit_top":"[Áo]","outfit_bottom":"[Quần]","helmet_or_hat":"[Mũ]","shoes_or_footwear":"[Giày]","props":"[Đạo cụ]","body_metrics":"u=cm; abs.height=[Height]; cons=no-auto-rescale,lock-proportions","position":"[Vị trí]","orientation":"[Hướng]","pose":"[Tư thế]","foot_placement":"[Chân]","hand_detail":"[Tay]","expression":"[Biểu cảm]","action_flow":{"pre_action":"[Bắt đầu]","main_action":"[Chính]","post_action":"[Kết thúc]"}}},"background_lock":{"BACKGROUND_1":{"id":"BACKGROUND_1","name":"[Bối cảnh]","setting":"[Indoor/Outdoor]","scenery":"[Mô tả]","props":"[Đồ vật]","lighting":"[Ánh sáng]"}},"camera":{"framing":"[Size]","angle":"[Góc]","movement":"[Chuyển động]","focus":"[Tiêu điểm]"},"foley_and_ambience":{"ambience":["[Âm thanh]"],"fx":["[Hiệu ứng]"],"music":"[Nhạc]"},"dialogue":[{"speaker":"CHAR_1","voice":"[Giọng]","language":"vi-VN","line":"[Lời]"}],"lip_sync_director_note":"[Ghi chú]"}`;
};

// Hàm xử lý encode và phân tích giữ nguyên logic cũ nhưng cập nhật xử lý nội dung
export async function analyzeVideo(file: File, style: string, model: string, lastSceneId: number = 0): Promise<AnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  // Helper function nội bộ để chuyển đổi base64 (Browser compatible)
  const base64Data = btoa(
    bytes.reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [
        { inlineData: { mimeType: file.type, data: base64Data } },
        { text: GET_USER_PROMPT(style, lastSceneId) }
      ]
    },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION(style),
      temperature: 0.1, // Giữ nhiệt độ thấp để AI tuân thủ JSON chặt chẽ
    }
  });

  const rawText = response.text || "";
  const scenes: SceneJson[] = [];
  
  // Trích xuất JSON từ text phản hồi
  const lines = rawText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.scene_id) {
          scenes.push(parsed as SceneJson);
        }
      } catch (e) {
        // Fallback xử lý nếu AI chèn text thừa quanh JSON
        const match = trimmed.match(/\{.*\}/);
        if (match) {
          try {
            const parsedMatch = JSON.parse(match[0]);
            if (parsedMatch.scene_id) scenes.push(parsedMatch);
          } catch(e2) {}
        }
      }
    }
  }

  return {
    raw: rawText,
    scenes: scenes
  };
}