/** Two crossing diagonals of iron links (DESIGN_LANGUAGE 6.6 "cannot act"), drawn as a stretchable SVG data URL. */
function chainLink(x: number, y: number, angle: number, open: boolean): string {
  const face = open ? '#66707a' : '#4a5259';
  return (
    `<g transform='translate(${x} ${y}) rotate(${angle.toFixed(1)})'>` +
    `<rect x='-6' y='-3' width='12' height='6' fill='#16181b'/>` +
    `<rect x='-5' y='-2' width='10' height='4' fill='${face}'/>` +
    (open ? `<rect x='-3' y='-1' width='6' height='2' fill='#16181b'/>` : '') +
    `<rect x='-5' y='-2' width='10' height='1' fill='#9aa4ad'/></g>`
  );
}

export function chainsUrl(w: number, h: number): string {
  const angle = (Math.atan2(h, w) * 180) / Math.PI;
  const links = Math.floor(Math.hypot(w, h) / 9);
  let body = '';
  for (let i = 0; i <= links; i++) {
    const t = i / links;
    body += chainLink(Math.round(t * w), Math.round(t * h), angle, i % 2 === 0);
    body += chainLink(Math.round(w - t * w), Math.round(t * h), -angle, i % 2 === 0);
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' shape-rendering='crispEdges'>${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
