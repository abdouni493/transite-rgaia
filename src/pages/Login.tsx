import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  AtSign,
  CheckCircle2,
  FileSpreadsheet,
  KeyRound,
  ShieldCheck,
  User,
  UserPlus,
  Wallet,
  Ship,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useStore } from '../store/AppStore';
import { useToast } from '../components/ui/overlays';
import { Button, Input, PasswordInput } from '../components/ui/primitives';
import { LangSwitch } from '../components/layout/LangSwitch';
import type { TranslationKey } from '../i18n/translations';

type Mode = 'login' | 'register';

export function Login() {
  const { t, isRtl } = useI18n();
  const { login, registerAdmin } = useStore();
  const toast = useToast();
  const reduce = useReducedMotion();

  const [mode, setMode] = useState<Mode>('login');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [reg, setReg] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirm: '',
  });

  const switchMode = (m: Mode) => {
    setErrors({});
    setMode(m);
  };

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!identifier.trim()) errs.identifier = t('requiredField');
    if (!password) errs.password = t('requiredField');
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    const res = await login(identifier, password);
    setBusy(false);
    if (!res.ok) {
      setErrors({ form: t('invalidCredentials') });
      toast.error(t('invalidCredentials'));
    }
  };

  const onRegister = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!reg.name.trim()) errs.name = t('requiredField');
    if (!reg.username.trim()) errs.username = t('requiredField');
    if (!reg.email.trim()) errs.email = t('requiredField');
    if (reg.password.length < 6) errs.password = t('requiredField');
    if (reg.password !== reg.confirm) errs.confirm = t('passwordsDontMatch');
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    const res = await registerAdmin(reg);
    setBusy(false);

    if (!res.ok) {
      if (res.error === 'emailTaken') setErrors({ email: t('emailTaken') });
      else setErrors({ form: res.error ?? t('invalidCredentials') });
      return;
    }

    // Supabase signs the new administrator straight in — the store's auth
    // listener swaps the login screen for the dashboard on its own.
    toast.success(t('accountCreated'));
    setReg({ name: '', username: '', email: '', password: '', confirm: '' });
  };

  const features: { icon: typeof Ship; key: TranslationKey }[] = [
    { icon: Ship, key: 'loginFeature1' },
    { icon: Wallet, key: 'loginFeature2' },
    { icon: FileSpreadsheet, key: 'loginFeature3' },
  ];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-grad-brand-soft">
      {/* animated gradient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.span
          animate={reduce ? undefined : { y: [0, -30, 0], x: [0, 18, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -start-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-brand-400/25 blur-3xl"
        />
        <motion.span
          animate={reduce ? undefined : { y: [0, 34, 0], x: [0, -22, 0] }}
          transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -end-28 top-1/4 h-[30rem] w-[30rem] rounded-full bg-ocean-400/22 blur-3xl"
        />
        <motion.span
          animate={reduce ? undefined : { y: [0, -22, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-32 start-1/3 h-[24rem] w-[24rem] rounded-full bg-violet-400/16 blur-3xl"
        />
      </div>

      <div className="absolute end-4 top-4 z-20 sm:end-6 sm:top-6">
        <LangSwitch showIcon={false} />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-6xl items-center justify-center px-4 py-10 sm:px-6">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-16">
          {/* ---------- brand panel ---------- */}
          <motion.section
            initial={{ opacity: 0, x: reduce ? 0 : isRtl ? 40 : -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="hidden lg:block"
          >
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
              className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-grad-brand text-white shadow-float"
            >
              <ShieldCheck size={32} />
            </motion.span>

            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-ink-900 xl:text-5xl">
              <span className="gradient-text">TransitPro</span>
            </h1>
            <p className="mt-3 max-w-md text-lg font-medium text-ink-600">{t('appTagline')}</p>

            <ul className="mt-9 space-y-3.5">
              {features.map((f, i) => (
                <motion.li
                  key={f.key}
                  initial={{ opacity: 0, x: reduce ? 0 : isRtl ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.25 + i * 0.09 }}
                  className="flex items-center gap-3.5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 text-brand-600 shadow-card ring-1 ring-brand-100">
                    <f.icon size={19} />
                  </span>
                  <span className="text-[15px] font-semibold text-ink-700">{t(f.key)}</span>
                </motion.li>
              ))}
            </ul>
          </motion.section>

          {/* ---------- auth card ---------- */}
          <motion.section
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
            className="w-full"
          >
            <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-[0_30px_70px_-25px_rgb(15_23_42_/_0.25)] backdrop-blur-2xl">
              {/* mobile brand */}
              <div className="flex items-center gap-3 border-b border-ink-200/60 px-6 py-4 lg:hidden">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-grad-brand text-white shadow-float">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <p className="text-[15px] font-extrabold text-ink-900">TransitPro</p>
                  <p className="text-2xs font-semibold text-brand-600">{t('appTagline')}</p>
                </div>
              </div>

              <div className="px-6 py-7 sm:px-8">
                <AnimatePresence mode="wait">
                  {mode === 'login' ? (
                    <motion.div
                      key="login"
                      initial={{ opacity: 0, x: reduce ? 0 : isRtl ? -24 : 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: reduce ? 0 : isRtl ? 24 : -24 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">
                        {t('loginTitle')}
                      </h2>
                      <p className="mt-1.5 text-sm text-ink-500">{t('loginSubtitle')}</p>

                      <form onSubmit={onLogin} className="mt-6 space-y-4" noValidate>
                        <Input
                          label={t('identifier')}
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          error={errors.identifier}
                          icon={<User size={17} />}
                          autoComplete="username"
                          placeholder="demo"
                          required
                        />
                        <PasswordInput
                          label={t('password')}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          error={errors.password}
                          icon={<KeyRound size={17} />}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          showLabel={t('showPassword')}
                          hideLabel={t('hidePassword')}
                          required
                        />

                        <AnimatePresence>
                          {errors.form && (
                            <motion.p
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              role="alert"
                              className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] font-semibold text-rose-700 ring-1 ring-rose-200"
                            >
                              {errors.form}
                            </motion.p>
                          )}
                        </AnimatePresence>

                        <Button type="submit" size="lg" block loading={busy} icon={<KeyRound size={17} />}>
                          {t('signIn')}
                        </Button>
                      </form>

                      <p className="mt-6 text-center text-[13px] text-ink-500">
                        {t('noAccountYet')}{' '}
                        <button
                          type="button"
                          onClick={() => switchMode('register')}
                          className="cursor-pointer font-bold text-brand-700 underline-offset-2 hover:underline"
                        >
                          {t('createAdminAccount')}
                        </button>
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="register"
                      initial={{ opacity: 0, x: reduce ? 0 : isRtl ? -24 : 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: reduce ? 0 : isRtl ? 24 : -24 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <button
                        type="button"
                        onClick={() => switchMode('login')}
                        className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-bold text-ink-500 transition-colors hover:text-brand-700"
                      >
                        <ArrowLeft size={15} className={isRtl ? 'rotate-180' : ''} />
                        {t('backToLogin')}
                      </button>

                      <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">
                        {t('createAdminAccount')}
                      </h2>

                      <form onSubmit={onRegister} className="mt-5 space-y-3.5" noValidate>
                        <Input
                          label={t('fullName')}
                          value={reg.name}
                          onChange={(e) => setReg({ ...reg, name: e.target.value })}
                          error={errors.name}
                          icon={<User size={17} />}
                          autoComplete="name"
                          required
                        />
                        <Input
                          label={t('username')}
                          value={reg.username}
                          onChange={(e) => setReg({ ...reg, username: e.target.value })}
                          error={errors.username}
                          icon={<UserPlus size={17} />}
                          autoComplete="username"
                          required
                        />
                        <Input
                          label={t('email')}
                          type="email"
                          value={reg.email}
                          onChange={(e) => setReg({ ...reg, email: e.target.value })}
                          error={errors.email}
                          icon={<AtSign size={17} />}
                          autoComplete="email"
                          required
                        />
                        <div className="grid gap-3.5 sm:grid-cols-2">
                          <PasswordInput
                            label={t('password')}
                            value={reg.password}
                            onChange={(e) => setReg({ ...reg, password: e.target.value })}
                            error={errors.password}
                            autoComplete="new-password"
                            showLabel={t('showPassword')}
                            hideLabel={t('hidePassword')}
                            required
                          />
                          <PasswordInput
                            label={t('confirmPassword')}
                            value={reg.confirm}
                            onChange={(e) => setReg({ ...reg, confirm: e.target.value })}
                            error={errors.confirm}
                            autoComplete="new-password"
                            showLabel={t('showPassword')}
                            hideLabel={t('hidePassword')}
                            required
                          />
                        </div>

                        <Button
                          type="submit"
                          size="lg"
                          block
                          loading={busy}
                          icon={<CheckCircle2 size={17} />}
                          className="!mt-5"
                        >
                          {t('createAccount')}
                        </Button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
