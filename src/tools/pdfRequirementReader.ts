import { readFile } from "fs/promises";
import { resolve } from "path";
import { PDFParse } from "pdf-parse";
import { TurnContext } from "@microsoft/agents-hosting";

const MAX_PDF_CHARS = 12000;
const MAX_TOTAL_CHARS = 20000;

interface AttachmentLike {
  name?: string;
  contentType?: string;
  contentUrl?: string;
  content?: unknown;
}

function trimText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n[...contenido truncado para MVP...]`;
}

async function extractTextFromPdfBuffer(
  fileBuffer: Buffer,
  sourceName: string
): Promise<string | null> {
  try {
    const parser = new PDFParse({ data: fileBuffer });
    const parsed = await parser.getText();
    await parser.destroy();
    const text = (parsed.text || "").trim();
    if (!text) return null;
    return `Fuente PDF: ${sourceName}\n${trimText(text, MAX_PDF_CHARS)}`;
  } catch {
    return null;
  }
}

function parsePdfPathsFromText(inputText: string): string[] {
  if (!inputText) return [];

  const matches = inputText.match(/([A-Za-z]:\\[^\n\r"']+\.pdf|(?:\.\\|\.\/|\/)?[^\s"']+\.pdf)/gi) || [];
  const unique = new Set<string>();

  for (const match of matches) {
    const cleaned = match.trim().replace(/^['"]|['"]$/g, "");
    if (cleaned) unique.add(cleaned);
  }

  return Array.from(unique);
}

async function readPdfFromPath(pathCandidate: string): Promise<string | null> {
  try {
    const absolutePath = resolve(process.cwd(), pathCandidate);
    const data = await readFile(absolutePath);
    return extractTextFromPdfBuffer(data, absolutePath);
  } catch {
    return null;
  }
}

async function readPdfFromAttachment(attachment: AttachmentLike): Promise<string | null> {
  const sourceName = attachment.name || attachment.contentUrl || "adjunto";

  if (typeof attachment.content === "string") {
    const maybeBase64 = attachment.content.trim();
    if (maybeBase64.length > 0) {
      const buffer = Buffer.from(maybeBase64, "base64");
      if (buffer.length > 0) {
        const result = await extractTextFromPdfBuffer(buffer, sourceName);
        if (result) return result;
      }
    }
  }

  if (typeof attachment.contentUrl === "string" && attachment.contentUrl) {
    try {
      const response = await fetch(attachment.contentUrl);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      return extractTextFromPdfBuffer(Buffer.from(arrayBuffer), sourceName);
    } catch {
      return null;
    }
  }

  return null;
}

export async function extractPdfRequirementText(
  context: TurnContext
): Promise<string> {
  const extractedChunks: string[] = [];
  const userText = context.activity.text || "";

  const attachmentItems = (context.activity.attachments || []) as AttachmentLike[];

  for (const attachment of attachmentItems) {
    const name = (attachment.name || "").toLowerCase();
    const contentType = (attachment.contentType || "").toLowerCase();
    const isPdf = name.endsWith(".pdf") || contentType.includes("pdf");
    if (!isPdf) continue;

    const text = await readPdfFromAttachment(attachment);
    if (text) extractedChunks.push(text);
  }

  const pdfPathsInText = parsePdfPathsFromText(userText);
  for (const pathCandidate of pdfPathsInText) {
    if (!pathCandidate.toLowerCase().endsWith(".pdf")) continue;
    const text = await readPdfFromPath(pathCandidate);
    if (text) extractedChunks.push(text);
  }

  if (!extractedChunks.length) return "";

  const merged = extractedChunks.join("\n\n---\n\n");
  return trimText(merged, MAX_TOTAL_CHARS);
}
