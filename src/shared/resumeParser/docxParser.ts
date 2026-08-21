// DOCX text extraction via mammoth (browser build, resolved through its
// package.json "browser" field) — pure JS, no eval, no native deps.

import mammoth from "mammoth";

export async function extractTextFromDocx(data: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: data });
  return result.value.trim();
}
