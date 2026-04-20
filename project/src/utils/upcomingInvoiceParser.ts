import * as pdfjsLib from 'pdfjs-dist';

export type ParsedInvoiceLineDraft = {
  line_no: number;
  product_code: string;
  product_name: string;
  qty_kg: number;
  price_per_kg_eur: number | null;
  amount_eur: number | null;
  customer_ref: string | null;
  notes: string | null;
};

export type ParsedInvoiceDraft = {
  reference: string;
  order_number: string | null;
  info_label: string | null;
  invoice_date: string | null;
  shipping_date: string | null;
  expected_arrival_date: string | null;
  delivery_mode: string | null;
  carrier: string | null;
  payment_terms: string | null;
  currency: string | null;
  total_net_weight_kg: number | null;
  total_amount_eur: number | null;
  raw_text: string;
  lines: ParsedInvoiceLineDraft[];
};

function parseEuropeanNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number(value.replace(/\s+/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function normalizeSpaces(input: string): string {
  return input.replace(/\u00A0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function extractDateToIso(text: string): string | null {
  const m = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/i);
  if (!m) return null;
  const d = Number(m[1]);
  const month = m[2].toLowerCase();
  const y = Number(m[3]);
  const mm = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ].indexOf(month);
  if (mm < 0 || !Number.isFinite(d) || !Number.isFinite(y)) return null;
  const dt = new Date(Date.UTC(y, mm, d));
  return dt.toISOString().slice(0, 10);
}

function extractHeader(rawText: string) {
  const reference = rawText.match(/\bCD\d{6,}\b/i)?.[0] ?? '';
  const orderNumber = rawText.match(/Order N[°o]\s+([^\n]+)/i)?.[1]?.trim() ?? null;
  const infoLabel = rawText.match(/Order N[°o]\s+[^\n]*\n([^\n]+)/i)?.[1]?.trim() ?? null;
  const deliveryMode = rawText.match(/Delivery mode\s+([^\n]+)/i)?.[1]?.trim() ?? null;
  const carrier = rawText.match(/Carrier\s+([^\n]+)/i)?.[1]?.trim() ?? null;
  const paymentTerms = rawText.match(/Payment terms\s+([^\n]+)/i)?.[1]?.trim() ?? null;
  const dates = [...rawText.matchAll(/(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/gi)].map((x) => x[1]);
  const invoiceDate = dates[0] ? extractDateToIso(dates[0]) : null;
  const shippingDate = dates[1] ? extractDateToIso(dates[1]) : null;
  const expectedArrivalDate = dates[2] ? extractDateToIso(dates[2]) : null;
  const totalNetWeight = parseEuropeanNumber(rawText.match(/([\d\s]+,\d{2})\s+KG\s+Total net weight/i)?.[1]);
  const totalAmount = parseEuropeanNumber(rawText.match(/EUR\s+([\d\s]+,\d{2})\s+Total tax included/i)?.[1]);

  return {
    reference,
    order_number: orderNumber,
    info_label: infoLabel,
    invoice_date: invoiceDate,
    shipping_date: shippingDate,
    expected_arrival_date: expectedArrivalDate,
    delivery_mode: deliveryMode,
    carrier,
    payment_terms: paymentTerms,
    currency: 'EUR',
    total_net_weight_kg: totalNetWeight,
    total_amount_eur: totalAmount
  };
}

export function parseUpcomingInvoiceText(rawText: string): ParsedInvoiceDraft {
  const text = rawText.replace(/\r\n/g, '\n');
  const lines = text.split('\n').map(normalizeSpaces).filter(Boolean);
  const parsedLines: ParsedInvoiceLineDraft[] = [];

  for (const line of lines) {
    const codeMatch = line.match(/\b(ITM\d{6,})\b/i);
    if (!codeMatch) continue;
    const productCode = codeMatch[1].toUpperCase();

    const nameMatch = line.match(/\bITM\d{6,}\s+(.+?)\s+ALU NEUTRAL/i);
    const productName = nameMatch?.[1]?.replace(/\s{2,}/g, ' ').trim() ?? '';
    const pricePerKg = parseEuropeanNumber(line.match(/OMNI\+50\s+([\d\s]+,\d{2})/i)?.[1] ?? null);
    const qty = parseEuropeanNumber(line.match(/\bKG\s+\d+\s+([\d\s]+,\d{2})/i)?.[1] ?? null);
    const decimals = [...line.matchAll(/([\d\s]+,\d{2})/g)].map((m) => m[1]);
    const amount = parseEuropeanNumber(decimals.length > 0 ? decimals[decimals.length - 1] : null);
    const customerRef = line.match(/\bUN\d{4}\b/i)?.[0] ?? null;

    if (!productName || !qty || qty <= 0) continue;

    parsedLines.push({
      line_no: parsedLines.length + 1,
      product_code: productCode,
      product_name: productName,
      qty_kg: qty,
      price_per_kg_eur: pricePerKg,
      amount_eur: amount,
      customer_ref: customerRef,
      notes: null
    });
  }

  const header = extractHeader(text);
  return {
    ...header,
    reference: header.reference || `INV-${Date.now()}`,
    raw_text: text,
    lines: parsedLines
  };
}

export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    disableWorker: true
  } as any);
  const pdf = await loadingTask.promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => ('str' in item ? String(item.str) : ''))
      .join(' ')
      .replace(/[ \t]+/g, ' ')
      .trim();
    parts.push(text);
  }
  return parts.join('\n');
}

export async function parseUpcomingInvoicePdf(file: File): Promise<ParsedInvoiceDraft> {
  const text = await extractPdfText(file);
  return parseUpcomingInvoiceText(text);
}
