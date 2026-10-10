/**
 * reading/js-r/reading-builder.js - Module dựng giao diện câu hỏi Reading
 * (BẢN FULL ĐẦY ĐỦ 100% - CHUẨN MA TRẬN RADIO GRID & SIDEBAR GHI CHÚ BÊN PHẢI)
 */

window.activateReadingBubble = function(qId) {
  document.querySelectorAll('.rd-comment-bubble').forEach(b => b.classList.remove('is-active'));
  const target = document.getElementById(`rd_bubble_${qId}`);
  if (target) {
    target.classList.add('is-active');
    target.classList.remove('is-collapsed');
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

window.toggleSingleReadingBubble = function(qId, e) {
  if (e) e.stopPropagation();
  const target = document.getElementById(`rd_bubble_${qId}`);
  if (target) target.classList.toggle('is-collapsed');
};

window.toggleAllReadingBubbles = function(shouldExpand) {
  document.querySelectorAll('.rd-comment-bubble').forEach(b => {
    if (shouldExpand) b.classList.remove('is-collapsed');
    else b.classList.add('is-collapsed');
  });
};

window.saveReadingThought = function(qId, val) {
  const prev = document.getElementById(`rd_bubble_prev_${qId}`);
  if (prev) prev.innerText = val.trim() ? `• ${val.trim().substring(0, 16)}...` : '';
};

// ĐỒNG BỘ ĐÁP ÁN (HỖ TRỢ CẢ SINGLE, MATRIX VÀ MULTI CHECKBOX)
window.syncUserAnswer = function(qId, val) {
  if (val === undefined || val === null) return;
  var cleanVal = String(val).trim();

  var textInputs = document.querySelectorAll(`input[id="${qId}_input"]`);
  textInputs.forEach(el => {
    if (el && el.value !== cleanVal) el.value = cleanVal;
  });

  var radios = document.querySelectorAll(`input[name="${qId}"]`);
  radios.forEach(rb => {
    var isMatch = rb.value.trim().toUpperCase() === cleanVal.toUpperCase();
    if (rb.type === 'radio') rb.checked = isMatch;
    var parentLabel = rb.closest('.choice-btn-label') || rb.closest('.mcq-option-item');
    if (parentLabel) {
      if (rb.checked) parentLabel.classList.add('active', 'selected');
      else parentLabel.classList.remove('active', 'selected');
    }
  });

  var badgeBtn = document.getElementById(`badge_${qId}`);
  if (badgeBtn) {
    if (cleanVal !== "") badgeBtn.classList.add('status-answered');
    else badgeBtn.classList.remove('status-answered');
  }
};

// XỬ LÝ CHỌN ĐÚNG 2 ĐÁP ÁN TRONG DẠNG "CHOOSE TWO"
window.toggleChooseTwoOption = function(groupKey, optKey, maxAllowed = 2) {
  const container = document.getElementById(`choose_two_${groupKey}`);
  if (!container) return;

  const checkedBoxes = Array.from(container.querySelectorAll('input[type="checkbox"]:checked'));
  
  if (checkedBoxes.length > maxAllowed) {
    // Nếu chọn vượt quá 2, hủy chọn cái vừa nhấp
    const currentBox = container.querySelector(`input[value="${optKey}"]`);
    if (currentBox) currentBox.checked = false;
    alert(`⚠️ Dạng bài này yêu cầu chọn chính xác ${maxAllowed} đáp án!`);
    return;
  }

  // Cập nhật giao diện thẻ được chọn
  container.querySelectorAll('.choose-two-item').forEach(item => {
    const cb = item.querySelector('input[type="checkbox"]');
    if (cb && cb.checked) item.classList.add('is-checked');
    else item.classList.remove('is-checked');
  });

  // Ghi kết quả vào input ẩn của từng câu hỏi trong nhóm
  const qIds = container.dataset.qids ? container.dataset.qids.split(',') : [];
  const selectedValues = Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

  qIds.forEach((qId, idx) => {
    const val = selectedValues[idx] || '';
    window.syncUserAnswer(qId, val);
  });
};

function parseOptionsList(rawOptions) {
  if (!rawOptions) return [];
  if (Array.isArray(rawOptions)) {
    return rawOptions.map((opt, idx) => {
      const defaultKey = String.fromCharCode(65 + idx);
      if (typeof opt === 'string') {
        const m = opt.match(/^([A-Za-z0-9ivxlcdm]+)[\.\:\-\)\s]\s*(.*)$/i);
        if (m) return { key: m[1].toUpperCase(), text: m[2] ? m[2].trim() : opt.trim() };
        return { key: defaultKey, text: opt.trim() };
      }
      return { key: defaultKey, text: String(opt) };
    });
  }
  return [];
}

export function buildReadingHtml(data) {
  if (!data.groups || !data.questions) return data.questionHtml || "";
  let paperHtml = '';
  const allQIds = [];

  data.groups.forEach((group, gIdx) => {
    paperHtml += `<div class="section-title" style="font-weight:900; font-size:16px; background:#FDEDEE; color:#8B1518; padding:10px 14px; border-left:5px solid #8B1518; margin:16px 0 10px 0; border-radius:0 10px 10px 0;">${group.title}</div>`;
    if (group.instructions) {
      paperHtml += `<p style="color:var(--text-muted); font-size:13.5px; margin-bottom:12px; line-height:1.5;">${group.instructions}</p>`;
    }

    const gType = (group.type || '').toLowerCase();
    const gMeta = (group.title + ' ' + (group.instructions || '')).toLowerCase();
    const isTFNG = gType.includes('tfng') || gMeta.includes('true/false/not given');
    const isYNNG = gType.includes('ynng') || gMeta.includes('yes/no/not given');
    
    // NHẬN DIỆN DẠNG BÀI MATCHING PARAGRAPHS A-F (CHUẨN MA TRẬN THI MÁY)
    const isMatchingParagraphs = gType.includes('matching_info') || gType.includes('matching_paragraphs') || gMeta.includes('which paragraph') || gMeta.includes('contains the following information');
    
    // NHẬN DIỆN DẠNG BÀI CHOOSE TWO (CHỌN 2 TRONG 5)
    const isChooseTwo = gMeta.includes('choose two') || gMeta.includes('choose 2') || (group.questionIds && group.questionIds.length === 2 && Array.isArray(group.options) && group.options.length >= 4);

    if (isMatchingParagraphs && (group.options || group.paragraphs || ['A','B','C','D','E','F'])) {
      // 1. RENDER MA TRẬN RADIO GRID CHUẨN THI IELTS CHÍNH THỨC
      const paras = group.paragraphs || (Array.isArray(group.options) ? group.options.map(o => typeof o === 'string' ? o.charAt(0) : o.key) : ['A','B','C','D','E','F']);
      
      paperHtml += `
        <div class="rd-matrix-table-wrap">
          <table class="rd-matrix-table">
            <thead>
              <tr>
                <th style="text-align:left; min-width:180px;">Câu hỏi</th>
                ${paras.map(p => `<th>${p}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${group.questionIds.map(qId => {
                allQIds.push(qId);
                const q = data.questions[qId];
                return `
                  <tr id="${qId}_row">
                    <td>
                      <b>${q?.num || qId}.</b> ${q?.text || ''}
                      <button type="button" class="btn-comment-anchor" onclick="window.activateReadingBubble('${qId}')">Ghi chú & AI</button>
                    </td>
                    ${paras.map(p => `
                      <td style="text-align:center;">
                        <input type="radio" name="${qId}" value="${p}" onchange="window.syncUserAnswer('${qId}', '${p}')">
                      </td>
                    `).join('')}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

    } else if (isChooseTwo && group.options) {
      // 2. RENDER DẠNG CHOOSE TWO OUT OF FIVE (CHECKBOX GỌN GÀNG)
      const groupKey = `g_${gIdx}`;
      group.questionIds.forEach(id => allQIds.push(id));

      const parsedOpts = parseOptionsList(group.options);

      paperHtml += `
        <div class="choose-two-container" id="choose_two_${groupKey}" data-qids="${group.questionIds.join(',')}">
          <div style="font-size:13.5px; font-weight:800; color:#8B1518; margin-bottom:4px;">
            📌 Đang trả lời cho Câu: <b>${group.questionIds.map(id => data.questions[id]?.num || id).join(', ')}</b> (Chọn đúng 2 lựa chọn):
          </div>
          ${parsedOpts.map(opt => `
            <label class="choose-two-item" onclick="window.toggleChooseTwoOption('${groupKey}', '${opt.key}', 2)">
              <input type="checkbox" value="${opt.key}">
              <span style="font-weight:900; color:#8B1518; background:#FDEDEE; padding:2px 8px; border-radius:6px;">${opt.key}</span>
              <span style="flex:1;">${opt.text}</span>
            </label>
          `).join('')}
        </div>
      `;

    } else if (group.template) {
      // 3. RENDER SUMMARY / TABLE COMPLETION ĐIỀN TỪ
      let content = group.template;
      group.questionIds.forEach(qId => {
        allQIds.push(qId);
        const q = data.questions[qId];
        const width = q?.inputWidth || "130px";

        const inputPart = `
          <span style="display:inline-block; vertical-align:middle; margin:2px 0;">
            <input type="text" class="fill-input" id="${qId}_input" style="width:${width}; font-weight:700; color:#8B1518; text-align:center;" placeholder="[Câu ${q?.num || qId}]" oninput="window.syncUserAnswer('${qId}', this.value)" onfocus="window.activateReadingBubble('${qId}')">
            <button type="button" class="btn-comment-anchor" onclick="window.activateReadingBubble('${qId}')">Ghi chú</button>
          </span>
        `;
        content = content.replace(new RegExp(`{{${qId}}}`, 'g'), inputPart);
      });

      paperHtml += `
        <div class="unified-notes-card" style="background:#FFFFFF; border:2px solid #E8E2D8; border-radius:14px; padding:16px 20px; margin-bottom:16px; line-height:1.75; font-size:14.5px;">
          ${(group.noteTitle || group.summaryTitle) ? `<h3 style="margin-top:0; color:#8B1518; font-weight:900; font-size:16px; border-bottom:1.5px solid #E8E2D8; padding-bottom:6px; margin-bottom:10px;">${group.noteTitle || group.summaryTitle}</h3>` : ''}
          <div>${content}</div>
        </div>
      `;

    } else {
      // 4. RENDER CÂU HỎI TRẮC NGHIỆM ĐƠN / TRUE-FALSE-NOT GIVEN
      group.questionIds.forEach(qId => {
        allQIds.push(qId);
        const q = data.questions[qId];
        if (!q) return;

        paperHtml += `
          <div class="question" id="${qId}" style="background:#FAF7F2; border:2px solid var(--border-color); border-radius:14px; padding:14px 16px; margin-bottom:14px;" onclick="window.activateReadingBubble('${qId}')">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:14.5px; font-weight:800; color:#1E293B;">
                <b>${q.num}.</b> ${q.text}
              </span>
              <button type="button" class="btn-comment-anchor" onclick="window.activateReadingBubble('${qId}')">Ghi chú & AI</button>
            </div>
        `;

        const qOptions = parseOptionsList(q.options);

        if (isTFNG || q.type === 'tfng') {
          paperHtml += renderChoicePillsHtml(qId, ['TRUE', 'FALSE', 'NOT GIVEN']);
        } else if (isYNNG || q.type === 'ynng') {
          paperHtml += renderChoicePillsHtml(qId, ['YES', 'NO', 'NOT GIVEN']);
        } else if (qOptions.length > 0) {
          paperHtml += renderMultipleChoiceHtml(qId, qOptions, q.multiple || false);
        } else {
          paperHtml += `
            <div style="margin: 8px 0;">
              <input type="text" class="fill-input" id="${qId}_input" placeholder="Nhập đáp án..." style="width:200px; font-weight:700;" oninput="window.syncUserAnswer('${qId}', this.value)" onfocus="window.activateReadingBubble('${qId}')">
            </div>
          `;
        }

        paperHtml += `
            <div class="result" id="${qId}_result"></div>
            ${renderExplanationHtml(qId, q)}
          </div>
        `;
      });
    }
  });

  paperHtml += `<button type="button" class="btn-3d btn-3d-red" onclick="window.checkAnswers()" style="margin-top:20px; width:100%; padding:14px; font-size:15px;">NỘP BÀI VÀ CHẤM ĐIỂM &rarr;</button>`;

  // TẠO TOÀN BỘ SIDEBAR BÊN PHẢI CHỨA SOCRATIC + GHI CHÚ + HỎI AI GEMINI
  const commentsListHtml = allQIds.map(qId => {
    const q = data.questions[qId];
    const num = q?.num || qId;
    return `
      <div class="rd-comment-bubble is-collapsed" id="rd_bubble_${qId}" onclick="window.activateReadingBubble('${qId}')">
        <div class="rd-bubble-header" onclick="window.toggleSingleReadingBubble('${qId}', event)">
          <div>
            <span class="rd-bubble-badge">Câu ${num}</span>
            <span class="rd-bubble-preview" id="rd_bubble_prev_${qId}"></span>
          </div>
          <span style="font-size:12px; font-weight:900; color:var(--text-muted);">▼</span>
        </div>
        <div class="rd-bubble-body">
          ${renderSocraticHtml(qId, q)}
          <div class="inline-thought-box" style="margin-bottom:8px; padding:8px 10px; background:#F0FDF4; border:1.5px solid #86EFAC; border-radius:8px;">
            <label style="font-size:11.5px; font-weight:800; color:#166534; display:block; margin-bottom:3px;">💭 Mạch suy nghĩ của em:</label>
            <textarea id="${qId}_thought" placeholder="Ghi chú lý do em chọn đáp án này..." style="width:100%; height:38px; padding:4px 8px; font-size:12.5px; border:1px solid #CBD5E1; border-radius:6px; outline:none; resize:vertical;" oninput="window.saveReadingThought('${qId}', this.value)"></textarea>
          </div>
          <div class="ai-assistant-box" style="padding:8px 10px; background:#FFFFFF; border:1.5px solid #F8B4B7; border-radius:8px;">
            <label style="font-size:11.5px; font-weight:800; color:#8B1518; display:block; margin-bottom:3px;">🤖 Hỏi Trợ Giảng AI Gemini:</label>
            <div style="display:flex; gap:5px;">
              <input type="text" id="ai_ask_${qId}" placeholder="Hỏi dịch nghĩa, tại sao đúng/sai..." style="flex:1; padding:5px 8px; font-size:12px; border:1px solid #CBD5E1; border-radius:6px; outline:none;" onkeydown="if(event.key==='Enter') window.askGeminiAI('${qId}')">
              <button type="button" style="background:#8B1518; color:white; border:none; padding:5px 10px; border-radius:6px; font-weight:800; font-size:11.5px; cursor:pointer;" onclick="window.askGeminiAI('${qId}')">Gửi</button>
            </div>
            <div class="ai-response" id="ai_response_${qId}" style="display:none; margin-top:6px; font-size:12.5px; line-height:1.5; max-height:220px; overflow-y:auto;"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="rd-exam-wrapper">
      <div class="rd-paper-col">
        ${paperHtml}
      </div>
      <div class="rd-comments-col">
        <div class="rd-comments-header">
          <span class="rd-header-title">💡 Gợi ý Socratic & Trợ Giảng AI</span>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn-rd-toggle-all" onclick="window.toggleAllReadingBubbles(true)">Mở hết</button>
            <button type="button" class="btn-rd-toggle-all" onclick="window.toggleAllReadingBubbles(false)">Thu gọn</button>
          </div>
        </div>
        <div class="rd-bubbles-container">
          ${commentsListHtml}
        </div>
      </div>
    </div>
  `;
}

function renderSocraticHtml(qId, q) {
  if (!q || !q.socratic || !q.socratic.steps || q.socratic.steps.length === 0) return '';
  const total = q.socratic.steps.length;
  const ans = q.finalAnswer || '';

  let sHtml = `
    <div style="background:#FAF7F2; border:1.5px solid var(--border-color); border-radius:8px; padding:8px 10px; margin-bottom:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <b style="color:#8B1518; font-size:12px;">🪜 Gợi ý dẫn dắt (Socratic)</b>
        <span style="font-size:11px; background:#FFFFFF; color:#8B1518; padding:1px 6px; border-radius:6px; font-weight:800; border:1px solid #F8B4B7;">Nấc 1/${total}</span>
      </div>
  `;

  q.socratic.steps.forEach((step, idx) => {
    const stepNum = idx + 1;
    const isFirst = stepNum === 1;

    sHtml += `
      <div id="${qId}_step_${stepNum}" style="display:${isFirst ? 'block' : 'none'}; ${!isFirst ? 'margin-top:8px; border-top:1px dashed #cbd5e1; padding-top:6px;' : ''}">
        <p style="margin:0 0 4px 0; font-size:12px; font-weight:700; color:var(--text-main);">
          🤖 Nấc ${stepNum}: ${step.title}<br>
          <span style="font-weight:normal; color:var(--text-muted); font-size:11.5px;">${step.question}</span>
        </p>
        <div style="display:flex; gap:4px;">
          <input type="text" id="${qId}_in_${stepNum}" placeholder="Trả lời câu hỏi gợi ý..." style="flex:1; padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:11.5px;" onkeydown="if(event.key==='Enter') window.nextSocraticStep('${qId}', ${stepNum}, '${ans}')">
          <button type="button" style="background:#8B1518; color:white; border:none; padding:4px 10px; border-radius:4px; font-weight:700; cursor:pointer; font-size:11.5px;" onclick="window.nextSocraticStep('${qId}', ${stepNum}, '${ans}')">Gửi</button>
        </div>
        <div id="${qId}_ans_${stepNum}" style="display:none; background:#f0fdf4; border-left:3px solid #16a34a; padding:6px 8px; border-radius:4px; margin-top:6px; font-size:11.5px; line-height:1.45;">
          <div style="color:#166534; font-weight:700;">🎯 Hướng dẫn:</div>
          <div style="color:#1e293b;">${step.guide}</div>
          ${step.bridge ? `<div style="margin-top:4px; font-style:italic; color:#475569;">🌉 <i>${step.bridge}</i></div>` : ''}
        </div>
      </div>
    `;
  });

  sHtml += `</div>`;
  return sHtml;
}

function renderMultipleChoiceHtml(qId, options, isMultiple) {
  let html = `<div class="mcq-options-list" style="display:flex; flex-direction:column; gap:8px; margin:8px 0;">`;
  const inputType = isMultiple ? 'checkbox' : 'radio';

  options.forEach(opt => {
    html += `
      <label class="mcq-option-item" onclick="window.syncUserAnswer('${qId}', '${opt.key}')" style="display:flex; align-items:flex-start; gap:10px; padding:10px 14px; border:2px solid var(--border-color); border-bottom:3.5px solid var(--border-shadow); border-radius:12px; background:#FFFFFF; cursor:pointer; font-size:14px; font-weight:700;">
        <input type="${inputType}" name="${qId}" value="${opt.key}" style="margin-top:2px; accent-color:#8B1518;">
        <span class="mcq-badge" style="font-weight:900; color:#8B1518; background:#FDEDEE; padding:2px 7px; border-radius:6px; font-size:12.5px;">${opt.key}</span>
        <span style="flex:1;">${opt.text}</span>
      </label>
    `;
  });
  html += `<input type="hidden" id="${qId}_input"></div>`;
  return html;
}

function renderChoicePillsHtml(qId, choices) {
  let html = `<div class="choice-group" style="display:flex; flex-wrap:wrap; gap:8px; margin:8px 0;">`;
  choices.forEach(ch => {
    html += `
      <label class="choice-btn-label" onclick="window.syncUserAnswer('${qId}', '${ch}')" style="display:inline-flex; align-items:center; gap:6px; padding:7px 14px; background:#FFFFFF; border:2px solid var(--border-color); border-bottom:3.5px solid var(--border-shadow); border-radius:10px; cursor:pointer; font-weight:800; font-size:13.5px;">
        <input type="radio" name="${qId}" value="${ch}" style="accent-color:#8B1518;">
        <span>${ch}</span>
      </label>
    `;
  });
  html += `<input type="hidden" id="${qId}_input"></div>`;
  return html;
}

function renderExplanationHtml(qId, q) {
  let expSteps = (q.explanation && q.explanation.steps) 
    ? q.explanation.steps.map(s => `<p style="margin:3px 0;">${s}</p>`).join('') 
    : '';
  let hlBtn = q.highlightId ? `<button type="button" style="background:#0284c7; color:white; border:none; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:800; cursor:pointer; margin-top:6px;" onclick="window.highlightText('${q.highlightId}')">📍 Xem dẫn chứng bài đọc</button>` : '';

  return `
    <div class="explanation" style="display:none; margin-top: 8px;">
      <div class="kw-exp">🎯 LỜI GIẢI CHI TIẾT:</div>
      ${expSteps}
      ${hlBtn}
    </div>
  `;
}
