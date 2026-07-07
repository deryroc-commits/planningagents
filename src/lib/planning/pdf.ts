import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

/**
 * Capture an A4-landscape preview element and export it as one exact PDF page.
 * The preview already contains the scaled planning sheet, so the export draws
 * that page once, edge-to-edge, and removes any accidental extra page.
 */
export async function exportElementToPdf(el: HTMLElement, fileName: string) {
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

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const imgData = canvas.toDataURL("image/png");
  pdf.addImage(imgData, "PNG", 0, 0, pageW, pageH, undefined, "FAST");

  while (pdf.getNumberOfPages() > 1) {
    pdf.deletePage(pdf.getNumberOfPages());
  }

  pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}
