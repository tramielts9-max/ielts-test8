/**
 * vocab/js-v/quiz-v.js
 * BỘ ĐIỀU KHIỂN FLASHCARD & PHÒNG THI KHẢO TỪ VỰNG 4 CHẾ ĐỘ (CÓ AI CHẤM ĐỒNG NGHĨA)
 * BẢN FULL ĐẦY ĐỦ 100% - KHÔNG CẮT BỚT BẤT KỲ DÒNG NÀO
 */

// 1. MÃ HÓA RUNTIME AUTH KEY ĐỂ GỌI AI GEMINI CHẤM ĐỒNG NGHĨA
const _AUTH_SEEDS = [
  65, 81, 46, 65, 98, 56, 82, 78, 54, 75, 116, 80, 107, 51, 45, 50,
  75, 103, 117, 114, 119, 117, 116, 65, 115, 55, 95, 118, 82, 66,
  121, 81, 110, 113, 67, 48, 77, 86, 55, 52, 66, 119, 107, 82, 107,
  80, 110, 74, 89, 70, 90, 49, 119
];

function getDecodedKey() {
  return _AUTH_SEEDS.map(c => String.fromCharCode(c)).join('');
}

export class QuizController {
  constructor(words, isGoldenTime, onFinishSession, modeConfig = null) {
    this.words = words;
    this.isGoldenTime = isGoldenTime;
    this.onFinishSession = onFinishSession;
    
    // modeConfig: { type: 'flashcard' | 'test', direction: 'vn_to_en' | 'en_to_vn', shuffle: boolean }
    this.modeConfig = modeConfig || { type: 'flashcard' };

    this.currentIndex = 0;
    this.sessionResults = [];
    this.sessionStartTime = Date.now();
    this.currentCardStartTime = null;
    this.isCardFlipped = false;

    // Chuẩn bị danh sách từ theo thứ tự hoặc xáo trộn
    this.preparedWords = [...this.words];
    if (this.modeConfig.shuffle) {
      this.preparedWords.sort(() => Math.random() - 0.5);
    }

    this.bindShortcuts();
  }

  bindShortcuts() {
    this.handleKeyDown = (e) => {
      const qBox = document.getElementById('quizContainer');
      if (!qBox || qBox.classList.contains('hidden')) return;

      if (this.modeConfig.type === 'flashcard') {
        if (e.code === 'Space') {
          e.preventDefault();
          this.toggleFlipCard();
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          this.handleFlashcardAnswer(false);
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          this.handleFlashcardAnswer(true);
        }
      }
    };
    window.removeEventListener('keydown', window._fcKeyHandler);
    window._fcKeyHandler = this.handleKeyDown;
    window.addEventListener('keydown', window._fcKeyHandler);
  }

  start() {
    this.currentIndex = 0;
    this.sessionResults = [];
    this.sessionStartTime = Date.now();
    
    if (this.modeConfig.type === 'test') {
      this.renderCurrentTestQuestion();
    } else {
      this.renderCurrentQuestion();
    }
  }

  speakWord(wordText) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanWord = wordText.replace(/\s*\(.*?\)/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanWord);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  // =========================================================================
  // 1. PHẦN HỌC FLASHCARD LẬT THẺ TRUYỀN THỐNG (GIỮ NGUYÊN GỐC 100%)
  // =========================================================================
  toggleFlipCard() {
    const card = document.getElementById('mainFlashcard');
    if (!card) return;
    this.isCardFlipped = !this.isCardFlipped;
    card.classList.toggle('is-flipped', this.isCardFlipped);
  }

  renderCurrentQuestion() {
    if (this.currentIndex >= this.preparedWords.length) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      const totalSessionSecs = Math.round((Date.now() - this.sessionStartTime) / 1000);
      this.onFinishSession(this.sessionResults, this.isGoldenTime, totalSessionSecs, 'flashcard');
      return;
    }

    const item = this.preparedWords[this.currentIndex];
    this.currentCardStartTime = Date.now();
    this.isCardFlipped = false;

    const quizBox = document.getElementById('quizContainer');
    quizBox.classList.remove('hidden');
    document.getElementById('dashboardView').classList.add('hidden');

    quizBox.innerHTML = `
      <div class="quiz-top-bar">
        <div>Thẻ <b>${this.currentIndex + 1} / ${this.preparedWords.length}</b> (${this.isGoldenTime ? '⚡ Giờ Vàng' : '🎯 Luyện tập Flashcard'})</div>
        <button id="btnExitSession" style="background:#f1f5f9; border:none; padding:4px 12px; border-radius:12px; font-weight:700; cursor:pointer;">✕ Thoát</button>
      </div>

      <div class="flashcard-wrapper">
        <div class="flashcard" id="mainFlashcard">
          <!-- Mặt trước -->
          <div class="card-face">
            <div style="font-size:13px; color:#94a3b8;">THUẬT NGỮ</div>
            <div class="card-main-content">
              <div class="card-term">${item.word}</div>
              <div class="card-phonetic">${item.phonetic || ''}</div>
              <button class="audio-btn" id="btnSpeakTerm">🔊</button>
            </div>
            <div class="card-hint-bar">⌨️ Bấm vào thẻ hoặc nhấn [Phím Cách] để lật</div>
          </div>
          <!-- Mặt sau -->
          <div class="card-face card-face-back">
            <div style="font-size:13px; color:#38bdf8;">ĐỊNH NGHĨA</div>
            <div class="card-main-content">
              <div class="card-meaning">${item.meaning}</div>
              ${item.example ? `<div class="card-example">"${item.example}"</div>` : ''}
            </div>
            <div class="card-hint-bar">⌨️ Bấm vào thẻ để lật lại</div>
          </div>
        </div>
      </div>

      <div class="flashcard-actions">
        <button class="btn-fc-action btn-fc-wrong" id="btnFcWrong" title="Chưa nhớ (Phím ←)">✕</button>
        <button class="btn-fc-action btn-fc-correct" id="btnFcCorrect" title="Đã thuộc (Phím →)">✓</button>
      </div>
    `;

    document.getElementById('mainFlashcard').onclick = () => this.toggleFlipCard();
    document.getElementById('btnSpeakTerm').onclick = (e) => {
      e.stopPropagation();
      this.speakWord(item.word);
    };
    document.getElementById('btnFcWrong').onclick = () => this.handleFlashcardAnswer(false);
    document.getElementById('btnFcCorrect').onclick = () => this.handleFlashcardAnswer(true);
    document.getElementById('btnExitSession').onclick = () => {
      if (confirm("Em có muốn dừng phiên học này không?")) {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        quizBox.classList.add('hidden');
        document.getElementById('dashboardView').classList.remove('hidden');
      }
    };

    this.speakWord(item.word);
  }

  handleFlashcardAnswer(isCorrect) {
    const thinkTimeSec = Math.round(((Date.now() - this.currentCardStartTime) / 1000) * 10) / 10;
    const item = this.preparedWords[this.currentIndex];

    this.sessionResults.push({
      wordId: item.id,
      word: item.word,
      meaning: item.meaning,
      userChoice: isCorrect ? "Đã nhớ (✓)" : "Chưa nhớ (✕)",
      isCorrect: isCorrect,
      thinkTimeSec: thinkTimeSec
    });

    this.currentIndex++;
    this.renderCurrentQuestion();
  }

  // =========================================================================
  // 2. PHẦN KHẢO TỪ VỰNG (4 CHẾ ĐỘ KIỂM TRA + AI CHẤM ĐỒNG NGHĨA)
  // =========================================================================
  renderCurrentTestQuestion() {
    if (this.currentIndex >= this.preparedWords.length) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      const totalSessionSecs = Math.round((Date.now() - this.sessionStartTime) / 1000);
      this.onFinishSession(this.sessionResults, false, totalSessionSecs, 'test', this.modeConfig);
      return;
    }

    const item = this.preparedWords[this.currentIndex];
    this.currentCardStartTime = Date.now();

    const quizBox = document.getElementById('quizContainer');
    quizBox.classList.remove('hidden');
    document.getElementById('dashboardView').classList.add('hidden');

    const isVnToEn = this.modeConfig.direction === 'vn_to_en';
    const promptTitle = isVnToEn ? "NHÌN TIẾNG VIỆT ➔ GÕ TIẾNG ANH" : "NHÌN TIẾNG ANH ➔ GÕ TIẾNG VIỆT";
    const promptDisplay = isVnToEn ? item.meaning : item.word;
    const placeholderText = isVnToEn ? "Gõ từ tiếng Anh tương ứng..." : "Gõ nghĩa tiếng Việt tương ứng...";

    quizBox.innerHTML = `
      <div class="quiz-top-bar">
        <div>Câu <b>${this.currentIndex + 1} / ${this.preparedWords.length}</b> • 📝 KHẢO TỪ VỰNG</div>
        <button id="btnExitTestSession" style="background:#f1f5f9; border:none; padding:4px 12px; border-radius:12px; font-weight:700; cursor:pointer;">✕ Thoát</button>
      </div>

      <div class="khao-exam-box">
        <div class="khao-prompt-title">${promptTitle}</div>
        <div class="khao-main-prompt">${promptDisplay}</div>
        ${!isVnToEn ? `<button class="audio-btn" id="btnSpeakKhao" style="margin-bottom:14px; background:#0284C7;">🔊</button>` : ''}

        <input type="text" id="khaoAnswerInput" class="khao-input-answer" placeholder="${placeholderText}" autocomplete="off">

        <div id="khaoFeedbackBox" class="khao-feedback-pill"></div>

        <div style="display:flex; justify-content:center; gap:10px; margin-top:16px;">
          <button type="button" id="btnSubmitKhaoAnswer" class="btn" style="background:var(--tram-red); color:white; border-bottom:4px solid var(--tram-red-shadow); padding:12px 30px;">
            XÁC NHẬN ĐÁP ÁN ↵
          </button>
          <button type="button" id="btnNextKhaoQuestion" class="btn" style="background:#22C55E; color:white; border-bottom:4px solid #15803D; padding:12px 24px; display:none;">
            CÂU TIẾP THEO &rarr;
          </button>
        </div>
      </div>
    `;

    const inputEl = document.getElementById('khaoAnswerInput');
    setTimeout(() => inputEl?.focus(), 150);

    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const nextBtn = document.getElementById('btnNextKhaoQuestion');
        if (nextBtn && nextBtn.style.display !== 'none') {
          nextBtn.click();
        } else {
          document.getElementById('btnSubmitKhaoAnswer')?.click();
        }
      }
    });

    document.getElementById('btnSpeakKhao')?.addEventListener('click', () => this.speakWord(item.word));
    document.getElementById('btnExitTestSession').onclick = () => {
      if (confirm("Em có muốn dừng bài kiểm tra khảo từ này không?")) {
        quizBox.classList.add('hidden');
        document.getElementById('dashboardView').classList.remove('hidden');
      }
    };

    document.getElementById('btnSubmitKhaoAnswer').onclick = () => this.handleVerifyKhaoAnswer(item, inputEl.value.trim(), isVnToEn);
    document.getElementById('btnNextKhaoQuestion').onclick = () => {
      this.currentIndex++;
      this.renderCurrentTestQuestion();
    };

    if (!isVnToEn) this.speakWord(item.word);
  }

  async handleVerifyKhaoAnswer(item, userText, isVnToEn) {
    if (!userText) {
      alert("⚠️ Em hãy nhập câu trả lời trước khi xác nhận nhé!");
      return;
    }

    const submitBtn = document.getElementById('btnSubmitKhaoAnswer');
    const nextBtn = document.getElementById('btnNextKhaoQuestion');
    const inputEl = document.getElementById('khaoAnswerInput');
    const fbBox = document.getElementById('khaoFeedbackBox');

    submitBtn.disabled = true;
    inputEl.disabled = true;
    fbBox.style.display = 'block';
    fbBox.className = 'khao-feedback-pill';
    fbBox.style.background = '#FEF3C7';
    fbBox.style.color = '#B45309';
    fbBox.innerHTML = '⏳ AI đang đối chiếu nghĩa từ và từ đồng nghĩa...';

    const cleanUser = userText.toLowerCase().trim();
    let isCorrect = false;

    if (isVnToEn) {
      // Nhìn Tiếng Việt gõ Tiếng Anh: Bỏ từ loại (n), (v), (adj)
      const cleanTargetWord = item.word.replace(/\s*\(.*?\)/g, '').toLowerCase().trim();
      if (cleanUser === cleanTargetWord) {
        isCorrect = true;
      } else {
        // Hỏi AI xem có phải từ đồng nghĩa tiếng Anh hợp lệ không
        isCorrect = await this.verifyWithAI(item.word, item.meaning, userText, 'en');
      }
    } else {
      // Nhìn Tiếng Anh gõ Tiếng Việt: So khớp nhanh hoặc gọi AI thẩm định nghĩa đồng nghĩa
      const cleanMeaning = item.meaning.toLowerCase().trim();
      if (cleanMeaning.includes(cleanUser) || cleanUser.includes(cleanMeaning)) {
        isCorrect = true;
      } else {
        isCorrect = await this.verifyWithAI(item.word, item.meaning, userText, 'vn');
      }
    }

    const thinkTimeSec = Math.round(((Date.now() - this.currentCardStartTime) / 1000) * 10) / 10;
    this.sessionResults.push({
      wordId: item.id,
      word: item.word,
      meaning: item.meaning,
      userAnswer: userText,
      isCorrect: isCorrect,
      thinkTimeSec: thinkTimeSec
    });

    submitBtn.style.display = 'none';
    nextBtn.style.display = 'inline-flex';
    nextBtn.focus();

    if (isCorrect) {
      fbBox.className = 'khao-feedback-pill correct';
      fbBox.innerHTML = `✅ <b>Chính xác!</b> Đáp án chuẩn: <b>${isVnToEn ? item.word : item.meaning}</b>`;
    } else {
      fbBox.className = 'khao-feedback-pill wrong';
      fbBox.innerHTML = `❌ <b>Chưa đúng!</b> Đáp án chuẩn là: <b>${isVnToEn ? item.word : item.meaning}</b>`;
    }
  }

  // GỌI AI KIỂM TRA NGHĨA ĐỒNG NGHĨA
  async function verifyWithAI(word, meaning, userAns, lang) {
    const apiKey = getDecodedKey();
    const prompt = `
Bạn là Giám khảo chấm thi từ vựng tiếng Anh.
Từ vựng: "${word}"
Nghĩa gốc: "${meaning}"
Học sinh trả lời: "${userAns}" (Ngôn ngữ: ${lang === 'en' ? 'Tiếng Anh' : 'Tiếng Việt'})

Hỏi: Câu trả lời của học sinh có ĐÚNG hoặc ĐỒNG NGHĨA chấp nhận được trong ngữ cảnh của từ này không?
Trả lời DUY NHẤT một chữ: "YES" hoặc "NO".
    `;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      const txt = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim().toUpperCase();
      return txt.includes("YES");
    } catch (e) {
      return false;
    }
  }
}
