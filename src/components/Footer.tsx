import { TreePine, Heart, ShieldCheck, Mail, Phone, MapPin, FileText, Download } from 'lucide-react';

interface FooterProps {
  onNavigate: (section: string) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  const year = new Date().getFullYear();

  const legalDocs = [
    {
      title: 'Términos y Condiciones de Uso',
      file: encodeURI('/POLÍTICA DE TERMINOS Y CONDICIONES DE USO.pdf'),
      type: 'PDF',
    },
    {
      title: 'Políticas de Privacidad',
      file: encodeURI('/POLITICAS DE PRIVACIDAD.pdf'),
      type: 'PDF',
    },
    {
      title: 'Condiciones Generales',
      file: encodeURI('/CONDICIONES.pdf'),
      type: 'PDF',
    },
    {
      title: 'T&C Plan Separe',
      file: encodeURI('/tycplansepare.jpg'),
      type: 'Imagen/JPG',
    },
  ];

  return (
    <footer className="bg-stone-900 text-stone-300 border-t border-stone-850">
      
      {/* Top detailed grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 items-start">
          
          {/* Company presentation (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex flex-wrap xs:flex-nowrap items-center gap-3">
              <img 
                src="/logonavidad.png" 
                alt="Feria Navideña" 
                className="h-10 sm:h-12 w-auto object-contain bg-white/5 p-1 rounded-xl"
                referrerPolicy="no-referrer"
                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
              />
              <span className="hidden xs:block h-6 w-px bg-stone-700/80" />
              <img 
                src="/logo_impormax.png" 
                alt="IMPORMAX" 
                className="h-10 sm:h-12 w-auto object-contain bg-white/5 p-1 rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>

            <p className="text-xs text-stone-400 leading-relaxed font-normal">
              Especialistas en proveer de forma eficiente y oportuna adornos navideños premium, árboles nevados, escolar, ferretería y hogar. Calidad premium sin falsas promesas.
            </p>

            <div className="flex items-center gap-2 text-xs text-white bg-stone-800 p-3 rounded-xl border border-stone-750">
              <ShieldCheck className="w-4 h-4 text-brand-green shrink-0" />
              <span>Distribución autorizada con garantía directa y pago 100% seguro.</span>
            </div>
          </div>

          {/* Quick links navigation (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Navegación
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('hero')}
                  className="hover:text-brand-green transition-colors cursor-pointer text-left focus:outline-none"
                >
                  Inicio
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('catalogo')}
                  className="hover:text-brand-green transition-colors cursor-pointer text-left focus:outline-none"
                >
                  Catálogo
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('separe')}
                  className="hover:text-brand-green transition-colors cursor-pointer text-left focus:outline-none"
                >
                  Plan Separe
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('faq')}
                  className="hover:text-brand-green transition-colors cursor-pointer text-left focus:outline-none"
                >
                  Preguntas FAQ
                </button>
              </li>
            </ul>
          </div>

          {/* Legal documents (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-brand-blue" />
              Legales y Políticas
            </h4>
            <ul className="space-y-2.5 text-xs">
              {legalDocs.map((doc, idx) => (
                <li key={idx}>
                  <a
                    href={doc.file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 hover:text-brand-green transition-colors text-stone-300"
                    title={`Ver o descargar ${doc.title}`}
                  >
                    <Download className="w-3.5 h-3.5 text-stone-500 group-hover:text-brand-green transition-colors shrink-0" />
                    <span className="underline decoration-stone-700 underline-offset-2 group-hover:decoration-brand-green">
                      {doc.title}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact and address channels (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Contacto y Atención
            </h4>
            
            <div className="space-y-3.5 text-xs text-stone-400">
              
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-brand-blue flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-white font-semibold block leading-tight">Sede Principal</span>
                  <p className="mt-0.5 leading-normal">Carrera 8 Bis #15-109, Sector Servientrega — Dosquebradas, Risaralda</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-brand-blue flex-shrink-0" />
                <span>ventas2@impormax.net</span>
              </div>

              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-brand-blue flex-shrink-0" />
                <span>+57 315 4618049</span>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* Bottom copyright notice */}
      <div className="border-t border-stone-800 py-6 text-center text-[11px] text-stone-500 font-normal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            &copy; {year} IMPORMAX Colombia. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4 flex-wrap justify-center text-stone-400">
            {legalDocs.map((doc, idx) => (
              <a 
                key={idx}
                href={doc.file}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand-green transition-colors"
              >
                {doc.title}
              </a>
            ))}
          </div>
          <p className="flex items-center gap-1">
            Diseñado con <Heart className="w-3 h-3 text-red-500 fill-red-500" /> para Plan Separe Navideño.
          </p>
        </div>
      </div>

    </footer>
  );
}
