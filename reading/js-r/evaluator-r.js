/**
 * reading/js-r/evaluator-r.js - Bộ máy chấm điểm chuyên biệt cho IELTS Reading
 * (BẢN FULL ĐẦY ĐỦ 100% NGUYÊN GỐC + HỖ TRỢ BẢNG MA TRẬN)
 */
import { CONFIG } from '../../js/config.js';
import { stateManager } from '../../js/state.js';

export class TestEvaluatorReading {
  constructor(testData) {
    this.testData = testData || window.TEST_DATA || { answers: {} };
  }

  evaluate() {
    const answers = this.testData.answers;
    let score = 0;
    const total = Object.keys(answers).length;
    const details = [];

    const snapshot = {
      inputs: {},
      radios: {},
      thoughts: {},
      aiResponses: {}
    };

    for (const qKey in answers) {
      const expected = answers[qKey];
      const qDiv = document.getElementById(qKey);
      const textInput = document.getElementById(`${qKey}_input`);
      const radioSelected = document.querySelector(`input[name="${qKey}"]:checked`);
      const thoughtEl = document.getElementById(`${qKey}_thought`);
      const aiBox = document.getElementById(`ai_response_${qKey}`);

      let userVal = textInput ? textInput.value.trim() : (radioSelected ? radioSelected.value.trim() : '');
      if (textInput) snapshot.inputs[textInput.id] = userVal;
      if (radioSelected) snapshot.radios[qKey] = userVal;
      if (thoughtEl) snapshot.thoughts[thoughtEl.id] = thoughtEl.value;
      if (aiBox && aiBox.innerHTML.trim() !== "") snapshot.aiResponses[aiBox.id] = aiBox.innerHTML;

      let isCorrect = false;
      if (radioSelected) {
        isCorrect = (userVal.toUpperCase() === String(expected).trim().toUpperCase());
      } else {
        const cleanVal = userVal.toLowerCase().replace(/\s+/g, ' ');
        if (Array.isArray(expected)) {
          isCorrect = expected.map(a => a.toLowerCase().trim()).includes(cleanVal);
        } else {
          isCorrect = (cleanVal === String(expected).toLowerCase().trim());
        }
      }

      if (isCorrect) score++;

      // GÁN CLASS CHUẨN ĐÚNG/SAI CŨ (GIỮ NGUYÊN GỐC 100%)
      if (qDiv) {
        const resDiv = qDiv.querySelector('.result') || document.getElementById(`${qKey}_result`);
        const expDiv = qDiv.querySelector('.explanation');
        if (isCorrect) {
          if (resDiv) resDiv.innerHTML = "<span class='correct-text' style='color:#16a34a; font-weight:700;'>✓ Đúng</span>";
          qDiv.classList.add('correct-border');
          qDiv.classList.remove('incorrect-border');
        } else {
          const expStr = Array.isArray(expected) ? expected.join(' / ') : expected;
          if (resDiv) resDiv.innerHTML = `<span class='incorrect-text' style='color:#dc2626; font-weight:700;'>✗ Sai (Đáp án: <b>${expStr}</b>)</span>`;
          qDiv.classList.add('incorrect-border');
          qDiv.classList.remove('correct-border');
        }
        if (expDiv) expDiv.style.display = 'block';
      }

      // XỬ LÝ NẾU LÀ HÀNG TRONG BẢNG MA TRẬN
      const matrixRow = document.getElementById(`${qKey}_row`);
      if (matrixRow) {
        matrixRow.style.backgroundColor = isCorrect ? '#F0FDF4' : '#FFF5F5';
      }

      const badge = document.getElementById(`badge_${qKey}`);
      if (badge) {
        badge.classList.remove('status-answered');
        badge.classList.toggle('status-correct', isCorrect);
        badge.classList.toggle('status-incorrect', !isCorrect);
      }

      details.push(`${qKey.toUpperCase()}: ${userVal || 'Trống'} (${isCorrect ? 'ĐÚNG' : 'SAI'}) | Nghĩ: ${thoughtEl?.value || 'N/A'}`);
    }

    return { score, total, details: details.join('\n'), snapshot };
  }

  async submitToCloud(resultData, studentName, studentEmail, timeSpent) {
    const scoreStr = `${resultData.score}/${resultData.total}`;
    const fullPageUrl = 'reading/' + (window.location.pathname.split('/').pop() || 'runner-reading.html') + window.location.search;

    const payload = {
      testTitle: this.testData.title || document.title,
      studentName,
      studentEmail,
      score: scoreStr,
      timeSpent,
      details: resultData.details
    };

    const attemptSnapshot = {
      id: "attempt_" + Date.now(),
      timestamp: stateManager.getCurrentFormattedTimestamp(),
      ...payload,
      pageUrl: fullPageUrl,
      moduleType: 'reading',
      ...resultData.snapshot
    };

    stateManager.saveAttempt(attemptSnapshot);

    if (CONFIG.AI_AND_SHEET_URL) {
      fetch(CONFIG.AI_AND_SHEET_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({ action: "submit_score", ...payload })
      }).catch(() => {});
    }

    if (CONFIG.DRIVE_STORAGE_URL) {
      fetch(CONFIG.DRIVE_STORAGE_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({ action: "save_attempt", attempt: attemptSnapshot })
      }).catch(() => {});
    }

    this.renderPostSubmissionControls();
  }

  renderPostSubmissionControls() {
    if (document.getElementById('btnPostSaveContainer')) return;
    const questionBox = document.querySelector('.question-box');
    if (!questionBox) return;

    const postBox = document.createElement('div');
    postBox.id = 'btnPostSaveContainer';
    postBox.style.cssText = "margin-top: 25px; padding: 16px; background: var(--bg-subcard); border: 1.5px solid var(--border-color); border-radius: 8px; text-align: center; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;";
    postBox.innerHTML = `
      <button type="button" id="btnPostSave" style="background: #16a34a; color: white; border: none; padding: 10px 18px; font-weight: 700; font-size: 14px; border-radius: 6px; cursor: pointer;">
        💾 Lưu vào lịch sử (Bản Sau sửa)
      </button>
      <button type="button" id="btnResetTest" style="background: #ef4444; color: white; border: none; padding: 10px 18px; font-weight: 700; font-size: 14px; border-radius: 6px; cursor: pointer;">
        🔄 Xóa hết để làm lại từ đầu
      </button>
    `;
    questionBox.appendChild(postBox);

    document.getElementById('btnPostSave')?.addEventListener('click', () => this.savePostReviewUpdate());
    document.getElementById('btnResetTest')?.addEventListener('click', () => {
      if (confirm("⚠️ Em có chắc muốn xóa hết đáp án để làm lại bài này không?")) {
        stateManager.clearProgress();
        window.location.href = window.location.pathname + window.location.search;
      }
    });
  }

  savePostReviewUpdate() {
    const user = stateManager.getUser();
    if (!user.email) {
      alert("⚠️ Không tìm thấy email học viên!");
      return;
    }

    const snapshotThoughts = {};
    const snapshotAI = {};

    document.querySelectorAll('.thought-box textarea, .inline-thought-box textarea').forEach(t => snapshotThoughts[t.id] = t.value);
    document.querySelectorAll('.ai-response').forEach(a => {
      if (a.innerHTML.trim() !== '') snapshotAI[a.id] = a.innerHTML;
    });

    const fullPageUrl = 'reading/' + (window.location.pathname.split('/').pop() || 'runner-reading.html') + window.location.search;

    const attemptSnapshot = {
      id: "attempt_" + Date.now(),
      timestamp: stateManager.getCurrentFormattedTimestamp() + " (Sau sửa)",
      testTitle: (this.testData.title || document.title) + " (Sau sửa)",
      pageUrl: fullPageUrl,
      moduleType: 'reading',
      studentName: user.name,
      studentEmail: user.email,
      score: document.getElementById('scoreText')?.innerText || '',
      timeSpent: document.getElementById('timerDisplay')?.innerText || '',
      inputs: {},
      radios: {},
      thoughts: snapshotThoughts,
      aiResponses: snapshotAI
    };

    document.querySelectorAll('input.fill-input').forEach(i => attemptSnapshot.inputs[i.id] = i.value);
    document.querySelectorAll('input[type="radio"]:checked').forEach(r => attemptSnapshot.radios[r.name] = r.value);

    stateManager.saveAttempt(attemptSnapshot);

    if (CONFIG.DRIVE_STORAGE_URL) {
      fetch(CONFIG.DRIVE_STORAGE_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({ action: "save_attempt", attempt: attemptSnapshot })
      });
    }

    alert("✅ Đã cập nhật thành công Mạch suy nghĩ và Chat AI mới nhất lên Lịch sử!");
  }
}
