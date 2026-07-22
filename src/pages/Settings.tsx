import { AnimatePresence, motion } from 'framer-motion';
import { useRef, useState } from 'react';
import {
  Building2,
  Database,
  Download,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Landmark,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  ShieldAlert,
  Trash2,
  Upload,
  UserCog,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useStore } from '../store/AppStore';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Input,
  PasswordInput,
  SectionTitle,
  StaggerItem,
  StaggerList,
  Textarea,
} from '../components/ui/primitives';
import { Tabs, useConfirm, useToast } from '../components/ui/overlays';
import { PageHeader } from '../components/shared';
import type { TabDef } from '../components/ui/overlays';

const MAX_LOGO_BYTES = 1024 * 1024;

export function Settings() {
  const { t } = useI18n();
  const { can } = useStore();

  const tabs: TabDef[] = [
    ...(can('settings', 'company')
      ? [{ key: 'company', label: t('companyInfo'), icon: <Building2 size={15} /> }]
      : []),
    ...(can('settings', 'account')
      ? [{ key: 'account', label: t('accountInfo'), icon: <UserCog size={15} /> }]
      : []),
    ...(can('settings', 'backup') || can('settings', 'restore')
      ? [{ key: 'database', label: t('database'), icon: <Database size={15} /> }]
      : []),
  ];

  const [tab, setTab] = useState(tabs[0]?.key ?? 'company');

  return (
    <div>
      <PageHeader
        icon={<SettingsIcon size={24} />}
        title={t('settings')}
        subtitle={t('settingsSubtitle')}
      />

      {tabs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShieldAlert size={28} />}
            title={t('accessDenied')}
            hint={t('accessDeniedHint')}
          />
        </Card>
      ) : (
        <>
          <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-5" />
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            >
              {tab === 'company' && <CompanyPanel />}
              {tab === 'account' && <AccountPanel />}
              {tab === 'database' && <DatabasePanel />}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

/* ============================================================
   1 — Company
   ============================================================ */

function CompanyPanel() {
  const { t } = useI18n();
  const { state, updateCompany } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: state.company.name,
    description: state.company.description,
    email: state.company.email,
    phone: state.company.phone,
    address: state.company.address,
    nif: state.company.nif,
    nis: state.company.nis,
    article: state.company.article,
    rc: state.company.rc,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onPick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(t('logoHint'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateCompany({ logo: String(reader.result) });
      toast.success(t('settingsSaved'));
    };
    reader.readAsDataURL(file);
  };

  const save = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('requiredField');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    updateCompany({
      name: form.name.trim(),
      description: form.description.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      nif: form.nif.trim(),
      nis: form.nis.trim(),
      article: form.article.trim(),
      rc: form.rc.trim(),
    });
    toast.success(t('settingsSaved'));
  };

  return (
    <div className="space-y-4">
      {/* logo */}
      <Card className="p-4 sm:p-5">
        <SectionTitle
          icon={<ImageIcon size={17} />}
          title={t('logo')}
          subtitle={t('logoHint')}
          className="mb-4"
        />
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          {state.company.logo ? (
            <img
              src={state.company.logo}
              alt={state.company.name}
              className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-2 ring-ink-200"
            />
          ) : (
            <Avatar name={state.company.name || 'TP'} size="xl" gradient="from-brand-800 to-ocean-400" />
          )}
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                onPick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button
              variant="secondary"
              icon={<Upload size={16} />}
              onClick={() => fileRef.current?.click()}
            >
              {t('uploadLogo')}
            </Button>
            {state.company.logo && (
              <Button
                variant="ghost"
                icon={<Trash2 size={16} />}
                onClick={() => {
                  updateCompany({ logo: undefined });
                  toast.success(t('removeLogo'));
                }}
                className="!text-rose-600 hover:!bg-rose-50"
              >
                {t('removeLogo')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* identity */}
      <Card className="p-4 sm:p-5">
        <SectionTitle
          icon={<Building2 size={17} />}
          title={t('companyInfo')}
          subtitle={t('settingsSubtitle')}
          className="mb-4"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('companyName')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
            icon={<Building2 size={16} />}
            wrapClassName="sm:col-span-2"
            required
          />
          <div className="sm:col-span-2">
            <Textarea
              label={t('companyDescription')}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>
          <Input
            label={t('email')}
            type="email"
            dir="ltr"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            icon={<Mail size={16} />}
          />
          <Input
            label={t('phone')}
            type="tel"
            dir="ltr"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            icon={<Phone size={16} />}
          />
          <div className="sm:col-span-2">
            <Textarea
              label={t('address')}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              rows={2}
            />
          </div>
        </div>
      </Card>

      {/* legal */}
      <Card className="p-4 sm:p-5">
        <SectionTitle icon={<Landmark size={17} />} title={t('information')} className="mb-4" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('nif')}
            dir="ltr"
            value={form.nif}
            onChange={(e) => setForm({ ...form, nif: e.target.value })}
            icon={<FileText size={16} />}
          />
          <Input
            label={t('nis')}
            dir="ltr"
            value={form.nis}
            onChange={(e) => setForm({ ...form, nis: e.target.value })}
            icon={<FileText size={16} />}
          />
          <Input
            label={t('articleNumber')}
            dir="ltr"
            value={form.article}
            onChange={(e) => setForm({ ...form, article: e.target.value })}
            icon={<FileText size={16} />}
          />
          <Input
            label={t('rc')}
            dir="ltr"
            value={form.rc}
            onChange={(e) => setForm({ ...form, rc: e.target.value })}
            icon={<MapPin size={16} />}
          />
        </div>
        <div className="mt-4 flex justify-end border-t border-ink-100 pt-4">
          <Button icon={<Save size={16} />} onClick={save}>
            {t('saveChanges')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   2 — Account
   ============================================================ */

function AccountPanel() {
  const { t } = useI18n();
  const { state, session, updateOwnAccount } = useStore();
  const toast = useToast();

  const storedPassword =
    session?.kind === 'admin'
      ? (state.admins.find((a) => a.id === session.id)?.password ?? '')
      : (state.workers.find((w) => w.id === session?.id)?.account.password ?? '');

  const [profile, setProfile] = useState({
    name: session?.name ?? '',
    username: session?.username ?? '',
    email: session?.email ?? '',
  });
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!session) return null;

  const saveProfile = () => {
    const errs: Record<string, string> = {};
    if (!profile.name.trim()) errs.name = t('requiredField');
    if (!profile.username.trim()) errs.username = t('requiredField');
    if (!profile.email.trim()) errs.email = t('requiredField');
    setErrors((e) => ({ ...e, ...errs, name: errs.name ?? '', username: errs.username ?? '', email: errs.email ?? '' }));
    if (Object.values(errs).some(Boolean)) return;
    updateOwnAccount({
      name: profile.name.trim(),
      username: profile.username.trim(),
      email: profile.email.trim(),
    });
    toast.success(t('settingsSaved'));
  };

  const savePassword = () => {
    const errs: Record<string, string> = {};
    if (!pwd.current) errs.current = t('requiredField');
    else if (pwd.current !== storedPassword) errs.current = t('wrongPassword');
    if (!pwd.next) errs.next = t('requiredField');
    if (pwd.next !== pwd.confirm) errs.confirm = t('passwordsDontMatch');
    setErrors((e) => ({ ...e, current: errs.current ?? '', next: errs.next ?? '', confirm: errs.confirm ?? '' }));
    if (Object.values(errs).some(Boolean)) return;
    updateOwnAccount({ password: pwd.next });
    setPwd({ current: '', next: '', confirm: '' });
    toast.success(t('passwordChanged'));
  };

  return (
    <StaggerList className="grid gap-4 lg:grid-cols-2">
      <StaggerItem className="lg:col-span-2">
        <Card className="flex flex-wrap items-center gap-4 bg-grad-brand-soft p-4 sm:p-5">
          <Avatar name={session.name} size="lg" gradient="from-brand-800 to-ocean-400" />
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold text-ink-900">{session.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-500">
              <span className="chip bg-white text-brand-700 ring-1 ring-brand-200">
                {session.roleName}
              </span>
              <span dir="ltr" className="truncate">
                {session.email}
              </span>
            </p>
          </div>
        </Card>
      </StaggerItem>

      <StaggerItem>
        <Card className="h-full p-4 sm:p-5">
          <SectionTitle icon={<UserCog size={17} />} title={t('accountInfo')} className="mb-4" />
          <div className="space-y-4">
            <Input
              label={t('fullName')}
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              error={errors.name || undefined}
              required
            />
            <Input
              label={t('username')}
              dir="ltr"
              value={profile.username}
              onChange={(e) => setProfile({ ...profile, username: e.target.value })}
              error={errors.username || undefined}
              required
            />
            <Input
              label={t('email')}
              type="email"
              dir="ltr"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              error={errors.email || undefined}
              icon={<Mail size={16} />}
              required
            />
          </div>
          <div className="mt-4 flex justify-end border-t border-ink-100 pt-4">
            <Button icon={<Save size={16} />} onClick={saveProfile}>
              {t('saveChanges')}
            </Button>
          </div>
        </Card>
      </StaggerItem>

      <StaggerItem>
        <Card className="h-full p-4 sm:p-5">
          <SectionTitle
            icon={<KeyRound size={17} />}
            title={t('accountSecurity')}
            subtitle={t('leaveBlankHint')}
            className="mb-4"
          />
          <div className="space-y-4">
            <PasswordInput
              label={t('currentPassword')}
              value={pwd.current}
              onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
              error={errors.current || undefined}
              showLabel={t('showPassword')}
              hideLabel={t('hidePassword')}
            />
            <PasswordInput
              label={t('newPassword')}
              value={pwd.next}
              onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
              error={errors.next || undefined}
              showLabel={t('showPassword')}
              hideLabel={t('hidePassword')}
            />
            <PasswordInput
              label={t('confirmPassword')}
              value={pwd.confirm}
              onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
              error={errors.confirm || undefined}
              showLabel={t('showPassword')}
              hideLabel={t('hidePassword')}
            />
          </div>
          <div className="mt-4 flex justify-end border-t border-ink-100 pt-4">
            <Button icon={<KeyRound size={16} />} onClick={savePassword}>
              {t('changePassword')}
            </Button>
          </div>
        </Card>
      </StaggerItem>
    </StaggerList>
  );
}

/* ============================================================
   3 — Database
   ============================================================ */

function DatabasePanel() {
  const { t } = useI18n();
  const { can, exportBackup, importBackup, refresh } = useStore();
  const confirm = useConfirm();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const doExport = () => {
    exportBackup();
    toast.success(t('backupDone'));
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    const ok = await confirm({
      title: t('restore'),
      message: t('restoreConfirm'),
      confirmLabel: t('restore'),
      tone: 'danger',
      icon: <Upload size={26} />,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const text = await file.text();
      if (await importBackup(text)) toast.success(t('restoreDone'));
      else toast.error(t('restoreFailed'));
    } catch {
      toast.error(t('restoreFailed'));
    } finally {
      setBusy(false);
    }
  };

  const doReload = async () => {
    setBusy(true);
    await refresh();
    setBusy(false);
    toast.success(t('dataReloaded'));
  };

  return (
    <div className="space-y-4">
      <StaggerList className="grid gap-4 lg:grid-cols-2">
        {can('settings', 'backup') && (
          <StaggerItem>
            <Card className="flex h-full flex-col p-4 sm:p-5">
              <SectionTitle
                icon={<Download size={17} />}
                title={t('backup')}
                subtitle={t('backupHint')}
                className="mb-4"
              />
              <div className="mt-auto flex justify-end">
                <Button icon={<Download size={16} />} onClick={doExport}>
                  {t('downloadBackup')}
                </Button>
              </div>
            </Card>
          </StaggerItem>
        )}

        {can('settings', 'restore') && (
          <StaggerItem>
            <Card className="flex h-full flex-col p-4 sm:p-5">
              <SectionTitle
                icon={<Upload size={17} />}
                title={t('restore')}
                subtitle={t('restoreHint')}
                className="mb-4"
              />
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  void doImport(f);
                }}
              />
              <div className="mt-auto flex justify-end">
                <Button
                  variant="secondary"
                  icon={<Upload size={16} />}
                  loading={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {t('importBackup')}
                </Button>
              </div>
            </Card>
          </StaggerItem>
        )}
      </StaggerList>

      <Card className="p-4 sm:p-5">
        <SectionTitle
          icon={<ShieldAlert size={17} />}
          title={t('syncTitle')}
          subtitle={t('syncHint')}
          className="mb-4"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-ink-50/70 p-3.5">
          <p className="min-w-0 flex-1 text-xs font-semibold text-ink-600">{t('syncHint')}</p>
          <Button
            variant="secondary"
            icon={<RefreshCw size={16} />}
            loading={busy}
            onClick={doReload}
          >
            {t('reloadData')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
