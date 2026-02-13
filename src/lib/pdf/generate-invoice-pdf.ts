import PDFDocument from "pdfkit";

export type InvoiceData = {
  invoiceNumber: string;
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  issueDate?: string;
  dueDate: string;
  paymentTerms?: string;
  currency: string;
  subtotal?: number;
  tax?: number;
  total: number;
  lineItems: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    lineTotal?: number;
  }>;
};

export type CompanyInfo = {
  companyName?: string;
  senderName?: string;
};


export function generateInvoicePdf(
  invoice: InvoiceData,
  companyInfo: CompanyInfo = {}
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const buffers: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Header
  const companyName = companyInfo.companyName || "Your Company";
  doc.fontSize(24).font("Helvetica-Bold").text("INVOICE", { align: "right" });
  doc.moveDown(0.5);
  doc.fontSize(12).font("Helvetica").text(companyName, { align: "right" });
  doc.moveDown(2);

  // Client billing details
  doc.fontSize(14).font("Helvetica-Bold").text("Bill To:", 50, doc.y);
  doc.moveDown(0.5);
  doc.fontSize(11).font("Helvetica");
  doc.text(invoice.clientName);
  if (invoice.clientEmail) {
    doc.text(invoice.clientEmail);
  }
  if (invoice.clientAddress) {
    const addressLines = invoice.clientAddress.split("\n");
    addressLines.forEach((line) => doc.text(line));
  }
  doc.moveDown(2);

  // Invoice metadata
  const metadataY = doc.y;
  doc.fontSize(10).font("Helvetica");
  let metadataX = 350;
  let metadataLineHeight = 15;

  doc.text(`Invoice Number:`, metadataX, metadataY);
  doc.font("Helvetica-Bold").text(invoice.invoiceNumber, metadataX + 100, metadataY);
  doc.font("Helvetica");

  if (invoice.issueDate) {
    const formattedIssueDate = formatDate(invoice.issueDate);
    doc.text(`Issue Date:`, metadataX, metadataY + metadataLineHeight);
    doc.text(formattedIssueDate, metadataX + 100, metadataY + metadataLineHeight);
  }

  const formattedDueDate = formatDate(invoice.dueDate);
  doc.text(`Due Date:`, metadataX, metadataY + metadataLineHeight * 2);
  doc.font("Helvetica-Bold").text(formattedDueDate, metadataX + 100, metadataY + metadataLineHeight * 2);
  doc.font("Helvetica");

  if (invoice.paymentTerms) {
    doc.text(`Payment Terms:`, metadataX, metadataY + metadataLineHeight * 3);
    doc.text(invoice.paymentTerms, metadataX + 100, metadataY + metadataLineHeight * 3);
  }

  doc.moveDown(3);

  // Line items table
  const tableTop = doc.y;
  const itemHeight = 20;
  const tableWidth = 500;
  const colWidths = {
    description: 250,
    quantity: 60,
    unitPrice: 90,
    lineTotal: 100
  };

  // Table header
  doc.fontSize(10).font("Helvetica-Bold");
  doc.text("Description", 50, tableTop);
  doc.text("Qty", 50 + colWidths.description, tableTop);
  doc.text("Unit Price", 50 + colWidths.description + colWidths.quantity, tableTop);
  doc.text("Total", 50 + colWidths.description + colWidths.quantity + colWidths.unitPrice, tableTop);

  // Draw header underline
  doc.moveTo(50, tableTop + 15).lineTo(50 + tableWidth, tableTop + 15).stroke();
  doc.moveDown(1);

  // Table rows
  doc.fontSize(10).font("Helvetica");
  let currentY = doc.y;

  if (invoice.lineItems.length === 0) {
    doc.text("No line items", 50, currentY);
    currentY += itemHeight;
  } else {
    invoice.lineItems.forEach((item) => {
      const descriptionLines = doc.heightOfString(item.description, {
        width: colWidths.description
      });
      const lineHeight = Math.max(itemHeight, descriptionLines + 5);

      doc.text(item.description, 50, currentY, {
        width: colWidths.description,
        align: "left"
      });

      if (item.quantity !== undefined && item.quantity !== null) {
        doc.text(String(item.quantity), 50 + colWidths.description, currentY, {
          width: colWidths.quantity,
          align: "right"
        });
      }

      if (item.unitPrice !== undefined && item.unitPrice !== null) {
        doc.text(formatCurrency(item.unitPrice, invoice.currency), 50 + colWidths.description + colWidths.quantity, currentY, {
          width: colWidths.unitPrice,
          align: "right"
        });
      }

      if (item.lineTotal !== undefined && item.lineTotal !== null) {
        doc.text(formatCurrency(item.lineTotal, invoice.currency), 50 + colWidths.description + colWidths.quantity + colWidths.unitPrice, currentY, {
          width: colWidths.lineTotal,
          align: "right"
        });
      }

      currentY += lineHeight;
    });
  }

  doc.y = currentY + 10;

  // Summary section
  const summaryX = 350;
  const summaryY = doc.y;
  let summaryLine = 0;
  const summaryLineHeight = 18;

  doc.fontSize(10).font("Helvetica");

  if (invoice.subtotal !== undefined && invoice.subtotal !== null) {
    doc.text("Subtotal:", summaryX, summaryY + summaryLine * summaryLineHeight);
    doc.text(formatCurrency(invoice.subtotal, invoice.currency), summaryX + 100, summaryY + summaryLine * summaryLineHeight, {
      align: "right"
    });
    summaryLine++;
  }

  if (invoice.tax !== undefined && invoice.tax !== null) {
    doc.text("Tax:", summaryX, summaryY + summaryLine * summaryLineHeight);
    doc.text(formatCurrency(invoice.tax, invoice.currency), summaryX + 100, summaryY + summaryLine * summaryLineHeight, {
      align: "right"
    });
    summaryLine++;
  }

  // Total
  doc.fontSize(12).font("Helvetica-Bold");
  doc.text("Total:", summaryX, summaryY + summaryLine * summaryLineHeight);
  doc.text(formatCurrency(invoice.total, invoice.currency), summaryX + 100, summaryY + summaryLine * summaryLineHeight, {
    align: "right"
  });

  doc.moveDown(4);

  // Footer
  doc.fontSize(9).font("Helvetica");
  doc.text("Thank you for your business!", 50, doc.y, { align: "center" });
  doc.moveDown(0.5);
  doc.text("Please remit payment by the due date.", 50, doc.y, { align: "center" });

  doc.end();
  });
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return dateString;
  }
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}
