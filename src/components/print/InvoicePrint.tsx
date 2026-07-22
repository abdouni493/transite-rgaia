/* ============================================================
   Printable invoice.

   Same masthead as every other document (logo + company block), then the
   billing party, the vehicle file, the priced lines, the totals recap and
   the signature block — which carries the electronic stamp from Paramètres.
   ============================================================ */

import { useMemo } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { useStore } from '../../store/AppStore';
import { fullName, invoiceTotals } from '../../lib/selectors';
import {
  formatDate,
  formatDeclarationNo,
  formatInvoiceNo,
  formatMoney,
  formatPercent,
} from '../../lib/format';
import type { Invoice } from '../../lib/types';
import { amountInWords } from '../../lib/amountInWords';
import { CUSTOMS_META } from '../shared';
import {
  HeroAmount,
  InfoCell,
  PrintDocument,
  PrintPreview,
  PrintSection,
  PrintSignatures,
  TotalCell,
} from './PrintDocument';

export function InvoicePrintDialog({
  invoice,
  onClose,
}: {
  invoice: Invoice | null;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const { state } = useStore();
  const fm = (n: number) => formatMoney(n, lang, t('currency'));

  const data = useMemo(() => {
    if (!invoice) return null;
    const client = state.secondaryClients.find((c) => c.id === invoice.secondaryClientId);
    return {
      client,
      principal: client
        ? state.principalClients.find((p) => p.id === client.principalClientId)
        : undefined,
      container: client ? state.containers.find((c) => c.id === client.containerId) : undefined,
      warehouse: client ? state.warehouses.find((w) => w.id === client.warehouseId) : undefined,
      totals: invoiceTotals(invoice.carPrice, invoice.lines),
    };
  }, [state, invoice]);

  if (!invoice || !data) return null;

  const no = formatInvoiceNo(invoice.invoiceNo);
  const { client, principal, container, warehouse, totals } = data;

  return (
    <PrintPreview
      open={!!invoice}
      onClose={onClose}
      heading={`${t('invoice')} ${no}`}
      subheading={`${client ? fullName(client) : '—'} · ${formatDate(invoice.date, lang)} · ${fm(totals.grandTotal)}`}
    >
      <PrintDocument
        title={t('invoicePrintTitle')}
        meta={[
          { label: t('invoiceNo'), value: no, mono: true, strong: true },
          { label: t('invoiceDate'), value: formatDate(invoice.date, lang) },
          {
            label: t('declarationNo'),
            value: client ? formatDeclarationNo(client.declarationNo) : '—',
            mono: true,
          },
        ]}
      >
        {/* ---------- who is billed ---------- */}
        <PrintSection title={t('billedTo')}>
          <div className="tp-box grid grid-cols-2 gap-x-4 gap-y-2.5 rounded p-3 sm:grid-cols-4">
            <InfoCell label={t('invoiceNo')} value={no} mono />
            <InfoCell label={t('invoiceDate')} value={formatDate(invoice.date, lang)} />
            <InfoCell
              label={t('declarationNo')}
              value={client ? formatDeclarationNo(client.declarationNo) : '—'}
              mono
            />
            <InfoCell label={t('recordedBy')} value={invoice.createdBy || '—'} />
            <InfoCell
              label={t('secondaryClient')}
              value={client ? fullName(client) : '—'}
            />
            <InfoCell label={t('phone')} value={client?.phone || '—'} />
            <InfoCell label={t('address')} value={client?.address || '—'} />
            <InfoCell
              label={t('principalClient')}
              value={principal ? fullName(principal) : '—'}
            />
          </div>
        </PrintSection>

        {/* ---------- the file this invoice covers ---------- */}
        <PrintSection title={t('vehicleAndFile')}>
          <div className="tp-box grid grid-cols-2 gap-x-4 gap-y-2.5 rounded p-3 sm:grid-cols-4">
            <InfoCell label={t('carBrand')} value={client?.car.brand || '—'} />
            <InfoCell label={t('carName')} value={client?.car.name || '—'} />
            <InfoCell label={t('chassisNumber')} value={client?.car.chassisNumber || '—'} mono />
            <InfoCell
              label={t('status')}
              value={client ? t(CUSTOMS_META[client.customsStatus].key) : '—'}
            />
            <InfoCell label={t('container')} value={container?.name ?? '—'} />
            <InfoCell label={t('tcNumber')} value={container?.tcNumber ?? '—'} mono />
            <InfoCell
              label={t('arrivalDate')}
              value={container?.arrivalDate ? formatDate(container.arrivalDate, lang) : '—'}
            />
            <InfoCell label={t('warehouse')} value={warehouse?.name ?? '—'} />
            {warehouse?.address && (
              <InfoCell label={t('address')} value={warehouse.address} />
            )}
          </div>
        </PrintSection>

        {/* ---------- the priced lines ---------- */}
        <PrintSection title={t('invoiceLines')}>
          <table>
            <thead>
              <tr>
                <th className="text-start">{t('designation')}</th>
                <th className="text-center" style={{ width: '7%' }}>
                  {t('qtyShort')}
                </th>
                <th className="text-end" style={{ width: '15%' }}>
                  {t('unitPrice')}
                </th>
                <th className="text-end" style={{ width: '15%' }}>
                  {t('amountHt')}
                </th>
                <th className="text-center" style={{ width: '9%' }}>
                  {t('tva')}
                </th>
                <th className="text-end" style={{ width: '15%' }}>
                  {t('tvaAmount')}
                </th>
                <th className="text-end" style={{ width: '16%' }}>
                  {t('amountTtc')}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* the vehicle itself — billed as agreed, no tax on it */}
              <tr>
                <td className="text-start font-bold">
                  {t('carAmount')}
                  {client && (
                    <span className="font-medium">
                      {' — '}
                      {client.car.brand} {client.car.name} · {client.car.chassisNumber}
                    </span>
                  )}
                </td>
                <td className="text-center tabular-nums">1</td>
                <td className="text-end tabular-nums">{fm(invoice.carPrice)}</td>
                <td className="text-end tabular-nums">{fm(invoice.carPrice)}</td>
                <td className="text-center tabular-nums">—</td>
                <td className="text-end tabular-nums">—</td>
                <td className="text-end font-bold tabular-nums">{fm(invoice.carPrice)}</td>
              </tr>

              {invoice.lines.map((l, i) => {
                const ht = l.amount * l.quantity;
                const tax = ht * (l.tva / 100);
                return (
                  <tr key={`${l.serviceId}-${i}`}>
                    <td className="text-start font-bold">{l.name}</td>
                    <td className="text-center tabular-nums">{l.quantity}</td>
                    <td className="text-end tabular-nums">{fm(l.amount)}</td>
                    <td className="text-end tabular-nums">{fm(ht)}</td>
                    <td className="text-center tabular-nums">{formatPercent(l.tva, lang)}</td>
                    <td className="text-end tabular-nums">{fm(tax)}</td>
                    <td className="text-end font-bold tabular-nums">{fm(ht + tax)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="text-start">
                  {t('grandTotal')}
                </td>
                <td className="text-end tabular-nums">
                  {fm(totals.carPrice + totals.servicesHt)}
                </td>
                <td className="text-center">—</td>
                <td className="text-end tabular-nums">{fm(totals.tva)}</td>
                <td className="text-end tabular-nums">{fm(totals.grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </PrintSection>

        {/* ---------- totals recap ---------- */}
        <PrintSection title={t('invoiceTotalsRecap')}>
          <div className="grid grid-cols-4 gap-3">
            <TotalCell label={t('totalServicesHt')} value={fm(totals.servicesHt)} />
            <TotalCell label={t('totalTva')} value={fm(totals.tva)} />
            <TotalCell label={t('totalServicesTtc')} value={fm(totals.servicesTtc)} />
            <TotalCell label={t('carAmount')} value={fm(totals.carPrice)} />
          </div>
        </PrintSection>

        <HeroAmount
          label={t('netToPayInvoice')}
          value={fm(totals.grandTotal)}
          words={amountInWords(totals.grandTotal, lang, t('currency'))}
          wordsLabel={t('amountInWords')}
        />

        {invoice.notes && (
          <PrintSection title={t('invoiceNotes')}>
            <p className="tp-box rounded p-3 text-[11px] leading-relaxed">{invoice.notes}</p>
          </PrintSection>
        )}

        <p className="text-[10px] font-medium italic text-ink-500">{t('thankYouNote')}</p>

        <PrintSignatures />
      </PrintDocument>
    </PrintPreview>
  );
}
