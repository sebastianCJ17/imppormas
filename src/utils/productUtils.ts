import { Product } from '../types';

/**
 * Determina con precisión si un producto es NUEVO.
 * Regla de negocio:
 * Un producto es nuevo si fue publicado hoy o dentro de los últimos 15 días posteriores
 * a su fecha de publicación (0 a 15 días de antigüedad respecto al momento de la consulta).
 */
export function isProductNew(product?: Partial<Product> | null): boolean {
  if (!product) return false;

  // Si ya viene precalculado explícitamente en el backend
  if (typeof product.isNew === 'boolean') {
    return product.isNew;
  }

  const dateStr = product.publicationDate || product.createdAt;
  if (!dateStr) return false;

  try {
    const pubDate = new Date(dateStr);
    if (isNaN(pubDate.getTime())) return false;

    const now = new Date();
    // Diferencia en milisegundos
    const diffTime = now.getTime() - pubDate.getTime();
    // Convertir a días decimales
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    // Es nuevo si la fecha de publicación es hasta 15 días antes de hoy
    // (Aceptando un margen de -1 día por zonas horarias del servidor)
    return diffDays >= -1 && diffDays <= 15;
  } catch {
    return false;
  }
}

/**
 * Formatea una fecha ISO a formato legible en español (ej: "20 Ago 2026")
 */
export function formatPublicationDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch {
    return '';
  }
}

/**
 * Obtiene la URL de video demostrativo de un producto si existe.
 */
export function getProductVideoUrl(product?: Partial<Product> | null): string | null {
  if (!product) return null;
  if (product.videoUrl && typeof product.videoUrl === 'string' && product.videoUrl.trim() !== '') {
    return product.videoUrl;
  }
  const idStr = String(product.id || product.code || '').trim();
  if (idStr === '8050930') return '/video-8050930.mp4';
  if (idStr === '8050931') return '/video-8050931.mp4';
  return null;
}

