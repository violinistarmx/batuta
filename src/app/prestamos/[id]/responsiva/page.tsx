import { notFound } from "next/navigation";

import { db } from "@/db";
import { configuracion } from "@/db/schema/index";
import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { tutoresDe } from "@/lib/datos/alumnos";
import { prestamoPorId } from "@/lib/datos/inventario";
import { NOMBRE_CONDICION, type Condicion } from "@/lib/dominio/inventario";
import { BarraCredencial } from "@/app/alumnos/[id]/credencial/cliente";

export const dynamic = "force-dynamic";

const MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Responsiva del préstamo. Cláusula 9ª.
 *
 * Mismo armazón que la nota de remisión y la credencial —caja, franja, impresión
 * por navegador— porque son documentos de la misma casa. Lo único propio es el
 * cuerpo: qué instrumento salió, en qué estado, hasta cuándo y quién responde.
 *
 * El documento dice explícitamente que no hay depósito en garantía y que un daño
 * no genera cargo automático. Callarlo dejaría a la familia suponiendo lo
 * contrario, que es como nacen los malentendidos que terminan en el mostrador.
 */
export default async function Responsiva({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("inventario.gestionar");
  const { id } = await params;

  const prestamoId = Number(id);
  if (!Number.isInteger(prestamoId)) notFound();

  const p = prestamoPorId(prestamoId);
  if (!p) notFound();

  const cfg = Object.fromEntries(
    db.select().from(configuracion).all().map((c) => [c.clave, c.valor]),
  );
  const tutor = tutoresDe(p.alumnoId)[0] ?? null;

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "inventario.prestar",
    entidad: "prestamos",
    entidadId: p.id,
    cambios: { responsiva: "impresa" },
  });

  const [anio = 0, mes = 1, dia = 1] = p.entregadoEl.split("-").map(Number);

  return (
    <>
      <div className="no-imprimir">
        <Encabezado sesion={sesion} activo="inventario" />
      </div>

      <BarraCredencial volverA={`/inventario/${p.ejemplarId}`} volverTexto="Volver al inventario" />

      <main className="recibo">
        <header className="recibo-cabeza">
          <div>
            <h1 className="recibo-titulo">RESPONSIVA<br />DE PRÉSTAMO</h1>
            <p id="responsiva-folio" className="recibo-folio">{p.codigo}</p>
          </div>
          <div className="recibo-fecha">
            <span className="recibo-fecha-rotulo">FECHA</span>
            <span className="recibo-fecha-valor">
              {String(dia).padStart(2, "0")} / {String(mes).padStart(2, "0")} / {anio}
            </span>
          </div>
        </header>

        <section className="recibo-datos">
          <p><span>ALUMNO</span> {p.alumno} <em>· {p.alumnoCodigo}</em></p>
          <p>
            <span>RESPONSABLE</span> {tutor?.nombre ?? p.alumno}
            {tutor?.telefono && <><span className="ml">TELÉFONO</span> {tutor.telefono}</>}
          </p>
        </section>

        <table className="recibo-tabla">
          <thead>
            <tr>
              <th>INSTRUMENTO</th>
              <th className="num">CONDICIÓN AL SALIR</th>
              <th className="num">DEVOLVER ANTES DEL</th>
            </tr>
          </thead>
          <tbody id="responsiva-renglones">
            <tr>
              <td>
                {p.instrumento}
                {p.marca && <em className="periodo"> · {p.marca}</em>}
                <em className="periodo"> · folio {p.codigo}</em>
              </td>
              <td className="num">{NOMBRE_CONDICION[p.condicionSalida as Condicion]}</td>
              <td className="num">{p.terminaEl}</td>
            </tr>
            <tr className="vacia"><td colSpan={3}>&nbsp;</td></tr>
            <tr className="vacia"><td colSpan={3}>&nbsp;</td></tr>
          </tbody>
        </table>

        <section className="recibo-pie">
          <div className="recibo-terminos">
            <h2>TÉRMINOS DEL PRÉSTAMO</h2>
            <p>
              El instrumento es propiedad de la Academia de Música VioliniStar y se entrega en
              préstamo mientras el período de clases de {p.alumno} esté vigente, en el programa
              {" "}{p.programa} (cláusula 9ª). Los instrumentos de gran formato no salen de las
              instalaciones. Quien firma se compromete a devolverlo en el mismo estado, salvo
              el desgaste normal del uso, y a avisar de inmediato de cualquier daño.
            </p>
            <p className="recibo-nofiscal">
              <strong>No se solicita depósito en garantía.</strong> Un daño o extravío no genera
              cargo automático: se registra y la dirección determina qué procede en cada caso.
            </p>
          </div>

          <div className="recibo-totales">
            <div className="fila">
              <span>PROGRAMA</span><span>{p.programa}</span>
            </div>
            <div className="fila">
              <span>ENTREGÓ</span><span>{p.entregadoPor ?? "—"}</span>
            </div>
            {p.notas && (
              <div className="fila"><span>NOTAS</span><span>{p.notas}</span></div>
            )}
            <div className="total">
              <span>VIGENTE HASTA</span><span>{p.terminaEl}</span>
            </div>
          </div>
        </section>

        <section className="responsiva-firmas">
          <div>
            <span className="linea" />
            <p>{tutor?.nombre ?? p.alumno}</p>
            <em>Recibe y se hace responsable</em>
          </div>
          <div>
            <span className="linea" />
            <p>{p.entregadoPor ?? "Academia de Música VioliniStar"}</p>
            <em>Entrega por la academia</em>
          </div>
        </section>

        <footer className="recibo-franja">
          <span>{cfg.academia_telefono}</span>
          <span className="dir">{cfg.academia_domicilio}</span>
          <span>{cfg.academia_instagram}</span>
        </footer>

        <p className="recibo-emision">
          Entregado el {dia} de {MES[mes - 1]} de {anio}
          {p.devueltoEl && ` · devuelto el ${p.devueltoEl}`}
          {" "}· Academia de Música VioliniStar
        </p>
      </main>
    </>
  );
}
