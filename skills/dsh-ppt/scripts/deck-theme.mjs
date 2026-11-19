// Built-in theme data and pure lookup/color helpers.
export const THEMES = {
  swiss: {
    id: 'swiss',
    name: { zh: '瑞士脉冲', en: 'Swiss Pulse' },
    mood: { zh: '精准、理性、数据', en: 'Precise, rational, data-driven' },
    bestFor: { zh: 'SaaS、数据、开发者工具', en: 'SaaS, data, developer tools' },
    dark: true,
    palette: {
      bg: '#10151B',
      panel: '#161D26',
      fg: '#F5F7FA',
      muted: '#8E9AAA',
      accent: '#2F6BFF',
      accent2: '#FFB300',
    },
    fonts: {
      heading: '"Helvetica Neue", Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
      body: '"Helvetica Neue", Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
    },
  },
  velvet: {
    id: 'velvet',
    name: { zh: '天鹅绒标准', en: 'Velvet Standard' },
    mood: { zh: '高级、克制、可信', en: 'Premium, restrained, trustworthy' },
    bestFor: { zh: '高管汇报、品牌、融资路演', en: 'Executive decks, brand, investor pitches' },
    dark: true,
    palette: {
      bg: '#111316',
      panel: '#1A1D22',
      fg: '#F4EFE6',
      muted: '#A79F91',
      accent: '#C9A84C',
      accent2: '#3D4A63',
    },
    fonts: {
      heading: 'Georgia, "Times New Roman", "Songti SC", "SimSun", serif',
      body: '"Helvetica Neue", Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
    },
  },
  data: {
    id: 'data',
    name: { zh: '数据漂移', en: 'Data Drift' },
    mood: { zh: '未来、沉浸、前沿', en: 'Futuristic, immersive, cutting-edge' },
    bestFor: { zh: 'AI、数据、研究、技术发布', en: 'AI, data, research, tech launches' },
    dark: true,
    palette: {
      bg: '#070B14',
      panel: '#0D1424',
      fg: '#E8F1FF',
      muted: '#7E8BA8',
      accent: '#7C3AED',
      accent2: '#06B6D4',
    },
    fonts: {
      heading: '"Space Grotesk", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      body: '"Space Grotesk", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    },
  },
  soft: {
    id: 'soft',
    name: { zh: '柔和信号', en: 'Soft Signal' },
    mood: { zh: '温暖、亲近、人本', en: 'Warm, intimate, human' },
    bestFor: { zh: '品牌故事、培训、个人分享', en: 'Brand stories, training, personal talks' },
    dark: false,
    palette: {
      bg: '#FFF8EC',
      panel: '#FFF2DE',
      fg: '#3B2F2A',
      muted: '#7E6F68',
      accent: '#E58A2F',
      accent2: '#8FAF8C',
    },
    fonts: {
      heading: '"Avenir Next", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      body: '"Avenir Next", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    },
  },
  bold: {
    id: 'bold',
    name: { zh: '极繁大字', en: 'Maximalist Type' },
    mood: { zh: '大声、动能、发布', en: 'Loud, kinetic, launch' },
    bestFor: { zh: '产品发布、活动、品牌大事件', en: 'Product launches, events, brand moments' },
    dark: true,
    palette: {
      bg: '#0D0D0D',
      panel: '#181818',
      fg: '#FFFFFF',
      muted: '#B8B8B8',
      accent: '#E63946',
      accent2: '#FFD60A',
    },
    fonts: {
      heading: 'Impact, "Arial Black", "PingFang SC", "Microsoft YaHei", sans-serif',
      body: '"Helvetica Neue", Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
    },
  },
}

export const THEME_IDS = Object.keys(THEMES)
export const DEFAULT_THEME = 'data'

export function resolveTheme(input) {
  const id = String(input ?? DEFAULT_THEME).trim().toLowerCase()
  const theme = THEMES[id]
  if (!theme) {
    throw new Error('dsh-ppt：未知主题 "' + id + '"，可选：' + THEME_IDS.join(' / ') + '（默认 ' + DEFAULT_THEME + '）')
  }
  return theme
}

export function listThemes(lang = 'zh') {
  const pick = (pair) => (lang === 'en' || lang === 'ru' ? pair.en : pair.zh)
  return THEME_IDS.map((id) => {
    const theme = THEMES[id]
    return {
      id,
      name: pick(theme.name),
      mood: pick(theme.mood),
      bestFor: pick(theme.bestFor),
      dark: theme.dark,
      palette: { ...theme.palette },
      fonts: { ...theme.fonts },
    }
  })
}

export function hexToRgba(hex, alpha) {
  const value = String(hex).replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  const num = Number.parseInt(full, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')'
}
