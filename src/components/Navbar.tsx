import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, TreePine, DollarSign, Calendar, Search, ShoppingCart, Layers, Gift } from 'lucide-react';

interface NavbarProps {
  onNavigate: (section: string) => void;
  activeSection: string;
  cartCount: number;
  onCartClick: () => void;
  onOpenPromo?: () => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onSearchSubmit?: () => void;
}

export default function Navbar({
  onNavigate,
  activeSection,
  cartCount,
  onCartClick,
  onOpenPromo,
  searchQuery = '',
  onSearchQueryChange,
  onSearchSubmit,
}: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const navLinks = [
    { id: 'hero', label: 'Inicio', icon: TreePine },
    { id: 'categorias', label: 'Categorías', icon: Layers },
    { id: 'separe', label: '¿Cómo funciona?', icon: Calendar },
    { id: 'portal', label: 'Mi Cuenta', icon: Search, highlight: true },
  ];

  const handleLinkClick = (id: string) => {
    onNavigate(id);
    setIsOpen(false);
  };

  const handleSearchFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (onSearchSubmit) {
      onSearchSubmit();
    } else {
      handleLinkClick('catalogo');
    }
  };

  return (
    <header className="sticky top-0 z-50 shadow-2xs">
      {/* Top Banner - Brand Blue (#0089D0) permanently sticky with 10% first order promo trigger */}
      <div
        onClick={onOpenPromo}
        className="bg-gradient-to-r from-[#0089D0] via-[#0076B3] to-[#92BF1F] text-[#FAF9F6] text-center py-2 px-3 sm:px-4 flex items-center justify-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs tracking-wide font-bold cursor-pointer hover:brightness-105 transition-all select-none"
      >
        <Gift className="w-3.5 h-3.5 text-amber-300 animate-bounce shrink-0" />
        <span className="underline decoration-white/60 underline-offset-2">
          ¡10% DE DESCUENTO EXTRA EN TU 1RA COMPRA SOBRE TODO EL PEDIDO!
        </span>
        <span className="hidden md:inline">|</span>
        <span className="hidden md:inline">
          ENVÍO GRATIS POR COMPRAS SUPERIORES A $199.000 EN CIUDADES PRINCIPALES
        </span>
        <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-white font-mono ml-1">
          Ver detalles ✨
        </span>
      </div>

      <div className="bg-[#FDFDFB]/95 backdrop-blur-md border-b border-stone-200/60">
        <div className="w-full px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between min-h-[76px] sm:min-h-[84px] py-2 gap-2">
          
          {/* Logo / Brand (Logos: Feria Navidad + IMPORMAX) */}
          {/* On mobile: stacked vertically (flex-col). On desktop (md+): side by side (md:flex-row) */}
          <div 
            className="flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-3 cursor-pointer py-1 group shrink-0" 
            onClick={() => handleLinkClick('hero')}
          >
            <img 
              src="/logonavidad.png" 
              alt="Feria Navideña" 
              className="h-8 sm:h-9 md:h-11 lg:h-12 w-auto object-contain transition-transform group-hover:scale-[1.02]"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
            />
            <span className="hidden md:block h-7 lg:h-8 w-px bg-stone-300/80" />
            <img 
              src="/logo_impormax.png" 
              alt="IMPORMAX" 
              className="h-8 sm:h-9 md:h-11 lg:h-12 w-auto object-contain transition-transform group-hover:scale-[1.02]"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Centered Desktop Nav Links */}
          <nav className="hidden md:flex items-center justify-center space-x-1 lg:space-x-2 flex-1 mx-1 lg:mx-3">
            {navLinks.filter((l) => !l.highlight).map((link) => {
              const isActive = activeSection === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleLinkClick(link.id)}
                  className={`px-2.5 lg:px-3 py-2 rounded-xl text-xs lg:text-sm font-semibold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'text-brand-blue bg-brand-blue/10 font-bold'
                      : 'text-stone-600 hover:text-brand-blue hover:bg-stone-100/80'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>

          {/* Right Desktop Action Buttons & Search next to Cart */}
          <div className="hidden md:flex items-center gap-2 lg:gap-2.5 shrink-0">
            {navLinks.filter((l) => l.highlight).map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.id}
                  onClick={() => handleLinkClick(link.id)}
                  className="px-3 lg:px-3.5 py-2 rounded-xl text-xs lg:text-sm font-semibold tracking-wide flex items-center gap-1.5 bg-brand-green hover:bg-brand-green-dark text-white shadow-xs border border-brand-green transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </button>
              );
            })}

            {/* Desktop Search Bar (Directamente al lado del Carrito con excelente visibilidad) */}
            <form onSubmit={handleSearchFormSubmit} className="relative flex items-center">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange && onSearchQueryChange(e.target.value)}
                  placeholder="Buscar productos..."
                  className="w-44 md:w-48 lg:w-60 focus:w-68 pl-9 pr-7 py-2 text-xs lg:text-sm bg-stone-100 hover:bg-stone-200/70 focus:bg-white border border-stone-200 focus:border-brand-blue rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 transition-all duration-200 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchQueryChange && onSearchQueryChange('')}
                    className="absolute right-2 text-stone-400 hover:text-stone-700 cursor-pointer p-0.5"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </form>

            {/* Desktop Cart Button (Solo Icono del Carrito sin texto) */}
            <button
              onClick={onCartClick}
              className="flex items-center justify-center p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-800 transition-all cursor-pointer relative shrink-0 shadow-2xs"
              title="Carrito de compras"
              aria-label="Carrito de compras"
            >
              <ShoppingCart className="w-5 h-5 text-stone-700" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold animate-pulse">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          {/* Mobile Search, Cart and Menu buttons */}
          <div className="md:hidden flex items-center gap-1.5 shrink-0">
            {/* Mobile Search Toggle (al lado del Carrito) */}
            <button
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
              className={`p-2 rounded-xl transition-colors focus:outline-none ${
                isMobileSearchOpen || (searchQuery && searchQuery.length > 0)
                  ? 'text-brand-blue bg-brand-blue/10'
                  : 'text-stone-600 hover:text-brand-blue hover:bg-stone-100'
              }`}
              title="Buscar por palabras clave"
              aria-label="Buscar"
            >
              <Search className="w-6 h-6" />
            </button>

            <button
              onClick={onCartClick}
              className="p-2 rounded-xl text-stone-600 hover:text-brand-blue hover:bg-stone-100 transition-colors focus:outline-none relative"
            >
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-xl text-stone-600 hover:text-brand-blue hover:bg-stone-100 transition-colors focus:outline-none"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Mobile Search Bar (Directamente accesible en móviles) */}
      <AnimatePresence>
        {isMobileSearchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-stone-200 bg-white px-3 py-2.5 shadow-xs"
          >
            <form onSubmit={handleSearchFormSubmit} className="relative flex items-center">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => onSearchQueryChange && onSearchQueryChange(e.target.value)}
                placeholder="Buscar por palabras clave, ref o código..."
                className="w-full pl-9 pr-8 py-2 bg-stone-50 border border-stone-200 focus:border-brand-blue rounded-xl text-xs font-medium text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange && onSearchQueryChange('')}
                  className="absolute right-2.5 text-stone-400 hover:text-stone-700 p-0.5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-stone-200 bg-[#FDFDFB] shadow-inner"
          >
            <div className="px-4 pt-3 pb-6 space-y-2">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isHighlight = link.highlight;
                const isActive = activeSection === link.id;

                if (isHighlight) {
                  return (
                    <button
                      key={link.id}
                      onClick={() => handleLinkClick(link.id)}
                      className="w-full mt-3 px-4 py-3 rounded-xl text-sm font-semibold tracking-wide flex items-center justify-center gap-2 bg-brand-green text-white shadow-sm"
                    >
                      <Icon className="w-4 h-4" />
                      {link.label}
                    </button>
                  );
                }

                return (
                  <button
                    key={link.id}
                    onClick={() => handleLinkClick(link.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium tracking-wide flex items-center gap-3 transition-colors ${
                      isActive
                        ? 'text-brand-blue bg-brand-blue/10 font-bold'
                        : 'text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-stone-400" />
                    {link.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </header>
  );
}
