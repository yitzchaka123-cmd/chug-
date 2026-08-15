import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  type PDFPageDrawTextOptions,
  rgb,
} from "pdf-lib";

export type AgreementPdfAssetLoader = (path: string) => Promise<Uint8Array>;

export type AgreementPdfAssets = Readonly<{
  logo: Uint8Array;
  regularFont: Uint8Array;
  boldFont: Uint8Array;
}>;

export type AgreementPdfImage =
  | Readonly<{ dataUrl: string }>
  | Readonly<{ bytes: Uint8Array; mimeType: "image/png" | "image/jpeg" }>;

export type AgreementPdfParagraph = Readonly<{
  id: string;
  text: string;
}>;

export type AgreementPdfSection = Readonly<{
  id?: string;
  title: string;
  paragraphs: readonly AgreementPdfParagraph[];
  acknowledgement: Readonly<{
    required?: boolean;
    accepted: boolean;
    acceptedAt?: string | null;
  }>;
}>;

export type SignedAgreementSnapshot = Readonly<{
  registrationId?: string | null;
  schoolYear: string;
  agreementVersion: string;
  participant: Readonly<{
    fullName: string;
    birthDate?: string | null;
    age?: number | null;
    address?: string | null;
    school?: string | null;
  }>;
  parents: Readonly<{
    fatherName?: string | null;
    fatherPhone?: string | null;
    motherName?: string | null;
    motherPhone?: string | null;
    email: string;
  }>;
  care: Readonly<{
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactRelation?: string | null;
    allergies?: string | null;
    medicalInformation?: string | null;
    medications?: string | null;
    additionalNote?: string | null;
    consentAccepted: boolean;
  }>;
  payment: Readonly<{
    method: string;
    monthlyAmount: number;
    juneAmount: number;
    currency?: string;
    securityCheckAmount: number;
    securityCheckMonths?: string | null;
    securityCheckAccepted: boolean;
    paymentProofReceived?: boolean;
  }>;
  sections: readonly AgreementPdfSection[];
  consents: Readonly<{
    parentOrGuardianAccepted: boolean;
    privacyAndTermsAccepted: boolean;
    electronicSignatureAccepted: boolean;
  }>;
  signature: Readonly<{
    signerName: string;
    image: AgreementPdfImage;
  }>;
  signedAt: string;
}>;

export const agreementPdfAssetPaths = Object.freeze({
  logo: "/choir-chug-logo-transparent.png",
  regularFont: "/fonts/DejaVuSans.ttf",
  boldFont: "/fonts/DejaVuSans-Bold.ttf",
});

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 48;
const TOP_Y = PAGE_HEIGHT - 46;
const BOTTOM_Y = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const BODY_SIZE = 8.8;
const BODY_LEADING = 12.2;

const BLACK = rgb(0.075, 0.075, 0.075);
const DARK_GRAY = rgb(0.24, 0.24, 0.24);
const MID_GRAY = rgb(0.48, 0.48, 0.48);
const LIGHT_GRAY = rgb(0.91, 0.91, 0.91);
const PALE_GRAY = rgb(0.97, 0.97, 0.97);

type Fonts = Readonly<{ regular: PDFFont; bold: PDFFont }>;

type DrawingState = {
  document: PDFDocument;
  page: PDFPage;
  y: number;
  fonts: Fonts;
  agreementVersion: string;
};

function compact(value: string | null | undefined, fallback = "Not provided") {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function formatBoolean(value: boolean) {
  return value ? "Confirmed" : "Not confirmed";
}

function formatAmount(amount: number, currency = "ILS") {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(amount);
  return currency.toUpperCase() === "ILS" ? `₪${formatted}` : `${formatted} ${currency}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  }).format(date);
}

function cleanPdfText(value: string) {
  return value
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "♪")
    .replace(/\u00A0/g, " ");
}

function measuredWidth(text: string, font: PDFFont, size: number) {
  return font.widthOfTextAtSize(cleanPdfText(text), size);
}

/**
 * Fontkit correctly lays out a pure Hebrew run, but treats a whole mixed line
 * as RTL when the first strong character is Hebrew. Drawing its directional
 * runs independently preserves both "הוראת קבע" and the surrounding English.
 */
function drawDirectionSafeText(
  page: PDFPage,
  value: string,
  options: PDFPageDrawTextOptions & Readonly<{ x: number; font: PDFFont; size: number }>,
) {
  const cleaned = cleanPdfText(value);
  if (!/[\u0590-\u05FF]/.test(cleaned)) {
    page.drawText(cleaned, options);
    return;
  }

  const runs = cleaned.split(/([\u0590-\u05FF]+(?:[\s\u05F3\u05F4'"-]+[\u0590-\u05FF]+)*)/g).filter(Boolean);
  let x = options.x;
  for (const run of runs) {
    page.drawText(run, { ...options, x, maxWidth: undefined });
    x += options.font.widthOfTextAtSize(run, options.size);
  }
}

function splitLongToken(token: string, font: PDFFont, size: number, maxWidth: number) {
  const pieces: string[] = [];
  let piece = "";
  for (const character of Array.from(token)) {
    const candidate = piece + character;
    if (piece && measuredWidth(candidate, font, size) > maxWidth) {
      pieces.push(piece);
      piece = character;
    } else {
      piece = candidate;
    }
  }
  if (piece) pieces.push(piece);
  return pieces;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const output: string[] = [];
  const sourceLines = cleanPdfText(text).replace(/\r\n?/g, "\n").split("\n");

  sourceLines.forEach((sourceLine) => {
    if (!sourceLine.trim()) {
      output.push("");
      return;
    }

    const tokens = sourceLine.trim().split(/\s+/).flatMap((token) =>
      measuredWidth(token, font, size) <= maxWidth
        ? [token]
        : splitLongToken(token, font, size, maxWidth),
    );
    let line = "";
    for (const token of tokens) {
      const candidate = line ? `${line} ${token}` : token;
      if (line && measuredWidth(candidate, font, size) > maxWidth) {
        output.push(line);
        line = token;
      } else {
        line = candidate;
      }
    }
    if (line) output.push(line);
  });

  return output.length ? output : [""];
}

function addPage(state: DrawingState) {
  state.page = state.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  state.y = TOP_Y;
  state.page.drawText("THE CHOIR CHUG", {
    x: MARGIN_X,
    y: state.y,
    size: 7.5,
    font: state.fonts.bold,
    color: MID_GRAY,
  });
  const rightHeader = `SIGNED AGREEMENT  |  ${state.agreementVersion}`;
  state.page.drawText(rightHeader, {
    x: PAGE_WIDTH - MARGIN_X - state.fonts.regular.widthOfTextAtSize(rightHeader, 6.8),
    y: state.y,
    size: 6.8,
    font: state.fonts.regular,
    color: MID_GRAY,
  });
  state.page.drawLine({
    start: { x: MARGIN_X, y: state.y - 8 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: state.y - 8 },
    thickness: 0.45,
    color: LIGHT_GRAY,
  });
  state.y -= 28;
}

function ensureSpace(state: DrawingState, height: number) {
  if (state.y - height < BOTTOM_Y) addPage(state);
}

function drawWrappedLines(
  state: DrawingState,
  lines: readonly string[],
  options?: Readonly<{
    x?: number;
    maxWidth?: number;
    size?: number;
    leading?: number;
    font?: PDFFont;
    color?: ReturnType<typeof rgb>;
    allowPageBreak?: boolean;
  }>,
) {
  const x = options?.x ?? MARGIN_X;
  const size = options?.size ?? BODY_SIZE;
  const leading = options?.leading ?? BODY_LEADING;
  const font = options?.font ?? state.fonts.regular;
  const color = options?.color ?? BLACK;
  const allowPageBreak = options?.allowPageBreak ?? true;

  for (const line of lines) {
    if (allowPageBreak) ensureSpace(state, leading);
    drawDirectionSafeText(state.page, line || " ", {
      x,
      y: state.y,
      size,
      font,
      color,
      maxWidth: options?.maxWidth,
    });
    state.y -= leading;
  }
}

function drawParagraph(
  state: DrawingState,
  text: string,
  options?: Readonly<{
    x?: number;
    width?: number;
    size?: number;
    leading?: number;
    font?: PDFFont;
    color?: ReturnType<typeof rgb>;
    after?: number;
  }>,
) {
  const font = options?.font ?? state.fonts.regular;
  const size = options?.size ?? BODY_SIZE;
  const width = options?.width ?? CONTENT_WIDTH;
  const lines = wrapText(text, font, size, width);
  const leading = options?.leading ?? BODY_LEADING;
  const paragraphHeight = lines.length * leading + (options?.after ?? 0);
  const usablePageHeight = TOP_Y - 28 - BOTTOM_Y;
  if (paragraphHeight <= usablePageHeight && state.y - paragraphHeight < BOTTOM_Y) addPage(state);
  drawWrappedLines(state, lines, {
    x: options?.x,
    maxWidth: width,
    size,
    leading,
    font,
    color: options?.color,
  });
  state.y -= options?.after ?? 0;
}

function drawSectionTitle(state: DrawingState, title: string) {
  ensureSpace(state, 34);
  state.page.drawRectangle({
    x: MARGIN_X,
    y: state.y - 16,
    width: CONTENT_WIDTH,
    height: 22,
    color: PALE_GRAY,
    borderColor: LIGHT_GRAY,
    borderWidth: 0.5,
  });
  drawDirectionSafeText(state.page, title, {
    x: MARGIN_X + 10,
    y: state.y - 9,
    size: 10.8,
    font: state.fonts.bold,
    color: BLACK,
  });
  state.y -= 30;
}

function estimateSectionHeight(section: AgreementPdfSection, fonts: Fonts) {
  const paragraphHeight = section.paragraphs.reduce((height, paragraph) => {
    const lineCount = wrapText(paragraph.text, fonts.regular, BODY_SIZE, CONTENT_WIDTH).length;
    return height + lineCount * BODY_LEADING + 7;
  }, 0);
  return 30 + paragraphHeight + 19;
}

function drawAgreementSection(state: DrawingState, section: AgreementPdfSection) {
  const height = estimateSectionHeight(section, state.fonts);
  const usablePageHeight = TOP_Y - 28 - BOTTOM_Y;
  if (height <= usablePageHeight && state.y - height < BOTTOM_Y) addPage(state);
  else ensureSpace(state, 78);

  drawSectionTitle(state, section.title);
  for (const paragraph of section.paragraphs) {
    drawParagraph(state, paragraph.text, { after: 7 });
  }

  ensureSpace(state, 18);
  if (section.acknowledgement.required === false) {
    state.y -= 3;
    return;
  }
  const acknowledgement = section.acknowledgement.accepted ? "✓  I understand" : "☐  I understand";
  state.page.drawText(acknowledgement, {
    x: MARGIN_X,
    y: state.y,
    size: 8.5,
    font: state.fonts.bold,
    color: section.acknowledgement.accepted ? BLACK : MID_GRAY,
  });
  if (section.acknowledgement.acceptedAt) {
    const acceptedAt = `Confirmed ${formatDateTime(section.acknowledgement.acceptedAt)}`;
    state.page.drawText(acceptedAt, {
      x: PAGE_WIDTH - MARGIN_X - state.fonts.regular.widthOfTextAtSize(acceptedAt, 7.2),
      y: state.y,
      size: 7.2,
      font: state.fonts.regular,
      color: MID_GRAY,
    });
  }
  state.y -= 22;
}

function drawKeyValueRows(
  state: DrawingState,
  rows: readonly Readonly<{ label: string; value: string }>[] ,
) {
  const labelWidth = 152;
  const valueWidth = CONTENT_WIDTH - labelWidth - 22;
  for (const [index, row] of rows.entries()) {
    const labelLines = wrapText(row.label, state.fonts.bold, 7.6, labelWidth - 16);
    const valueLines = wrapText(row.value, state.fonts.regular, 8.2, valueWidth);
    const lineCount = Math.max(labelLines.length, valueLines.length);
    const rowHeight = Math.max(24, lineCount * 10.8 + 10);
    ensureSpace(state, rowHeight);

    state.page.drawRectangle({
      x: MARGIN_X,
      y: state.y - rowHeight + 5,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: index % 2 === 0 ? PALE_GRAY : rgb(1, 1, 1),
      borderColor: LIGHT_GRAY,
      borderWidth: 0.35,
    });

    const startY = state.y - 8;
    labelLines.forEach((line, lineIndex) => {
      drawDirectionSafeText(state.page, line, {
        x: MARGIN_X + 8,
        y: startY - lineIndex * 10.8,
        size: 7.6,
        font: state.fonts.bold,
        color: DARK_GRAY,
      });
    });
    valueLines.forEach((line, lineIndex) => {
      drawDirectionSafeText(state.page, line, {
        x: MARGIN_X + labelWidth,
        y: startY - lineIndex * 10.8,
        size: 8.2,
        font: state.fonts.regular,
        color: BLACK,
      });
    });
    state.y -= rowHeight;
  }
  state.y -= 10;
}

function decodeDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) throw new Error("The signature must be a base64 PNG or JPEG data URL.");
  const binary = atob(match[2].replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return {
    bytes,
    mimeType: match[1].toLowerCase() as "image/png" | "image/jpeg",
  };
}

function imageSource(image: AgreementPdfImage) {
  return "dataUrl" in image ? decodeDataUrl(image.dataUrl) : image;
}

async function embedImage(document: PDFDocument, image: AgreementPdfImage) {
  const source = imageSource(image);
  return source.mimeType === "image/png"
    ? document.embedPng(source.bytes)
    : document.embedJpg(source.bytes);
}

async function embedLogo(document: PDFDocument, bytes: Uint8Array) {
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return isPng ? document.embedPng(bytes) : document.embedJpg(bytes);
}

function drawCoverHeader(state: DrawingState, logo: PDFImage, snapshot: SignedAgreementSnapshot) {
  const logoWidth = 254;
  const scaled = logo.scale(logoWidth / logo.width);
  const logoHeight = Math.min(scaled.height, 105);
  state.page.drawImage(logo, {
    x: (PAGE_WIDTH - logoWidth) / 2,
    y: PAGE_HEIGHT - 42 - logoHeight,
    width: logoWidth,
    height: logoHeight,
  });
  state.y = PAGE_HEIGHT - 58 - logoHeight;
  state.page.drawLine({
    start: { x: MARGIN_X, y: state.y },
    end: { x: PAGE_WIDTH - MARGIN_X, y: state.y },
    thickness: 0.7,
    color: LIGHT_GRAY,
  });
  state.y -= 28;

  const title = "Registration & Agreement Form";
  state.page.drawText(title, {
    x: (PAGE_WIDTH - state.fonts.bold.widthOfTextAtSize(title, 17)) / 2,
    y: state.y,
    size: 17,
    font: state.fonts.bold,
    color: BLACK,
  });
  state.y -= 22;
  const subtitle = `${snapshot.schoolYear}  |  Agreement ${snapshot.agreementVersion}`;
  state.page.drawText(subtitle, {
    x: (PAGE_WIDTH - state.fonts.regular.widthOfTextAtSize(subtitle, 8.5)) / 2,
    y: state.y,
    size: 8.5,
    font: state.fonts.regular,
    color: MID_GRAY,
  });
  state.y -= 28;
}

function drawSignatureBlock(state: DrawingState, snapshot: SignedAgreementSnapshot, signature: PDFImage) {
  // Keep the heading, identifying fields and handwritten mark together. A
  // signature should never appear alone on the page after its context.
  ensureSpace(state, 278);
  drawSectionTitle(state, "Confirmation & Electronic Signature");
  drawKeyValueRows(state, [
    { label: "Singer’s name", value: compact(snapshot.participant.fullName) },
    { label: "Parent signing", value: compact(snapshot.signature.signerName) },
    { label: "Signed", value: formatDateTime(snapshot.signedAt) },
    { label: "Agreement version", value: snapshot.agreementVersion },
  ]);

  ensureSpace(state, 118);
  const signatureBoxHeight = 94;
  state.page.drawRectangle({
    x: MARGIN_X,
    y: state.y - signatureBoxHeight,
    width: CONTENT_WIDTH,
    height: signatureBoxHeight,
    color: rgb(1, 1, 1),
    borderColor: LIGHT_GRAY,
    borderWidth: 0.8,
  });
  state.page.drawText("PARENT’S ELECTRONIC SIGNATURE", {
    x: MARGIN_X + 12,
    y: state.y - 17,
    size: 7,
    font: state.fonts.bold,
    color: MID_GRAY,
  });
  const maxSignatureWidth = CONTENT_WIDTH - 40;
  const maxSignatureHeight = 58;
  const scale = Math.min(maxSignatureWidth / signature.width, maxSignatureHeight / signature.height, 1);
  const width = signature.width * scale;
  const height = signature.height * scale;
  state.page.drawImage(signature, {
    x: MARGIN_X + 20,
    y: state.y - signatureBoxHeight + 13,
    width,
    height,
  });
  state.y -= signatureBoxHeight + 18;

  drawParagraph(state, "Looking forward to a wonderful year of music and growth together! ♪", {
    font: state.fonts.bold,
    size: 9,
    after: 4,
  });
}

function addFooters(document: PDFDocument, fonts: Fonts, snapshot: SignedAgreementSnapshot) {
  const pages = document.getPages();
  pages.forEach((page, index) => {
    page.drawLine({
      start: { x: MARGIN_X, y: 31 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: 31 },
      thickness: 0.35,
      color: LIGHT_GRAY,
    });
    const left = `The Choir Chug  |  ${snapshot.agreementVersion}`;
    const right = `Page ${index + 1} of ${pages.length}`;
    page.drawText(left, { x: MARGIN_X, y: 19, size: 6.7, font: fonts.regular, color: MID_GRAY });
    page.drawText(right, {
      x: PAGE_WIDTH - MARGIN_X - fonts.regular.widthOfTextAtSize(right, 6.7),
      y: 19,
      size: 6.7,
      font: fonts.regular,
      color: MID_GRAY,
    });
  });
}

function validateSnapshot(snapshot: SignedAgreementSnapshot) {
  if (!snapshot.participant.fullName.trim()) throw new Error("Participant name is required for the agreement PDF.");
  if (!snapshot.parents.email.trim()) throw new Error("Parent email is required for the agreement PDF.");
  if (!snapshot.signature.signerName.trim()) throw new Error("Signer name is required for the agreement PDF.");
  if (!snapshot.agreementVersion.trim()) throw new Error("Agreement version is required for the agreement PDF.");
  if (Number.isNaN(new Date(snapshot.signedAt).getTime())) throw new Error("A valid signing timestamp is required for the agreement PDF.");
  if (!snapshot.sections.length) throw new Error("At least one agreement section is required for the agreement PDF.");
  if (snapshot.sections.some((section) => section.acknowledgement.required !== false && !section.acknowledgement.accepted)) {
    throw new Error("Every agreement section must be acknowledged before the PDF is generated.");
  }
  if (
    !snapshot.care.consentAccepted ||
    !snapshot.payment.securityCheckAccepted ||
    !snapshot.consents.parentOrGuardianAccepted ||
    !snapshot.consents.privacyAndTermsAccepted ||
    !snapshot.consents.electronicSignatureAccepted
  ) {
    throw new Error("All required confirmations must be accepted before the PDF is generated.");
  }
}

export async function loadAgreementPdfAssets(loadAsset: AgreementPdfAssetLoader): Promise<AgreementPdfAssets> {
  const [logo, regularFont, boldFont] = await Promise.all([
    loadAsset(agreementPdfAssetPaths.logo),
    loadAsset(agreementPdfAssetPaths.regularFont),
    loadAsset(agreementPdfAssetPaths.boldFont),
  ]);
  return { logo, regularFont, boldFont };
}

/**
 * Produces a static, immutable A4 PDF suitable for storing in private object
 * storage. All runtime assets are injected, so this function is safe to call in
 * a Cloudflare Worker and never reads from the Node filesystem.
 */
export async function generateSignedAgreementPdf(
  snapshot: SignedAgreementSnapshot,
  assets: AgreementPdfAssets,
): Promise<Uint8Array> {
  validateSnapshot(snapshot);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  document.setTitle(`The Choir Chug - ${snapshot.participant.fullName} - ${snapshot.schoolYear}`);
  document.setAuthor("The Choir Chug");
  document.setSubject(`Signed registration agreement ${snapshot.agreementVersion}`);
  document.setKeywords(["The Choir Chug", "registration", "signed agreement", snapshot.schoolYear]);
  document.setCreationDate(new Date(snapshot.signedAt));
  document.setModificationDate(new Date(snapshot.signedAt));

  const [regular, bold, logo, signature] = await Promise.all([
    document.embedFont(assets.regularFont, { subset: true }),
    document.embedFont(assets.boldFont, { subset: true }),
    embedLogo(document, assets.logo),
    embedImage(document, snapshot.signature.image),
  ]);
  const fonts = { regular, bold };
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const state: DrawingState = {
    document,
    page,
    y: TOP_Y,
    fonts,
    agreementVersion: snapshot.agreementVersion,
  };

  drawCoverHeader(state, logo, snapshot);
  const isIntroduction = (section: AgreementPdfSection) =>
    section.id?.toLowerCase() === "introduction" || section.title.trim().toLowerCase() === "introduction";
  for (const section of snapshot.sections.filter(isIntroduction)) drawAgreementSection(state, section);

  drawSectionTitle(state, "Participant Information");
  drawKeyValueRows(state, [
    ...(snapshot.registrationId ? [{ label: "Registration reference", value: snapshot.registrationId }] : []),
    { label: "Daughter’s full name", value: compact(snapshot.participant.fullName) },
    {
      label: "Date of birth / Age",
      value: `${compact(snapshot.participant.birthDate)}${snapshot.participant.age == null ? "" : `  |  ${snapshot.participant.age}`}`,
    },
    { label: "Father", value: `${compact(snapshot.parents.fatherName)}  |  ${compact(snapshot.parents.fatherPhone, "No phone")}` },
    { label: "Mother", value: `${compact(snapshot.parents.motherName)}  |  ${compact(snapshot.parents.motherPhone, "No phone")}` },
    { label: "Parent email", value: compact(snapshot.parents.email) },
    ...(snapshot.participant.address ? [{ label: "Home address", value: snapshot.participant.address }] : []),
    ...(snapshot.participant.school ? [{ label: "School", value: snapshot.participant.school }] : []),
  ]);

  drawSectionTitle(state, "Emergency & Medical Information");
  drawKeyValueRows(state, [
    {
      label: "Emergency contact",
      value: `${compact(snapshot.care.emergencyContactName)}  |  ${compact(snapshot.care.emergencyContactPhone, "No phone")}  |  ${compact(snapshot.care.emergencyContactRelation, "Relationship not provided")}`,
    },
    { label: "Allergies", value: compact(snapshot.care.allergies) },
    { label: "Medical information or special assistance", value: compact(snapshot.care.medicalInformation) },
    { label: "Medication or regular assistance", value: compact(snapshot.care.medications) },
    { label: "Additional private note", value: compact(snapshot.care.additionalNote, "None") },
    { label: "Care information consent", value: formatBoolean(snapshot.care.consentAccepted) },
  ]);

  drawSectionTitle(state, "Payment Information");
  const currency = snapshot.payment.currency ?? "ILS";
  drawKeyValueRows(state, [
    { label: "Payment method", value: compact(snapshot.payment.method) },
    { label: "Monthly payment", value: `${formatAmount(snapshot.payment.monthlyAmount, currency)} per month` },
    { label: "June payment", value: formatAmount(snapshot.payment.juneAmount, currency) },
    {
      label: "Security check",
      value: `${formatAmount(snapshot.payment.securityCheckAmount, currency)}${snapshot.payment.securityCheckMonths ? `  |  ${snapshot.payment.securityCheckMonths}` : ""}`,
    },
    { label: "Security check acknowledgement", value: formatBoolean(snapshot.payment.securityCheckAccepted) },
    { label: "Payment proof received", value: snapshot.payment.paymentProofReceived == null ? "Not applicable" : formatBoolean(snapshot.payment.paymentProofReceived) },
  ]);

  for (const section of snapshot.sections.filter((section) => !isIntroduction(section))) {
    drawAgreementSection(state, section);
  }

  drawSectionTitle(state, "Final Confirmations");
  drawKeyValueRows(state, [
    { label: "Parent or legal guardian", value: formatBoolean(snapshot.consents.parentOrGuardianAccepted) },
    { label: "Privacy Policy and Terms of Use", value: formatBoolean(snapshot.consents.privacyAndTermsAccepted) },
    { label: "Electronic signature and delivery", value: formatBoolean(snapshot.consents.electronicSignatureAccepted) },
  ]);

  drawSignatureBlock(state, snapshot, signature);
  addFooters(document, fonts, snapshot);
  return document.save({ useObjectStreams: false });
}
