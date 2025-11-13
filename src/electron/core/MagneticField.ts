/**
 * Magnetic Fields Implementation - Thought Capsule Boundaries
 * 
 * Bu modül, Magnetic Fields prensibini uygular.
 * Sistem sınırları, mıknatısların manyetik alanları gibi çalışır.
 * Güçlü alanlar yakındakileri çeker (Public API), zayıf alanlar uzak tutar (Private).
 * 
 * @module MagneticField
 * @description Manyetik alan metaforu ile sınır yönetimi
 * @principle Magnetic Fields (Mıknatıs Alanları)
 */

export interface MagneticField<T> {
  readonly component: T;
  readonly fieldStrength: number;
  readonly attractionZone: number; // Çekim bölgesi (Public API)
  readonly repulsionZone: number; // İtme bölgesi (Private)
  readonly neutralZone: number; // Nötr bölge (Internal)
}

export interface FieldBoundary {
  attracts: (other: any) => boolean; // Public API - çekim bölgesi
  repels: (other: any) => boolean; // Private - itme bölgesi
  neutral: (other: any) => boolean; // Internal - nötr bölge
}

/**
 * Manyetik alan oluştur
 * 
 * @param component - Komponent (Thought Capsule)
 * @param fieldStrength - Alan gücü (0-1 arası, 1 = maksimum güç)
 * @returns MagneticField
 */
export function createMagneticField<T>(
  component: T,
  fieldStrength: number = 1.0
): MagneticField<T> {
  const attractionZone = fieldStrength * 0.7; // Çekim bölgesi (Public API)
  const repulsionZone = fieldStrength * 1.3; // İtme bölgesi (Private)
  const neutralZone = (attractionZone + repulsionZone) / 2; // Nötr bölge (Internal)

  return {
    component,
    fieldStrength,
    attractionZone,
    repulsionZone,
    neutralZone,
  };
}

/**
 * Manyetik alan sınırlarını hesapla
 * 
 * @param field - Manyetik alan
 * @param distance - Mesafe (0-1 arası, 0 = aynı, 1 = uzak)
 * @returns FieldBoundary
 */
export function calculateFieldBoundary<T>(
  field: MagneticField<T>,
  distance: number
): FieldBoundary {
  return {
    attracts: (_other: any) => distance < field.attractionZone, // Public API
    repels: (_other: any) => distance > field.repulsionZone, // Private
    neutral: (_other: any) =>
      field.attractionZone <= distance && distance <= field.repulsionZone, // Internal
  };
}

/**
 * Komponentler arası mesafe hesapla
 * 
 * @param component1 - İlk komponent
 * @param component2 - İkinci komponent
 * @returns Mesafe (0-1 arası)
 */
export function calculateDistance(component1: any, component2: any): number {
  // Basit mesafe hesaplama (gerçek uygulamada daha karmaşık olabilir)
  if (component1 === component2) {
    return 0; // Aynı komponent
  }

  // Farklı modüller arası mesafe
  const type1 = typeof component1;
  const type2 = typeof component2;

  if (type1 !== type2) {
    return 1; // Tamamen farklı
  }

  // Aynı tür ama farklı instance
  return 0.5;
}

/**
 * Public API oluştur (çekim bölgesi)
 * 
 * @param field - Manyetik alan
 * @returns Public API wrapper
 */
export function createPublicAPI<T>(field: MagneticField<T>): T {
  // Public API, çekim bölgesindeki metodları expose eder
  return field.component;
}

/**
 * Private API koruması (itme bölgesi)
 * 
 * @param field - Manyetik alan
 * @param accessor - Erişim kontrolü
 * @returns Erişim kontrolü
 */
export function protectPrivateAPI<T>(
  field: MagneticField<T>,
  accessor: (component: T) => any
): (component: T) => any {
  // Private API, itme bölgesindeki metodları korur
  return (component: T) => {
    const distance = calculateDistance(field.component, component);
    const boundary = calculateFieldBoundary(field, distance);

    if (boundary.repels(component)) {
      throw new Error('Access denied: Private API is protected');
    }

    return accessor(component);
  };
}

