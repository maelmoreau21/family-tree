import { CardDim } from "./templates"

export default function setupCardSvgDefs(svg: SVGElement, card_dim: CardDim) {
  if (svg.querySelector("defs#f3CardDef")) return
  
  const safeW = Number.isFinite(Number(card_dim.w)) ? Math.max(0, Math.floor(Number(card_dim.w))) : 0
  const safeH = Number.isFinite(Number(card_dim.h)) ? Math.max(0, Math.floor(Number(card_dim.h))) : 0
  const safeImgW = Number.isFinite(Number(card_dim.img_w)) ? Math.max(0, Math.floor(Number(card_dim.img_w))) : 0
  const safeImgH = Number.isFinite(Number(card_dim.img_h)) ? Math.max(0, Math.floor(Number(card_dim.img_h))) : 0

  
  const svgns = 'http://www.w3.org/2000/svg'
  const defs = document.createElementNS(svgns, 'defs')
  defs.setAttribute('id', 'f3CardDef')

  const linear = document.createElementNS(svgns, 'linearGradient')
  linear.setAttribute('id', 'fadeGrad')
  const stop1 = document.createElementNS(svgns, 'stop')
  stop1.setAttribute('offset', '0.9')
  stop1.setAttribute('stop-color', 'white')
  stop1.setAttribute('stop-opacity', '0')
  const stop2 = document.createElementNS(svgns, 'stop')
  stop2.setAttribute('offset', '.91')
  stop2.setAttribute('stop-color', 'white')
  stop2.setAttribute('stop-opacity', '0.5')
  const stop3 = document.createElementNS(svgns, 'stop')
  stop3.setAttribute('offset', '1')
  stop3.setAttribute('stop-color', 'white')
  stop3.setAttribute('stop-opacity', '1')
  linear.appendChild(stop1)
  linear.appendChild(stop2)
  linear.appendChild(stop3)

  const mask = document.createElementNS(svgns, 'mask')
  mask.setAttribute('id', 'fade')
  mask.setAttribute('maskContentUnits', 'objectBoundingBox')
  const maskRect = document.createElementNS(svgns, 'rect')
  maskRect.setAttribute('width', '1')
  maskRect.setAttribute('height', '1')
  maskRect.setAttribute('fill', 'url(#fadeGrad)')
  mask.appendChild(maskRect)

  const clipCard = document.createElementNS(svgns, 'clipPath')
  clipCard.setAttribute('id', 'card_clip')
  const clipCardPath = document.createElementNS(svgns, 'path')
  clipCardPath.setAttribute('d', curvedRectPath({ w: safeW, h: safeH }, 5))
  clipCard.appendChild(clipCardPath)

  const clipText = document.createElementNS(svgns, 'clipPath')
  clipText.setAttribute('id', 'card_text_clip')
  const clipTextRect = document.createElementNS(svgns, 'rect')
  clipTextRect.setAttribute('width', String(Math.max(0, safeW - 10)))
  clipTextRect.setAttribute('height', String(safeH))
  clipText.appendChild(clipTextRect)

  const clipImage = document.createElementNS(svgns, 'clipPath')
  clipImage.setAttribute('id', 'card_image_clip')
  const clipImagePath = document.createElementNS(svgns, 'path')
  clipImagePath.setAttribute('d', `M0,0 Q 0,0 0,0 H${safeImgW} V${safeImgH} H0 Q 0,${safeImgH} 0,${safeImgH} z`)
  clipImage.appendChild(clipImagePath)

  const clipImageCurved = document.createElementNS(svgns, 'clipPath')
  clipImageCurved.setAttribute('id', 'card_image_clip_curved')
  const clipImageCurvedPath = document.createElementNS(svgns, 'path')
  clipImageCurvedPath.setAttribute('d', curvedRectPath({ w: safeImgW, h: safeImgH }, 5, ['rx', 'ry']))
  clipImageCurved.appendChild(clipImageCurvedPath)

  defs.appendChild(linear)
  defs.appendChild(mask)
  defs.appendChild(clipCard)
  defs.appendChild(clipText)
  defs.appendChild(clipImage)
  defs.appendChild(clipImageCurved)

  svg.insertBefore(defs, svg.firstChild)

  function curvedRectPath(dim: {w: number, h: number}, curve: number, no_curve_corners?: string[]) {
    const {w,h} = dim,
      c = curve,
      ncc = no_curve_corners || [],
      ncc_check = (corner: string) => ncc.includes(corner),
      lx = ncc_check('lx') ? `M0,0` : `M0,${c} Q 0,0 5,0`,
      rx = ncc_check('rx') ? `H${w}` : `H${w-c} Q ${w},0 ${w},5`,
      ry = ncc_check('ry') ? `V${h}` : `V${h-c} Q ${w},${h} ${w-c},${h}`,
      ly = ncc_check('ly') ? `H0` : `H${c} Q 0,${h} 0,${h-c}`

    return (`${lx} ${rx} ${ry} ${ly} z`)
  }
}

export function updateCardSvgDefs(svg: SVGElement, card_dim: CardDim) {
  if (svg.querySelector("defs#f3CardDef")) {
    svg.querySelector("defs#f3CardDef")!.remove()
  }
  setupCardSvgDefs(svg, card_dim)
}