/**
 * PRE-SPEAKING CONTROLLER (-ps)
 * Tích hợp Màn hình Portal Danh sách Card + Chuyển phòng Luyện Nói
 * BẢN FULL ĐẦY ĐỦ 100% - LƯU TOÀN BỘ TEXT ĐÃ NÓI, ĐIỂM SỐ & XEM LẠI CÁC LẦN NỘP
 */

// 1. MÃ HÓA RUNTIME AUTH KEY GỐC
const _AUTH_SEEDS = [
  65, 81, 46, 65, 98, 56, 82, 78, 54, 75, 116, 80, 107, 51, 45, 50,
  75, 103, 117, 114, 119, 117, 116, 65, 115, 55, 95, 118, 82, 66,
  121, 81, 110, 113, 67, 48, 77, 86, 55, 52, 66, 119, 107, 82, 107,
  80, 110, 74, 89, 70, 90, 49, 119
];

function getDecodedKey() {
  return _AUTH_SEEDS.map(c => String.fromCharCode(c)).join('');
}

// 2. DANH SÁCH ACTIVE MODELS & CƠ CHẾ RETRY
const ACTIVE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash'
];

const STORAGE_KEY_PS_HISTORY = 'ps_completed_lessons_history';
const CLOUD_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyNErQQFdciAQM0k9KUrACtpX7rxKkopjChYAC2Ubwj5MGzFOeekDEGs8C1n7P9cNR6vg/exec";

let manifestData = null;
let currentCatalog = null;
let categoriesData = [];
let currentCategory = null;
let currentLesson = null;
let ytPlayer = null;

// Speech & Recording States
let recognition = null;
let audioStream = null;
let audioContext = null;
let analyser = null;
let animationFrameId = null;

let timerInterval = null;
let secondsRecorded = 0;
const MIN_REQUIRED_DURATION = 15; // 15s

// Quản lý Portal
let activePortalLevelId = 'shadow_a1';
let portalAllLessonsFlat = [];

window.addEventListener('DOMContentLoaded', async () => {
  await loadManifestAndInit();
  initYouTubeAPI();
  initSpeechRecognition();
});

// =========================================================================
// QUẢN LÝ LƯU TRỮ VĂN BẢN ĐÃ NÓI (TRANSCRIPT) & ĐIỂM SỐ TỪNG LẦN
// =========================================================================
function getPSStorageKey(lessonId) {
  return `ielts_ps_attempts_${lessonId}`;
}

function getPSAttempts(lessonId) {
  try {
    const raw = localStorage.getItem(getPSStorageKey(lessonId));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function savePSAttempt(lessonId, attemptData) {
  try {
    const attempts = getPSAttempts(lessonId);
    attempts.unshift(attemptData); // Mới nhất lên đầu
    localStorage.setItem(getPSStorageKey(lessonId), JSON.stringify(attempts));
  } catch (e) {
    console.warn("Lỗi lưu lần nói Pre-Speaking:", e);
  }
}

function getCompletedHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_PS_HISTORY) || '{}');
  } catch (e) {
    return {};
  }
}

function saveCompletedLesson(lessonId) {
  const history = getCompletedHistory();
  const todayStr = new Intl.DateTimeFormat('vi-VN').format(new Date());

  if (!history[lessonId]) {
    history[lessonId] = { count: 1, lastDate: todayStr };
  } else {
    history[lessonId].count += 1;
    history[lessonId].lastDate = todayStr;
  }

  localStorage.setItem(STORAGE_KEY_PS_HISTORY, JSON.stringify(history));
}

// ================== KHỞI TẠO TỪ MANIFEST ==================
async function loadManifestAndInit() {
  try {
    const res = await fetch('data/manifest-ps.json');
    if (!res.ok) throw new Error("Chưa có manifest");
    manifestData = await res.json();
  } catch (err) {
    manifestData = {
      catalogs: [
        { id: "shadow_a1", name: "Level A1: Shadow Speaking Foundation", dataFile: "data/shadow_a1/lessons-ps.json" },
        { id: "shadow_a2", name: "Level A2: Pre-Intermediate Shadowing", dataFile: "data/shadow_a2/lessons-ps.json" },
        { id: "shadow_b1", name: "Level B1: Intermediate Fluency Shadowing", dataFile: "data/shadow_b1/lessons-ps.json" },
        { id: "shadow_b2", name: "Level B2.1: Upper-Intermediate Mastery", dataFile: "data/shadow_b2/lessons-ps.json" },
        { id: "shadow_b2_2", name: "Level B2.2: Deep Thinking & Complex Concepts", dataFile: "data/shadow_b2_2/lessons-ps.json" },
        { id: "shadow_c1", name: "Level C1: Native Accents, Celebrities & Cinema", dataFile: "data/shadow_c1/lessons-ps.json" }
      ]
    };
  }

  renderLevelPills();
  populateLevelDropdown();
  await switchPortalLevel(activePortalLevelId);
}

// ================== MÀN HÌNH 1: PORTAL DASHBOARD ==================
function renderLevelPills() {
  const container = document.getElementById('levelPillsContainer');
  if (!container) return;
  container.innerHTML = '';

  manifestData.catalogs.forEach((cat) => {
    const btn = document.createElement('button');
    const isActive = cat.id === activePortalLevelId;
    btn.className = `ps-level-btn ${isActive ? 'active' : ''}`;
    
    const shortLabel = cat.name.split(':')[0] || cat.id;
    btn.innerText = shortLabel;

    btn.onclick = () => switchPortalLevel(cat.id);
    container.appendChild(btn);
  });
}

async function switchPortalLevel(levelId) {
  activePortalLevelId = levelId;
  renderLevelPills();

  const catalog = manifestData.catalogs.find(c => c.id === levelId);
  if (!catalog) return;

  try {
    const res = await fetch(catalog.dataFile);
    if (!res.ok) throw new Error("Chưa tải được dữ liệu");
    const levelCategories = await res.json();

    portalAllLessonsFlat = [];
    levelCategories.forEach(cat => {
      (cat.lessons || []).forEach(lesson => {
        portalAllLessonsFlat.push({
          ...lesson,
          categoryName: cat.category,
          levelId: catalog.id,
          levelName: catalog.name.split(':')[0] || 'Level'
        });
      });
    });

    renderPortalCards(portalAllLessonsFlat);
  } catch (err) {
    console.error("Lỗi tải bài học cho Portal:", err);
    document.getElementById('portalCardsGrid').innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #DC2626; font-weight: 800;">
        Không thể tải bài học của cấp độ này (${catalog.dataFile}).
      </div>
    `;
  }
}

function renderPortalCards(lessonsList) {
  const grid = document.getElementById('portalCardsGrid');
  const progressBadge = document.getElementById('levelProgressBadge');
  const history = getCompletedHistory();

  let completedCount = 0;
  lessonsList.forEach(l => {
    const attempts = getPSAttempts(l.id);
    if (attempts.length > 0 || history[l.id]) completedCount++;
  });

  if (progressBadge) {
    progressBadge.innerText = `${completedCount}/${lessonsList.length} Đã xong`;
  }

  if (lessonsList.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted); font-weight: 800; background: #FFFFFF; border-radius: 20px; border: 2.5px dashed var(--border-color);">
        Không tìm thấy bài học nào phù hợp.
      </div>
    `;
    return;
  }

  grid.innerHTML = lessonsList.map(l => {
    const attempts = getPSAttempts(l.id);
    const record = history[l.id];
    const isDone = attempts.length > 0 || !!record;
    const count = attempts.length > 0 ? attempts.length : (record?.count || 1);
    const latestScore = attempts.length > 0 ? `${attempts[0].overall}%` : 'Đã nộp';

    const statusBadge = isDone
      ? `<span class="ps-pill-tag" style="background: #DCFCE7; color: #166534; border-color: #86EFAC;">
           ✓ Đã làm ${count} lần (${latestScore})
         </span>`
      : `<span style="font-size: 12.5px; font-weight: 800; color: var(--text-muted);">
           ● Chưa làm
         </span>`;

    return `
      <div class="ps-lesson-card ${isDone ? 'is-done' : ''}">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span class="ps-card-tag" style="background: #FAF5FF; color: var(--ps-purple); border: 1.5px solid #E9D5FF;">
              ${l.id} • ${l.levelName}
            </span>
            ${statusBadge}
          </div>
          <h3 style="font-size: 16.5px; font-weight: 900; color: var(--text-main); margin: 6px 0; line-height: 1.4;" title="${l.title}">
            ${l.title}
          </h3>
          <div style="font-size: 13px; color: var(--text-muted); font-weight: 700; margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 190px;" title="${l.categoryName}">📁 ${l.categoryName}</span>
            <span style="color: #0284C7; font-weight: 800; white-space: nowrap;">⏱️ ${l.duration}</span>
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 16px;">
          <button 
            onclick="window.startLessonFromPortal('${l.levelId}', '${l.id}')"
            class="btn-3d ${isDone ? 'btn-3d-green' : 'btn-3d-purple'}"
            style="flex: 1; padding: 11px; font-size: 13px;"
          >
            ${isDone ? `+ Luyện tiếp lần ${count + 1}` : 'Vào luyện nói →'}
          </button>
          ${isDone ? `
            <button 
              onclick="window.openPastAttemptsFromPortal('${l.levelId}', '${l.id}')"
              class="btn-3d btn-3d-white"
              style="padding: 11px 12px; font-size: 13px;"
              title="Xem lại bài nói và điểm các lần trước"
            >
              👁️ Xem (${count})
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

window.filterPortalLessons = () => {
  const query = (document.getElementById('portalSearchInput')?.value || '').toLowerCase().trim();
  const filtered = portalAllLessonsFlat.filter(l => 
    l.title.toLowerCase().includes(query) || 
    l.id.toLowerCase().includes(query) ||
    l.categoryName.toLowerCase().includes(query)
  );
  renderPortalCards(filtered);
};

// ================== CHUYỂN ĐỔI MÀN HÌNH ==================
window.startLessonFromPortal = async (levelId, lessonId) => {
  document.getElementById('portalScreen').classList.add('hidden');
  document.getElementById('workspaceScreen').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const levelSel = document.getElementById('levelSelect');
  if (levelSel) {
    levelSel.value = levelId;
    await handleLevelChange(lessonId);
  }
};

window.openPastAttemptsFromPortal = async (levelId, lessonId) => {
  await window.startLessonFromPortal(levelId, lessonId);
  setTimeout(() => {
    window.viewPastAttemptDetailPS(0);
  }, 400);
};

window.backToPortal = () => {
  if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
  clearInterval(timerInterval);
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  if (recognition) { try { recognition.stop(); } catch (e) {} }
  if (audioStream) audioStream.getTracks().forEach(t => t.stop());
  if (audioContext && audioContext.state !== 'closed') audioContext.close();

  document.getElementById('workspaceScreen').classList.add('hidden');
  document.getElementById('portalScreen').classList.remove('hidden');

  switchPortalLevel(activePortalLevelId);
};

// ================== LOGIC 3 THANH CHỌN WORKSPACE ==================
function populateLevelDropdown() {
  const levelSel = document.getElementById('levelSelect');
  if (!levelSel) return;
  levelSel.innerHTML = '';

  manifestData.catalogs.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.innerText = cat.name;
    levelSel.appendChild(opt);
  });
}

window.handleLevelChange = async (targetLessonId = null) => {
  const levelSel = document.getElementById('levelSelect');
  const selectedCatId = levelSel.value;
  currentCatalog = manifestData.catalogs.find(c => c.id === selectedCatId) || manifestData.catalogs[0];

  try {
    const res = await fetch(currentCatalog.dataFile);
    categoriesData = await res.json();
  } catch (err) {
    categoriesData = [];
  }

  populateCategoryDropdown(targetLessonId);
};

function populateCategoryDropdown(targetLessonId = null) {
  const catSel = document.getElementById('categorySelect');
  if (!catSel) return;
  catSel.innerHTML = '';

  if (categoriesData.length === 0) {
    const opt = document.createElement('option');
    opt.innerText = "(Chưa có dữ liệu bài học)";
    catSel.appendChild(opt);
    return;
  }

  let selectedCatIndex = 0;
  if (targetLessonId) {
    categoriesData.forEach((group, idx) => {
      if ((group.lessons || []).some(l => l.id === targetLessonId)) {
        selectedCatIndex = idx;
      }
    });
  }

  categoriesData.forEach((group, index) => {
    const opt = document.createElement('option');
    opt.value = index;
    opt.innerText = group.category;
    if (index === selectedCatIndex) opt.selected = true;
    catSel.appendChild(opt);
  });

  handleCategoryChange(targetLessonId);
}

window.handleCategoryChange = (targetLessonId = null) => {
  const catSel = document.getElementById('categorySelect');
  const lessonSel = document.getElementById('lessonSelect');
  const catIndex = parseInt(catSel.value) || 0;
  currentCategory = categoriesData[catIndex];

  if (!lessonSel) return;
  lessonSel.innerHTML = '';

  if (!currentCategory || !currentCategory.lessons || currentCategory.lessons.length === 0) {
    const opt = document.createElement('option');
    opt.innerText = "(Chưa có video)";
    lessonSel.appendChild(opt);
    return;
  }

  currentCategory.lessons.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.innerText = `[${l.id}] ${l.title} (${l.duration})`;
    if (targetLessonId && l.id === targetLessonId) opt.selected = true;
    lessonSel.appendChild(opt);
  });

  handleLessonChange();
};

window.handleLessonChange = () => {
  const lessonSel = document.getElementById('lessonSelect');
  const lessonId = lessonSel.value;
  if (!currentCategory) return;

  currentLesson = currentCategory.lessons.find(l => l.id === lessonId) || currentCategory.lessons[0];

  if (currentLesson) {
    document.getElementById('displayLessonTitle').innerText = `[${currentLesson.id}] ${currentLesson.title}`;
    document.getElementById('displayLessonDuration').innerText = `Thời lượng: ${currentLesson.duration}`;
    
    if (ytPlayer && ytPlayer.loadVideoById) {
      ytPlayer.loadVideoById(currentLesson.videoId);
    }

    renderWorkspacePastAttemptsBar();
  }
  resetUI();
};

// =========================================================================
// THANH HIỂN THỊ CÁC LẦN NÓI CŨ ĐỂ HỌC SINH XEM LẠI BẤT KỲ LÚC NÀO
// =========================================================================
function renderWorkspacePastAttemptsBar() {
  if (!currentLesson) return;
  let bar = document.getElementById('psPastAttemptsBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'psPastAttemptsBar';
    const grid = document.querySelector('.ps-workspace-grid');
    if (grid) grid.parentNode.insertBefore(bar, grid);
  }

  const attempts = getPSAttempts(currentLesson.id);
  if (attempts.length === 0) {
    bar.innerHTML = '';
    return;
  }

  let html = `
    <div style="background: #F0FDF4; border: 2px solid #86EFAC; border-radius: 16px; padding: 12px 18px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
      <div>
        <b style="color: #166534; font-size: 14px;">📜 Bài này Em đã nói ${attempts.length} lần trước đây:</b>
        <div style="display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap;">
  `;

  attempts.forEach((att, idx) => {
    html += `
      <button type="button" onclick="window.viewPastAttemptDetailPS(${idx})" style="background: #FFFFFF; border: 1.5px solid #86EFAC; border-bottom: 3px solid #22C55E; padding: 4px 10px; border-radius: 8px; font-weight: 800; font-size: 12.5px; cursor: pointer; color: #166534;">
        Lần ${att.attemptNum || (attempts.length - idx)}: <b>${att.overall}%</b> (${att.timestamp.split(' - ')[0]})
      </button>
    `;
  });

  html += `
        </div>
      </div>
      <span style="font-size: 12px; color: #15803D; font-weight: 700;">Nhấp vào lần làm để xem lại bản ký âm cũ</span>
    </div>
  `;

  bar.innerHTML = html;
}

window.viewPastAttemptDetailPS = (idx) => {
  if (!currentLesson) return;
  const attempts = getPSAttempts(currentLesson.id);
  const att = attempts[idx];
  if (!att) return;

  const txtArea = document.getElementById('speechTranscript');
  if (txtArea) txtArea.value = att.transcript || '';

  document.getElementById('resOverall').innerText = att.overall || '--';
  document.getElementById('resFluency').innerText = att.fluency || '--';
  document.getElementById('resPronun').innerText = att.pronun || '--';
  document.getElementById('resFeedback').innerText = `📜 [BẢN LƯU LẦN ${att.attemptNum || 1} - ${att.timestamp}]:\n${att.feedback || ''}`;

  const missedBox = document.getElementById('resMissedWords');
  missedBox.innerHTML = '';
  if (att.missedWords && att.missedWords.length > 0) {
    att.missedWords.forEach(w => {
      const sp = document.createElement('span');
      sp.style.cssText = "padding: 3px 8px; background: #FEE2E2; color: #991B1B; border: 1.5px solid #FCA5A5; border-radius: 8px; font-weight: 800; font-size: 12.5px;";
      sp.innerText = w;
      missedBox.appendChild(sp);
    });
  } else {
    missedBox.innerHTML = '<span style="color: #166534; font-weight: 800; font-size: 13px;">🎉 Phát âm rất chuẩn xác, không bị nuốt từ!</span>';
  }
};

// ================== YOUTUBE API ==================
function initYouTubeAPI() {
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
}

window.onYouTubeIframeAPIReady = () => {
  const defaultId = currentLesson ? currentLesson.videoId : "UHMbJlKzNu8";
  ytPlayer = new YT.Player('youtube-player', {
    videoId: defaultId,
    playerVars: {
      playsinline: 1,
      rel: 0,
      modestbranding: 1
    }
  });
};

// ================== WEB SPEECH API REALTIME (STT) ==================
function initSpeechRecognition() {
  window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!window.SpeechRecognition) {
    console.warn("Trình duyệt không hỗ trợ Web Speech API.");
    return;
  }

  recognition = new window.SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = 0; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript + ' ';
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    const txtArea = document.getElementById('speechTranscript');
    if (txtArea) {
      txtArea.value = (final + interim).trim();
    }
  };

  recognition.onerror = (e) => {
    console.warn("Web Speech Error:", e.error);
  };
}

// VU METER ÂM THANH
async function startAudioMeter() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(audioStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);

    const canvas = document.getElementById('audioMeter');
    const ctx = canvas.getContext('2d');
    const data = new Uint8Array(analyser.frequencyBinCount);

    function render() {
      animationFrameId = requestAnimationFrame(render);
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      let avg = sum / data.length;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = avg > 80 ? '#22C55E' : (avg > 30 ? '#9333EA' : '#CBD5E1');
      ctx.fillRect(0, 0, (avg / 255) * canvas.width, canvas.height);
    }
    render();
    return true;
  } catch (err) {
    alert("Vui lòng cắm Micro và cấp quyền Micro trên trình duyệt để luyện nói!");
    return false;
  }
}

// BẬT / DỪNG THU ÂM
window.toggleShadowRecording = async () => {
  const btnRec = document.getElementById('btnRecord');
  const btnStop = document.getElementById('btnStop');
  const badge = document.getElementById('sttStatusBadge');

  resetUI();
  const ok = await startAudioMeter();
  if (!ok) return;

  if (recognition) {
    const txtArea = document.getElementById('speechTranscript');
    if (txtArea) txtArea.value = '';
    try { recognition.start(); } catch (e) {}
    if (badge) {
      badge.innerText = "🔴 Đang nghe & ký âm...";
      badge.style.background = "#FEE2E2";
      badge.style.color = "#991B1B";
      badge.style.borderColor = "#FCA5A5";
    }
  }

  if (ytPlayer && ytPlayer.playVideo) {
    ytPlayer.seekTo(0, true);
    ytPlayer.playVideo();
  }

  secondsRecorded = 0;
  timerInterval = setInterval(() => {
    secondsRecorded++;
    const m = String(Math.floor(secondsRecorded / 60)).padStart(2, '0');
    const s = String(secondsRecorded % 60).padStart(2, '0');
    document.getElementById('timerDisplay').innerText = `${m}:${s}`;
  }, 1000);

  btnRec.disabled = true;
  btnRec.classList.add('recording');
  btnStop.disabled = false;
};

window.stopAndSubmitRecording = async () => {
  const btnRec = document.getElementById('btnRecord');
  const btnStop = document.getElementById('btnStop');
  const badge = document.getElementById('sttStatusBadge');

  if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
  clearInterval(timerInterval);
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  if (recognition) {
    try { recognition.stop(); } catch (e) {}
    if (badge) {
      badge.innerText = "✓ Đã ký âm xong";
      badge.style.background = "#DCFCE7";
      badge.style.color = "#166534";
      badge.style.borderColor = "#86EFAC";
    }
  }
  if (audioStream) audioStream.getTracks().forEach(t => t.stop());
  if (audioContext && audioContext.state !== 'closed') audioContext.close();

  btnRec.disabled = false;
  btnRec.classList.remove('recording');
  btnStop.disabled = true;

  const transcript = document.getElementById('speechTranscript') ? document.getElementById('speechTranscript').value.trim() : "";
  if (!transcript) {
    alert("⚠️ Chưa ghi nhận được bài nói nào từ Micro. Em hãy nói to và rõ hơn nhé!");
    return;
  }

  await evaluateWithGeminiEngine(transcript, secondsRecorded);
};

// ================== GỌI AI VỚI FALLBACK & RETRY ==================
async function callGeminiWithFallback(promptText, apiKey) {
  for (const model of ACTIVE_MODELS) {
    let attempts = 0;
    const maxAttempts = (model.includes('lite')) ? 3 : 1;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        showOverlay(`Đang kết nối ${model} (Lần thử ${attempts}/${maxAttempts})...`);

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
          })
        });

        if (response.status === 503 || response.status === 429) {
          throw new Error(`Server busy: ${response.status}`);
        }

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(`API Error ${response.status}: ${errData.error?.message || 'Unknown'}`);
        }

        const data = await response.json();
        return data;

      } catch (error) {
        if (attempts < maxAttempts) {
          showOverlay(`Máy chủ ${model} đang bận, tự động thử lại sau 1.5s...`);
          await new Promise(res => setTimeout(res, 1500));
        }
      }
    }
  }

  throw new Error("Tất cả các model Gemini khả dụng đều đang bận. Vui lòng thử lại sau ít phút.");
}

async function evaluateWithGeminiEngine(transcriptText, durationSec) {
  showOverlay("Đang chuẩn bị dữ liệu phân tích...");
  const apiKey = getDecodedKey();

  const promptText = `
Bạn là Giám khảo chấm Shadowing tiếng Anh trình độ ${currentCatalog ? currentCatalog.name : "A1-C1"}.
Chủ đề bài học học sinh nhại theo video: "${currentLesson.title}".
Bản ký âm Speech-to-Text từ giọng nói thực tế của học sinh:
"${transcriptText}"

HÃY ĐỐI CHIẾU VÀ ĐÁNH GIÁ:
- Các từ bị nuốt âm đuôi (-s, -ed, âm cuối), phát âm chưa chuẩn dẫn đến ký âm nhầm.
- Tính điểm overall_score, fluency_score, pronunciation_score.
- Trả về DUY NHẤT một chuỗi JSON thuần (không markdown, không backtick \`\`\`json):
{
  "overall_score": 75,
  "fluency_score": 80,
  "pronunciation_score": 70,
  "missed_words": ["danh", "sach", "tu", "sai"],
  "feedback": "Nhận xét ngắn gọn bằng tiếng Việt (1 lời khen và 1 lời khuyên sửa phát âm)"
}
`;

  try {
    const rawResponse = await callGeminiWithFallback(promptText, apiKey);
    
    let rawText = rawResponse.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";
    if (rawText.startsWith("```json")) rawText = rawText.replace(/^```json/, "").replace(/```$/, "").trim();
    else if (rawText.startsWith("```")) rawText = rawText.replace(/^```/, "").replace(/```$/, "").trim();

    const parsed = JSON.parse(rawText);
    hideOverlay();
    renderGradingResult(parsed, durationSec, transcriptText);
  } catch (err) {
    hideOverlay();
    alert("Lỗi chấm điểm: " + err.message);
  }
}

// BẢNG KẾT QUẢ VÀ TIÊU CHUẨN HOÀN THÀNH
function renderGradingResult(data, durationSec, transcriptText) {
  document.getElementById('resOverall').innerText = data.overall_score || 0;
  document.getElementById('resFluency').innerText = data.fluency_score || 0;
  document.getElementById('resPronun').innerText = data.pronunciation_score || 0;
  document.getElementById('resFeedback').innerText = data.feedback || "";

  const missedBox = document.getElementById('resMissedWords');
  missedBox.innerHTML = '';
  if (data.missed_words && data.missed_words.length > 0) {
    data.missed_words.forEach(w => {
      const sp = document.createElement('span');
      sp.style.cssText = "padding: 3px 8px; background: #FEE2E2; color: #991B1B; border: 1.5px solid #FCA5A5; border-radius: 8px; font-weight: 800; font-size: 12.5px;";
      sp.innerText = w;
      missedBox.appendChild(sp);
    });
  } else {
    missedBox.innerHTML = '<span style="color: #166534; font-weight: 800; font-size: 13px;">🎉 Phát âm rất chuẩn xác, không bị nuốt từ!</span>';
  }

  const isDurationPassed = durationSec >= MIN_REQUIRED_DURATION;
  const isScorePassed = (data.overall_score || 0) >= 60;

  document.getElementById('valPacingText').innerHTML = `<b style="color: ${isDurationPassed ? '#166534' : '#DC2626'};">${durationSec}s</b> / ${MIN_REQUIRED_DURATION}s`;
  document.getElementById('valScoreText').innerHTML = `<b style="color: ${isScorePassed ? '#166534' : '#DC2626'};">${data.overall_score}%</b> (≥60%)`;

  const badge = document.getElementById('validationBadge');
  const completeBtn = document.getElementById('btnComplete');

  if (isDurationPassed && isScorePassed) {
    badge.style.background = "#DCFCE7";
    badge.style.color = "#166534";
    badge.style.borderColor = "#86EFAC";
    badge.innerText = "✓ ĐẠT YÊU CẦU";
    completeBtn.disabled = false;
  } else {
    badge.style.background = "#FEE2E2";
    badge.style.color = "#991B1B";
    badge.style.borderColor = "#FCA5A5";
    badge.innerText = "✕ CHƯA ĐẠT";
    completeBtn.disabled = true;
  }

  // TẠM LƯU DỮ LIỆU ĐỂ KHI BẤM NÚT HOÀN THÀNH SẼ LƯU ĐẦY ĐỦ
  window.lastGradingSnapshot = {
    transcript: transcriptText,
    overall: data.overall_score || 0,
    fluency: data.fluency_score || 0,
    pronun: data.pronunciation_score || 0,
    missedWords: data.missed_words || [],
    feedback: data.feedback || ''
  };
}

function resetUI() {
  document.getElementById('timerDisplay').innerText = "00:00";
  document.getElementById('resOverall').innerText = "--";
  document.getElementById('resFluency').innerText = "--";
  document.getElementById('resPronun').innerText = "--";
  document.getElementById('resMissedWords').innerHTML = '<span style="color: var(--text-muted); font-style: italic; font-size: 13px;">Không có dữ liệu</span>';
  document.getElementById('resFeedback').innerText = "Bấm 'Bắt đầu Shadow & Nói' để nhận đánh giá tức thì.";
  
  const badge = document.getElementById('validationBadge');
  badge.style.background = "#FAF7F2";
  badge.style.color = "var(--text-muted)";
  badge.style.borderColor = "var(--border-color)";
  badge.innerText = "Chờ nộp bài";

  document.getElementById('btnComplete').disabled = true;
}

// XÁC NHẬN HOÀN THÀNH -> LƯU TIẾN ĐỘ, VĂN BẢN ĐÃ NÓI & BẮN GOOGLE DRIVE
window.completeLessonSubmission = () => {
  if (!currentLesson) return;

  saveCompletedLesson(currentLesson.id);

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} - ${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  const sName = localStorage.getItem('ielts_student_name') || 'Học viên';
  const sEmail = localStorage.getItem('ielts_student_email') || '';
  const sc = document.getElementById('resOverall')?.innerText || '60';
  const transcriptText = document.getElementById('speechTranscript')?.value || '';

  const attempts = getPSAttempts(currentLesson.id);
  const newAttemptNum = attempts.length + 1;

  // 1. LƯU VĂN BẢN VÀ ĐIỂM SỐ VÀO DANH SÁCH LẦN LÀM RIÊNG BIỆT
  const newAttemptRecord = {
    attemptNum: newAttemptNum,
    timestamp: timeStr,
    transcript: transcriptText,
    overall: sc,
    fluency: document.getElementById('resFluency')?.innerText || 0,
    pronun: document.getElementById('resPronun')?.innerText || 0,
    missedWords: window.lastGradingSnapshot?.missedWords || [],
    feedback: document.getElementById('resFeedback')?.innerText || ''
  };

  savePSAttempt(currentLesson.id, newAttemptRecord);

  // 2. LƯU LỊCH SỬ CHUNG TRANG CHỦ & BẮN LÊN GOOGLE DRIVE
  try {
    const attemptSnapshot = {
      id: "attempt_ps_" + Date.now(),
      timestamp: `${timeStr} (Lần ${newAttemptNum})`,
      testTitle: `Pre-Speaking: [${currentLesson.id}] ${currentLesson.title} (Lần ${newAttemptNum})`,
      studentName: sName,
      studentEmail: sEmail,
      score: `${sc}%`,
      timeSpent: `${secondsRecorded}s`,
      details: `BẢN KÝ ÂM (HỌC VIÊN ĐÃ NÓI):\n"${transcriptText}"\n\nKẾT QUẢ ĐÁNH GIÁ AI:\nOverall: ${sc}% | Fluency: ${document.getElementById('resFluency')?.innerText || 0}% | Pronunciation: ${document.getElementById('resPronun')?.innerText || 0}%\nNhận xét: ${document.getElementById('resFeedback')?.innerText || ''}`,
      pageUrl: "pre-speaking/index-ps.html",
      moduleType: "pre_speaking"
    };

    const localHist = JSON.parse(localStorage.getItem('ielts_local_history') || '[]');
    localHist.unshift(attemptSnapshot);
    localStorage.setItem('ielts_local_history', JSON.stringify(localHist));

    fetch(CLOUD_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "save_attempt", attempt: attemptSnapshot })
    }).catch(() => {});
  } catch(errHist) {
    console.warn("Lỗi lưu Pre-Speaking:", errHist);
  }

  alert(`🎉 Chúc mừng em đã hoàn thành bài tập [${currentLesson.id}] Lần ${newAttemptNum}! Toàn bộ bài nói và điểm số đã được lưu an toàn.`);
  window.backToPortal();
};

function showOverlay(txt) {
  document.getElementById('loadingText').innerText = txt;
  document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideOverlay() {
  document.getElementById('loadingOverlay').style.display = 'none';
}
