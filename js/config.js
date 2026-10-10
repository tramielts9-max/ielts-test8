/**
 * js/config.js - Cấu hình tập trung toàn hệ thống
 */
export const CONFIG = {
  AI_AND_SHEET_URL: "https://script.google.com/macros/s/AKfycby7vRFXq_YhjIEq4kN-8NLRFw2sj-7VkVEmTw6IkNkPmidEPnPtxtNkSE-HKfn5mAPfbw/exec",
  DRIVE_STORAGE_URL: "https://script.google.com/macros/s/AKfycbyNErQQFdciAQM0k9KUrACtpX7rxKkopjChYAC2Ubwj5MGzFOeekDEGs8C1n7P9cNR6vg/exec",
  STORAGE_KEYS: {
    STUDENT_NAME: "ielts_student_name",
    STUDENT_EMAIL: "ielts_student_email",
    SYSTEM_SETTINGS: "ielts_system_settings",
    LOCAL_HISTORY: "ielts_local_history",
    ERROR_NOTEBOOK: "ielts_error_notebook",
    GRAMMAR_STATE: "ielts_grammar_progress"
  },
  // 👑 DANH SÁCH EMAIL CÓ QUYỀN ADMIN
  ADMIN_EMAILS: [
    "tramielts9@gmail.com",
    "dinhnguyenphuc019.2@gmail.com"
  ],
  // DANH MỤC CÁC PHÂN HỆ & BẢNG MÀU PASTEL CHUẨN
  MODULES: {
    vocab: { 
      name: "1. Luyện Từ Vựng Thông Minh (Vocab)", 
      theme: { bg: "#EEF2FF", border: "#C7D2FE", tagBg: "#4F46E5", text: "#312E81", label: "Từ vựng" } 
    },
    grammar: { 
      name: "2. Ngữ Pháp Trọng Tâm (Grammar)", 
      theme: { bg: "#F0FDF4", border: "#BBF7D0", tagBg: "#16A34A", text: "#14532D", label: "Ngữ pháp" } 
    },
    pre_listening: { 
      name: "3. Pre-Listening (Luyện Nghe Phản Xạ)", 
      theme: { bg: "#ECFEFF", border: "#A5F3FC", tagBg: "#0891B2", text: "#164E63", label: "Pre-Listening" } 
    },
    listening: { 
      name: "4. IELTS Listening (Cam 17 - 21)", 
      theme: { bg: "#F0F9FF", border: "#BAE6FD", tagBg: "#0284C7", text: "#0C4A6E", label: "Listening" } 
    },
    pre_reading: { 
      name: "5. Pre-Reading (Kỹ Năng Đọc Quét)", 
      theme: { bg: "#FFF7ED", border: "#FED7AA", tagBg: "#EA580C", text: "#7C2D12", label: "Pre-Reading" } 
    },
    reading: { 
      name: "6. IELTS Reading (Cam 17 - 21)", 
      theme: { bg: "#FEF2F2", border: "#FECACA", tagBg: "#8B1518", text: "#7F1D1D", label: "Reading" } 
    },
    pre_writing_t1: { 
      name: "7A. Pre-Writing Task 1 (Mô Tả Biểu Đồ)", 
      theme: { bg: "#EFF6FF", border: "#BFDBFE", tagBg: "#2563EB", text: "#1E3A8A", label: "Pre-Writing T1" } 
    },
    pre_writing_t2: { 
      name: "7B. Pre-Writing Task 2 (Dịch Luận)", 
      theme: { bg: "#FFF1F2", border: "#FECDD3", tagBg: "#E11D48", text: "#881337", label: "Pre-Writing T2" } 
    },
    writing_t1: { 
      name: "8A. IELTS Writing Task 1", 
      theme: { bg: "#F0FDFA", border: "#99F6E4", tagBg: "#0D9488", text: "#134E4A", label: "Writing Task 1" } 
    },
    writing_t2: { 
      name: "8B. IELTS Writing Task 2", 
      theme: { bg: "#FAF5FF", border: "#E9D5FF", tagBg: "#7C3AED", text: "#581C87", label: "Writing Task 2" } 
    },
    pre_speaking: { 
      name: "9. Pre-Speaking (Phát Âm IPA)", 
      theme: { bg: "#FAF5FF", border: "#E9D5FF", tagBg: "#9333EA", text: "#581C87", label: "Pre-Speaking" } 
    },
    speaking: { 
      name: "10. IELTS Speaking 2 Tầng", 
      theme: { bg: "#FFFBEB", border: "#FDE68A", tagBg: "#D97706", text: "#78350F", label: "Speaking" } 
    }
  }
};
