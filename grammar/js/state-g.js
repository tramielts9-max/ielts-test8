/**
 * grammar/js/state-g.js
 * QUẢN LÝ TIẾN ĐỘ, LƯU TỪNG CÂU TRẢ LỜI & ĐỒNG BỘ LỊCH SỬ CHUNG TRANG CHỦ
 * BẢN FULL ĐẦY ĐỦ 100% - KHÔNG CẮT BỚT BẤT KỲ DÒNG NÀO
 */

import { GRAMMAR_CONFIG } from './config-g.js';

class GrammarStateManager {
  constructor() {
    this.storageKey = GRAMMAR_CONFIG.STORAGE_KEYS.USER_PROGRESS;
  }

  getProgress() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
    } catch(e) {
      return {};
    }
  }

  saveLessonScore(topicId, score, total) {
    const progress = this.getProgress();
    const percent = Math.round((score / total) * 100);
    progress[topicId] = {
      score,
      total,
      percent,
      passed: percent >= GRAMMAR_CONFIG.PASSING_SCORE_PERCENT,
      updatedAt: new Date().toLocaleString('vi-VN')
    };
    localStorage.setItem(this.storageKey, JSON.stringify(progress));
  }

  getUser() {
    return {
      name: localStorage.getItem(GRAMMAR_CONFIG.STORAGE_KEYS.STUDENT_NAME) || "Học viên",
      email: (localStorage.getItem(GRAMMAR_CONFIG.STORAGE_KEYS.STUDENT_EMAIL) || "").trim().toLowerCase()
    };
  }

  // =========================================================================
  // LƯU CHI TIẾT TỪNG ĐÁP ÁN ĐÃ LÀM VÀ TRẠNG THÁI TỪNG NHÓM BÀI TẬP
  // =========================================================================
  getTopicDetailKey(topicId) {
    return `ielts_grammar_answers_${topicId}`;
  }

  saveTopicDetailState(topicId, detailData) {
    try {
      const key = this.getTopicDetailKey(topicId);
      localStorage.setItem(key, JSON.stringify(detailData));
    } catch (e) {
      console.warn("Không thể lưu chi tiết bài làm ngữ pháp:", e);
    }
  }

  getTopicDetailState(topicId) {
    try {
      const raw = localStorage.getItem(this.getTopicDetailKey(topicId));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // =========================================================================
  // GHI NHẬN HOÀN THÀNH LÊN LỊCH SỬ CHUNG TRANG CHỦ (KHI LÀM ĐẾN BÀI CUỐI)
  // =========================================================================
  recordCompletedToMainHistory(topicId, topicTitle, totalCorrect, totalQuestions) {
    try {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} - ${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
      const user = this.getUser();

      const attemptSnapshot = {
        id: `attempt_gram_${Date.now()}`,
        timestamp: timeStr,
        testTitle: `Ngữ pháp: ${topicTitle || topicId}`,
        studentName: user.name,
        studentEmail: user.email,
        score: `${totalCorrect}/${totalQuestions}`,
        timeSpent: "Hoàn thành",
        details: `Đã làm xong toàn bộ các phần bài tập chuyên đề: ${topicTitle || topicId}`,
        pageUrl: `grammar/lesson-g.html?tense=${topicId}`,
        moduleType: "grammar"
      };

      // 1. Đưa vào Lịch sử LocalStorage chung của hệ thống
      const localHist = JSON.parse(localStorage.getItem('ielts_local_history') || '[]');
      localHist.unshift(attemptSnapshot);
      localStorage.setItem('ielts_local_history', JSON.stringify(localHist));

      // 2. Gửi đồng bộ lên Google Drive (nếu có kết nối)
      fetch("https://script.google.com/macros/s/AKfycbyNErQQFdciAQM0k9KUrACtpX7rxKkopjChYAC2Ubwj5MGzFOeekDEGs8C1n7P9cNR6vg/exec", {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "save_attempt", attempt: attemptSnapshot })
      }).catch(() => {});

      // 3. Cập nhật tiến độ của riêng Grammar
      this.saveLessonScore(topicId, totalCorrect, totalQuestions);

    } catch (err) {
      console.error("Lỗi ghi nhận lịch sử ngữ pháp:", err);
    }
  }
}

export const grammarState = new GrammarStateManager();
