import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface LineItem {
  id: string;
  offer: string;
  roles: string;
  qty: number;
  duration: string;
  price: number;
}

export interface ProposalData {
  title: string;
  clientName: string;
  businessName: string;
  location: string;
  phone: string;
  email: string;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
}

export const generateProposalPdf = async (data: ProposalData) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Load Logo
  const logoData = await new Promise<string | null>((resolve) => {
    const img = new Image();
    img.src = '/logo.jpg';
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg'));
    };
    img.onerror = () => resolve(null);
  });

  // Background accents
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, 210, 297, 'F');
  
  // Top deep slate blue header banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 60, 'F');

  // Logo
  if (logoData) {
    doc.addImage(logoData, 'JPEG', 15, 12, 36, 36);
  }

  // Title header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(data.title || "BUSINESS PROPOSAL & QUOTATION", 60, 26);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text("WE DON'T JUST BUILD WEBSITES — WE BUILD BRANDS.", 60, 33);
  doc.text("Prepared by Hyperscript Solutions (", 60, 38);
  const prepWidth = doc.getTextWidth("Prepared by Hyperscript Solutions (");
  doc.setTextColor(96, 165, 250);
  doc.text("hyperscriptsolutions.in", 60 + prepWidth, 38);
  const linkW1 = doc.getTextWidth("hyperscriptsolutions.in");
  doc.link(60 + prepWidth, 38 - (9 * 0.353) + 1, linkW1, 9 * 0.353, { url: "https://hyperscriptsolutions.in" });
  doc.setTextColor(148, 163, 184);
  doc.text(")", 60 + prepWidth + linkW1, 38);

  // Client Title Block
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(15, 75, 180, 50, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, 75, 180, 50, 3, 3, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text("PREPARED FOR:", 22, 87);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(data.businessName || data.clientName || "Client Business", 22, 97);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Contact: ${data.clientName || "N/A"}`, 22, 105);
  doc.text(`Email: ${data.email || "N/A"} | Phone: ${data.phone || "N/A"}`, 22, 111);
  doc.text(`Location: ${data.location || "N/A"}`, 22, 117);

  // Date and Quote details on right side of block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text("Date:", 145, 95);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('en-US', { dateStyle: 'long' }), 145, 101);
  
  // Table for Line Items
  const tableData = data.lineItems.map((item, index) => [
    (index + 1).toString(),
    `${item.offer}\n\nNotes: ${item.roles}`,
    item.duration,
    item.qty.toString(),
    `₹${item.price.toLocaleString()}`,
    `₹${(item.qty * item.price).toLocaleString()}`
  ]);

  autoTable(doc, {
    startY: 135,
    head: [['#', 'Service / Details', 'Duration', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 80 },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
    },
    styles: {
      font: 'helvetica',
      fontSize: 10,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 15, right: 15 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;

  // Financial Summary Block
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(125, finalY, 70, 40, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("Subtotal:", 130, finalY + 10);
  doc.text(`₹${data.subtotal.toLocaleString()}`, 190, finalY + 10, { align: 'right' });
  
  doc.text("Tax:", 130, finalY + 18);
  doc.text(`₹${data.tax.toLocaleString()}`, 190, finalY + 18, { align: 'right' });

  // Line before total
  doc.line(130, finalY + 23, 190, finalY + 23);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Grand Total:", 130, finalY + 31);
  doc.text(`₹${data.total.toLocaleString()}`, 190, finalY + 31, { align: 'right' });

  // Footer terms
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text("Terms & Conditions:", 15, finalY + 10);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const terms = [
    "1. This quotation is valid for 30 days from the date of issue.",
    "2. 50% advance payment required to commence work.",
    "3. Remaining 50% due upon project completion.",
    "4. All prices are in INR (₹) unless otherwise specified."
  ];
  let currentY = finalY + 16;
  terms.forEach(term => {
    doc.text(term, 15, currentY);
    currentY += 5;
  });

  // Footer line
  doc.setDrawColor(226, 232, 240);
  doc.line(15, 280, 195, 280);
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Generated by Hyperscript Solutions", 105, 285, { align: 'center' });

  // Save the PDF
  const filename = `${data.businessName || 'Proposal'}_Quotation.pdf`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(filename);
};
