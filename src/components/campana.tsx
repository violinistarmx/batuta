import Link from "next/link";

/**
 * Campana de avisos en el encabezado. Lleva a la bandeja y muestra cuántos avisos
 * no se han leído. Cuando hay alguno, la campana se sacude una vez al cargar la
 * página (ver `.campana-sonar` en globals.css). Con «reducir movimiento» no se mueve.
 */
export function Campana({ sinLeer }: { sinLeer: number }) {
  const hay = sinLeer > 0;
  return (
    <Link
      href="/avisos"
      aria-label={hay ? `Avisos: ${sinLeer} sin leer` : "Avisos"}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-vs-tinta-2
                 no-underline transition hover:bg-vs-crema focus-visible:outline-2
                 focus-visible:outline-offset-2 focus-visible:outline-vs-naranja-700"
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={hay ? "campana-sonar" : undefined}
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {hay && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-vs-naranja px-1
                     text-center text-[10px] font-bold leading-[1.1rem] text-vs-tinta tabular-nums"
        >
          {sinLeer > 9 ? "9+" : sinLeer}
        </span>
      )}
    </Link>
  );
}
