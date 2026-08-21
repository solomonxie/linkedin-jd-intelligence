import { describe, expect, it, vi } from "vitest";

vi.mock("./pdfParser", () => ({
  extractTextFromPdf: vi.fn().mockResolvedValue("pdf text content here ".repeat(20)),
}));
vi.mock("./docxParser", () => ({
  extractTextFromDocx: vi.fn().mockResolvedValue("docx text content here ".repeat(20)),
}));

import { parseResumeFile } from "./index";
import { extractTextFromPdf } from "./pdfParser";

function makeFile(name: string, type: string, content = "dummy"): File {
  return new File([content], name, { type });
}

describe("parseResumeFile dispatch", () => {
  it("dispatches .pdf files to the PDF parser", async () => {
    const result = await parseResumeFile(makeFile("resume.pdf", "application/pdf"));
    expect(result.text).toContain("pdf text content here");
    expect(result.warning).toBeNull();
  });

  it("dispatches .docx files to the DOCX parser by mime type", async () => {
    const result = await parseResumeFile(
      makeFile("resume.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    );
    expect(result.text).toContain("docx text content here");
  });

  it("dispatches by file extension when the mime type is missing", async () => {
    const result = await parseResumeFile(makeFile("resume.pdf", ""));
    expect(result.text).toContain("pdf text content here");
  });

  it("throws for an unsupported file type", async () => {
    await expect(parseResumeFile(makeFile("resume.txt", "text/plain"))).rejects.toThrow(/Unsupported/);
  });

  it("warns when extracted text is implausibly short", async () => {
    vi.mocked(extractTextFromPdf).mockResolvedValueOnce("short");
    const result = await parseResumeFile(makeFile("resume.pdf", "application/pdf"));
    expect(result.warning).toMatch(/little text/);
    expect(result.text).toBe("short");
  });
});
