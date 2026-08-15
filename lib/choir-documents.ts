import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb } from "pdf-lib";
import type { AgreementPdfAssets } from "@/lib/agreement-pdf";

type PageSizeName = "A4" | "A5";
type DocumentRow = { date?: string; hebrewDate?: string; title: string; details?: string; note?: string };

const sizes = { A4: [595.28, 841.89], A5: [419.53, 595.28] } as const;
const ink = rgb(0.08, 0.07, 0.08);
const wine = rgb(0.56, 0.09, 0.21);
const gray = rgb(0.45, 0.42, 0.43);

function clean(value: string) { return value.normalize("NFC").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\p{Extended_Pictographic}/gu, "♪"); }
function wrap(value: string, font: PDFFont, size: number, width: number) {
  const result: string[] = [];
  for (const source of clean(value).replace(/\r\n?/g, "\n").split("\n")) {
    if (!source.trim()) { result.push(""); continue; }
    let line = "";
    for (const word of source.trim().split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(next, size) > width) { result.push(line); line = word; } else line = next;
    }
    result.push(line);
  }
  return result;
}

function drawSafe(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color = ink) {
  page.drawText(clean(text), { x, y, font, size, color });
}

async function prepare(assets: AgreementPdfAssets) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const [regular, bold, logo] = await Promise.all([
    document.embedFont(assets.regularFont, { subset: true }),
    document.embedFont(assets.boldFont, { subset: true }),
    document.embedPng(assets.logo),
  ]);
  return { document, regular, bold, logo };
}

function header(page: PDFPage, logo: PDFImage, bold: PDFFont, title: string, subtitle: string, width: number, height: number) {
  const logoWidth = Math.min(width * 0.52, 270);
  const logoHeight = logo.height * (logoWidth / logo.width);
  page.drawImage(logo, { x: (width - logoWidth) / 2, y: height - 42 - logoHeight, width: logoWidth, height: logoHeight });
  const titleSize = width < 500 ? 18 : 22;
  const titleWidth = bold.widthOfTextAtSize(title, titleSize);
  drawSafe(page, title, Math.max(28, (width - titleWidth) / 2), height - logoHeight - 72, bold, titleSize, wine);
  if (subtitle) {
    const subtitleSize = width < 500 ? 8.5 : 10;
    const subtitleWidth = bold.widthOfTextAtSize(subtitle, subtitleSize);
    drawSafe(page, subtitle, Math.max(28, (width - subtitleWidth) / 2), height - logoHeight - 91, bold, subtitleSize, gray);
  }
  page.drawLine({ start: { x: 36, y: height - logoHeight - 104 }, end: { x: width - 36, y: height - logoHeight - 104 }, thickness: 1, color: wine });
  return height - logoHeight - 125;
}

export async function generateLyricsPdf(input: { title: string; subtitle?: string; lyrics: string; pageSize: PageSizeName }, assets: AgreementPdfAssets) {
  const { document, regular, bold, logo } = await prepare(assets);
  const [width, height] = sizes[input.pageSize];
  const margin = input.pageSize === "A5" ? 28 : 42;
  const availableWidth = width - margin * 2;
  let fontSize = input.pageSize === "A5" ? 10.5 : 12;
  let lines = wrap(input.lyrics, regular, fontSize, availableWidth);
  const firstPageRoom = height - 210;
  while (fontSize > (input.pageSize === "A5" ? 8.5 : 9.5) && lines.length * fontSize * 1.38 > firstPageRoom) {
    fontSize -= 0.5;
    lines = wrap(input.lyrics, regular, fontSize, availableWidth);
  }
  const onePage = lines.length * fontSize * 1.38 <= firstPageRoom;
  let page = document.addPage([width, height]);
  let y = header(page, logo, bold, input.title, input.subtitle || "", width, height);
  for (const line of lines) {
    if (y < 40) { page = document.addPage([width, height]); y = header(page, logo, bold, input.title, input.subtitle || "Continued", width, height); }
    if (line) drawSafe(page, line, margin, y, regular, fontSize);
    y -= fontSize * 1.38;
  }
  const bytes = await document.save({ useObjectStreams: true });
  return { bytes, onePage, fontSize, pageCount: document.getPageCount() };
}

export async function generateRowsPdf(input: { title: string; subtitle?: string; rows: DocumentRow[]; pageSize?: PageSizeName }, assets: AgreementPdfAssets) {
  const { document, regular, bold, logo } = await prepare(assets);
  const pageSize = input.pageSize || "A4";
  const [width, height] = sizes[pageSize];
  const margin = 38;
  let page = document.addPage([width, height]);
  let y = header(page, logo, bold, input.title, input.subtitle || "", width, height);
  for (const row of input.rows) {
    const detailLines = wrap([row.details, row.note].filter(Boolean).join(" — "), regular, 8.5, width - margin * 2 - 115);
    const rowHeight = Math.max(28, 16 + detailLines.length * 10);
    if (y - rowHeight < 48) { page = document.addPage([width, height]); y = header(page, logo, bold, input.title, "Continued", width, height); }
    page.drawRectangle({ x: margin, y: y - rowHeight + 4, width: width - margin * 2, height: rowHeight, borderColor: rgb(0.86, 0.82, 0.83), borderWidth: 0.5 });
    drawSafe(page, row.date || "", margin + 8, y - 10, bold, 8.5, wine);
    if (row.hebrewDate) drawSafe(page, row.hebrewDate, margin + 8, y - 21, regular, 6.8, gray);
    drawSafe(page, row.title, margin + 112, y - 10, bold, 9.2);
    detailLines.forEach((line, index) => drawSafe(page, line, margin + 112, y - 22 - index * 10, regular, 8.5, gray));
    y -= rowHeight + 6;
  }
  return document.save({ useObjectStreams: true });
}

export async function generateSimpleAgreementPdf(input: { title: string; schoolYear: string; sections: Array<{ title: string; paragraphs: string[] }> }, assets: AgreementPdfAssets) {
  const { document, regular, bold, logo } = await prepare(assets);
  const [width, height] = sizes.A4;
  const margin = 44;
  let page = document.addPage([width, height]);
  let y = header(page, logo, bold, input.title, input.schoolYear, width, height);
  for (const section of input.sections) {
    const paragraphLines = section.paragraphs.flatMap((paragraph) => [...wrap(paragraph, regular, 8.5, width - margin * 2), ""]);
    const needed = 23 + paragraphLines.length * 11 + 18;
    if (y - Math.min(needed, 180) < 52) { page = document.addPage([width, height]); y = header(page, logo, bold, input.title, input.schoolYear, width, height); }
    drawSafe(page, section.title, margin, y, bold, 11, wine);
    y -= 17;
    for (const line of paragraphLines) {
      if (y < 62) { page = document.addPage([width, height]); y = header(page, logo, bold, input.title, input.schoolYear, width, height); }
      if (line) drawSafe(page, line, margin, y, regular, 8.5);
      y -= line ? 11 : 5;
    }
    drawSafe(page, "☐  I understand", margin, y, bold, 8.5);
    y -= 24;
  }
  return document.save({ useObjectStreams: true });
}

export async function mergePdfFiles(files: Uint8Array[]) {
  const result = await PDFDocument.create();
  for (const bytes of files) {
    const source = await PDFDocument.load(bytes);
    const pages = await result.copyPages(source, source.getPageIndices());
    pages.forEach((page) => result.addPage(page));
  }
  return result.save({ useObjectStreams: true });
}

