/** One palette for cloth shirts in the inventory, displays and equipped avatar. */
export const CLOTH_SHIRT_COLORS: Record<string, string> = {
  tunic: '#f4f1e8',
  'tunic-red': '#b82e32',
  'tunic-blue': '#254b86',
  'tunic-black': '#17171b',
  'tunic-green': '#3e693d',
};
export const clothShirtColor = (visual: string) => CLOTH_SHIRT_COLORS[visual];

export const CLOTH_PANTS_COLORS: Record<string, string> = {
  'cloth-pants-khaki': '#a38b60',
  'cloth-pants-white': CLOTH_SHIRT_COLORS.tunic,
  'cloth-pants-blue': CLOTH_SHIRT_COLORS['tunic-blue'],
  'cloth-pants-red': CLOTH_SHIRT_COLORS['tunic-red'],
  'cloth-pants-black': CLOTH_SHIRT_COLORS['tunic-black'],
  'cloth-pants-green': CLOTH_SHIRT_COLORS['tunic-green'],
};
export const clothPantsColor = (visual: string) => CLOTH_PANTS_COLORS[visual];
