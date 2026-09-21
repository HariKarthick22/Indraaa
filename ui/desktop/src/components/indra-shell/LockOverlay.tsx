import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useReducedMotion } from '../../indra/useReducedMotion';

export interface LockOverlayProps {
  open: boolean;
  mode: 'passphrase' | 'idp';
  attemptsRemaining: number;
  onUnlock: (secret: string) => void;
  children?: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export function LockOverlay({ open, mode, attemptsRemaining, onUnlock, children }: LockOverlayProps) {
  const reducedMotion = useReducedMotion();
  const [passphrase, setPassphrase] = useState('');
  const [shaking, setShaking] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const passphraseInputRef = useRef<HTMLInputElement | null>(null);
  const idpButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousAttemptsRef = useRef(attemptsRemaining);

  useEffect(() => {
    if (!open) return;
    if (mode === 'passphrase') passphraseInputRef.current?.focus();
    else idpButtonRef.current?.focus();
  }, [open, mode]);

  // A wrong attempt is inferred from the caller lowering `attemptsRemaining`
  // between renders — the component has no separate "that was wrong" signal,
  // and the spec's shake is a response to exactly that.
  useEffect(() => {
    if (open && attemptsRemaining < previousAttemptsRef.current && !reducedMotion) {
      setShaking(true);
    }
    previousAttemptsRef.current = attemptsRemaining;
  }, [attemptsRemaining, open, reducedMotion]);

  // Focus traps to the card: Tab and Shift+Tab cycle within it rather than
  // escaping to the workspace sealed behind the backdrop.
  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = focusableElements(dialogRef.current);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onUnlock(passphrase);
    setPassphrase('');
  }

  const locked = attemptsRemaining <= 0;

  return (
    <>
      {children}
      {open ? (
        <div
          className={reducedMotion ? undefined : 'indra-lock-backdrop'}
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(12px)',
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={mode === 'passphrase' ? 'Unlock INDRA' : 'Unlock with your identity provider'}
            onKeyDown={trapFocus}
            className={!reducedMotion && shaking ? 'indra-lock-shake' : undefined}
            onAnimationEnd={() => setShaking(false)}
            style={{
              width: 320,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-5)',
              padding: 'var(--space-7)',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-md)',
              boxShadow: 'var(--shadow-pop)',
              color: 'var(--text)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                fontSize: 'var(--t-16)',
                lineHeight: 'var(--t-16--line-height)',
                fontWeight: 600,
                color: 'var(--text-hi)',
              }}
            >
              <span aria-hidden="true">{'⛨'}</span>
              Sealed
            </span>

            {locked ? (
              <p
                role="alert"
                style={{
                  margin: 0,
                  display: 'flex',
                  gap: 'var(--space-3)',
                  borderLeftWidth: '2px',
                  borderLeftStyle: 'solid',
                  borderLeftColor: 'var(--blocked)',
                  paddingLeft: 'var(--space-4)',
                  fontSize: 'var(--t-13)',
                  lineHeight: 'var(--t-13--line-height)',
                }}
              >
                <span aria-hidden="true" style={{ color: 'var(--blocked)' }}>
                  {'▲'}
                </span>
                {/* Rather than pretending: the sealed key is dropped from memory
                    and the session returns to cold boot (spec §5.3). */}
                <span>No attempts remaining. The sealed key has been dropped — returning to cold boot.</span>
              </p>
            ) : (
              <>
                {mode === 'passphrase' ? (
                  <form
                    onSubmit={handleSubmit}
                    style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
                  >
                    <label
                      htmlFor="indra-lock-passphrase"
                      style={{
                        fontSize: 'var(--t-12)',
                        lineHeight: 'var(--t-12--line-height)',
                        color: 'var(--text-dim)',
                      }}
                    >
                      Passphrase
                    </label>
                    <input
                      id="indra-lock-passphrase"
                      ref={passphraseInputRef}
                      type="password"
                      value={passphrase}
                      onChange={(event) => setPassphrase(event.target.value)}
                      autoComplete="current-password"
                      className="indra-focusable"
                      style={{
                        height: 32,
                        padding: '0 var(--space-4)',
                        background: 'var(--bg)',
                        border: '1px solid var(--line-strong)',
                        borderRadius: 'var(--r-sm)',
                        color: 'var(--text-hi)',
                        caretColor: 'var(--focus)',
                        fontFamily: 'var(--font-ui)',
                        fontSize: 'var(--t-13)',
                        lineHeight: 'var(--t-13--line-height)',
                      }}
                    />
                    <button
                      type="submit"
                      className="indra-focusable"
                      style={{
                        height: 32,
                        padding: '0 var(--space-5)',
                        background: 'var(--raised)',
                        border: '1px solid var(--line-strong)',
                        borderRadius: 'var(--r-sm)',
                        color: 'var(--text-hi)',
                        fontFamily: 'var(--font-ui)',
                        fontSize: 'var(--t-13)',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Unlock
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    ref={idpButtonRef}
                    onClick={() => onUnlock('')}
                    className="indra-focusable"
                    style={{
                      height: 32,
                      padding: '0 var(--space-5)',
                      background: 'var(--raised)',
                      border: '1px solid var(--line-strong)',
                      borderRadius: 'var(--r-sm)',
                      color: 'var(--text-hi)',
                      fontFamily: 'var(--font-ui)',
                      fontSize: 'var(--t-13)',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Continue with identity provider
                  </button>
                )}

                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 'var(--t-12)',
                    lineHeight: 'var(--t-12--line-height)',
                    color: attemptsRemaining <= 1 ? 'var(--degraded)' : 'var(--text-dim)',
                  }}
                >
                  {`${attemptsRemaining} attempts remaining`}
                </span>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
