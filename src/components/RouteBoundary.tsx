/* ============================================================
   Route error boundary.

   Lazy route chunks can fail to load — a flaky mobile connection, or a
   fresh deploy that has replaced the hashed chunk the open tab still points
   at. Without a boundary, that rejection (or any render error in a page)
   unmounts the whole tree and leaves a blank white screen when switching
   screens. This boundary catches it: a stale-chunk failure reloads the app
   once on its own, and anything else shows a recoverable error card with a
   retry that simply re-renders the route.
   ============================================================ */

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { Button } from './ui/primitives';

/** True for the "couldn't fetch the JS chunk" family of errors. */
function isChunkLoadError(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null;
  const name = e?.name ?? '';
  const msg = e?.message ?? '';
  return (
    name === 'ChunkLoadError' ||
    /loading chunk [\d]+ failed/i.test(msg) ||
    /loading css chunk/i.test(msg) ||
    /dynamically imported module/i.test(msg) ||
    /failed to fetch dynamically imported module/i.test(msg) ||
    /importing a module script failed/i.test(msg)
  );
}

const RELOAD_FLAG = 'transitpro.chunkReload';

interface Props {
  /** Changing this value clears a caught error — pass the active page key. */
  resetKey: string | number;
  children: ReactNode;
}

interface State {
  error: unknown;
}

class Boundary extends Component<Props & { fallback: (reset: () => void) => ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    /* Navigating to another screen should clear a previous failure. */
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error)) {
      /* Reload once to pull the fresh chunk manifest; guard against a loop. */
      let reloaded = false;
      try {
        reloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
        if (!reloaded) sessionStorage.setItem(RELOAD_FLAG, '1');
      } catch {
        /* storage blocked — fall through to the manual card */
      }
      if (!reloaded) {
        window.location.reload();
        return;
      }
    } else {
      /* A clean render clears the one-shot reload guard elsewhere; here we
         just make sure a non-chunk error never inherits a stale flag. */
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        /* ignore */
      }
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) return this.props.fallback(this.reset);
    return this.props.children;
  }
}

export function RouteBoundary({ resetKey, children }: Props) {
  return (
    <Boundary resetKey={resetKey} fallback={(reset) => <ErrorCard onRetry={reset} />}>
      {children}
    </Boundary>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-3xl border border-ink-200/80 bg-white p-8 text-center shadow-card">
      <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-amber-600">
        <AlertTriangle size={30} />
      </span>
      <h2 className="mt-4 text-lg font-bold text-ink-900">{t('pageLoadError')}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-ink-500">{t('pageLoadErrorHint')}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
        <Button icon={<RotateCcw size={16} />} onClick={onRetry}>
          {t('retry')}
        </Button>
        <Button
          variant="secondary"
          icon={<RefreshCw size={16} />}
          onClick={() => {
            try {
              sessionStorage.removeItem(RELOAD_FLAG);
            } catch {
              /* ignore */
            }
            window.location.reload();
          }}
        >
          {t('reloadPage')}
        </Button>
      </div>
    </div>
  );
}
