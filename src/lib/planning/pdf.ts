import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export type PdfFormat = "a4" | "a3";

/**
 * Capture a landscape preview element and export it as one exact PDF page.
 * The preview already contains the scaled planning sheet, so the export draws
 * that page once, edge-to-edge, and removes any accidental extra page.
 * A4 and A3 share the same aspect ratio, so A3 simply yields a larger,
 * more readable/printable sheet.
 */
export async function exportElementToPdf(
  el: HTMLElement,
  fileName: string,
  format: PdfFormat = "a4",
) {
  const rect = el.getBoundingClientRect();
  const width = Math.ceil(rect.width || el.scrollWidth);
  const height = Math.ceil(rect.height || el.scrollHeight);
  const scale = Math.min(4, Math.max(2, 2400 / Math.max(width, 1)));

  const canvas = await html2canvas(el, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: Math.max(document.documentElement.clientWidth, width),
    windowHeight: Math.max(document.documentElement.clientHeight, height),
    width,
    height,
    scrollX: 0,
    scrollY: -window.scrollY,
  });

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Fit the captured image inside the page while preserving its aspect ratio,
  // so nothing is cropped and the whole table stays on a single page.
  const imgRatio = canvas.width / canvas.height;
  const pageRatio = pageW / pageH;

  let drawW = pageW;
  let drawH = pageH;
  if (imgRatio > pageRatio) {
    // Image is wider than the page → constrain by width.
    drawW = pageW;
    drawH = pageW / imgRatio;
  } else {
    // Image is taller than the page → constrain by height.
    drawH = pageH;
    drawW = pageH * imgRatio;
  }

  const offsetX = (pageW - drawW) / 2;
  const offsetY = (pageH - drawH) / 2;

  const imgData = canvas.toDataURL("image/png");
  pdf.addImage(imgData, "PNG", offsetX, offsetY, drawW, drawH, undefined, "FAST");

  // Guarantee a single page even if any extra page slipped in.
  while (pdf.getNumberOfPages() > 1) {
    pdf.deletePage(pdf.getNumberOfPages());
  }

  pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}
