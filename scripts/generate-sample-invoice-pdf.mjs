/**
 * Generates a sample invoice PDF for testing upload, parse, reminders, and tokens.
 * Run: node scripts/generate-sample-invoice-pdf.mjs
 * Output: test-data/sample-invoice.pdf
 */
import PDFDocument from "pdfkit";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "test-data");
const outPath = join(outDir, "sample-invoice.pdf");

const invoice = {
  clientName: "Bluehill Media",
  clientEmail: "billing@bluehill.io",
  clientAddress: "456 Oak Avenue, Suite 200\nSan Francisco, CA 94102",
  invoiceNumber: "INV-2026-001",
  issueDate: "2025-12-15",
  dueDate: "2026-01-15",
  paymentTerms: "Net 30",
  currency: "USD",
  lineItems: [
    { description: "Website redesign – Phase 1", quantity: 1, unitPrice: 2500, lineTotal: 2500 },
    { description: "Copywriting and content", quantity: 8, unitPrice: 125, lineTotal: 1000 },
    { description: "SEO audit and report", quantity: 1, unitPrice: 750, lineTotal: 750 }
  ],
  subtotal: 4250,
  tax: 340,
  total: 4590
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

const doc = new PDFDocument({ size: "LETTER", margin: 50 });

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

const chunks = [];
doc.on("data", (chunk) => chunks.push(chunk));
doc.on("end", () => {
  writeFileSync(outPath, Buffer.concat(chunks));
  console.log("Written:", outPath);
});
doc.on("error", (err) => {
  console.error(err);
  process.exit(1);
});

// Header
doc.fontSize(24).font("Helvetica-Bold").text("INVOICE", { align: "right" });
doc.moveDown(0.5);
doc.fontSize(12).font("Helvetica").text("Acme Design Co.", { align: "right" });
doc.moveDown(2);

// Bill To (so regex and AI can find client)
doc.fontSize(14).font("Helvetica-Bold").text("Bill To:", 50, doc.y);
doc.moveDown(0.5);
doc.fontSize(11).font("Helvetica");
doc.text(invoice.clientName);
doc.text(invoice.clientEmail);
invoice.clientAddress.split("\n").forEach((line) => doc.text(line));
doc.moveDown(2);

// Metadata (right side) – clear labels for parsing
const metaY = doc.y;
const metaX = 350;
const lh = 15;
doc.fontSize(10).font("Helvetica");
doc.text("Invoice Number:", metaX, metaY);
doc.font("Helvetica-Bold").text(invoice.invoiceNumber, metaX + 110, metaY);
doc.font("Helvetica");
doc.text("Issue Date:", metaX, metaY + lh);
doc.text(formatDate(invoice.issueDate), metaX + 110, metaY + lh);
doc.text("Due Date:", metaX, metaY + lh * 2);
doc.font("Helvetica-Bold").text(formatDate(invoice.dueDate), metaX + 110, metaY + lh * 2);
doc.font("Helvetica");
doc.text("Payment Terms:", metaX, metaY + lh * 3);
doc.text(invoice.paymentTerms, metaX + 110, metaY + lh * 3);
doc.moveDown(3);

// Line items table
const tableTop = doc.y;
const colDesc = 250;
const colQty = 60;
const colUnit = 90;
const colTotal = 100;
doc.fontSize(10).font("Helvetica-Bold");
doc.text("Description", 50, tableTop);
doc.text("Qty", 50 + colDesc, tableTop);
doc.text("Unit Price", 50 + colDesc + colQty, tableTop);
doc.text("Total", 50 + colDesc + colQty + colUnit, tableTop);
doc.moveTo(50, tableTop + 15).lineTo(50 + 500, tableTop + 15).stroke();
doc.moveDown(1);

doc.fontSize(10).font("Helvetica");
let y = doc.y;
invoice.lineItems.forEach((item) => {
  doc.text(item.description, 50, y, { width: colDesc });
  doc.text(String(item.quantity), 50 + colDesc, y, { width: colQty, align: "right" });
  doc.text(formatCurrency(item.unitPrice), 50 + colDesc + colQty, y, { width: colUnit, align: "right" });
  doc.text(formatCurrency(item.lineTotal), 50 + colDesc + colQty + colUnit, y, { width: colTotal, align: "right" });
  y += 22;
});
doc.y = y + 10;

// Totals – "Total" and "Amount Due" for regex
const sumX = 350;
const sumY = doc.y;
doc.fontSize(10).font("Helvetica");
doc.text("Subtotal:", sumX, sumY);
doc.text(formatCurrency(invoice.subtotal), sumX + 100, sumY, { align: "right" });
doc.text("Tax:", sumX, sumY + 18);
doc.text(formatCurrency(invoice.tax), sumX + 100, sumY + 18, { align: "right" });
doc.fontSize(12).font("Helvetica-Bold");
doc.text("Total:", sumX, sumY + 36);
doc.text(formatCurrency(invoice.total), sumX + 100, sumY + 36, { align: "right" });
doc.moveDown(0.5);
doc.fontSize(10).font("Helvetica");
doc.text("Amount Due: " + formatCurrency(invoice.total), sumX, doc.y);

doc.moveDown(3);
doc.fontSize(9).font("Helvetica");
doc.text("Thank you for your business! Please remit payment by the due date.", 50, doc.y, { align: "center" });

doc.end();
