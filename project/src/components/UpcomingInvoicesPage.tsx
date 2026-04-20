import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Save } from 'lucide-react';
import { Product, UpcomingInvoice } from '../types';
import {
  createUpcomingInvoice,
  getUpcomingInvoiceByReference,
  getUpcomingInvoices
} from '../lib/supabase';
import {
  parseUpcomingInvoicePdf,
  parseUpcomingInvoiceText,
  ParsedInvoiceDraft,
  ParsedInvoiceLineDraft
} from '../utils/upcomingInvoiceParser';
import { formatDate } from '../utils/stockUtils';
import { PageHeader } from './shared/PageLayout';

interface UpcomingInvoicesPageProps {
  products: Product[];
  onBack: () => void;
  onSaved?: () => Promise<void> | void;
}

type DraftLineWithMatch = ParsedInvoiceLineDraft & {
  matched_product_id: string | null;
  match_status: 'matched' | 'unmatched' | 'manual';
};

function matchProduct(
  line: ParsedInvoiceLineDraft,
  products: Product[]
): { matched_product_id: string | null; match_status: DraftLineWithMatch['match_status'] } {
  const byCode = products.find((p) => p.code?.trim().toUpperCase() === line.product_code.trim().toUpperCase());
  if (byCode) return { matched_product_id: byCode.id, match_status: 'matched' };

  const byItem = products.find(
    (p) => p.item_number?.trim().toUpperCase() === line.product_code.trim().toUpperCase()
  );
  if (byItem) return { matched_product_id: byItem.id, match_status: 'matched' };

  const name = line.product_name.trim().toLowerCase();
  if (!name) return { matched_product_id: null, match_status: 'unmatched' };
  const byName = products.find((p) => p.commercial_name.trim().toLowerCase() === name);
  if (byName) return { matched_product_id: byName.id, match_status: 'manual' };
  return { matched_product_id: null, match_status: 'unmatched' };
}

export const UpcomingInvoicesPage: React.FC<UpcomingInvoicesPageProps> = ({ products, onBack, onSaved }) => {
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [existingInvoices, setExistingInvoices] = useState<UpcomingInvoice[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ParsedInvoiceDraft | null>(null);
  const [draftLines, setDraftLines] = useState<DraftLineWithMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [manualRawText, setManualRawText] = useState('');

  const loadInvoices = async () => {
    setLoadingInvoices(true);
    setError(null);
    try {
      const data = await getUpcomingInvoices();
      setExistingInvoices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load upcoming invoices.');
    } finally {
      setLoadingInvoices(false);
    }
  };

  React.useEffect(() => {
    void loadInvoices();
  }, []);

  const applyDraft = (nextDraft: ParsedInvoiceDraft) => {
    setDraft(nextDraft);
    setDraftLines(
      nextDraft.lines.map((line) => ({
        ...line,
        ...matchProduct(line, products)
      }))
    );
    setInfo(`Parsed ${nextDraft.lines.length} lines from invoice ${nextDraft.reference}.`);
  };

  const handleFileUpload = async (file: File) => {
    setParsing(true);
    setError(null);
    setInfo(null);
    try {
      const parsed = await parseUpcomingInvoicePdf(file);
      applyDraft(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse PDF.');
    } finally {
      setParsing(false);
    }
  };

  const matchedCount = useMemo(
    () => draftLines.filter((l) => l.match_status === 'matched' || l.match_status === 'manual').length,
    [draftLines]
  );
  const unmatchedCount = draftLines.length - matchedCount;

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const existing = await getUpcomingInvoiceByReference(draft.reference);
      if (existing) {
        setError(`Invoice reference ${draft.reference} already exists. Update the reference before saving.`);
        setSaving(false);
        return;
      }

      await createUpcomingInvoice(
        {
          reference: draft.reference,
          order_number: draft.order_number,
          info_label: draft.info_label,
          invoice_date: draft.invoice_date,
          shipping_date: draft.shipping_date,
          expected_arrival_date: draft.expected_arrival_date,
          delivery_mode: draft.delivery_mode,
          carrier: draft.carrier,
          payment_terms: draft.payment_terms,
          currency: draft.currency ?? 'EUR',
          total_net_weight_kg: draft.total_net_weight_kg,
          total_amount_eur: draft.total_amount_eur,
          source_file_name: null,
          raw_text: draft.raw_text
        },
        draftLines.map((line) => ({
          line_no: line.line_no,
          product_code: line.product_code,
          product_name: line.product_name,
          qty_kg: line.qty_kg,
          price_per_kg_eur: line.price_per_kg_eur,
          amount_eur: line.amount_eur,
          customer_ref: line.customer_ref,
          matched_product_id: line.matched_product_id,
          match_status: line.match_status,
          notes: line.notes
        }))
      );

      setInfo('Upcoming invoice saved successfully.');
      setDraft(null);
      setDraftLines([]);
      await loadInvoices();
      await onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save upcoming invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upcoming invoices"
        subtitle="Upload supplier invoice PDF, review extracted rows, then save incoming stock lines."
        onBack={onBack}
      />

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 cursor-pointer hover:bg-blue-100">
            <FileUp className="w-4 h-4" />
            <span className="text-sm font-medium">Upload invoice PDF</span>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileUpload(file);
              }}
            />
          </label>
          {parsing && (
            <span className="inline-flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Parsing PDF...
            </span>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Optional fallback: paste invoice text and parse
          </label>
          <textarea
            value={manualRawText}
            onChange={(e) => setManualRawText(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Paste raw invoice text if PDF extraction fails..."
          />
          <button
            type="button"
            onClick={() => {
              if (!manualRawText.trim()) return;
              applyDraft(parseUpcomingInvoiceText(manualRawText));
            }}
            className="mt-2 px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            Parse pasted text
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
        )}
        {info && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2 text-sm">
            {info}
          </div>
        )}
      </div>

      {draft && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-gray-600">Reference</span>
              <input
                value={draft.reference}
                onChange={(e) => setDraft({ ...draft, reference: e.target.value.trim() })}
                className="rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-600">Expected arrival date</span>
              <input
                type="date"
                value={draft.expected_arrival_date ?? ''}
                onChange={(e) => setDraft({ ...draft, expected_arrival_date: e.target.value || null })}
                className="rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Matched {matchedCount}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5" />
              Unmatched {unmatchedCount}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-2 py-2">Code</th>
                  <th className="text-left px-2 py-2">Name</th>
                  <th className="text-right px-2 py-2">Qty (kg)</th>
                  <th className="text-left px-2 py-2">Matched Product</th>
                </tr>
              </thead>
              <tbody>
                {draftLines.map((line, idx) => (
                  <tr key={`${line.product_code}-${idx}`} className="border-t border-gray-100">
                    <td className="px-2 py-2">{line.product_code}</td>
                    <td className="px-2 py-2">{line.product_name}</td>
                    <td className="px-2 py-2 text-right">{line.qty_kg.toFixed(2)}</td>
                    <td className="px-2 py-2">
                      <select
                        value={line.matched_product_id ?? ''}
                        onChange={(e) => {
                          const value = e.target.value || null;
                          setDraftLines((prev) =>
                            prev.map((it, i) =>
                              i === idx
                                ? {
                                    ...it,
                                    matched_product_id: value,
                                    match_status: value ? 'manual' : 'unmatched'
                                  }
                                : it
                            )
                          );
                        }}
                        className="w-full rounded border border-gray-300 px-2 py-1"
                      >
                        <option value="">Unmatched</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} - {p.commercial_name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !draft.reference || draftLines.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save upcoming invoice
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Saved upcoming invoices</h3>
          <button
            type="button"
            onClick={() => void loadInvoices()}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
            disabled={loadingInvoices}
          >
            Refresh
          </button>
        </div>
        {loadingInvoices ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : existingInvoices.length === 0 ? (
          <p className="text-sm text-gray-500">No upcoming invoices saved yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b border-gray-200">
                  <th className="py-2">Reference</th>
                  <th className="py-2">Arrival</th>
                  <th className="py-2 text-right">Net Weight (kg)</th>
                  <th className="py-2 text-right">Lines</th>
                </tr>
              </thead>
              <tbody>
                {existingInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-100">
                    <td className="py-2">{inv.reference}</td>
                    <td className="py-2">
                      {inv.expected_arrival_date ? formatDate(inv.expected_arrival_date) : '—'}
                    </td>
                    <td className="py-2 text-right">{inv.total_net_weight_kg?.toFixed(2) ?? '—'}</td>
                    <td className="py-2 text-right">{inv.lines?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
