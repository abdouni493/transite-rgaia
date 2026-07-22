/* ============================================================
   Create / edit form for a billable service.

   Shared by the Services catalogue page and the invoice wizard, where a
   service can be corrected inline while it is being added to a bill.
   ============================================================ */

import { useState, type FormEvent } from 'react';
import { Plus, ReceiptText, Wrench } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { formatMoney } from '../lib/format';
import type { Service } from '../lib/types';
import { Button, Input, Textarea } from './ui/primitives';
import { Modal } from './ui/overlays';

const EMPTY_FORM = { name: '', amount: '', tva: '', description: '' };

export function ServiceForm({
  open,
  editing,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: Service | null;
  onClose: () => void;
  onSave: (data: Omit<Service, 'id' | 'createdAt'>) => void;
}) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [seed, setSeed] = useState<string | null>(null);

  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);

  const target = editing?.id ?? (open ? '__new__' : null);
  if (target !== seed) {
    setSeed(target);
    setErrors({});
    setForm(
      editing
        ? {
            name: editing.name,
            amount: String(editing.amount),
            tva: String(editing.tva),
            description: editing.description,
          }
        : EMPTY_FORM,
    );
  }

  const amount = Number(form.amount.replace(/\s/g, ''));
  const tva = Number(form.tva.replace(/\s/g, '')) || 0;
  const preview = Number.isNaN(amount) ? 0 : amount * (1 + tva / 100);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('requiredField');
    if (!form.amount.trim() || Number.isNaN(amount) || amount < 0) errs.amount = t('invalidNumber');
    if (form.tva.trim() && (Number.isNaN(tva) || tva < 0 || tva > 100)) errs.tva = t('invalidNumber');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({
      name: form.name.trim(),
      amount,
      tva,
      description: form.description.trim(),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('editService') : t('newService')}
      subtitle={t('servicesSubtitle')}
      icon={<Wrench size={20} />}
      size="md"
      footer={
        <div className="flex gap-2.5">
          <Button variant="secondary" block onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button block onClick={submit} icon={<Plus size={16} />}>
            {editing ? t('saveChanges') : t('create')}
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input
          label={t('serviceName')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
          icon={<Wrench size={16} />}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('serviceAmount')}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            error={errors.amount}
            suffix={cur}
            required
          />
          <Input
            label={t('tvaPercent')}
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.01"
            value={form.tva}
            onChange={(e) => setForm({ ...form, tva: e.target.value })}
            error={errors.tva}
            suffix="%"
            placeholder="19"
          />
        </div>

        {/* live TTC readout, so the price is never a surprise on the invoice */}
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-grad-brand-soft px-4 py-3 ring-1 ring-brand-100">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand-700">
            <ReceiptText size={15} />
            {t('amountTtc')}
          </span>
          <span className="text-base font-extrabold tabular-nums text-brand-800">
            {fm(preview)}
          </span>
        </div>

        <Textarea
          label={`${t('description')} (${t('optional')})`}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
        />
      </form>
    </Modal>
  );
}
