import type { ThemeConfig } from 'antd';

// ─── 设计 token：东航夜航蓝体系，避开组件库默认蓝 ─────────────────────
// 色板锚点：
//   ink      #0F1E3D  墨蓝（正文/标题）
//   brand    #1B3B8B  夜航蓝（主操作/链接/焦点环）
//   canvas   #F5F7FA  画布底
//   surface  #FFFFFF  卡片面
//   line     #E3E8F0  分隔线
//   语义     上架=苔绿 / 停用=琥珀 / 删除=朱红

export const palette = {
  ink: '#0F1E3D',
  inkSoft: '#3D4A6B',
  inkFaint: '#8A94AD',
  brand: '#1B3B8B',
  brandDeep: '#12295F',
  brandWash: '#EDF2FB',
  canvas: '#F5F7FA',
  surface: '#FFFFFF',
  line: '#E3E8F0',
  green: '#1F7A4D',
  greenWash: '#E8F5EE',
  amber: '#B45309',
  amberWash: '#FDF3E3',
  red: '#C02626',
  redWash: '#FBECEC',
  // 渠道光谱六族色（同一饱和度层级，仅色相区分）
  family: {
    APP: '#1B3B8B',
    PC: '#0E7490',
    'M站': '#6D28D9',
    '小程序': '#B45309',
    API: '#1F7A4D',
    '其他': '#64748B',
  } as Record<string, string>,
};

export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: palette.brand,
    colorInfo: palette.brand,
    colorLink: palette.brand,
    colorTextBase: palette.ink,
    colorBgLayout: palette.canvas,
    colorBorderSecondary: palette.line,
    colorBorder: '#C9D2E2',
    borderRadius: 6,
    borderRadiusLG: 10,
    fontFamily: "'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif",
    fontSize: 13,
    controlHeight: 30,
  },
  components: {
    Table: {
      headerBg: '#F0F3F9',
      headerColor: palette.inkSoft,
      headerSplitColor: 'transparent',
      rowHoverBg: '#F6F8FC',
      cellPaddingBlock: 9,
      cellPaddingInline: 12,
      cellPaddingBlockSM: 6,
      cellPaddingInlineSM: 8,
    },
    Button: { fontWeight: 500, primaryShadow: 'none', defaultShadow: 'none' },
    Card: { paddingLG: 20 },
    Drawer: { paddingLG: 24 },
    Tag: { borderRadiusSM: 4 },
    Menu: { itemBorderRadius: 6, itemMarginInline: 8, itemHeight: 36 },
    Segmented: { itemActiveBg: '#E9EEF6' },
  },
};
