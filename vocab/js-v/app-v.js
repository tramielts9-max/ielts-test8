/**
 * vocab/js-v/app-v.js
 * BỘ ĐIỀU KHIỂN TỔNG THỂ SMART VOCAB DUOLINGO X TRẠM IELTS
 * BẢN FULL ĐẦY ĐỦ 100% - TÍCH HỢP 4 CHẾ ĐỘ KHẢO TỪ VỰNG & LƯU LỊCH SỬ CHUNG
 */

import { StorageManager } from './storage-v.js';
import { SRSEngine } from './srs-engine-v.js';
import { BotsSimulation } from './bots-simulation-v.js';
import { QuizController } from './quiz-v.js';
import { UIController } from './ui-v.js';

class App {
  constructor() {
    this.courses = [];
    this.currentCourse = null;
    this.currentCourseId = localStorage.getItem('sv_active_course_id') || 'course_ielts_300';
    this.activeTab = 'ontap';
    this.user = StorageManager.getUser();
    this.progress = StorageManager.getWordProgress(this.user.email);
    this.leaderboard = StorageManager.getLeaderboard();
    this.currentWordsPool = [];
    this.currentSessionTitle = "Luyện tập tự do";
  }

  async init() {
    try {
      const resCourses = await fetch('data-v/courses-v.json');
      this.courses = await resCourses.json();
      
      this.currentCourse = this.courses.find(c => c.id === this.currentCourseId) || this.courses[0];
      await this.loadAllWordsForCurrentCourse();
    } catch (e) {
      alert("Không thể tải danh sách khóa học!");
      return;
    }

    if (!this.leaderboard) {
      this.leaderboard = BotsSimulation.initLeague(this.user);
      StorageManager.saveLeaderboard(this.leaderboard);
    }

    this.initCourseSelector();
    this.initNavigationTabs();
    this.updateUserStatsUI();
    this.renderWeeklyStreak();
    this.refreshDashboard();

    document.getElementById('btnStartReview').onclick = () => {
      this.currentSessionTitle = `${this.currentCourse.title} (Tổng hợp Flashcard)`;
      this.startReviewSession(this.currentWordsPool, { type: 'flashcard' });
    };

    setInterval(() => {
      this.leaderboard = BotsSimulation.simulateBotProgress(this.leaderboard, this.user.xp);
      StorageManager.saveLeaderboard(this.leaderboard);
      UIController.renderLeaderboard(this.leaderboard, 'me');
    }, 15000);
  }

  initCourseSelector() {
    const courseDropdown = document.getElementById('courseSelectorDropdown');
    if (!courseDropdown) return;

    courseDropdown.value = this.currentCourse.id;

    courseDropdown.onchange = async (e) => {
      const selectedId = e.target.value;
      this.currentCourse = this.courses.find(c => c.id === selectedId) || this.courses[0];
      this.currentCourseId = this.currentCourse.id;
      localStorage.setItem('sv_active_course_id', this.currentCourseId);

      await this.loadAllWordsForCurrentCourse();
      this.renderRoadmap();
      this.refreshDashboard();
      if (this.activeTab === 'sotay') this.renderSotay();
    };
  }

  async loadAllWordsForCurrentCourse() {
    const promises = this.currentCourse.lessons.map(async (lesson) => {
      try {
        const res = await fetch(`data-v/${lesson.file}`);
        return await res.json();
      } catch (err) {
        return [];
      }
    });
    const results = await Promise.all(promises);
    this.currentWordsPool = results.flat();
  }

  initNavigationTabs() {
    const tabs = ['ontap', 'roadmap', 'sotay', 'rank'];
    tabs.forEach(tab => {
      document.getElementById(`tab_${tab}`)?.addEventListener('click', () => {
        this.activeTab = tab;
        tabs.forEach(t => {
          document.getElementById(`tab_${t}`)?.classList.toggle('active', t === tab);
          document.getElementById(`view_${t}`)?.classList.toggle('hidden', t !== tab);
        });
        if (tab === 'roadmap') this.renderRoadmap();
        if (tab === 'sotay') this.renderSotay();
        if (tab === 'rank') UIController.renderLeaderboard(this.leaderboard, 'me');
      });
    });
  }

  // =========================================================================
  // TAB 2: LỘ TRÌNH ROADMAP (THÊM NÚT "KHẢO TỪ VỰNG" TỪNG BÀI)
  // =========================================================================
  renderRoadmap() {
    const container = document.getElementById('roadmapLessonList');
    const headerTitle = document.getElementById('courseHeaderTitle');
    if (!container || !this.currentCourse) return;

    if (headerTitle) {
      headerTitle.innerText = this.currentCourse.title;
    }

    container.innerHTML = this.currentCourse.lessons.map((lesson, idx) => {
      const isStart = idx === 0;
      return `
        <div class="lesson-card ${isStart ? 'active-start' : ''}">
          ${isStart ? '<div class="badge-start-here">BẮT ĐẦU TẠI ĐÂY</div>' : ''}
          <div class="lesson-avatar">${lesson.icon}</div>
          <div class="lesson-info">
            <div class="lesson-title">${lesson.title}</div>
            <div class="lesson-subtitle">${lesson.subTitle}</div>
            <div style="display:flex; gap:8px; margin-top:10px;">
              <button type="button" class="btn" style="background:#0284C7; color:white; padding:7px 14px; font-size:12.5px; border-radius:10px; border-bottom:3px solid #0369A1;" onclick="window.startUnitLesson('${lesson.file}', '${lesson.title}', 'flashcard')">
                🧠 Học Flashcard
              </button>
              <button type="button" class="btn" style="background:#8B1518; color:white; padding:7px 14px; font-size:12.5px; border-radius:10px; border-bottom:3px solid #5E0C0E;" onclick="window.openKhaoVocabModal('${lesson.file}', '${lesson.title}')">
                ✍️ Khảo Từ Vựng
              </button>
            </div>
          </div>
          <div class="lesson-badge-count">${lesson.count} từ</div>
        </div>
      `;
    }).join('');

    window.startUnitLesson = async (fileName, title, modeType = 'flashcard', customConfig = null) => {
      try {
        const res = await fetch(`data-v/${fileName}`);
        const unitWords = await res.json();
        this.currentSessionTitle = `Từ vựng: ${title}`;
        const config = customConfig || { type: modeType };
        this.startReviewSession(unitWords, config);
      } catch (e) {
        alert("Không thể tải bài học: " + fileName);
      }
    };

    // MỞ POPUP CHỌN 4 CHẾ ĐỘ KHẢO TỪ VỰNG
    window.openKhaoVocabModal = (fileName, title) => {
      let modal = document.getElementById('khaoModeSelectorModal');
      if (modal) modal.remove();

      modal = document.createElement('div');
      modal.id = 'khaoModeSelectorModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-card" style="max-width:540px;">
          <div class="modal-header">
            <h3>📝 KHẢO TỪ VỰNG: ${title}</h3>
            <button class="btn-close-modal" onclick="document.getElementById('khaoModeSelectorModal').remove()">&times;</button>
          </div>
          <div class="modal-body" style="padding:22px;">
            <p style="font-size:14px; color:var(--text-muted); font-weight:700; margin-bottom:16px;">
              Chọn 1 trong 4 hình thức khảo bài để kiểm tra độ thuộc lòng từ vựng của em:
            </p>
            <div class="khao-options-grid">
              <div class="btn-khao-mode-card" onclick="window.startKhaoMode('${fileName}', '${title}', 'vn_to_en', false)">
                <b style="color:var(--tram-red); font-size:15px; display:block;">1. Việt ➔ Anh</b>
                <span style="font-size:12.5px; color:var(--text-muted); font-weight:700;">Giữ nguyên thứ tự đề</span>
              </div>
              <div class="btn-khao-mode-card" onclick="window.startKhaoMode('${fileName}', '${title}', 'vn_to_en', true)">
                <b style="color:#0284C7; font-size:15px; display:block;">2. Việt ➔ Anh</b>
                <span style="font-size:12.5px; color:var(--text-muted); font-weight:700;">Xáo trộn ngẫu nhiên 🔀</span>
              </div>
              <div class="btn-khao-mode-card" onclick="window.startKhaoMode('${fileName}', '${title}', 'en_to_vn', false)">
                <b style="color:#16A34A; font-size:15px; display:block;">3. Anh ➔ Việt</b>
                <span style="font-size:12.5px; color:var(--text-muted); font-weight:700;">Giữ nguyên thứ tự đề</span>
              </div>
              <div class="btn-khao-mode-card" onclick="window.startKhaoMode('${fileName}', '${title}', 'en_to_vn', true)">
                <b style="color:#D97706; font-size:15px; display:block;">4. Anh ➔ Việt</b>
                <span style="font-size:12.5px; color:var(--text-muted); font-weight:700;">Xáo trộn ngẫu nhiên 🔀</span>
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
    };

    window.startKhaoMode = (fileName, title, direction, shuffle) => {
      document.getElementById('khaoModeSelectorModal')?.remove();
      const config = {
        type: 'test',
        direction: direction,
        shuffle: shuffle
      };
      const label = `${title} (${direction === 'vn_to_en' ? 'Việt->Anh' : 'Anh->Việt'} - ${shuffle ? 'Xáo trộn' : 'Thứ tự'})`;
      window.startUnitLesson(fileName, label, 'test', config);
    };
  }

  renderSotay() {
    const totalWords = this.currentWordsPool.length;
    let learnedCount = 0;

    this.currentWordsPool.forEach(w => {
      const prog = this.progress[w.id];
      if (prog && prog.level >= 2) {
        learnedCount++;
      }
    });

    const unlearnedCount = totalWords - learnedCount;
    const learnedPercent = totalWords > 0 ? Math.round((learnedCount / totalWords) * 100) : 0;

    const statTotal = document.getElementById('statTotalWords');
    const statLearned = document.getElementById('statLearnedWords');
    const statPercent = document.getElementById('statLearnedPercent');
    const statUnlearned = document.getElementById('statUnlearnedWords');

    if (statTotal) statTotal.innerText = totalWords;
    if (statLearned) statLearned.innerText = learnedCount;
    if (statPercent) statPercent.innerText = `${learnedPercent}%`;
    if (statUnlearned) statUnlearned.innerText = unlearnedCount;

    this.currentFilter = 'all';
    this.currentSearchTerm = '';
    this.renderWordStatusList();

    for (let i = 1; i <= 5; i++) {
      const countTier = this.currentWordsPool.filter(w => (this.progress[w.id]?.level || 1) === i).length;
      const el = document.getElementById(`towerT${i}_st`);
      if (el) el.innerText = `${countTier} từ 👉`;
    }

    window.filterWordTable = (filterType) => {
      this.currentFilter = filterType;
      ['all', 'learned', 'unlearned'].forEach(f => {
        const btn = document.getElementById(`btnFilter${f.charAt(0).toUpperCase() + f.slice(1)}`);
        if (btn) btn.classList.toggle('active', f === filterType);
      });
      this.renderWordStatusList();
    };

    window.searchWordTable = (term) => {
      this.currentSearchTerm = (term || '').toLowerCase().trim();
      this.renderWordStatusList();
    };
  }

  renderWordStatusList() {
    const container = document.getElementById('wordStatusTableContainer');
    if (!container) return;

    const filteredWords = this.currentWordsPool.filter(w => {
      const prog = this.progress[w.id];
      const isLearned = prog && prog.level >= 2;

      if (this.currentFilter === 'learned' && !isLearned) return false;
      if (this.currentFilter === 'unlearned' && isLearned) return false;

      if (this.currentSearchTerm) {
        const matchTerm = (w.word || '').toLowerCase().includes(this.currentSearchTerm);
        const matchMeaning = (w.meaning || '').toLowerCase().includes(this.currentSearchTerm);
        return matchTerm || matchMeaning;
      }
      return true;
    });

    if (filteredWords.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:14px;">Không tìm thấy từ vựng nào phù hợp!</div>`;
      return;
    }

    container.innerHTML = filteredWords.map(w => {
      const prog = this.progress[w.id];
      const isLearned = prog && prog.level >= 2;
      
      let badgeHtml = '';
      let reviewInfo = '';

      if (isLearned) {
        const lastDate = prog.reviewHistory && prog.reviewHistory.length > 0
          ? prog.reviewHistory[prog.reviewHistory.length - 1].reviewedAt.split(' - ')[0]
          : 'Gần đây';
        badgeHtml = `<span class="badge-status badge-learned">✅ ĐÃ THUỘC (${prog.totalReviews} lần ôn)</span>`;
        reviewInfo = `<span style="font-size:11px; color:#15803d; margin-top:3px; display:block;">Gần nhất: ${lastDate} • Đang ở Tầng ${prog.level}</span>`;
      } else {
        if (prog && prog.totalReviews > 0) {
          badgeHtml = `<span class="badge-status badge-unlearned" style="background:#fef3c7; color:#b45309; border-color:#fcd34d;">⚠️ CHƯA THUỘC (Cần ôn lại)</span>`;
          reviewInfo = `<span style="font-size:11px; color:#b45309; margin-top:3px; display:block;">Đã bấm ${prog.totalReviews} lần nhưng chưa thuộc • Tầng 1</span>`;
        } else {
          badgeHtml = `<span class="badge-status badge-unlearned">⏳ CHƯA HỌC</span>`;
          reviewInfo = `<span style="font-size:11px; color:#94a3b8; margin-top:3px; display:block;">Chưa học lần nào</span>`;
        }
      }

      return `
        <div class="word-status-row">
          <div>
            <div style="font-weight: 800; font-size: 15.5px; color: var(--tram-red);">
              ${w.word}
            </div>
            <div style="font-size: 13.5px; color: var(--text-main); margin-top: 2px;">
              ${w.meaning}
            </div>
            ${w.example ? `<div style="font-size: 12.5px; color: var(--text-muted); font-style: italic; margin-top: 3px;">"${w.example}"</div>` : ''}
          </div>
          <div style="text-align: right; flex-shrink: 0; margin-left: 12px;">
            ${badgeHtml}
            ${reviewInfo}
          </div>
        </div>
      `;
    }).join('');
  }

  renderWeeklyStreak() {
    const checkedDays = StorageManager.getWeekCheckin(this.user.email);
    const daysMap = [
      { day: 1, label: "T2" }, { day: 2, label: "T3" }, { day: 3, label: "T4" },
      { day: 4, label: "T5" }, { day: 5, label: "T6" }, { day: 6, label: "T7" }, { day: 0, label: "CN" }
    ];

    const container = document.getElementById('weekStreakDays');
    if (!container) return;

    container.innerHTML = daysMap.map(d => {
      const isDone = checkedDays.includes(d.day);
      return `
        <div class="day-bubble">
          <div class="day-circle ${isDone ? 'checked' : ''}">${isDone ? '✓' : ''}</div>
          <div class="day-label">${d.label}</div>
        </div>
      `;
    }).join('');
  }

  updateUserStatsUI() {
    document.getElementById('userStreak').innerText = `🔥 ${this.user.streak} ngày`;
    document.getElementById('userFreeze').innerText = `🧊 ${this.user.freezeCards} thẻ`;
    document.getElementById('userXP').innerText = `⚡ ${this.user.xp} KN`;
    document.getElementById('userLeague').innerText = `🏆 ${this.user.currentLeague}`;
  }

  refreshDashboard() {
    this.progress = StorageManager.getWordProgress(this.user.email);
    UIController.renderMemoryTower(this.currentWordsPool, this.progress, (tierLevel) => {
      const wordsInTier = this.currentWordsPool.filter(w => (this.progress[w.id]?.level || 1) === tierLevel);
      UIController.showTierWordsModal(tierLevel, wordsInTier, this.progress);
    });

    const queueData = SRSEngine.getReviewQueue(this.currentWordsPool, this.progress);
    const nextTime = SRSEngine.getNextReviewCountdown(this.currentWordsPool, this.progress);
    UIController.startGoldenTimer(nextTime, queueData.isGoldenTime);
  }

  startReviewSession(wordsPool, modeConfig = { type: 'flashcard' }) {
    const queueData = SRSEngine.getReviewQueue(wordsPool, this.progress);
    const quiz = new QuizController(
      queueData.words,
      queueData.isGoldenTime,
      (results, isGoldenTime, totalSecs, sessionType, customConfig) => this.onFinishSession(results, isGoldenTime, totalSecs, sessionType, customConfig),
      modeConfig
    );
    quiz.start();
  }

  // =========================================================================
  // KẾT THÚC PHIÊN HỌC HOẶC KHẢO TỪ: LƯU VÀO LỊCH SỬ CHUNG TRANG CHỦ
  // =========================================================================
  onFinishSession(sessionResults, isGoldenTime, totalSecs, sessionType = 'flashcard', customConfig = null) {
    let correctCount = 0;
    const detailsList = [];

    sessionResults.forEach(res => {
      if (res.isCorrect) correctCount++;
      const currentProg = this.progress[res.wordId];
      const nextLvl = SRSEngine.calculateNextReview(currentProg, res.isCorrect);
      
      this.progress = StorageManager.recordWordReview(this.user.email, res.wordId, res.isCorrect, nextLvl);
      
      const userChoiceStr = res.userAnswer ? `[Học sinh gõ: "${res.userAnswer}"]` : `[${res.userChoice || ''}]`;
      detailsList.push(`• ${res.word}: ${res.meaning} -> ${userChoiceStr} -> [${res.isCorrect ? 'ĐÚNG (✓)' : 'CHƯA ĐÚNG (✕)'}] (${res.thinkTimeSec}s)`);
    });

    const earnedXP = correctCount * (sessionType === 'test' ? 20 : (isGoldenTime ? 15 : 10));
    this.user.xp += earnedXP;
    StorageManager.saveUser(this.user);
    StorageManager.recordTodayCheckin(this.user.email);
    this.renderWeeklyStreak();

    const mm = String(Math.floor(totalSecs / 60)).padStart(2, '0');
    const ss = String(totalSecs % 60).padStart(2, '0');
    const speedStr = `${mm}:${ss}`;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} - ${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;

    const sessionTitle = sessionType === 'test' 
      ? `Khảo từ vựng: ${this.currentSessionTitle}` 
      : this.currentSessionTitle;

    // BẢN GHI ĐỒNG BỘ CHUẨN LÊN TRANG CHỦ INDEX.HTML
    const attemptSnapshot = {
      id: "attempt_vocab_" + Date.now(),
      timestamp: timeStr,
      testTitle: sessionTitle,
      studentName: this.user.name,
      studentEmail: this.user.email,
      score: `${correctCount}/${sessionResults.length}`,
      timeSpent: speedStr,
      details: detailsList.join('\n'),
      pageUrl: "vocab/index-v.html",
      moduleType: "vocab"
    };

    try {
      const localHist = JSON.parse(localStorage.getItem('ielts_local_history') || '[]');
      localHist.unshift(attemptSnapshot);
      localStorage.setItem('ielts_local_history', JSON.stringify(localHist));
    } catch (e) {
      console.warn("Không thể lưu cache lịch sử:", e);
    }

    if (StorageManager.GOOGLE_SCRIPT_URL) {
      fetch(StorageManager.GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "save_attempt", attempt: attemptSnapshot })
      }).catch(() => {});
    }

    this.updateUserStatsUI();
    document.getElementById('quizContainer').classList.add('hidden');
    document.getElementById('dashboardView').classList.remove('hidden');

    this.showResultPopup(correctCount, sessionResults.length, earnedXP, speedStr, sessionType);
    this.refreshDashboard();
  }

  showResultPopup(correct, total, xp, speedStr, sessionType = 'flashcard') {
    let existing = document.getElementById('sessionResultModal');
    if (existing) existing.remove();

    const titleText = sessionType === 'test' ? 'Đã hoàn thành bài Khảo Từ Vựng!' : 'Tuyệt vời!';
    const subText = sessionType === 'test' 
      ? `Điểm của em: ${correct}/${total} từ (${Math.round((correct/total)*100)}%). Bài thi đã được lưu vào Lịch sử Trang chủ.`
      : 'Bạn vừa hoàn thành một phiên luyện từ vựng xuất sắc';

    const modal = document.createElement('div');
    modal.id = 'sessionResultModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="result-modal-card">
        <div class="result-celebrate-icon">🎉</div>
        <h2>${titleText}</h2>
        <div class="result-subtitle">${subText}</div>

        <div class="result-stats-grid">
          <div class="result-stat-box">
            <div class="stat-val">${correct}/${total}</div>
            <div class="stat-lbl">${sessionType === 'test' ? 'ĐÚNG' : 'ĐÃ THUỘC'}</div>
          </div>
          <div class="result-stat-box">
            <div class="stat-val" style="color: #f59e0b;">+${xp}</div>
            <div class="stat-lbl">ĐIỂM KN</div>
          </div>
          <div class="result-stat-box">
            <div class="stat-val" style="color: #10b981;">${speedStr}</div>
            <div class="stat-lbl">TỐC ĐỘ</div>
          </div>
        </div>

        <button class="btn-result-finish" id="btnFinishPopup">TIẾP TỤC</button>
      </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('btnFinishPopup').onclick = () => modal.remove();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
