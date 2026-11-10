/** Keep a floating form in the viewport without stretching its task row. */
export function popoverPosition(anchor: {right:number;top:number;bottom:number}, size: {width:number;height:number}, viewport: {width:number;height:number}) {
  const margin = 12;
  const left = Math.max(margin, Math.min(anchor.right-size.width, viewport.width-size.width-margin));
  const below = viewport.height-anchor.bottom-margin-8;
  const above = anchor.top-margin-8;
  const upwards = below<size.height && above>below;
  const maxHeight = Math.max(80, upwards?above:below);
  const top = upwards ? Math.max(margin, anchor.top-Math.min(size.height,maxHeight)-8) : Math.max(margin,anchor.bottom+8);
  return {left, top, maxHeight};
}
