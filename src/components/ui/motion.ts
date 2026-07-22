/* ============================================================
   Shared motion tokens — one rhythm for the whole app.
   Durations follow the 150–300ms micro-interaction guideline;
   exits run ~65% of enter duration so dismissal feels snappy.
   ============================================================ */

import type { Transition, Variants } from 'framer-motion';

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN = [0.7, 0, 0.84, 0] as const;

export const spring: Transition = { type: 'spring', stiffness: 380, damping: 32, mass: 0.7 };
export const springSoft: Transition = { type: 'spring', stiffness: 260, damping: 30 };

/** Page-level enter/exit used by the route transition wrapper. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 14, filter: 'blur(4px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.34, ease: EASE_OUT, when: 'beforeChildren', staggerChildren: 0.04 },
  },
  exit: { opacity: 0, y: -10, filter: 'blur(4px)', transition: { duration: 0.2, ease: EASE_IN } },
};

/** Reduced-motion equivalent: cross-fade only. */
export const pageVariantsReduced: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, when: 'beforeChildren' } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/** Parent for staggered card grids / lists. */
export const listVariants: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
  exit: {},
};

export const itemVariants: Variants = {
  initial: { opacity: 0, y: 18, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.18, ease: EASE_IN } },
};

export const itemVariantsReduced: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.13 } },
};

/** Modal panel — scales from its trigger's direction (up from below). */
export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 24 },
  animate: { opacity: 1, scale: 1, y: 0, transition: spring },
  exit: { opacity: 0, scale: 0.97, y: 12, transition: { duration: 0.16, ease: EASE_IN } },
};

export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.22 } },
  exit: { opacity: 0, transition: { duration: 0.16 } },
};

/** Right/left drawer, direction-aware for RTL. */
export function drawerVariants(isRtl: boolean): Variants {
  const off = isRtl ? '-100%' : '100%';
  return {
    initial: { x: off, opacity: 0.6 },
    animate: { x: 0, opacity: 1, transition: spring },
    exit: { x: off, opacity: 0.6, transition: { duration: 0.2, ease: EASE_IN } },
  };
}

/** Collapsible section body. */
export const collapseVariants: Variants = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1, transition: { duration: 0.28, ease: EASE_OUT } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.18, ease: EASE_IN } },
};

/** Toast slides down from the top edge. */
export const toastVariants: Variants = {
  initial: { opacity: 0, y: -24, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1, transition: spring },
  exit: { opacity: 0, y: -16, scale: 0.96, transition: { duration: 0.18, ease: EASE_IN } },
};
