import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Limit } from '../types'

const limits = atom({ plugin: 'usage-meter', key: 'limits' } as const, [] as Limit[])
const isHidden = atom({ plugin: 'usage-meter', key: 'isHidden' } as const, false)
const palette = atom({ plugin: 'usage-meter', key: 'palette' } as const, 'neon')
const isCollapsed = atom({ plugin: 'usage-meter', key: 'isCollapsed' } as const, false)

const LABELS: Record<string, string> = { five_hour: '5H', seven_day: 'WEEK', spend_limit: 'SPEND' }
const SHORT: Record<string, string> = { five_hour: '5h', seven_day: 'Week', spend_limit: 'Spend' }
const ICONS: Record<string, string> = { five_hour: '⚡', seven_day: '📅', spend_limit: '💳' }

type RGB = [number, number, number]
type Palette = { name: string; stops: RGB[]; empty: string }

// Each palette runs from "plenty left" to "almost out".
const PALETTES: Record<string, Palette> = {
  neon: { name: 'Neon', stops: [[0, 224, 150], [76, 217, 100], [255, 200, 61], [255, 138, 61], [255, 77, 109]], empty: '#2b2b36' },
  ocean: { name: 'Ocean', stops: [[0, 229, 255], [0, 166, 255], [77, 108, 255], [150, 80, 255], [220, 60, 200]], empty: '#1f2a3a' },
  sunset: { name: 'Sunset', stops: [[255, 220, 90], [255, 170, 60], [255, 110, 70], [235, 60, 110], [170, 40, 160]], empty: '#3a2a2a' },
  claude: { name: 'Claude', stops: [[245, 200, 160], [235, 160, 110], [217, 119, 87], [190, 85, 60], [150, 55, 40]], empty: '#33291f' },
  matrix: { name: 'Matrix', stops: [[20, 120, 40], [30, 170, 60], [50, 220, 90], [120, 255, 140], [200, 255, 200]], empty: '#0f2414' },
  purple: { name: 'Purple', stops: [[200, 160, 255], [170, 110, 255], [140, 70, 250], [180, 50, 230], [235, 50, 200]], empty: '#261d36' },
  orange: { name: 'Orange', stops: [[255, 210, 120], [255, 175, 60], [255, 140, 30], [255, 100, 20], [240, 60, 30]], empty: '#3a2614' },
  mono: { name: 'Mono', stops: [[110, 110, 120], [150, 150, 160], [190, 190, 200], [225, 225, 235], [255, 255, 255]], empty: '#2a2a2a' },
}
const PALETTE_KEYS = Object.keys(PALETTES)
const pick = (key: string) => PALETTES[key] ?? (PALETTES.neon as Palette)

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
const gradient = (p: Palette, t: number) => {
  const stops = p.stops
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const i = Math.min(Math.floor(x), stops.length - 2)
  const f = x - i
  const a = stops[i] ?? [0, 0, 0]
  const b = stops[i + 1] ?? a
  return `#${hex(a[0] + (b[0] - a[0]) * f)}${hex(a[1] + (b[1] - a[1]) * f)}${hex(a[2] + (b[2] - a[2]) * f)}`
}

const mood = (pct: number) => (pct >= 90 ? '🔥' : pct >= 70 ? '⚠️' : pct >= 40 ? '🚀' : '😎')

const resetText = (resetsAt: string | undefined, now: number) => {
  if (!resetsAt) return ''
  const ms = Date.parse(resetsAt) - now
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `↻ ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `↻ ${hours}h${mins % 60 ? ` ${mins % 60}m` : ''}`
  return `↻ ${Math.floor(hours / 24)}d ${hours % 24}h`
}

const statusText = (list: Limit[]) =>
  list.length === 0
    ? undefined
    : '✦ ' + list.map(l => `${ICONS[l.kind] ?? ''}${SHORT[l.kind] ?? l.kind} ${Math.round(l.percentUsed)}%`).join('  ')

const warned = new Set<string>()

async function apply($: EngineInterface, list: Limit[]) {
  const clean = list.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt }))
  await update($, limits, () => clean)
  $.ui.status(statusText(clean))
  for (const l of clean) {
    if (l.percentUsed >= 90 && !warned.has(l.kind)) {
      warned.add(l.kind)
      $.ui.toast(`🔥 Claude usage: ${SHORT[l.kind] ?? l.kind} at ${Math.round(l.percentUsed)}%`)
    }
    if (l.percentUsed < 80) warned.delete(l.kind)
  }
}

async function nextPalette($: EngineInterface) {
  const key = await update($, palette, k => PALETTE_KEYS[(PALETTE_KEYS.indexOf(k) + 1) % PALETTE_KEYS.length] ?? 'neon')
  await $.store.set('palette', key)
}

async function toggleCollapsed($: EngineInterface) {
  const v = await update($, isCollapsed, c => !c)
  await $.store.set('collapsed', v)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const saved = await $.store.get('palette')
    if (typeof saved === 'string' && saved in PALETTES) await update($, palette, () => saved)
    if ((await $.store.get('collapsed')) === true) await update($, isCollapsed, () => true)
    const usage = await $.session.usage()
    await apply($, usage.rateLimits)
    await $.command.register({ name: 'usage-meter', description: 'Show or hide the usage meter' })
    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await apply($, e.rateLimits)
    return next(e)
  })

  on('command.run', { command: 'usage-meter' }, async ($, e, next) => {
    const hidden = await update($, isHidden, v => !v)
    const list = await read($, limits)
    const summary = statusText(list) ?? 'No usage reading yet (shows after the first reply on a subscription plan).'
    return { text: hidden ? 'Usage meter hidden. Run /usage-meter again to show it.' : `Usage meter shown. ${summary}` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, limits)
    if (e.props.hasSurvey || list.length === 0 || (await read($, isHidden))) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const now = await $.clock.now()
    const current = await read($, palette)
    const pal = pick(current)
    const BAR = 13
    const collapsed = await read($, isCollapsed)
    const arrow = (
      <Button key="toggle" label={collapsed ? '▸' : '▾'} plain dimColor onPress={() => toggleCollapsed($)} />
    )

    // One solid fill on an empty track: draws the same on every surface.
    const bar = (pct: number, tone: string) => (
      <Box width={BAR} height={1} backgroundColor={pal.empty}>
        <Box width={`${pct}%`} height={1} backgroundColor={tone} />
      </Box>
    )

    if (collapsed) {
      return (
        <Box flexDirection="row" gap={2} alignItems="flex-start">
          {arrow}
          {list.map(l => (
            <Text key={l.kind} color={gradient(pal, Math.min(100, l.percentUsed) / 100)} bold>
              {`${ICONS[l.kind] ?? '•'} ${Math.round(l.percentUsed)}%`}
            </Text>
          ))}
        </Box>
      )
    }

    return (
      <Box flexDirection="row" gap={1} alignItems="flex-start">
        {arrow}
        {list.map(l => {
          const pct = Math.max(0, Math.min(100, l.percentUsed))
          const tone = gradient(pal, pct / 100)
          return (
            <Box
              key={l.kind}
              flexDirection="column"
              borderStyle="round"
              borderColor={tone}
              paddingX={1}
              width={BAR + 5}
            >
              <Box flexDirection="row">
                <Text bold>{`${ICONS[l.kind] ?? '•'} ${LABELS[l.kind] ?? l.kind}`}</Text>
                <Box flexGrow={1} />
                <Text color={tone} bold>{`${Math.round(l.percentUsed)}%`}</Text>
                <Text>{` ${mood(pct)}`}</Text>
              </Box>
              {bar(pct, tone)}
              <Text dimColor>{resetText(l.resetsAt, now) || ' '}</Text>
            </Box>
          )
        })}
        <Box flexDirection="column" borderStyle="round" borderColor={gradient(pal, 0.5)} paddingX={1} width={14}>
          <Box flexDirection="row">
            <Text color={gradient(pal, 0.5)} bold>{`🎨 ${pal.name}`}</Text>
            <Box flexGrow={1} />
            <Button key="palette" label="›" plain onPress={() => nextPalette($)} />
          </Box>
          {[PALETTE_KEYS.slice(0, 4), PALETTE_KEYS.slice(4)].map((row, r) => (
            <Box key={`row-${r}`} flexDirection="row" gap={1}>
              {row.map(k => (
                <Text key={k} color={gradient(pick(k), 0.5)}>{k === current ? '◉' : '●'}</Text>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    )
  })
}
