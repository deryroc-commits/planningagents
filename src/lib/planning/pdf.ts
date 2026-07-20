import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export type PdfFormat = "a4" | "a3";

/**
 * Capture a landscape preview element and export it as a PDF. If the element
 * contains multiple `.planning-pdf-page` children, each is rendered as its
 * own PDF page (multi-page pagination). Otherwise the element itself becomes
 * a single page.
 */
export async function exportElementToPdf(
  el: HTMLElement,
  fileName: string,
  format: PdfFormat = "a4",
) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const pages = Array.from(
    el.querySelectorAll<HTMLElement>(".planning-pdf-page"),
  );
  const targets: HTMLElement[] = pages.length > 0 ? pages : [el];

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const rect = target.getBoundingClientRect();
    const width = Math.ceil(rect.width || target.scrollWidth);
    const height = Math.ceil(rect.height || target.scrollHeight);
    const scale = Math.min(4, Math.max(2, 2400 / Math.max(width, 1)));

    const canvas = await html2canvas(target, {
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

    const imgRatio = canvas.width / canvas.height;
    const pageRatio = pageW / pageH;
    let drawW = pageW;
    let drawH = pageH;
    if (imgRatio > pageRatio) {
      drawW = pageW;
      drawH = pageW / imgRatio;
    } else {
      drawH = pageH;
      drawW = pageH * imgRatio;
    }
    const offsetX = (pageW - drawW) / 2;
    const offsetY = (pageH - drawH) / 2;

    if (i > 0) pdf.addPage(format, "landscape");
    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", offsetX, offsetY, drawW, drawH, undefined, "FAST");
  }

  pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}
