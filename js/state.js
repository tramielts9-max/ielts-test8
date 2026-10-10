/**
 * js/state.js - Quản lý trạng thái phiên làm bài, Sổ tay sửa lỗi & Chuẩn hóa lịch sử
 */
import { CONFIG } from './config.js';

export class StateManager {
  constructor() {
    this.initTestKey();
    this.isReviewMode = false;
  }

  initTestKey() {
    const params = new URLSearchParams(window.location.search);
    const testId = params.get('test');
    if (testId) {
      this.testKey = 'ielts_state_' + testId.replace(/\.json$/i, '');
    } else {
      const pageName = window.location.pathname.split('/').pop() || 'default_test';
      this.testKey = 'ielts_state_' + pageName;
    }
  }

  getUser() {
    return {
      name: localStorage.getItem(CONFIG.STORAGE_KEYS.STUDENT_NAME) || '',
      email: (localStorage.getItem(CONFIG.STORAGE_KEYS.STUDENT_EMAIL) || '').trim().toLowerCase()
    };
  }

  saveUser(name, email) {
    if (name) localStorage.setItem(CONFIG.STORAGE_KEYS.STUDENT_NAME, name.trim());
    if (email) localStorage.setItem(CONFIG.STORAGE_KEYS.STUDENT_EMAIL, email.trim().toLowerCase());
  }

  saveTestProgress(data) {
    if (this.isReviewMode) return;
    try {
      localStorage.setItem(this.testKey, JSON.stringify(data));
    } catch (e) {
      console.warn("Không thể lưu tiến trình bài làm:", e);
    }
  }

  getSavedProgress() {
    try {
      const raw = localStorage.getItem(this.testKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  clearProgress() {
    localStorage.removeItem(this.testKey);
  }

  // =========================================================================
  // BỘ QUẢN LÝ LỊCH SỬ CHUNG (HỖ TRỢ MỌI PHÂN HỆ, SẮP XẾP MỚI NHẤT LÊN ĐẦU)
  // =========================================================================
  getLocalHistory() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.LOCAL_HISTORY) || '[]';
      const list = JSON.parse(raw);
      return this.sortAttemptsDescending(list);
    } catch (e) {
      return [];
    }
  }

  saveAttempt(attemptData) {
    try {
      const history = this.getLocalHistory();
      const newAttempt = {
        id: attemptData.id || `att_${Date.now()}`,
        testTitle: attemptData.testTitle || 'Bài luyện tập',
        moduleType: attemptData.moduleType || this.detectModuleType(attemptData.pageUrl, attemptData.testTitle),
        score: attemptData.score || 'Đã nộp',
        timeSpent: attemptData.timeSpent || 'N/A',
        timestamp: attemptData.timestamp || this.getCurrentFormattedTimestamp(),
        epochTime: Date.now(),
        pageUrl: attemptData.pageUrl || window.location.pathname + window.location.search,
        studentName: attemptData.studentName || this.getUser().name,
        studentEmail: (attemptData.studentEmail || this.getUser().email).toLowerCase(),
        details: attemptData.details || null
      };

      // Đẩy lên đầu danh sách
      history.unshift(newAttempt);
      localStorage.setItem(CONFIG.STORAGE_KEYS.LOCAL_HISTORY, JSON.stringify(history));
      return newAttempt;
    } catch (e) {
      console.error("Lỗi lưu lịch sử:", e);
      return null;
    }
  }

  detectModuleType(url = '', title = '') {
    const s = (url + ' ' + title).toLowerCase();
    if (s.includes('grammar') || s.includes('ngữ pháp')) return 'grammar';
    if (s.includes('vocab') || s.includes('từ vựng')) return 'vocab';
    if (s.includes('pre-listening') || s.includes('index-pl')) return 'pre_listening';
    if (s.includes('listening') || s.includes('runner-listening') || s.includes('lis-')) return 'listening';
    if (s.includes('pre-reading') || s.includes('index-pr')) return 'pre_reading';
    if (s.includes('reading') || s.includes('runner-reading')) return 'reading';
    if (s.includes('pre-writing') && s.includes('pwt1')) return 'pre_writing_t1';
    if (s.includes('pre-writing') && s.includes('pwt2')) return 'pre_writing_t2';
    if (s.includes('writing task 1') || s.includes('index-t1')) return 'writing_t1';
    if (s.includes('writing task 2') || s.includes('index-t2')) return 'writing_t2';
    if (s.includes('pre-speaking') || s.includes('index-ps')) return 'pre_speaking';
    if (s.includes('speaking') || s.includes('index-s')) return 'speaking';
    return 'reading';
  }

  getCurrentFormattedTimestamp() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${hh}:${mm} - ${dd}/${mon}/${yyyy}`;
  }

  sortAttemptsDescending(attempts) {
    return [...attempts].sort((a, b) => {
      const timeA = this.extractEpoch(a);
      const timeB = this.extractEpoch(b);
      return timeB - timeA;
    });
  }

  extractEpoch(item) {
    if (item.epochTime) return item.epochTime;
    if (item.id && !isNaN(Number(item.id.replace(/\D/g, '')))) {
      const num = Number(item.id.replace(/\D/g, ''));
      if (num > 1000000000000) return num;
    }
    const m = (item.timestamp || '').match(/(\d{2}):(\d{2})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) {
      return new Date(m[5], m[4] - 1, m[3], m[1], m[2]).getTime();
    }
    const dOnly = (item.timestamp || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (dOnly) {
      return new Date(dOnly[3], dOnly[2] - 1, dOnly[1]).getTime();
    }
    return 0;
  }

  // =========================================================================
  // DOC SỬA LỖI (SỔ TAY TỔNG HỢP LỖI SAI TẬP TRUNG)
  // =========================================================================
  getErrorNotes() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.ERROR_NOTEBOOK) || '[]';
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  saveErrorNote(note) {
    try {
      const list = this.getErrorNotes();
      const newNote = {
        id: note.id || `err_${Date.now()}`,
        moduleType: note.moduleType || 'reading',
        testTitle: note.testTitle || 'Bài làm',
        questionNum: note.questionNum || 'N/A',
        questionContent: note.questionContent || '',
        wrongAnswer: note.wrongAnswer || '',
        correctAnswer: note.correctAnswer || '',
        reasonAndTakeaway: note.reasonAndTakeaway || '',
        timestamp: note.timestamp || this.getCurrentFormattedTimestamp()
      };
      list.unshift(newNote);
      localStorage.setItem(CONFIG.STORAGE_KEYS.ERROR_NOTEBOOK, JSON.stringify(list));
      return newNote;
    } catch (e) {
      console.error("Lỗi lưu sổ tay sửa lỗi:", e);
      return null;
    }
  }

  deleteErrorNote(noteId) {
    const list = this.getErrorNotes().filter(n => n.id !== noteId);
    localStorage.setItem(CONFIG.STORAGE_KEYS.ERROR_NOTEBOOK, JSON.stringify(list));
  }
}

export const stateManager = new StateManager();
