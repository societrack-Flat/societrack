/** SOCIETRACK wordmark: SOCIE (navy) + TRACK (lime), all caps */
export function drawBrandWordmark(doc, x, y, fontSize = 20) {
  doc.setFontSize(fontSize);
  doc.setTextColor(10, 34, 61);
  doc.text('SOCIE', x, y);
  doc.setTextColor(132, 204, 22);
  doc.text('TRACK', x + doc.getTextWidth('SOCIE'), y);
}
