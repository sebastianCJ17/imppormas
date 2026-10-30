import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { FAQItem } from '../types';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqItems: FAQItem[] = [
    {
      question: '¿Con qué porcentaje mínimo puedo separar mi árbol?',
      answer: 'El porcentaje de separación para la línea navideña es siempre del 30% del valor total del producto. Durante el checkout se calculará de manera automática el valor exacto en pesos COP.'
    },
    {
      question: '¿Cómo puedo realizar mis abonos parciales?',
      answer: 'Es 100% flexible. Puedes ingresar en cualquier momento a nuestro portal "Mi Cuenta", digitar tu número de documento, ver tu saldo actualizado e iniciar el registro de un nuevo abono desde $50.000 COP. Aceptamos pasarela virtual Wompi, PSE, Nequi o transferencia bancaria.'
    },
    {
      question: '¿Qué pasa si deseo cancelar mi Plan Separe?',
      answer: 'Si decides cancelar tu plan separe por motivos personales, se te reintegrará el valor abonado exceptuando un 10% del valor total del pedido correspondiente a gastos administrativos y reserva.'
    },
    {
      question: '¿Cómo se maneja el envío y el costo de despacho?',
      answer: 'Envíos gratis a nivel nacional solo a ciudades principales. La fecha de envío y llegada del producto se define dependiendo de la ciudad de entrega y la fecha de temporada.'
    },
    {
      question: '¿Cuándo recibiré mi árbol navideño?',
      answer: 'Una vez completado el 100% del pago de tu Plan Separe, programamos el envío de tu pedido. Ten en cuenta que la fecha de envío y llegada del producto se define dependiendo de la ciudad de entrega y la fecha de temporada.'
    },
    {
      question: '¿Cuentan con atención para resolver inquietudes?',
      answer: '¡Por supuesto! Nuestro equipo de soporte está disponible vía WhatsApp y correo electrónico para asesorarte en la selección de tu árbol e informarte sobre el estado de tus abonos.'
    }
  ];

  return (
    <section id="faq" className="py-20 bg-[#FAF9F6] border-b border-stone-200/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-14 space-y-3">
          <h2 className="text-3xl font-extrabold text-stone-900 tracking-tight">
            Preguntas Frecuentes FAQ
          </h2>
          <p className="text-sm text-stone-500 max-w-xl mx-auto">
            ¿Tienes alguna consulta rápida sobre el Plan Separe, despachos o garantías?
            <span className="block mt-1 font-medium text-stone-700">Aquí despejamos las dudas habituales de nuestros compradores navideños.</span>
          </p>
        </div>

        {/* Collapsible block */}
        <div className="space-y-4">
          {faqItems.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="bg-white border border-stone-200/50 rounded-2xl overflow-hidden shadow-xs hover:border-stone-300 transition-colors"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 font-bold text-sm text-stone-900 focus:outline-none cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-[#1C5275] flex-shrink-0" />
                    <span>{item.question}</span>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-stone-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-stone-500" />
                  )}
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-stone-100"
                    >
                      <div className="px-6 py-4 text-xs leading-relaxed text-stone-600 bg-stone-50/50">
                        {item.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
