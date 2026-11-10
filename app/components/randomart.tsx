/** The ssh-keygen picture of a key. Decorative for screen readers; the fingerprint carries the meaning. */
export function Randomart({ art, size = 'md' }: { art: string; size?: 'sm' | 'md' }) {
  return (
    <pre
      aria-hidden="true"
      className={`shrink-0 select-none text-faint leading-[1.18] ${size === 'sm' ? 'text-[7px]' : 'text-[11px]'}`}
    >
      {art}
    </pre>
  )
}
