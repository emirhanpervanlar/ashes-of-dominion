/** Master palette shared by every pixel icon and sprite (DESIGN_LANGUAGE 7). '.' is transparent and has no entry. */
export type Palette = Readonly<Record<string, string>>;

export const MASTER: Palette = {
  k: '#100e0c', // outline
  w: '#e6dcc3', W: '#faf3df', // bone white, highlight
  g: '#9a907d', d: '#544d42', // grey, dark grey
  s: '#66707a', S: '#33393e', l: '#aab5be', // steel, steel shade, steel light
  y: '#cfa93f', Y: '#7a5f1c', j: '#ecd082', // gold, shade, light
  t: '#6b4a2b', T: '#3c2916', u: '#94673a', // brown, shade, light
  f: '#dfae82', F: '#a9744c', // skin, skin shade
  a: '#c4622d', A: '#7a3416', h: '#e58f52', // terracotta, shade, light
  q: '#a3c452', Q: '#6a9433', O: '#3b561b', // goblin green, shade, dark
  z: '#62804a', Z: '#33472a', x: '#8fac6c', // orc green, shade, light
  b: '#3f6f95', B: '#21405a', // blue, shade
  n: '#4f7a3a', N: '#22381b', // green, shade
  p: '#6d4f96', // purple
  i: '#7fb7c4', I: '#cfe8ec', // ice, ice light
  o: '#b5651d', // orange
  r: '#9c2f26', R: '#4a1712', // red, shade
  e: '#e8c93a', // eye glow
};

export const TRANSPARENT = '.';
