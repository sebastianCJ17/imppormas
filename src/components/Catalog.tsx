import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product } from '../types';
import ProductDetailModal from './ProductDetailModal';
import { isProductNew, getProductVideoUrl } from '../utils/productUtils';
import { 
  TreePine, 
  CheckCircle2, 
  ChevronDown, 
  AlertCircle, 
  Palette, 
  Ruler, 
  DollarSign, 
  ChevronLeft, 
  ChevronRight, 
  Layers,
  Filter,
  Sparkles,
  Eye,
  Search,
  ArrowUpDown,
  Truck,
  X,
  CircleDot,
  Lightbulb,
  Flower2,
  Gift,
  Utensils,
  ShoppingCart,
  Play,
  Video
} from 'lucide-react';

interface CatalogProps {
  onSelectProduct: (product: Product) => void;
  isLoadingCatalog: boolean;
  products: Product[];
  onRefresh: () => void;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

// Función para normalizar texto eliminando tildes y signos diacríticos
function normalizeSearchText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export default function Catalog({ 
  onSelectProduct, 
  isLoadingCatalog, 
  products, 
  onRefresh,
  selectedCategory: externalCategory,
  onSelectCategory: externalSetCategory,
  searchQuery: externalSearchQuery,
  onSearchQueryChange: externalSetSearchQuery
}: CatalogProps) {
  // Filter & Search States
  const [internalSearchQuery, setInternalSearchQuery] = useState<string>('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = (val: string) => {
    setInternalSearchQuery(val);
    if (externalSetSearchQuery) {
      externalSetSearchQuery(val);
    }
  };

  const [sortOption, setSortOption] = useState<string>('trees-first');
  const [showOnlyNew, setShowOnlyNew] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(externalCategory || 'Todos');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('Todos');
  const [selectedColor, setSelectedColor] = useState<string>('Todos');
  const [selectedHeight, setSelectedHeight] = useState<string>('Todos');
  const [maxPrice, setMaxPrice] = useState<number>(10000000);

  // Sync external category changes (e.g. from CategoryShowcase)
  useEffect(() => {
    if (externalCategory !== undefined && externalCategory !== selectedCategory) {
      setSelectedCategory(externalCategory);
    }
  }, [externalCategory]);

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    if (externalSetCategory) {
      externalSetCategory(cat);
    }
  };
  
  // Single Product Detail Modal State (with URL query support e.g. ?product=8010029)
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<Product | null>(null);

  // Sync URL product param when products load or URL changes
  useEffect(() => {
    if (typeof window !== 'undefined' && products.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const prodParam = urlParams.get('product') || urlParams.get('ref');
      if (prodParam) {
        const found = products.find((p) => p.id.toLowerCase() === prodParam.toLowerCase());
        if (found) {
          setSelectedDetailProduct(found);
        }
      }
    }
  }, [products]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 18; // 3 columns * 6 rows

  // Reset pagination to page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortOption, showOnlyNew, selectedCategory, selectedSubCategory, selectedColor, selectedHeight, maxPrice]);

  // Extract unique categories, subcategories, colors dynamically from fetched products
  const rawCategories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
  rawCategories.sort((a, b) => {
    const isTreeA = a.toLowerCase().includes('árbol') || a.toLowerCase().includes('arbol');
    const isTreeB = b.toLowerCase().includes('árbol') || b.toLowerCase().includes('arbol');
    if (isTreeA && !isTreeB) return -1;
    if (!isTreeA && isTreeB) return 1;
    return a.localeCompare(b, 'es', { sensitivity: 'base' });
  });
  const categoriesList = ['Todos', ...rawCategories];

  // Available subcategories for the selected category (preserving exact API string name)
  const availableSubCategories = Array.from(
    new Set(
      products
        .filter((p) => selectedCategory === 'Todos' || p.category === selectedCategory)
        .map((p) => p.subCategory)
        .filter((s): s is string => Boolean(s) && typeof s === 'string' && s.trim().length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  const subCategoriesList = ['Todos', ...availableSubCategories];

  const colorsList = ['Todos', ...Array.from(new Set(products.map((p) => p.color).filter(Boolean)))];

  // Height options (applicable for Trees)
  const heightOptions = [
    { value: 'Todos', label: 'Todas las alturas' },
    { value: 'Alto (más de 2.10m)', label: 'Altos (> 2.10m)' },
    { value: 'Mediano (1.80m a 2.00m)', label: 'Medianos (1.80m - 2.00m)' },
    { value: 'Bajo (hasta 1.50m)', label: 'Bajos (< 1.50m)' }
  ];

  // Filter & Sort products based on selected criteria
  // Regla estricta de catálogo:
  // 1. Stock / unidades disponibles >= 1
  // 2. Si el producto no cuenta con fotografía real del ERP, NO mostrarlo en la landing
  const inStockProducts = products.filter((prod) => {
    const hasStock = (prod.stock ?? 0) >= 1;
    const img = String(prod.imageUrl || '').trim();
    const hasValidPhoto = Boolean(
      img &&
      img !== '' &&
      !img.includes('placeholder') &&
      !img.endsWith('/') &&
      !img.endsWith('null') &&
      !img.endsWith('0.jpg') &&
      !img.includes('undefined')
    );
    return hasStock && hasValidPhoto;
  });
  const newProductsCount = inStockProducts.filter((prod) => isProductNew(prod)).length;

  const filteredProducts = inStockProducts.filter((prod) => {
    // 0. Filter by New Products if toggled
    if (showOnlyNew && !isProductNew(prod)) {
      return false;
    }

    // 0b. Multi-Keyword Search Query Filter (encuentra por cualquier palabra clave en cualquier orden)
    if (searchQuery.trim()) {
      const normQuery = normalizeSearchText(searchQuery);
      const tokens = normQuery.split(/\s+/).filter(Boolean);

      if (tokens.length > 0) {
        const rawContent = [
          prod.name,
          prod.id,
          prod.code,
          prod.reference,
          prod.category,
          prod.subCategory,
          prod.color,
          prod.height,
          prod.description,
          prod.observations,
          prod.dimensions,
          ...(prod.features || []),
          ...(prod.similarCodes || [])
        ].filter(Boolean).join(' ');

        const normContent = normalizeSearchText(rawContent);
        const strippedContent = normContent.replace(/[^a-z0-9]/g, '');

        // Cada token o palabra clave debe estar presente en el producto
        const matchesAllKeywords = tokens.every((token) => {
          if (normContent.includes(token)) return true;
          const strippedToken = token.replace(/[^a-z0-9]/g, '');
          if (strippedToken && strippedContent.includes(strippedToken)) return true;
          return false;
        });

        if (!matchesAllKeywords) {
          return false;
        }
      }
    }

    // 1. Category Filter
    const prodCategory = prod.category || 'Decoraciones';
    const meetCategory = selectedCategory === 'Todos' || prodCategory === selectedCategory;

    // 1b. Subcategory Filter (exact match with API string)
    const prodSubCategory = prod.subCategory || '';
    const meetSubCategory = selectedSubCategory === 'Todos' || prodSubCategory === selectedSubCategory;

    // 2. Color Filter
    const prodColor = prod.color || 'Multicolor';
    const meetColor = selectedColor === 'Todos' || prodColor === selectedColor;

    // 3. Height Filter (only applies if product is in tree category)
    let meetHeight = true;
    if (selectedHeight !== 'Todos') {
      if (prodCategory.toLowerCase().includes('árbol') || prodCategory.toLowerCase().includes('arbol')) {
        meetHeight = prod.height === selectedHeight;
      } else {
        meetHeight = false; 
      }
    }

    // 4. Price Filter
    const activePrice = prod.discountPrice || prod.price;
    const meetPrice = activePrice <= maxPrice;

    return meetCategory && meetSubCategory && meetColor && meetHeight && meetPrice;
  }).sort((a, b) => {
    if (sortOption === 'newest') {
      const isNewA = isProductNew(a);
      const isNewB = isProductNew(b);
      if (isNewA && !isNewB) return -1;
      if (!isNewA && isNewB) return 1;
      const dateA = a.publicationDate ? new Date(a.publicationDate).getTime() : 0;
      const dateB = b.publicationDate ? new Date(b.publicationDate).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    }
    if (sortOption === 'trees-first') {
      const isTreeA = (a.category || '').toLowerCase().includes('árbol') || (a.category || '').toLowerCase().includes('arbol');
      const isTreeB = (b.category || '').toLowerCase().includes('árbol') || (b.category || '').toLowerCase().includes('arbol');
      if (isTreeA && !isTreeB) return -1;
      if (!isTreeA && isTreeB) return 1;
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    }
    if (sortOption === 'name-asc') {
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    }
    if (sortOption === 'name-desc') {
      return b.name.localeCompare(a.name, 'es', { sensitivity: 'base' });
    }
    if (sortOption === 'price-asc') {
      const priceA = a.discountPrice || a.price;
      const priceB = b.discountPrice || b.price;
      return priceA - priceB;
    }
    if (sortOption === 'price-desc') {
      const priceA = a.discountPrice || a.price;
      const priceB = b.discountPrice || b.price;
      return priceB - priceA;
    }
    if (sortOption === 'discount-desc') {
      const discA = a.discountPercentage || 0;
      const discB = b.discountPercentage || 0;
      return discB - discA;
    }
    const isTreeA = (a.category || '').toLowerCase().includes('árbol') || (a.category || '').toLowerCase().includes('arbol');
    const isTreeB = (b.category || '').toLowerCase().includes('árbol') || (b.category || '').toLowerCase().includes('arbol');
    if (isTreeA && !isTreeB) return -1;
    if (!isTreeA && isTreeB) return 1;
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });

  // Calculate items for current page
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(val);
  };

  const getCategoryCount = (cat: string) => {
    if (cat === 'Todos') return inStockProducts.length;
    return inStockProducts.filter((p) => (p.category || 'Decoraciones') === cat).length;
  };

  // Helper to generate compact page numbers list for pagination
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [1];

    if (currentPage > 3) {
      pages.push('...');
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }

    if (currentPage < totalPages - 2) {
      pages.push('...');
    }

    if (!pages.includes(totalPages)) {
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <section id="catalogo" className="py-10 sm:py-14 bg-stone-50 border-b border-stone-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* --- SEARCH BAR, NUEVOS FILTER & SORT CONTROLS --- */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 items-center">
          {/* Search Input Bar */}
          <div className="sm:col-span-2 lg:col-span-5 relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-stone-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              id="input-catalog-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, referencia, categoría, color..."
              className="w-full pl-11 pr-10 py-3 bg-white border border-stone-250 hover:border-stone-400 focus:border-brand-blue rounded-2xl text-xs sm:text-sm font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 shadow-xs transition-all"
            />
            {searchQuery && (
              <button
                id="btn-clear-catalog-search"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Button: Productos Nuevos */}
          <div className="sm:col-span-1 lg:col-span-3">
            <button
              id="btn-filter-new-products"
              onClick={() => setShowOnlyNew(!showOnlyNew)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-xs border cursor-pointer select-none ${
                showOnlyNew
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-500/20'
                  : 'bg-white border-stone-250 hover:border-emerald-500 hover:text-emerald-700 text-stone-700'
              }`}
            >
              <Sparkles className={`w-4 h-4 ${showOnlyNew ? 'text-white' : 'text-emerald-600 animate-pulse'}`} />
              <span>Productos Nuevos</span>
              {newProductsCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black font-mono ${
                  showOnlyNew ? 'bg-white text-emerald-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {newProductsCount}
                </span>
              )}
            </button>
          </div>

          {/* Sort Selector Dropdown */}
          <div className="sm:col-span-1 lg:col-span-4 relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
              <ArrowUpDown className="w-4 h-4" />
            </div>
            <select
              id="select-catalog-sort"
              value={sortOption}
              onChange={(e) => {
                const val = e.target.value;
                setSortOption(val);
                if (val === 'newest') {
                  setShowOnlyNew(true);
                }
              }}
              className="appearance-none w-full pl-10 pr-10 py-3 bg-white border border-stone-250 hover:border-stone-400 rounded-2xl text-xs sm:text-sm font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 shadow-xs hover:cursor-pointer transition-all"
            >
              <option value="trees-first">Destacado</option>
              <option value="newest">Productos Nuevos</option>
              <option value="name-asc">Nombre (A - Z)</option>
              <option value="name-desc">Nombre (Z - A)</option>
              <option value="price-asc">Precio: Menor a Mayor</option>
              <option value="price-desc">Precio: Mayor a Menor</option>
              <option value="discount-desc">Mayor Descuento</option>
            </select>
            <ChevronDown className="absolute right-3.5 top-3.5 pointer-events-none w-4 h-4 text-stone-400" />
          </div>
        </div>

        {/* --- ACTIVE CATEGORY BANNER HEADER --- */}
        {selectedCategory !== 'Todos' && (
          <div className="mb-6 p-4.5 rounded-2xl bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-white border border-stone-800 flex flex-wrap items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center font-bold flex-shrink-0">
                {selectedCategory.toLowerCase().includes('árbol') || selectedCategory.toLowerCase().includes('arbol') ? <TreePine className="w-5 h-5" /> :
                 selectedCategory.toLowerCase().includes('pesebre') || selectedCategory.toLowerCase().includes('nacimiento') ? <Gift className="w-5 h-5" /> :
                 selectedCategory.toLowerCase().includes('bola') ? <CircleDot className="w-5 h-5" /> :
                 selectedCategory.toLowerCase().includes('cinta') || selectedCategory.toLowerCase().includes('malla') ? <Sparkles className="w-5 h-5" /> :
                 selectedCategory.toLowerCase().includes('ilumina') || selectedCategory.toLowerCase().includes('luces') ? <Lightbulb className="w-5 h-5" /> :
                 selectedCategory.toLowerCase().includes('flor') || selectedCategory.toLowerCase().includes('follaje') ? <Flower2 className="w-5 h-5" /> :
                 selectedCategory.toLowerCase().includes('cocina') || selectedCategory.toLowerCase().includes('utensilio') ? <Utensils className="w-5 h-5" /> :
                 <Sparkles className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="text-base font-extrabold flex items-center gap-2 text-white">
                  <span>Categoría Seleccionada: {selectedCategory}</span>
                </h4>
                <p className="text-xs text-stone-300 mt-0.5">
                  {selectedCategory === 'Árboles' 
                    ? 'Todos los árboles aplican para el Plan Separe del 30%. ¡Asegura tu árbol con tiempo!'
                    : `Explora la colección exclusiva de ${selectedCategory} en Impormax.`
                  }
                </p>
              </div>
            </div>

            <button
              onClick={() => handleCategoryChange('Todos')}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Ver todas las categorías</span>
            </button>
          </div>
        )}

        {/* --- ADVANCED FILTER BAR --- */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 mb-10 shadow-sm space-y-6">
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${availableSubCategories.length > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-5 sm:gap-6 items-end`}>
            
            {/* Subcategory Filter (if present from API) */}
            {availableSubCategories.length > 0 && (
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-stone-500 uppercase tracking-wider font-mono">
                  <Filter className="w-3.5 h-3.5 text-stone-400" />
                  Subcategoría
                </label>
                <div className="relative">
                  <select
                    value={selectedSubCategory}
                    onChange={(e) => setSelectedSubCategory(e.target.value)}
                    className="appearance-none w-full px-4 py-3 bg-stone-50 border border-stone-250 hover:border-stone-400 rounded-xl text-xs font-medium text-stone-800 focus:outline-brand-blue focus:ring-1 focus:ring-brand-blue hover:cursor-pointer transition-colors"
                  >
                    {subCategoriesList.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub === 'Todos' ? 'Todas las subcategorías' : sub}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-3.5 pointer-events-none w-4 h-4 text-stone-400" />
                </div>
              </div>
            )}

            {/* Color Filter */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-stone-500 uppercase tracking-wider font-mono">
                <Palette className="w-3.5 h-3.5 text-stone-400" />
                Color del Follaje/Diseño
              </label>
              <div className="relative">
                <select
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="appearance-none w-full px-4 py-3 bg-stone-50 border border-stone-250 hover:border-stone-400 rounded-xl text-xs font-medium text-stone-800 focus:outline-brand-blue focus:ring-1 focus:ring-brand-blue hover:cursor-pointer transition-colors"
                >
                  {colorsList.map((col) => (
                    <option key={col} value={col}>
                      {col === 'Todos' ? 'Todos los colores' : col}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-3.5 pointer-events-none w-4 h-4 text-stone-400" />
              </div>
            </div>

            {/* Height Filter (Restored next to Color) */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-stone-500 uppercase tracking-wider font-mono">
                <Ruler className="w-3.5 h-3.5 text-stone-400" />
                Altura (Árboles)
              </label>
              <div className="relative">
                <select
                  value={selectedHeight}
                  onChange={(e) => setSelectedHeight(e.target.value)}
                  className="appearance-none w-full px-4 py-3 bg-stone-50 border border-stone-250 hover:border-stone-400 rounded-xl text-xs font-medium text-stone-800 focus:outline-brand-blue focus:ring-1 focus:ring-brand-blue hover:cursor-pointer transition-colors"
                >
                  {heightOptions.map((h) => (
                    <option key={h.value} value={h.value}>
                      {h.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-3.5 pointer-events-none w-4 h-4 text-stone-400" />
              </div>
            </div>

            {/* Price Slider (Tope 10 millones) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-stone-500 uppercase tracking-wider font-mono">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-stone-400" />
                  Presupuesto Máx:
                </span>
                <span className="text-stone-900 font-bold font-mono text-[13px]">{formatCOP(maxPrice)}</span>
              </div>
              <input
                type="range"
                min="10000"
                max="10000000"
                step="50000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-brand-blue cursor-ew-resize py-2"
              />
              <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                <span>$10k</span>
                <span>$10M COP</span>
              </div>
            </div>

          </div>

          {/* Active Filter Badges & Reset Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-stone-150 gap-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[10px] text-stone-400 uppercase tracking-wider font-bold font-mono">Filtros Activos:</span>
              
              {selectedCategory !== 'Todos' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 border border-stone-200 text-stone-700 text-[10px] font-bold">
                  Categoría: {selectedCategory}
                  <button onClick={() => { setSelectedCategory('Todos'); setSelectedSubCategory('Todos'); }} className="text-stone-400 hover:text-stone-900 font-bold ml-1 cursor-pointer">×</button>
                </span>
              )}

              {selectedSubCategory !== 'Todos' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 border border-stone-200 text-stone-700 text-[10px] font-bold">
                  Subcategoría: {selectedSubCategory}
                  <button onClick={() => setSelectedSubCategory('Todos')} className="text-stone-400 hover:text-stone-900 font-bold ml-1 cursor-pointer">×</button>
                </span>
              )}
              
              {selectedColor !== 'Todos' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 border border-stone-200 text-stone-700 text-[10px] font-bold">
                  Color: {selectedColor}
                  <button onClick={() => setSelectedColor('Todos')} className="text-stone-400 hover:text-stone-900 font-bold ml-1 cursor-pointer">×</button>
                </span>
              )}

              {selectedHeight !== 'Todos' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 border border-stone-200 text-stone-700 text-[10px] font-bold">
                  Altura: {selectedHeight}
                  <button onClick={() => setSelectedHeight('Todos')} className="text-stone-400 hover:text-stone-900 font-bold ml-1 cursor-pointer">×</button>
                </span>
              )}

              {maxPrice < 10000000 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 border border-stone-200 text-stone-700 text-[10px] font-bold">
                  Precio &lt;= {formatCOP(maxPrice)}
                  <button onClick={() => setMaxPrice(10000000)} className="text-stone-400 hover:text-stone-900 font-bold ml-1 cursor-pointer">×</button>
                </span>
              )}

              {searchQuery.trim() && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-bold">
                  <Search className="w-3 h-3 text-blue-600" />
                  Búsqueda: &ldquo;{searchQuery}&rdquo; ({filteredProducts.length})
                  <button onClick={() => setSearchQuery('')} className="text-blue-500 hover:text-blue-900 font-bold ml-1 cursor-pointer">×</button>
                </span>
              )}

              {showOnlyNew && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Solo Productos Nuevos
                  <button onClick={() => setShowOnlyNew(false)} className="text-emerald-500 hover:text-emerald-900 font-bold ml-1 cursor-pointer">×</button>
                </span>
              )}

              {selectedCategory === 'Todos' && !showOnlyNew && !searchQuery.trim() && selectedSubCategory === 'Todos' && selectedColor === 'Todos' && selectedHeight === 'Todos' && maxPrice === 10000000 && (
                <span className="text-[11px] text-stone-500 italic">Ningún filtro aplicado</span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowOnlyNew(false);
                  setSelectedCategory('Todos');
                  setSelectedSubCategory('Todos');
                  setSelectedColor('Todos');
                  setSelectedHeight('Todos');
                  setMaxPrice(10000000);
                  setSearchQuery('');
                  setSortOption('trees-first');
                  if (externalSetCategory) externalSetCategory('Todos');
                }}
                className="px-3.5 py-1.5 rounded-lg text-[10px] font-bold text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer uppercase font-mono"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>

        {/* --- PRODUCTS SECTION --- */}
        {isLoadingCatalog ? (
          /* Loading State Grid (3 columns) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((placeholder) => (
              <div key={placeholder} className="border border-stone-200 rounded-3xl bg-white p-5 space-y-4 shadow-sm animate-pulse">
                <div className="w-full h-64 bg-stone-100 rounded-2xl" />
                <div className="h-4 bg-stone-200 rounded w-3/4" />
                <div className="h-3 bg-stone-200 rounded w-1/2" />
                <div className="h-10 bg-stone-200 rounded w-full mt-4" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          /* Empty State */
          <div className="text-center py-20 border border-stone-200 rounded-3xl bg-white max-w-xl mx-auto shadow-sm">
            <AlertCircle className="w-12 h-12 text-stone-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-stone-900">Ningún producto coincide</h3>
            <p className="text-xs text-stone-500 mt-2 px-6 max-w-sm mx-auto">
              Prueba modificando tu presupuesto máximo, limpiando filtros activos, o seleccionando otra categoría arriba.
            </p>
            <button
              onClick={() => { 
                setSelectedCategory('Todos'); 
                setSelectedColor('Todos'); 
                setSelectedHeight('Todos'); 
                setMaxPrice(1500000); 
              }}
              className="mt-5 px-5 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
            >
              Restablecer Filtros
            </button>
          </div>
        ) : (
          /* Products Grid with Paginated Items */
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {paginatedProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  onSelectProduct={onSelectProduct}
                  onOpenDetail={setSelectedDetailProduct}
                />
              ))}
            </div>

            {/* --- PAGINATION CONTROLS --- */}
            {totalPages > 1 && (
              <div className="flex flex-col md:flex-row items-center justify-between border-t border-stone-200 pt-8 mt-12 gap-4">
                <div className="flex items-center flex-wrap gap-3">
                  <span className="text-xs font-semibold text-stone-500 font-mono">
                    Mostrando {startIndex + 1} - {Math.min(startIndex + ITEMS_PER_PAGE, filteredProducts.length)} de {filteredProducts.length} productos
                  </span>
                  {totalPages > 5 && (
                    <div className="flex items-center gap-1.5 text-xs text-stone-600">
                      <span className="text-stone-400 font-mono hidden sm:inline">| Ir a:</span>
                      <select
                        value={currentPage}
                        onChange={(e) => {
                          setCurrentPage(Number(e.target.value));
                          const el = document.getElementById('catalogo');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs font-mono font-bold text-stone-800 focus:outline-none focus:border-brand-blue cursor-pointer shadow-2xs"
                      >
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                          <option key={pg} value={pg}>
                            Pág. {pg} ({((pg - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(pg * ITEMS_PER_PAGE, filteredProducts.length)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-full">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => {
                      setCurrentPage((prev) => Math.max(prev - 1, 1));
                      const el = document.getElementById('catalogo');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-3 py-2 rounded-xl border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 text-xs font-bold disabled:opacity-40 disabled:hover:bg-white flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>

                  {getPageNumbers().map((pageItem, idx) => {
                    if (pageItem === '...') {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-2 py-1 text-stone-400 font-mono text-xs select-none">
                          ...
                        </span>
                      );
                    }
                    const pageNum = pageItem as number;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => {
                          setCurrentPage(pageNum);
                          const el = document.getElementById('catalogo');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className={`w-9 h-9 rounded-xl text-xs font-extrabold font-mono transition-all flex items-center justify-center cursor-pointer ${
                          currentPage === pageNum
                            ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/25 border border-brand-blue'
                            : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => {
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages));
                      const el = document.getElementById('catalogo');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-3 py-2 rounded-xl border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 text-xs font-bold disabled:opacity-40 disabled:hover:bg-white flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Single Product Detailed View Modal */}
        <AnimatePresence>
          {selectedDetailProduct && (
            <ProductDetailModal
              product={selectedDetailProduct}
              allProducts={products}
              onClose={() => setSelectedDetailProduct(null)}
              onAddToCart={(prod) => {
                onSelectProduct(prod);
              }}
              onBuyNow={(prod) => {
                onSelectProduct(prod);
                setSelectedDetailProduct(null);
              }}
              onSelectRelatedProduct={(rel) => {
                setSelectedDetailProduct(rel);
              }}
            />
          )}
        </AnimatePresence>

      </div>
    </section>
  );
}

/**
 * Individual Product Card Component with Inline Multi-Image Carousel
 */
function ProductCard({
  p,
  onSelectProduct,
  onOpenDetail
}: {
  key?: string;
  p: Product;
  onSelectProduct: (product: Product) => void;
  onOpenDetail: (product: Product) => void;
}) {
  const [slideIndex, setSlideIndex] = useState(0);

  // Gallery of images for this card - Únicamente fotos reales traídas del ERP
  const images = Array.from(
    new Set(
      [
        p.imageUrl,
        ...(p.images || []),
        p.fallbackImageUrl
      ].filter((img): img is string => Boolean(img) && typeof img === 'string' && img.trim() !== '' && !img.includes('unsplash.com'))
    )
  );

  const handleNextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSlideIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSlideIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const discountPct = p.discountPercentage || (p.discountPrice && p.price ? Math.round(((p.price - p.discountPrice) / p.price) * 100) : 0);
  const activePrice = p.discountPrice || p.price;
  const originalPrice = p.discountPrice ? p.price : undefined;
  const isLowStock = (p.stock ?? 0) <= 5 && (p.stock ?? 0) > 0;
  const isNew = isProductNew(p);
  const hasVideo = Boolean(getProductVideoUrl(p));

  const isEligibleDirectly = activePrice >= 200000;
  const depositPercentage = 30;
  const depositFee = (activePrice * 30) / 100;

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(val);
  };

  const hasDistinctDescription = Boolean(
    p.description &&
    p.description.trim().toLowerCase() !== p.name.trim().toLowerCase()
  );

  const distinctFeatures = (p.features || []).filter((f) => {
    const feat = f.toLowerCase().trim();
    return (
      !feat.startsWith('referencia') &&
      !feat.startsWith('categoría') &&
      !feat.startsWith('categoria') &&
      !feat.startsWith('subcategoría') &&
      !feat.startsWith('subcategoria') &&
      !feat.includes('código') &&
      !feat.includes('codigo') &&
      !feat.includes('grupo') &&
      !feat.includes('costo') &&
      !feat.includes('bodega') &&
      !feat.includes('dimensión') &&
      !feat.includes('dimension') &&
      !feat.includes('altura') &&
      !feat.includes('tamaño') &&
      !feat.includes('tamano') &&
      !feat.includes('diámetro') &&
      !feat.includes('diametro') &&
      feat !== p.name.toLowerCase().trim() &&
      feat !== (p.reference || '').toLowerCase().trim()
    );
  });

  return (
    <motion.div
      layoutId={`product-${p.id}`}
      className="group relative border border-stone-200 rounded-3xl bg-white hover:shadow-xl hover:border-stone-300/80 transition-all duration-300 overflow-hidden flex flex-col justify-between"
    >
      {/* Floating badge for discount percentage (Esquina superior izquierda) */}
      {discountPct > 0 && (
        <div className="absolute top-3.5 left-3.5 z-10 px-3 py-1.5 rounded-full bg-red-600 text-white shadow-md text-xs font-black uppercase tracking-wider pointer-events-none flex items-center gap-1 font-mono">
          <Sparkles className="w-3 h-3 text-white animate-pulse" />
          <span>-{discountPct}% DCTO</span>
        </div>
      )}

      {/* Floating badge for NUEVO (Esquina superior derecha) */}
      {isNew && (
        <div className="absolute top-3.5 right-3.5 z-20 px-3 py-1 rounded-full bg-emerald-600 text-white shadow-md text-xs font-black uppercase tracking-wider pointer-events-none flex items-center gap-1 font-mono">
          <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
          <span>NUEVO</span>
        </div>
      )}

      {/* Stock warning */}
      {isLowStock && (
        <div className={`absolute ${isNew ? 'top-11' : 'top-3.5'} right-3.5 z-10 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm pointer-events-none`}>
          ¡Pocas Unidades! ({p.stock})
        </div>
      )}

      {/* Product Image Stage with In-Card Carousel */}
      <div
        onClick={() => onOpenDetail(p)}
        className="relative h-64 w-full overflow-hidden bg-stone-50 cursor-pointer group/img flex items-center justify-center p-2 border-b border-stone-100"
      >
        <img
          src={images[slideIndex]}
          alt={p.name}
          className="w-full h-full object-contain group-hover/img:scale-102 transition-transform duration-300"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const fallback = p.fallbackImageUrl || 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800';
            if (e.currentTarget.src !== fallback) {
              e.currentTarget.src = fallback;
            }
          }}
        />

        {/* Carousel Prev & Next Arrows (Visible on hover or touch) */}
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrevSlide}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-stone-900 shadow-md flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer z-20"
              title="Imagen anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextSlide}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-stone-900 shadow-md flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer z-20"
              title="Siguiente imagen"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Video Available Badge (Esquina inferior izquierda de la imagen) */}
        {hasVideo && (
          <div className="absolute bottom-3 left-3 z-20 px-2.5 py-1 rounded-full bg-red-600/90 backdrop-blur-xs text-white shadow-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 font-mono pointer-events-none">
            <Play className="w-2.5 h-2.5 fill-white text-white" />
            <span>Video</span>
          </div>
        )}

        {/* Carousel Dots / Pills Bar */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-stone-900/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setSlideIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  slideIndex === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        )}

        {/* "Ver Detalle Completo" Hover Overlay hint */}
        <div className="absolute inset-0 bg-stone-950/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <span className="px-3.5 py-2 bg-white/95 text-stone-900 rounded-full text-xs font-extrabold shadow-lg flex items-center gap-1.5 font-mono">
            <Eye className="w-4 h-4 text-brand-blue" />
            Ver Detalle Completo
          </span>
        </div>
      </div>

      {/* Specifications */}
      <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2 cursor-pointer" onClick={() => onOpenDetail(p)}>
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest font-mono">
            <span className="text-brand-blue font-bold">
              {p.category || 'Decoración'}
            </span>
            <span className="text-stone-600 font-bold bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
              Referencia: {p.reference || p.id}
            </span>
          </div>
          <h3 className="text-base font-bold text-stone-900 leading-snug line-clamp-2 hover:text-brand-blue transition-colors">
            {p.name}
          </h3>
          {hasDistinctDescription && (
            <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
              {p.description}
            </p>
          )}
        </div>

        {/* Features checklist (solo si hay características reales distintas y no repetidas) */}
        {distinctFeatures.length > 0 && (
          <div className="space-y-1.5 pt-3 border-t border-stone-100 text-[11px] text-stone-600">
            {distinctFeatures.slice(0, 2).map((f, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span className="truncate">{f}</span>
              </div>
            ))}
          </div>
        )}

        {/* Price & Separation Highlight */}
        <div className="pt-4 border-t border-stone-100 flex items-end justify-between cursor-pointer" onClick={() => onOpenDetail(p)}>
          <div>
            {originalPrice && originalPrice > activePrice && (
              <span className="text-[10px] text-stone-400 line-through block font-mono">
                {formatCOP(originalPrice)}
              </span>
            )}
            <span className="text-base font-extrabold text-stone-950 block leading-tight font-mono">
              {formatCOP(activePrice)}
            </span>
            <span className="text-[9px] text-stone-500 uppercase font-mono font-bold">
              Precio Total
            </span>
          </div>
          
          {isEligibleDirectly && (
            <div className="text-right">
              <span className="text-[9px] text-brand-blue font-extrabold uppercase block tracking-wider font-mono">
                Plan Separe 30%
              </span>
              <span className="text-base font-extrabold block font-mono text-brand-blue">
                {formatCOP(depositFee)}
              </span>
              <span className="text-[9px] text-stone-500 uppercase block leading-none mt-0.5 font-bold">
                Abono inicial
              </span>
            </div>
          )}
        </div>

        {/* Stock indicator (visible únicamente si quedan 5 o menos unidades o agotado) */}
        {p.stock !== undefined && (p.stock ?? 0) <= 5 && (
          <div className="text-[11px] font-mono flex items-center justify-between pt-1">
            <span className="text-stone-500 font-medium">Stock disponible:</span>
            {(p.stock ?? 0) <= 0 ? (
              <span className="text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded font-bold uppercase text-[10px]">
                Agotado
              </span>
            ) : (
              <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-bold text-[10px]">
                ¡Últimas {p.stock} unidades!
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <button
            onClick={() => onOpenDetail(p)}
            className="w-full py-2.5 rounded-xl font-extrabold text-xs text-stone-800 bg-stone-100 hover:bg-stone-200 border border-stone-200/80 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-4 h-4 text-brand-blue" />
            <span>Ver Producto y Simulador</span>
          </button>

          <button
            onClick={() => onSelectProduct(p)}
            disabled={(p.stock ?? 0) <= 0}
            className={`w-full py-3 rounded-xl font-bold text-xs tracking-wider border transition-all flex items-center justify-center gap-2 shadow-sm ${
              (p.stock ?? 0) <= 0
                ? 'bg-stone-200 border-stone-300 text-stone-400 cursor-not-allowed'
                : 'bg-brand-green border-brand-green hover:bg-brand-green-dark text-white hover:cursor-pointer'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{(p.stock ?? 0) <= 0 ? 'Agotado' : 'Agregar al Carrito'}</span>
          </button>
        </div>

      </div>
    </motion.div>
  );
}
