/**
 * pre-reading/modal-pr.js
 * ĐIỀU KHIỂN POPUP DÁN ẢNH BẰNG CHỨNG (CTRL + V)
 * BẢN FULL ĐẦY ĐỦ 100% - HIỂN THỊ ĐẦY ĐỦ CÁC LẦN NỘP TRƯỚC VÀ CHO PHÉP NỘP LẦN MỚI
 */

import { getSubmission, saveSubmission } from './db-pr.js';

let activeLessonId = null;
let activeLessonTitle = '';
let currentLevel = 'A1';
let tempWrongImages = [];
let tempFullImage = null;
let onSaveCallback = null;
let currentPasteTarget = 'wrong';

export function initModal(onSaved) {
  onSaveCallback = onSaved;

  document.getElementById('mWrongImgs')?.addEventListener('change', (e) => {
    handleFileSelect(Array.from(e.target.files), 'wrong');
  });

  document.getElementById('mFullImg')?.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      handleFileSelect([e.target.files[0]], 'full');
    }
  });

  const zoneWrong = document.getElementById('pasteZoneWrong');
  const zoneFull = document.getElementById('pasteZoneFull');

  zoneWrong?.addEventListener('click', () => setPasteTarget('wrong'));
  zoneFull?.addEventListener('click', () => setPasteTarget('full'));

  window.addEventListener('paste', (e) => {
    const modal = document.getElementById('submitModal');
    if (modal && modal.classList.contains('hidden')) return;

    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    let foundImage = false;

    for (let item of items) {
      if (item.type.indexOf('image') !== -1) {
        foundImage = true;
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (event) => {
          if (currentPasteTarget === 'wrong') {
            tempWrongImages.push(event.target.result);
            renderWrongPreview();
          } else {
            tempFullImage = event.target.result;
            renderFullPreview();
          }
        };
        reader.readAsDataURL(blob);
      }
    }

    if (foundImage) {
      e.preventDefault();
    }
  });

  window.removeWrongImgPR = (idx) => {
    tempWrongImages.splice(idx, 1);
    renderWrongPreview();
  };

  window.removeFullImgPR = () => {
    tempFullImage = null;
    renderFullPreview();
  };

  window.closeModalPR = () => closeModal();
  window.submitFormPR = () => handleSave();
}

function setPasteTarget(target) {
  currentPasteTarget = target;
  const zoneWrong = document.getElementById('pasteZoneWrong');
  const zoneFull = document.getElementById('pasteZoneFull');

  if (target === 'wrong') {
    zoneWrong?.classList.add('active-paste');
    zoneFull?.classList.remove('active-paste');
  } else {
    zoneFull?.classList.add('active-paste');
    zoneWrong?.classList.remove('active-paste');
  }
}

function handleFileSelect(files, target) {
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (target === 'wrong') {
        tempWrongImages.push(event.target.result);
        renderWrongPreview();
      } else {
        tempFullImage = event.target.result;
        renderFullPreview();
      }
    };
    reader.readAsDataURL(file);
  });
}

export async function openModal(id, title, level) {
  activeLessonId = id;
  activeLessonTitle = title;
  currentLevel = level;

  document.getElementById('mTitle').innerText = title;
  document.getElementById('mLevel').innerText = `READING - ${level}`;

  document.getElementById('mCorrect').value = '';
  document.getElementById('mTotal').value = '';
  document.getElementById('mWrongList').value = '';
  document.getElementById('mWrongImgs').value = '';
  document.getElementById('mFullImg').value = '';
  document.getElementById('previewWrong').innerHTML = '';
  document.getElementById('previewFull').innerHTML = '';
  tempWrongImages = [];
  tempFullImage = null;

  setPasteTarget('full');

  // HIỂN THỊ LỊCH SỬ CÁC LẦN NỘP TRƯỚC (NẾU CÓ)
  const existing = await getSubmission(id);
  renderHistoryAttemptsBox(existing);

  document.getElementById('submitModal').classList.remove('hidden');
}

function renderHistoryAttemptsBox(existing) {
  let histContainer = document.getElementById('prPastAttemptsHistory');
  if (!histContainer) {
    histContainer = document.createElement('div');
    histContainer.id = 'prPastAttemptsHistory';
    const body = document.querySelector('.pr-modal-body');
    if (body) body.insertBefore(histContainer, body.firstChild);
  }

  if (!existing) {
    histContainer.innerHTML = '';
    return;
  }

  const attempts = existing.attempts && existing.attempts.length > 0 
    ? existing.attempts 
    : [{ attemptNum: 1, correct: existing.correct, total: existing.total, timestamp: existing.timestamp, fullProof: existing.fullProof }];

  let html = `
    <div style="background: #FFFBEB; border: 2px solid #FCD34D; border-radius: 14px; padding: 12px 16px; margin-bottom: 14px;">
      <div style="font-size: 13.5px; font-weight: 900; color: #92400E; margin-bottom: 8px;">
        📜 BẰNG CHỨNG ĐÃ LƯU TRƯỚC ĐÂY (${attempts.length} lần làm):
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
  `;

  attempts.forEach(att => {
    const pct = att.total > 0 ? Math.round((att.correct / att.total) * 100) : 0;
    html += `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #FFFFFF; border: 1.5px solid #E8E2D8; border-radius: 10px; padding: 8px 12px; gap: 10px; flex-wrap: wrap;">
        <div>
          <span style="background: #D97706; color: white; padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: 900;">LẦN ${att.attemptNum}</span>
          <b style="font-size: 13.5px; color: #166534; margin-left: 6px;">🎯 ${att.correct}/${att.total} (${pct}%)</b>
          <span style="font-size: 12px; color: #756D68; margin-left: 6px;">📅 ${att.timestamp}</span>
        </div>
        ${att.fullProof ? `
          <a href="${att.fullProof}" target="_blank" style="font-size: 12px; background: #E0F2FE; color: #0284C7; text-decoration: none; padding: 3px 8px; border-radius: 6px; font-weight: 800;">
            🔍 Xem ảnh bằng chứng
          </a>
        ` : ''}
      </div>
    `;
  });

  html += `
      </div>
      <div style="font-size: 12px; color: #B45309; font-weight: 800; margin-top: 8px;">
        👉 Khi em điền điểm và dán ảnh bên dưới, hệ thống sẽ lưu tiếp thành <b>LẦN ${attempts.length + 1}</b> (Không ghi đè các lần cũ).
      </div>
    </div>
  `;

  histContainer.innerHTML = html;
}

export function closeModal() {
  document.getElementById('submitModal')?.classList.add('hidden');
  activeLessonId = null;
}

function renderWrongPreview() {
  const container = document.getElementById('previewWrong');
  container.innerHTML = tempWrongImages.map((src, idx) => `
    <div style="position: relative; width: 68px; height: 68px; border-radius: 12px; border: 2px solid var(--border-color); overflow: hidden; background: #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.06);">
      <img src="${src}" style="width: 100%; height: 100%; object-fit: cover;">
      <button onclick="window.removeWrongImgPR(${idx})" style="position: absolute; top: 0; right: 0; background: #DC2626; color: white; border: none; width: 22px; height: 22px; font-size: 13px; font-weight: 900; cursor: pointer; border-bottom-left-radius: 8px;">&times;</button>
    </div>
  `).join('');
}

function renderFullPreview() {
  const container = document.getElementById('previewFull');
  if (!tempFullImage) { container.innerHTML = ''; return; }
  container.innerHTML = `
    <div style="position: relative; display: inline-block; border: 2.5px solid var(--border-color); border-bottom: 4px solid var(--border-shadow); border-radius: 14px; overflow: hidden; margin-top: 8px; background: #FFFFFF;">
      <img src="${tempFullImage}" style="height: 120px; object-fit: contain; background: #FAF7F2;">
      <button onclick="window.removeFullImgPR()" style="position: absolute; top: 4px; right: 4px; background: #DC2626; color: white; border: none; border-radius: 50%; width: 26px; height: 26px; font-size: 14px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
    </div>
  `;
}

async function handleSave() {
  const correct = document.getElementById('mCorrect').value.trim();
  const total = document.getElementById('mTotal').value.trim();
  const wrongNotes = document.getElementById('mWrongList').value.trim();

  if (correct === '' || total === '') {
    alert("⚠️ Vui lòng nhập số câu đúng và tổng số câu!");
    return;
  }
  if (!tempFullImage) {
    alert("⚠️ Bắt buộc phải tải hoặc dán (Ctrl+V) ảnh chụp FULL màn hình kết quả làm bài!");
    return;
  }

  const submission = {
    id: activeLessonId,
    title: activeLessonTitle,
    skill: "reading",
    level: currentLevel,
    correct: parseInt(correct, 10),
    total: parseInt(total, 10),
    wrongNotes: wrongNotes || 'Không có',
    wrongProofs: tempWrongImages,
    fullProof: tempFullImage,
    timestamp: new Date().toLocaleString("vi-VN")
  };

  await saveSubmission(submission);
  closeModal();
  if (onSaveCallback) onSaveCallback();
}
