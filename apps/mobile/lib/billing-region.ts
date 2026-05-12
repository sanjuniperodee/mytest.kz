/**
 * Экраны Kaspi и тарифов в приложении — только если геолокация явно определила РК.
 * При `null` (ещё грузим) коммерцию не показываем.
 */
export function mayAccessKaspiCommerce(isInKZ: boolean | null): boolean {
  return isInKZ === true
}
