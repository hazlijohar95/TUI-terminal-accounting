// Document processing service for extracting data from receipts, statements, etc.
import { readFileSync } from "fs";
import OpenAI from "openai";
import type { Document, ExtractedData } from "../domain/documents.js";
import { updateDocumentStatus } from "../domain/documents.js";

// Process a document and extract data
export async function processDocument(
  doc: Document,
  apiKey: string
): Promise<ExtractedData | null> {
  try {
    updateDocumentStatus(doc.id, "processing");

    let extractedData: ExtractedData | null = null;

    if (doc.mime_type === "application/pdf") {
      extractedData = await processPdf(doc);
    } else if (doc.mime_type.startsWith("image/")) {
      extractedData = await processImage(doc, apiKey);
    } else if (doc.mime_type === "text/csv") {
      extractedData = await processCsv(doc);
    } else if (
      doc.mime_type.includes("spreadsheet") ||
      doc.mime_type.includes("excel")
    ) {
      extractedData = await processExcel(doc);
    }

    if (extractedData) {
      updateDocumentStatus(doc.id, "processed", extractedData);
    } else {
      updateDocumentStatus(doc.id, "failed");
    }

    return extractedData;
  } catch (error) {
    updateDocumentStatus(doc.id, "failed");
    throw error;
  }
}

// Process PDF documents
async function processPdf(doc: Document): Promise<ExtractedData | null> {
  // Use require for pdf-parse due to its export structure
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const pdfParse = require("pdf-parse");

  const buffer = readFileSync(doc.file_path);
  const data = await pdfParse(buffer);

  // Extract text and try to parse common patterns
  const text = data.text;

  return extractFromText(text);
}

// Process images using OpenAI Vision
async function processImage(
  doc: Document,
  apiKey: string
): Promise<ExtractedData | null> {
  const client = new OpenAI({ apiKey });

  // Read image and convert to base64
  const imageBuffer = readFileSync(doc.file_path);
  const base64Image = imageBuffer.toString("base64");
  const mimeType = doc.mime_type;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this receipt/document image and extract the following information in JSON format:
{
  "vendor": "store/business name",
  "amount": total amount as number,
  "date": "YYYY-MM-DD format",
  "category": "expense category (e.g., meals, office, travel)",
  "description": "brief description of purchase",
  "items": [{"description": "item name", "amount": price, "quantity": qty}],
  "tax": tax amount as number,
  "total": final total as number,
  "payment_method": "cash/card/etc",
  "reference": "receipt/transaction number if visible"
}

Only include fields you can clearly extract. Return only the JSON object, no other text.`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;

  try {
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Failed to parse JSON
  }

  return null;
}

// Process CSV files (bank statements)
async function processCsv(doc: Document): Promise<ExtractedData | null> {
  const Papa = await import("papaparse");
  const content = readFileSync(doc.file_path, "utf-8");

  const result = Papa.default.parse(content, {
    header: true,
    skipEmptyLines: true,
  });

  if (!result.data || result.data.length === 0) {
    return null;
  }

  // Try to identify common bank statement columns
  const rows = result.data as Record<string, string>[];
  const items: ExtractedData["items"] = [];

  for (const row of rows) {
    // Common column name patterns
    const description =
      row["Description"] ||
      row["description"] ||
      row["Memo"] ||
      row["memo"] ||
      row["Narrative"] ||
      row["Details"] ||
      "";

    const amountStr =
      row["Amount"] ||
      row["amount"] ||
      row["Debit"] ||
      row["Credit"] ||
      row["Value"] ||
      "0";

    const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, "")) || 0;

    if (description && amount !== 0) {
      items.push({
        description: description.trim(),
        amount: Math.abs(amount),
      });
    }
  }

  if (items.length === 0) {
    return null;
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    description: `Bank statement with ${items.length} transactions`,
    items,
    total,
  };
}

// Process Excel files
async function processExcel(doc: Document): Promise<ExtractedData | null> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(doc.file_path);

  // Get first sheet
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return null;

  // Convert worksheet to array of objects (like sheet_to_json)
  const rows: Record<string, any>[] = [];
  let headers: string[] = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      // First row is headers
      headers = row.values as string[];
      // Remove first empty element (exceljs 1-based indexing)
      headers = headers.slice(1).map(h => String(h || ""));
    } else {
      const rowData: Record<string, any> = {};
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          rowData[header] = cell.value;
        }
      });
      if (Object.keys(rowData).length > 0) {
        rows.push(rowData);
      }
    }
  });

  if (rows.length === 0) {
    return null;
  }

  // Similar logic to CSV
  const items: ExtractedData["items"] = [];

  for (const row of rows) {
    const description =
      row["Description"] ||
      row["description"] ||
      row["Memo"] ||
      row["memo"] ||
      "";

    const amount =
      parseFloat(row["Amount"] || row["amount"] || row["Value"] || 0) || 0;

    if (description && amount !== 0) {
      items.push({
        description: String(description).trim(),
        amount: Math.abs(amount),
      });
    }
  }

  if (items.length === 0) {
    return null;
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    description: `Excel file with ${items.length} transactions`,
    items,
    total,
  };
}

// Extract structured data from text (for PDFs)
function extractFromText(text: string): ExtractedData | null {
  const data: ExtractedData = {};

  // Try to extract common patterns

  // Date patterns
  const datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    /(\d{4}-\d{2}-\d{2})/,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.date = normalizeDate(match[1]);
      break;
    }
  }

  // Total amount patterns
  const totalPatterns = [
    /total[:\s]*\$?([\d,]+\.?\d*)/i,
    /amount[:\s]*\$?([\d,]+\.?\d*)/i,
    /grand\s+total[:\s]*\$?([\d,]+\.?\d*)/i,
  ];

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.total = parseFloat(match[1].replace(/,/g, ""));
      data.amount = data.total;
      break;
    }
  }

  // Tax patterns
  const taxMatch = text.match(/tax[:\s]*\$?([\d,]+\.?\d*)/i);
  if (taxMatch) {
    data.tax = parseFloat(taxMatch[1].replace(/,/g, ""));
  }

  // Reference/Invoice number
  const refPatterns = [
    /invoice\s*#?\s*:?\s*([A-Z0-9-]+)/i,
    /receipt\s*#?\s*:?\s*([A-Z0-9-]+)/i,
    /order\s*#?\s*:?\s*([A-Z0-9-]+)/i,
    /ref(?:erence)?[:\s]*([A-Z0-9-]+)/i,
  ];

  for (const pattern of refPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.reference = match[1];
      break;
    }
  }

  // Only return if we extracted something useful
  if (Object.keys(data).length > 0) {
    return data;
  }

  return null;
}

// Normalize date to YYYY-MM-DD
function normalizeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  } catch {
    // Failed to parse
  }
  return dateStr;
}

// Suggest category based on vendor/description
export function suggestCategory(text: string): string {
  const lower = text.toLowerCase();

  const categories: Record<string, string[]> = {
    meals: ["restaurant", "cafe", "coffee", "food", "lunch", "dinner", "uber eats", "doordash"],
    travel: ["airline", "hotel", "uber", "lyft", "taxi", "airbnb", "flight"],
    office: ["staples", "office depot", "amazon", "supplies"],
    software: ["github", "aws", "google cloud", "microsoft", "adobe", "subscription"],
    utilities: ["electric", "water", "gas", "internet", "phone"],
    advertising: ["google ads", "facebook", "meta", "linkedin", "marketing"],
    professional: ["legal", "accounting", "consulting", "lawyer", "attorney"],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return category;
      }
    }
  }

  return "other";
}
