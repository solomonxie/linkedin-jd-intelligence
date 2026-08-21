// Dispatches to the right parser by file type and flags implausibly short
// output (e.g. a scanned/image-only PDF pdf.js can't OCR) instead of silently
// saving an empty resume profile.

const MIN_MEANINGFUL_TEXT_LENGTH = 200;

export interface ParsedResume {
  text: string;
  warning: string | null;
}

export async function parseResumeFile(file: File): Promise<ParsedResume> {
  const data = await file.arrayBuffer();
  const text = (await extractByType(file, data)).trim();
  const warning =
    text.length < MIN_MEANINGFUL_TEXT_LENGTH
      ? "This file produced very little text — if it's a scanned/image-only PDF, try exporting a text-based version instead."
      : null;
  return { text, warning };
}

async function extractByType(file: File, data: ArrayBuffer): Promise<string> {
  const name = file.name.toLowerCase();

  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    const { extractTextFromPdf } = await import("./pdfParser");
    return extractTextFromPdf(data);
  }

  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const { extractTextFromDocx } = await import("./docxParser");
    return extractTextFromDocx(data);
  }

  throw new Error(`Unsupported resume file type: ${file.name}`);
}
