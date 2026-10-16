import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidad · Batuta · VioliniStar",
  description: "Cómo Batuta, el sistema de la Academia de Música VioliniStar, trata los datos personales.",
};

const CONTACTO = "violinistarmx@gmail.com";

export default function Privacidad() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-vs-tinta">
      <Link href="/entrar" className="text-sm text-vs-tinta-2 underline">
        ← Volver al inicio de sesión
      </Link>

      <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">
        Política de privacidad
      </h1>
      <p className="mt-2 text-sm text-vs-tinta-3">Última actualización: 16 de octubre de 2026</p>

      <div className="mt-8 flex flex-col gap-6 text-[15px] leading-relaxed text-vs-tinta-2">
        <section>
          <h2 className="font-display text-xl font-semibold text-vs-tinta">Quién es responsable</h2>
          <p className="mt-2">
            Batuta es el sistema de gestión interna de la Academia de Música VioliniStar, con sedes en
            Mineral de la Reforma, Hueypoxtla y Real del Monte, Hidalgo, México. El responsable del
            tratamiento de los datos es la dirección de la academia. Para cualquier duda puedes escribir a{" "}
            <a href={`mailto:${CONTACTO}`} className="underline">{CONTACTO}</a>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-vs-tinta">Qué datos guardamos</h2>
          <ul className="mt-2 list-disc pl-5">
            <li>De alumnos: nombre, fecha de nacimiento, instrumento, programa y horario de clases, y pagos.</li>
            <li>De tutores: nombre, teléfono, correo electrónico y parentesco con el alumno.</li>
            <li>De maestros y personal: nombre, correo y la información necesaria para su cuenta de acceso.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-vs-tinta">Para qué los usamos</h2>
          <ul className="mt-2 list-disc pl-5">
            <li>Organizar clases, inscripciones, pagos y recibos.</li>
            <li>Enviar recordatorios de clase, de pago y de renovación, por WhatsApp o por correo.</li>
            <li>
              Crear y actualizar eventos de las clases en el calendario de Google de la academia, para que
              maestros, alumnos y tutores reciban la invitación correspondiente.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-vs-tinta">Uso de datos de Google</h2>
          <p className="mt-2">
            Batuta usa la API de Google Calendar únicamente para crear, modificar y cancelar los eventos de
            las clases de la academia. No leemos el resto de tu calendario, no vendemos ni compartimos esos
            datos con terceros, y no los usamos para publicidad. Este uso cumple con la Política de datos de
            usuario de los servicios de API de Google, incluidos sus requisitos de uso limitado.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-vs-tinta">Con quién se comparten</h2>
          <p className="mt-2">
            No vendemos ni rentamos datos personales. Solo intervienen los servicios que la academia
            necesita para operar: el proveedor de alojamiento del sistema y Google, para el calendario.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-vs-tinta">Cuánto tiempo los conservamos</h2>
          <p className="mt-2">
            Conservamos los datos mientras el alumno esté inscrito y durante el tiempo necesario para cumplir
            obligaciones administrativas y contables. Después se eliminan o se anonimizan.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-vs-tinta">Tus derechos</h2>
          <p className="mt-2">
            Puedes pedir acceso, rectificación, cancelación u oposición al uso de tus datos (derechos ARCO)
            escribiendo a <a href={`mailto:${CONTACTO}`} className="underline">{CONTACTO}</a>. Te responderemos
            en un plazo razonable.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-vs-tinta">Cambios a esta política</h2>
          <p className="mt-2">
            Si cambiamos esta política, publicaremos la nueva versión en esta página y actualizaremos la fecha
            de arriba.
          </p>
        </section>
      </div>
    </main>
  );
}
