"use client";

import { useState } from "react";

type Props = {
  codigo: string;
  concepto: string;
  alumno: string;
  sede: string | null;
  importe: string;
  pagado: boolean;
  /** SVG del QR ya generado en el servidor. */
  qrSvg: string;
  /** Mensaje de WhatsApp (sin enlace) y, si hay número, el enlace al chat con ese texto. */
  mensaje: string;
  enlaceWhatsApp: string | null;
};

const TINTA = "#221A0E";

/** Parte un texto en renglones que quepan en `ancho`, para dibujarlo en el lienzo. */
function renglones(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string[] {
  const salida: string[] = [];
  let actual = "";
  for (const palabra of texto.split(" ")) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > ancho && actual) { salida.push(actual); actual = palabra; } else actual = prueba;
  }
  if (actual) salida.push(actual);
  return salida;
}

/** Dibuja el ticket como imagen: se manda tal cual por WhatsApp y se enseña en el celular. */
async function dibujarTicket(p: Props): Promise<Blob> {
  const W = 640, H = 900, margen = 40;
  const lienzo = document.createElement("canvas");
  lienzo.width = W; lienzo.height = H;
  const ctx = lienzo.getContext("2d")!;

  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ffd500"; ctx.fillRect(0, 0, W, 96);
  ctx.fillStyle = TINTA; ctx.textAlign = "left";
  ctx.font = "700 30px Georgia, serif"; ctx.fillText("VioliniStar", margen, 46);
  ctx.font = "500 16px system-ui, sans-serif"; ctx.fillText("Academia de Música · Vale de entrega", margen, 74);

  ctx.font = "700 40px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(p.codigo, margen, 160);

  ctx.font = "600 24px system-ui, sans-serif";
  let y = 206;
  for (const linea of renglones(ctx, p.concepto, W - margen * 2)) { ctx.fillText(linea, margen, y); y += 32; }

  ctx.font = "400 20px system-ui, sans-serif"; ctx.fillStyle = "#6e5c45";
  ctx.fillText(`Alumno: ${p.alumno}`, margen, y + 8);
  if (p.sede) ctx.fillText(`Sede: ${p.sede}`, margen, y + 38);
  ctx.fillText(`Importe: ${p.importe}`, margen, y + (p.sede ? 68 : 38));

  const url = URL.createObjectURL(new Blob([p.qrSvg], { type: "image/svg+xml" }));
  try {
    const qr = new Image();
    qr.src = url;
    await qr.decode();
    const lado = 340;
    ctx.fillStyle = "#ffffff";
    ctx.drawImage(qr, (W - lado) / 2, 400, lado, lado);
  } finally {
    URL.revokeObjectURL(url);
  }

  ctx.textAlign = "center"; ctx.fillStyle = TINTA; ctx.font = "600 20px system-ui, sans-serif";
  ctx.fillText(p.pagado ? "Pagado · presenta este código para recogerlo" : "Se entrega al liquidar el pago", W / 2, 810);
  ctx.fillStyle = "#6e5c45"; ctx.font = "400 15px system-ui, sans-serif";
  ctx.fillText("Este vale no es un comprobante fiscal.", W / 2, 850);

  return new Promise((resolver, rechazar) =>
    lienzo.toBlob((b) => (b ? resolver(b) : rechazar(new Error("No se pudo generar el ticket."))), "image/png"));
}

function descargar(blob: Blob, nombre: string) {
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

const boton = "rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vs-naranja-700";

/**
 * Envía el ticket del vale. En el celular abre la hoja de compartir con la imagen (ahí está
 * WhatsApp); en computadora descarga el PNG y abre el chat con el mensaje listo, para adjuntarlo.
 * El sistema no manda nada por sí solo: la persona de recepción termina el envío.
 */
export function EnviarTicket(p: Props) {
  const [estado, setEstado] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const nombreArchivo = `${p.codigo}.png`;

  async function enviar() {
    setTrabajando(true); setEstado(null);
    try {
      const imagen = await dibujarTicket(p);
      const archivo = new File([imagen], nombreArchivo, { type: "image/png" });
      if (navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({ files: [archivo], text: p.mensaje });
        setEstado("Ticket compartido.");
      } else {
        descargar(imagen, nombreArchivo);
        if (p.enlaceWhatsApp) window.open(p.enlaceWhatsApp, "_blank", "noopener");
        setEstado(p.enlaceWhatsApp
          ? "Ticket descargado. En WhatsApp, adjúntalo al mensaje que se abrió."
          : "Ticket descargado. No hay un WhatsApp registrado del tutor: envíalo manualmente.");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setEstado("No se pudo generar el ticket.");
    } finally {
      setTrabajando(false);
    }
  }

  async function soloDescargar() {
    setTrabajando(true); setEstado(null);
    try { descargar(await dibujarTicket(p), nombreArchivo); setEstado("Ticket descargado."); }
    catch { setEstado("No se pudo generar el ticket."); }
    finally { setTrabajando(false); }
  }

  return (
    <section aria-label="Enviar ticket" className="rounded-xl border border-vs-linea bg-white p-4">
      <h2 className="text-sm font-semibold">Ticket para la familia</h2>
      <p className="mt-1 text-xs text-vs-tinta-3">
        Imagen con el código y el QR del vale. {p.enlaceWhatsApp ? "Se envía al tutor responsable." : "No hay un WhatsApp registrado del tutor."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={enviar} disabled={trabajando}
                className={`${boton} bg-green-600 text-white hover:bg-green-700`}>
          {trabajando ? "Preparando…" : "Enviar ticket por WhatsApp"}
        </button>
        <button type="button" onClick={soloDescargar} disabled={trabajando}
                className="text-sm text-vs-tinta-2 underline-offset-2 hover:underline disabled:opacity-60">
          Solo descargar
        </button>
      </div>
      {estado && <p role="status" className="mt-2 text-xs text-vs-tinta-2">{estado}</p>}
    </section>
  );
}
