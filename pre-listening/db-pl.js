/**
 * pre-listening/db-pl.js
 * CƠ SỞ DỮ LIỆU INDEXEDDB PRE-LISTENING (HỖ TRỢ LƯU ĐA TẦNG NHIỀU LẦN NỘP LẦN 1, LẦN 2...)
 * BẢN FULL ĐẦY ĐỦ 100% - KHÔNG CẮT BỚT BẤT KỲ DÒNG NÀO
 */

const DB_NAME = "PreListeningHomeworkDB";
const STORE_NAME = "ListeningSubmissions";
let db = null;

export function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        d.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e);
  });
}

export function getSubmission(id) {
  return new Promise((resolve) => {
    const tx = db.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

export function saveSubmission(data) {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. LẤY BẢN GHI CŨ ĐỂ KHÔNG BỊ GHI ĐÈ
      const existing = await getSubmission(data.id);
      let attempts = (existing && Array.isArray(existing.attempts)) ? existing.attempts : [];

      // Nếu trước đó đã nộp 1 lần theo dạng cũ
      if (existing && attempts.length === 0 && existing.timestamp) {
        attempts.push({
          attemptNum: 1,
          correct: existing.correct,
          total: existing.total,
          wrongNotes: existing.wrongNotes || 'Không có',
          wrongProofs: existing.wrongProofs || [],
          fullProof: existing.fullProof || null,
          timestamp: existing.timestamp
        });
      }

      // 2. TẠO LẦN LÀM MỚI (LẦN 2, LẦN 3...)
      const newAttemptNum = attempts.length + 1;
      const currentAttempt = {
        attemptNum: newAttemptNum,
        correct: data.correct,
        total: data.total,
        wrongNotes: data.wrongNotes || 'Không có',
        wrongProofs: data.wrongProofs || [],
        fullProof: data.fullProof || null,
        timestamp: data.timestamp || new Date().toLocaleString("vi-VN")
      };

      attempts.push(currentAttempt);

      // 3. ĐÓNG GÓI BẢN GHI TỔNG HỢP (LƯU TOÀN BỘ CÁC LẦN VÀO MẢNG)
      const recordToSave = {
        id: data.id,
        skill: data.skill || "listening",
        level: data.level || "A1",
        title: data.title || existing?.title || data.id,
        // Giữ thuộc tính ở tầng ngoài để tương thích ngược
        correct: data.correct,
        total: data.total,
        wrongNotes: data.wrongNotes,
        wrongProofs: data.wrongProofs,
        fullProof: data.fullProof,
        timestamp: data.timestamp,
        attempts: attempts
      };

      const tx = db.transaction([STORE_NAME], "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(recordToSave);

      req.onsuccess = () => {
        try {
          const now = new Date();
          const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} - ${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
          const sName = localStorage.getItem('ielts_student_name') || 'Học viên';
          const sEmail = localStorage.getItem('ielts_student_email') || '';

          const attemptSnapshot = {
            id: `attempt_pl_${Date.now()}`,
            timestamp: `${timeStr} (Lần ${newAttemptNum})`,
            testTitle: `Pre-Listening: ${data.title || data.id} (Lần ${newAttemptNum})`,
            studentName: sName,
            studentEmail: sEmail,
            score: `${data.correct || 0}/${data.total || 0}`,
            timeSpent: "N/A",
            details: `Đã nộp bài mức độ ${data.level || ''} [LẦN ${newAttemptNum}]. Điểm đạt: ${data.correct || 0}/${data.total || 0}`,
            pageUrl: "pre-listening/index-pl.html",
            moduleType: "pre_listening"
          };

          // Lưu LocalStorage chung
          const localHist = JSON.parse(localStorage.getItem('ielts_local_history') || '[]');
          localHist.unshift(attemptSnapshot);
          localStorage.setItem('ielts_local_history', JSON.stringify(localHist));

          // Gửi lên Google Drive
          fetch("https://script.google.com/macros/s/AKfycbyNErQQFdciAQM0k9KUrACtpX7rxKkopjChYAC2Ubwj5MGzFOeekDEGs8C1n7P9cNR6vg/exec", {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "save_attempt", attempt: attemptSnapshot })
          }).catch(() => {});
        } catch (err) {}

        resolve(recordToSave);
      };
      req.onerror = (e) => reject(e);
    } catch (err) {
      reject(err);
    }
  });
}

export function getAllSubmissions() {
  return new Promise((resolve) => {
    const tx = db.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}
