/**
 * Quick script to generate 3 demo invoice PDFs using pdfkit directly.
 * Run: node demo/generate-pdfs.mjs
 */
import PDFDocument from "pdfkit";
import { writeFileSync, mkdirSync } from "fs";

function generatePdf(invoice, companyName) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Header
    doc.fontSize(24).font("Helvetica-Bold").text("INVOICE", { align: "right" });
    doc.moveDown(0.5);
    doc.fontSize(12).font("Helvetica").text(companyName, { align: "right" });
    doc.moveDown(2);

    // Bill To
    doc.fontSize(14).font("Helvetica-Bold").text("Bill To:", 50, doc.y);
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica");
    doc.text(invoice.clientName);
    if (invoice.clientEmail) doc.text(invoice.clientEmail);
    if (invoice.clientAddress) {
      invoice.clientAddress.split("\n").forEach((l) => doc.text(l));
    }
    doc.moveDown(2);

    // Metadata
    const metaY = doc.y;
    const mx = 350;
    const mh = 15;
    doc.fontSize(10).font("Helvetica");
    doc.text("Invoice Number:", mx, metaY);
    doc.font("Helvetica-Bold").text(invoice.invoiceNumber, mx + 105, metaY);
    doc.font("Helvetica");
    if (invoice.issueDate) {
      doc.text("Issue Date:", mx, metaY + mh);
      doc.text(fmtDate(invoice.issueDate), mx + 105, metaY + mh);
    }
    doc.text("Due Date:", mx, metaY + mh * 2);
    doc.font("Helvetica-Bold").text(fmtDate(invoice.dueDate), mx + 105, metaY + mh * 2);
    doc.font("Helvetica");
    if (invoice.paymentTerms) {
      doc.text("Payment Terms:", mx, metaY + mh * 3);
      doc.text(invoice.paymentTerms, mx + 105, metaY + mh * 3);
    }
    doc.moveDown(3);

    // Line items table
    const tableTop = doc.y;
    const colW = { desc: 250, qty: 60, price: 90, total: 100 };
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Description", 50, tableTop);
    doc.text("Qty", 50 + colW.desc, tableTop);
    doc.text("Unit Price", 50 + colW.desc + colW.qty, tableTop);
    doc.text("Total", 50 + colW.desc + colW.qty + colW.price, tableTop);
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
    doc.moveDown(1);

    doc.fontSize(10).font("Helvetica");
    let curY = doc.y;
    for (const item of invoice.lineItems) {
      const h = Math.max(20, doc.heightOfString(item.description, { width: colW.desc }) + 5);
      doc.text(item.description, 50, curY, { width: colW.desc });
      if (item.quantity != null) doc.text(String(item.quantity), 50 + colW.desc, curY, { width: colW.qty, align: "right" });
      if (item.unitPrice != null) doc.text(fmtCur(item.unitPrice, invoice.currency), 50 + colW.desc + colW.qty, curY, { width: colW.price, align: "right" });
      if (item.lineTotal != null) doc.text(fmtCur(item.lineTotal, invoice.currency), 50 + colW.desc + colW.qty + colW.price, curY, { width: colW.total, align: "right" });
      curY += h;
    }

    doc.y = curY + 10;

    // Summary
    const sx = 350;
    let sy = doc.y;
    const sh = 18;
    let sl = 0;
    doc.fontSize(10).font("Helvetica");
    if (invoice.subtotal != null) {
      doc.text("Subtotal:", sx, sy + sl * sh);
      doc.text(fmtCur(invoice.subtotal, invoice.currency), sx + 100, sy + sl * sh, { align: "right" });
      sl++;
    }
    if (invoice.tax != null) {
      doc.text("Tax:", sx, sy + sl * sh);
      doc.text(fmtCur(invoice.tax, invoice.currency), sx + 100, sy + sl * sh, { align: "right" });
      sl++;
    }
    doc.fontSize(12).font("Helvetica-Bold");
    doc.text("Total:", sx, sy + sl * sh);
    doc.text(fmtCur(invoice.total, invoice.currency), sx + 100, sy + sl * sh, { align: "right" });

    doc.moveDown(4);
    doc.fontSize(9).font("Helvetica");
    doc.text("Thank you for your business!", 50, doc.y, { align: "center" });
    doc.moveDown(0.5);
    doc.text("Please remit payment by the due date.", 50, doc.y, { align: "center" });

    doc.end();
  });
}

function fmtDate(s) {
  return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function fmtCur(n, c) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: c || "USD", minimumFractionDigits: 2 }).format(n);
}

// ── Demo invoices ──────────────────────────────────────────────

const invoices = [
  {
    file: "demo/Invoice_INV-2026-002_Pinnacle_Ventures.pdf",
    company: "Starter Studio",
    data: {
      invoiceNumber: "INV-2026-002",
      clientName: "Pinnacle Ventures",
      clientEmail: "billing@pinnaclevc.com",
      clientAddress: "1 Market Plaza, Suite 400\nSan Francisco, CA 94105",
      issueDate: "2026-01-15",
      dueDate: "2026-02-14",
      paymentTerms: "Net 30",
      currency: "USD",
      subtotal: 8000,
      tax: 400,
      total: 8400,
      lineItems: [
        { description: "Investor pitch deck — 20 slides", quantity: 1, unitPrice: 5000, lineTotal: 5000 },
        { description: "Financial model spreadsheet", quantity: 1, unitPrice: 2000, lineTotal: 2000 },
        { description: "Brand identity refresh", quantity: 1, unitPrice: 1000, lineTotal: 1000 },
      ],
    },
  },
  {
    file: "demo/Invoice_SC-0041_TechNova.pdf",
    company: "CloudBridge Consulting",
    data: {
      invoiceNumber: "SC-0041",
      clientName: "TechNova Inc",
      clientEmail: "ap@technova.dev",
      clientAddress: "700 Innovation Park\nSan Jose, CA 95110",
      issueDate: "2025-12-15",
      dueDate: "2026-01-14",
      paymentTerms: "Net 30",
      currency: "USD",
      subtotal: 12500,
      tax: 0,
      total: 12500,
      lineItems: [
        { description: "Cloud migration consulting — Phase 1 (40 hrs @ $250/hr)", quantity: 40, unitPrice: 250, lineTotal: 10000 },
        { description: "Architecture review & documentation", quantity: 1, unitPrice: 2500, lineTotal: 2500 },
      ],
    },
  },
  {
    file: "demo/Invoice_MIX-103_Brighton_Cole.pdf",
    company: "PixelForge Digital",
    data: {
      invoiceNumber: "MIX-103",
      clientName: "Brighton & Cole Solicitors",
      clientEmail: "accounts@brightoncole.co.uk",
      clientAddress: "14 Chancery Lane\nLondon WC2A 1PL, UK",
      issueDate: "2026-01-12",
      dueDate: "2026-02-11",
      paymentTerms: "Net 30",
      currency: "GBP",
      subtotal: 2200,
      tax: 440,
      total: 2640,
      lineItems: [
        { description: "Website accessibility audit", quantity: 1, unitPrice: 1200, lineTotal: 1200 },
        { description: "GDPR compliance review", quantity: 1, unitPrice: 800, lineTotal: 800 },
        { description: "Monthly retainer — February", quantity: 1, unitPrice: 200, lineTotal: 200 },
      ],
    },
  },
];

// Generate all PDFs
for (const inv of invoices) {
  const buf = await generatePdf(inv.data, inv.company);
  writeFileSync(inv.file, buf);
  console.log(`✓ ${inv.file} (${(buf.length / 1024).toFixed(1)} KB)`);
}

console.log("\nDone — 3 demo PDFs generated in demo/");
