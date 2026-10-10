/**
 * pre-reading/export-pr.js
 * XUẤT BÁO CÁO TIẾN ĐỘ PRE-READING CHI TIẾT TOÀN BỘ CÁC LẦN NỘP
 */

import { getAllSubmissions } from './db-pr.js';

export async function exportReport() {
  const subs = await getAllSubmissions();
  if (subs.length === 0) {
    alert("Chưa có bài tập nào được nộp để xuất báo cáo!");
    return;
  }

  let text = `📋 BÁO CÁO TIẾN ĐỘ PRE-READING (TEST-ENGLISH)\n`;
  text += `Thời gian xuất: ${new Date().toLocaleString("vi-VN")}\n`;
  text += `Tổng số bài đã hoàn thành: ${subs.length}\n`;
  text += `--------------------------------------------------\n\n`;

  subs.forEach((s, idx) => {
    text += `${idx + 1}. [PRE-READING - ${s.level}] ID: ${s.id} - ${s.title || ''}\n`;
    const attempts = s.attempts && s.attempts.length > 0 ? s.attempts : [s];

    attempts.forEach(att => {
      const pct = att.total > 0 ? Math.round((att.correct / att.total) * 100) : 0;
      text += `   ✦ [LẦN ${att.attemptNum || 1}]:\n`;
      text += `      - Điểm số: ${att.correct}/${att.total} (${pct}%)\n`;
      text += `      - Câu sai: ${att.wrongNotes || 'Không có'}\n`;
      text += `      - Ảnh chi tiết câu sai: ${att.wrongProofs ? att.wrongProofs.length : 0} ảnh\n`;
      text += `      - Ảnh Full bài làm: ${att.fullProof ? 'Đã lưu' : 'Chưa có'}\n`;
      text += `      - Thời gian nộp: ${att.timestamp}\n`;
    });
    text += `\n`;
  });

  const win = window.open("", "_blank");
  win.document.write(`
    <html>
      <head><title>Báo Cáo Pre-Reading</title></head>
      <body style="font-family: monospace; padding: 24px; white-space: pre-wrap; background: #fffbeb; font-size: 13.5px; line-height: 1.5;">${text}</body>
    </html>
  `);
  win.document.close();
}
