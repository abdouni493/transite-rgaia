/* ============================================================
   Printable delivery receipt — "Accusé de réception".

   Printed once a vehicle's clearance file reaches "Remis au client":
   it states, on the company letterhead, that the secondary client took
   delivery of the vehicle. It carries the full client file, the vehicle
   and its container/warehouse, an acknowledgment statement, and the
   signature block — which prints the electronic stamp from Paramètres.
   ============================================================ */

import { useMemo } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { useStore } from '../../store/AppStore';
import { fullName } from '../../lib/selectors';
import { formatDate, formatDeclarationNo, formatMoney, todayISO } from '../../lib/format';
import type { SecondaryClient } from '../../lib/types';
import { CUSTOMS_META } from '../shared';
import {
  InfoCell,
  PrintDocument,
  PrintPreview,
  PrintSection,
  PrintSignatures,
} from './PrintDocument';

export function DeliveryReceiptDialog({
  car,
  onClose,
}: {
  car: SecondaryClient | null;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const { state } = useStore();
  const fm = (n: number) => formatMoney(n, lang, t('currency'));

  const data = useMemo(() => {
    if (!car) return null;
    return {
      principal: state.principalClients.find((p) => p.id === car.principalClientId),
      container: state.containers.find((c) => c.id === car.containerId),
      warehouse: state.warehouses.find((w) => w.id === car.warehouseId),
    };
  }, [state, car]);

  if (!car || !data) return null;

  const { principal, container, warehouse } = data;
  const decl = formatDeclarationNo(car.declarationNo);
  const today = formatDate(todayISO(), lang);
  const company = state.company.name || t('appName');

  return (
    <PrintPreview
      open={!!car}
      onClose={onClose}
      heading={t('deliveryReceipt')}
      subheading={`${fullName(car)} · ${decl} · ${today}`}
    >
      <PrintDocument
        title={t('deliveryReceiptTitle')}
        reference={`${car.car.brand} ${car.car.name} · ${car.car.chassisNumber}`}
        meta={[
          { label: t('declarationNo'), value: decl, mono: true, strong: true },
          { label: t('deliveryDate'), value: today },
        ]}
      >
        {/* ---------- who took delivery ---------- */}
        <PrintSection title={t('deliveredTo')}>
          <div className="tp-box grid grid-cols-2 gap-x-4 gap-y-2.5 rounded p-3 sm:grid-cols-4">
            <InfoCell label={t('declarationNo')} value={decl} mono />
            <InfoCell label={t('secondaryClient')} value={fullName(car)} />
            <InfoCell label={t('phone')} value={car.phone || '—'} />
            <InfoCell label={t('address')} value={car.address || '—'} />
            <InfoCell
              label={t('principalClient')}
              value={principal ? fullName(principal) : '—'}
            />
          </div>
        </PrintSection>

        {/* ---------- the vehicle & its file ---------- */}
        <PrintSection title={t('vehicleAndFile')}>
          <div className="tp-box grid grid-cols-2 gap-x-4 gap-y-2.5 rounded p-3 sm:grid-cols-4">
            <InfoCell label={t('carBrand')} value={car.car.brand || '—'} />
            <InfoCell label={t('carName')} value={car.car.name || '—'} />
            <InfoCell label={t('chassisNumber')} value={car.car.chassisNumber || '—'} mono />
            <InfoCell label={t('status')} value={t(CUSTOMS_META[car.customsStatus].key)} />
            <InfoCell label={t('container')} value={container?.name ?? '—'} />
            <InfoCell label={t('tcNumber')} value={container?.tcNumber ?? '—'} mono />
            <InfoCell
              label={t('arrivalDate')}
              value={container?.arrivalDate ? formatDate(container.arrivalDate, lang) : '—'}
            />
            <InfoCell label={t('warehouse')} value={warehouse?.name ?? '—'} />
            <InfoCell label={t('price')} value={fm(car.price)} />
          </div>
        </PrintSection>

        {/* ---------- acknowledgment ---------- */}
        <PrintSection title={t('deliveryAckSection')}>
          <p className="tp-box rounded p-3 text-[11px] leading-relaxed">
            {t('deliveryAckStatement', { name: fullName(car), company })}
          </p>
        </PrintSection>

        <PrintSignatures />
      </PrintDocument>
    </PrintPreview>
  );
}
