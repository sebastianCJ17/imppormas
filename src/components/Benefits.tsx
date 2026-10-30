import { motion } from 'motion/react';
import { DollarSign, ShieldAlert, Award, Star, Truck, Percent } from 'lucide-react';

export default function Benefits() {
  const benefitsList = [
    {
      icon: DollarSign,
      title: 'Precio Fijo Congelado',
      desc: 'Congela el precio de pre-temporada. Olvídate de las alzas desproporcionadas en Noviembre y Diciembre por alta demanda.'
    },
    {
      icon: ShieldAlert,
      title: 'Garantía de Stock Absoluta',
      desc: 'Asegura tu árbol favorito desde ahora. No te arriesgues a quedarte con saldos de baja densidad o referencias agotadas.'
    },
    {
      icon: Percent,
      title: '0% de Intereses',
      desc: 'Divide tus pagos de forma justa. El valor total pactado hoy es exactamente lo que terminarás pagando.'
    },
    {
      icon: Truck,
      title: 'Envío Gratis Nacional',
      desc: 'Por compras superiores a $300,000 COP, el costo de envío es 100% cubierto por Impormax. Directo a tu puerta.'
    },
    {
      icon: Award,
      title: 'Calidad de Importación Directa',
      desc: 'Sin intermediarios. Traemos ejemplares frondosos con ramas articuladas de nivel premium directamente al consumidor.'
    },
    {
      icon: Star,
      title: 'Abonos a tu Medida',
      desc: '¿Sueldo de quincena? ¿Mes vencido? Abona lo que desees, cuando desees, directo desde la facilidad del portal.'
    }
  ];

  return (
    <section id="beneficios" className="py-20 bg-white border-b border-stone-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header split details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-16">
          <div className="lg:col-span-6 space-y-4 text-center lg:text-left">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-widest font-mono">
              ¿Por qué preferirnos?
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-blue tracking-tight">
              La Inteligencia Financiera para una Navidad Perfecta
            </h2>
          </div>
          <div className="lg:col-span-6">
            <p className="text-sm text-stone-600 leading-relaxed text-center lg:text-left">
              Comprar árbol en Diciembre representa un estrés logístico y un golpe alto al flujo de caja. Con el Plan Separe de Impormax, distribuyes el costo de forma imperceptible y te garantizas un hogar hermoso sin preocupaciones de última hora.
            </p>
          </div>
        </div>

        {/* Benefits Grid list */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefitsList.map((b, idx) => {
            const Icon = b.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="p-6 rounded-2xl border border-stone-200/50 hover:bg-stone-50/50 transition-colors space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-stone-900">
                  {b.title}
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  {b.desc}
                </p>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
