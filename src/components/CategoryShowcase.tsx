import React from 'react';
import { motion } from 'motion/react';
import { 
  TreePine, 
  CircleDot, 
  Sparkles, 
  Lightbulb, 
  Flower2, 
  Gift, 
  Layers, 
  ArrowRight,
  Utensils
} from 'lucide-react';
import { Product } from '../types';

interface CategoryShowcaseProps {
  products: Product[];
  onSelectCategory: (category: string) => void;
}

// Icon helper per category
const getCategoryIcon = (categoryName: string): React.ElementType => {
  const lower = categoryName.toLowerCase();
  if (lower.includes('árbol') || lower.includes('arbol') || lower.includes('guirnalda') || lower.includes('corona')) return TreePine;
  if (lower.includes('bola')) return CircleDot;
  if (lower.includes('cinta') || lower.includes('malla')) return Sparkles;
  if (lower.includes('luz') || lower.includes('luces') || lower.includes('iluminac')) return Lightbulb;
  if (lower.includes('flor') || lower.includes('follaje')) return Flower2;
  if (lower.includes('pesebre') || lower.includes('nacimiento')) return Gift;
  if (lower.includes('cocina') || lower.includes('utensilio')) return Utensils;
  if (lower.includes('decorac')) return Gift;
  return Layers;
};

const DEFAULT_CATEGORIES = [
  'Árboles y Guirnaldas',
  'Luces Navideñas',
  'Bolas Navideñas',
  'Cintas y Mallas',
  'Decoración',
  'Flores y Follaje',
  'Pesebres',
  'Utensilios Navideños de Cocina'
];

export default function CategoryShowcase({ products, onSelectCategory }: CategoryShowcaseProps) {
  // Extract unique categories dynamically from available in-stock products
  const inStockProducts = products.filter((p) => (p.stock ?? 0) >= 1);
  const dynamicCategories = Array.from(new Set(inStockProducts.map((p) => p.category).filter(Boolean))) as string[];
  const categoriesList = dynamicCategories.length >= 8 ? dynamicCategories : DEFAULT_CATEGORIES;

  // Sort so Árboles y Guirnaldas is always first, then alphabetical
  const sortedCategories = [...categoriesList].sort((a, b) => {
    const isTreeA = a.toLowerCase().includes('árbol') || a.toLowerCase().includes('arbol');
    const isTreeB = b.toLowerCase().includes('árbol') || b.toLowerCase().includes('arbol');
    if (isTreeA && !isTreeB) return -1;
    if (!isTreeA && isTreeB) return 1;
    return a.localeCompare(b, 'es', { sensitivity: 'base' });
  });

  return (
    <section className="py-10 sm:py-14 bg-gradient-to-b from-stone-900 via-stone-950 to-stone-900 text-white relative overflow-hidden border-b border-stone-800">
      
      {/* Decorative ambient background glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header Title */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 space-y-2">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
            Explora por Categoría
          </h2>
          <p className="text-stone-300 text-xs sm:text-sm">
            Selecciona una categoría para ver todos los productos disponibles
          </p>
        </div>

        {/* --- CATEGORY BUTTONS GRID: 8 CATEGORÍAS EN 4 COLUMNAS --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 max-w-6xl mx-auto">
          {sortedCategories.map((catName, index) => {
            const Icon = getCategoryIcon(catName);

            return (
              <motion.button
                key={catName}
                id={`cat-btn-${catName.toLowerCase().replace(/\s+/g, '-')}`}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectCategory(catName)}
                className="group relative flex items-center justify-between p-4 sm:p-4.5 rounded-xl border border-stone-800 bg-stone-900/90 hover:bg-stone-800/90 hover:border-amber-400/60 shadow-md hover:shadow-lg hover:shadow-amber-500/10 cursor-pointer transition-all duration-200 text-left w-full"
              >
                {/* Left: Icon & Category Name */}
                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                  <div className="w-10 h-10 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-300 group-hover:bg-amber-400 group-hover:text-stone-950 transition-colors shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-sm sm:text-base font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                    {catName}
                  </span>
                </div>

                {/* Right: Direct Arrow Indicator */}
                <div className="w-8 h-8 rounded-full bg-stone-800/80 border border-stone-700/80 flex items-center justify-center text-stone-400 group-hover:text-amber-300 group-hover:border-amber-400/40 group-hover:bg-amber-400/10 transition-all shrink-0 ml-2">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Quick View All Action */}
        <div className="mt-8 pt-6 border-t border-stone-800/80 flex justify-center">
          <button
            id="view-all-categories-btn"
            onClick={() => onSelectCategory('Todos')}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-stone-800/80 hover:bg-stone-700 border border-stone-700 text-stone-300 hover:text-white font-semibold text-xs sm:text-sm transition-all cursor-pointer shadow-sm"
          >
            <span>Ver Todo el Catálogo</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
          </button>
        </div>

      </div>
    </section>
  );
}

