import Link from "next/link";

/**
 * Página para las direcciones que no existen. Sustituye la de Next (en inglés y con fondo blanco
 * fijo) por una con el diseño de Batuta, que funciona en los dos temas.
 */
export default function NoEncontrada() {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 py-16 text-center">
      <div className="w-full rounded-2xl border border-vs-linea bg-white/85 p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-vs-tinta-3">Error 404</p>
        <h1 className="font-display mt-2 text-2xl font-semibold text-vs-tinta">Esta página no existe</h1>
        <p className="mt-2 text-sm text-vs-tinta-2">
          Puede que el enlace esté mal escrito o que lo que buscas se haya movido.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg bg-vs-naranja px-5 py-2.5 text-sm font-semibold text-vs-tinta
                     transition hover:bg-vs-naranja-claro focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-vs-naranja-700"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
