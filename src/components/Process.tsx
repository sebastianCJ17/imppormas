import { useState } from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, Landmark, Key, Truck, Calendar, Copy, Check, ShieldCheck } from 'lucide-react';

export default function Process() {
  const [copiedKey, setCopiedKey] = useState(false);

  const handleCopyKey = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText('900405698');
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    }
  };

  const steps = [
    {
      num: '01',
      title: 'Elige tu Árbol y Separa',
      desc: 'Selecciona el árbol navideño que más te encante de nuestro catálogo.',
      icon: ShoppingBag,
      color: 'bg-amber-100 text-amber-800'
    },
    {
      num: '02',
      title: 'Realiza el Pago Inicial',
      desc: 'Realiza el abono de reserva del 30% de forma segura mediante pasarela virtual Wompi, PSE, Nequi o transferencia bancaria (llave: 900405698).',
      icon: Landmark,
      color: 'bg-emerald-100 text-emerald-800'
    },
    {
      num: '03',
      title: 'Abona Tu Saldo',
      desc: 'Vas realizando abonos parciales sin interés a través de nuestro portal de saldos hasta la fecha límite.',
      icon: Key,
      color: 'bg-blue-100 text-brand-blue'
    },
    {
      num: '04',
      title: 'Despacho y Entrega',
      desc: 'Una vez completado el 100% del pago, programamos el envío de tu pedido. Envíos gratis por compras superiores a $199.000 a nivel nacional en ciudades principales.',
      icon: Truck,
      color: 'bg-indigo-100 text-indigo-800'
    }
  ];

  return (
    <section id="separe" className="py-20 bg-[#FAF9F6] border-b border-stone-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
            ¿Cómo funciona el Plan Separe?
          </h2>
          <p className="text-base text-stone-600">
            Diseñamos un sistema transparente para facilitar tu compra navideña sin presiones financieras.
            <span className="block mt-1.5 font-semibold text-stone-900">En 4 simples pasos, asegura tu árbol ideal.</span>
          </p>
        </div>

        {/* Timeline Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          
          {/* Connector Line (hidden on mobile, visible on lg grid) */}
          <div className="hidden lg:block absolute top-1/4 left-1/10 right-1/10 h-0.5 bg-stone-200 -z-0" />

          {steps.map((s, idx) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="relative bg-white border border-stone-200/50 hover:border-stone-400 p-6 rounded-2xl shadow-sm z-10 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  
                  {/* Step visual header */}
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-black text-stone-200 font-mono tracking-wider">
                      {s.num}
                    </span>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Title & Desc */}
                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-stone-900">
                      {s.title}
                    </h3>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      {s.desc}
                    </p>
                  </div>

                </div>

                {/* Micro tracker footer */}
                <div className="pt-4 mt-6 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-400 font-mono">
                  <span>ETAPA {s.num}</span>
                  <span className="text-stone-800 font-semibold">ACTIVO</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* --- UNIFIED HIGHLIGHT BANNER (Subtle light background with visual cues) --- */}
        <div className="mt-14 max-w-6xl mx-auto rounded-3xl bg-gradient-to-br from-emerald-50/40 via-stone-100/70 to-amber-50/40 border border-stone-200/80 p-4 sm:p-6 lg:p-7 shadow-sm relative overflow-hidden">
          
          {/* Subtle Ambient Decorative Glows */}
          <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-emerald-300/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-amber-300/15 rounded-full blur-2xl pointer-events-none" />

          {/* Grid with 2 side-by-side balanced cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 relative z-10">
            
            {/* Card 1: Payment Methods & BRE-B Bancolombia */}
            <div className="bg-white/95 backdrop-blur-xs border border-emerald-200/90 rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black font-mono text-sm shadow-xs shrink-0">
                      BC
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono font-bold text-emerald-800 tracking-wider block">
                        Medio de Pago Directo
                      </span>
                      <h4 className="text-sm font-extrabold text-stone-900">
                        BRE-B Bancolombia
                      </h4>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Oficial
                  </span>
                </div>

                {/* Key with Copy button */}
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-stone-500 font-medium block">
                      Llave Bancolombia / BRE-B:
                    </span>
                    <span className="font-mono text-base sm:text-lg font-black text-emerald-950 tracking-wider select-all">
                      900405698
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs active:scale-95"
                    title="Copiar llave al portapapeles"
                  >
                    {copiedKey ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>¡Copiada!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Llave</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600 font-medium">
                <span>Aceptamos Wompi, PSE, Nequi y Transferencia</span>
                <span className="text-[11px] text-emerald-700 font-semibold">Sin comisiones</span>
              </div>
            </div>

            {/* Card 2: Liquidation Date Warning */}
            <div className="bg-white/95 backdrop-blur-xs border border-amber-200/90 rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono font-bold text-amber-800 tracking-wider block">
                        Cronograma de Despacho
                      </span>
                      <h4 className="text-sm font-extrabold text-stone-900">
                        Fecha de Liquidación Máxima
                      </h4>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    Importante
                  </span>
                </div>

                {/* Date Highlight Box */}
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3">
                  <p className="text-xs text-stone-700 leading-relaxed">
                    Para garantizar tu despacho oportuno, todos los planes separe deben quedar liquidados al 100% a más tardar el <strong className="text-stone-950 font-black text-xs sm:text-sm bg-white px-2 py-0.5 rounded border border-amber-300 inline-block mt-0.5">16 de Noviembre de 2026</strong>.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-100 text-[11px] text-stone-500 leading-snug">
                Envíos gratis a nivel nacional solo a ciudades principales; la fecha de envío y llegada se define según la ciudad de entrega y la fecha de temporada.
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}

