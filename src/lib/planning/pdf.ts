import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

/**
 * Capture a DOM element and export it as a single-page A4 landscape PDF.
 * The content is scaled to fit entirely on one page (no overflow, no blank
 * second page) and saved with the provided file name.
 */
export async function exportElementToPdf(el: HTMLElement, fileName: string) {
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    // Capture the full element even if it is scrolled / clipped on screen.
    windowWidth: el.scrollWidth,
    width: el.scrollWidth,
    height: el.scrollHeight,
  });

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 6;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;

  // Fit the whole capture on a single page, preserving aspect ratio.
  const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
  const imgW = canvas.width * ratio;
  const imgH = canvas.height * ratio;
  const x = (pageW - imgW) / 2;
  const y = (pageH - imgH) / 2;

  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  pdf.addImage(imgData, "JPEG", x, y, imgW, imgH);
  pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}
