'use client'

// ─────────────────────────────────────────────────────────
// 紅茶の水色（すいしょく）をリアルに表現する共通カップコンポーネント。
//
// 実際の紅茶は、液体の深さによって
//   ・中心（深い）＝濃く暗い
//   ・縁（浅い）＝明るい琥珀色に抜ける
// というグラデーションになる。単色塗りではなく、登録された色(hex)から
// 「中心の濃い色」「縁の明るい琥珀色」を自動計算して立体感を出す。
// あわせて、上部の光の映り込み・茶葉の微粒子も描いてリアルさを足している。
// ─────────────────────────────────────────────────────────

// hex を [R, G, B, A(0〜1)] に解析する。
// 3桁(#RGB)・4桁(#RGBA)・6桁(#RRGGBB)・8桁(#RRGGBBAA)すべてに対応。
// ※ カラーパレットは透明度付き8桁で保存しているため、8桁対応は必須。
function parseHex(hex: string): [number, number, number, number] {
  let h = hex.replace('#', '').trim()
  if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('')
  if (h.length !== 6 && h.length !== 8) return [200, 169, 110, 1]
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
  if ([r, g, b].some(isNaN)) return [200, 169, 110, 1]
  return [r, g, b, isNaN(a) ? 1 : a]
}
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`

// 2色を混ぜる（t=0でa、t=1でb）
function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [clamp(a[0] + (b[0] - a[0]) * t), clamp(a[1] + (b[1] - a[1]) * t), clamp(a[2] + (b[2] - a[2]) * t)]
}

export default function TeaCup({ hex, size = 70, tight = false }: { hex?: string; size?: number; tight?: boolean }) {
  const [r, g, b, a] = parseHex(hex ?? '#C8A96E')
  // 透明度は「淡さ」として反映する（薄い設定ほど淡い水色になる）
  const base = mix([r, g, b], [248, 242, 230], 1 - a)
  // 中心：濃い焦げ茶方向に寄せて深みを出す
  const deep = mix(base, [30, 12, 4], 0.35)
  // 縁：明るい琥珀（暖かい金白色）に抜ける
  const edge = mix(base, [255, 238, 205], 0.5)
  const edgeRim = mix(base, [255, 246, 228], 0.75)
  const id = 'tea' + (hex ?? 'x').replace(/\W/g, '').slice(0, 8) + size

  return (
    /* tight=true のときは外周の余白を詰めて、同じ枠内でカップを大きく見せる
       （最外周は r=46 + 線幅1.4 なので 13〜107 が収まる範囲まで切り詰める） */
    <svg viewBox={tight ? '13 13 94 94' : '0 0 120 120'} width={size} height={size}>
      <defs>
        {/* 水色本体：中心が濃く、縁で明るい琥珀に抜ける */}
        <radialGradient id={`${id}b`} cx="50%" cy="47%" r="53%">
          <stop offset="0%" stopColor={rgb(deep)} />
          <stop offset="45%" stopColor={rgb(mix(deep, base, 0.55))} />
          <stop offset="80%" stopColor={rgb(base)} />
          <stop offset="94%" stopColor={rgb(edge)} />
          <stop offset="100%" stopColor={rgb(edgeRim)} />
        </radialGradient>
        {/* 上部のやわらかい光の映り込み */}
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.35" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* カップ（外周の細い円は廃止し、r=46 を最も外側の縁とする） */}
      <ellipse cx="60" cy="60" rx="46" ry="46" fill="#efeae2" />

      {/* 紅茶の液面 */}
      <circle cx="60" cy="60" r="40" fill={`url(#${id}b)`} />

      {/* 上部の映り込み（窓明かりのような帯） */}
      <ellipse cx="60" cy="38" rx="28" ry="10" fill={`url(#${id}r)`} />
      {/* 小さなハイライト */}
      <ellipse cx="44" cy="45" rx="8" ry="4" fill="white" opacity="0.2" transform="rotate(-20 44 45)" />

      {/* 茶葉の微粒子（中央付近にうっすら） */}
      <circle cx="63" cy="62" r="0.9" fill={rgb(deep)} opacity="0.5" />
      <circle cx="57" cy="66" r="0.7" fill={rgb(deep)} opacity="0.4" />
      <circle cx="67" cy="57" r="0.6" fill={rgb(deep)} opacity="0.35" />
      <circle cx="60" cy="59" r="0.5" fill={rgb(deep)} opacity="0.3" />

      {/* カップの縁：外周の細い線は使わず、太い線を一つ内側（r=46）に配置する */}
      <circle cx="60" cy="60" r="46" fill="none" stroke="#bdb4a5" strokeWidth="1.4" />
    </svg>
  )
}
