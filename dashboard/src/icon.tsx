import type { ReactNode, SVGProps } from 'react';

/**
 * 自绘 SVG 图标集（WO-20261006-03 Phase B）
 * · 全套 24×24 网格 · stroke-width 1.5 · stroke="currentColor" · 圆头圆角 · aria-hidden
 * · path 逐条照抄 docs/design/console-visual.html（唯一规格来源）；色彩/尺寸走令牌，零 emoji 当图标
 * · 成员身份色（--id-N）与主题令牌见 src/styles.css
 */

export type IconName =
  | 'pipeline'
  | 'reports'
  | 'users'
  | 'pause'
  | 'check'
  | 'trash'
  | 'close'
  | 'minus'
  | 'plus'
  | 'reset'
  | 'image'
  | 'doc'
  | 'expand'
  | 'refresh'
  | 'offline'
  | 'sun'
  | 'moon'
  | 'display'
  | 'copy'
  | 'token';

/** 每个图标只描述 24×24 网格内的形状；描边/色彩由 <Icon> 统一给定。 */
const PATHS: Record<IconName, ReactNode> = {
  // 导航
  pipeline: (
    <>
      <rect x="8" y="2" width="8" height="6" rx="2" />
      <rect x="2" y="16" width="8" height="6" rx="2" />
      <rect x="14" y="16" width="8" height="6" rx="2" />
      <path d="M12 8v6M6 16v-2h12v2" />
    </>
  ),
  reports: <path d="M4 20V12M10 20V4M16 20v-6M4 20h16" />,
  users: (
    <>
      <circle cx="8" cy="8" r="3" />
      <path d="M4 20a4 4 0 0 1 8 0" />
      <circle cx="16" cy="8" r="3" />
      <path d="M12 20a4 4 0 0 1 8 0" />
    </>
  ),
  // 状态 / 动作
  pause: <path d="M10 4v16M14 4v16" />,
  check: <path d="M4 12l4 4L20 6" />,
  trash: <path d="M4 6h16M8 6V4h8v2M6 6v14h12V6M10 10v6M14 10v6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  minus: <path d="M6 12h12" />,
  plus: <path d="M12 6v12M6 12h12" />,
  reset: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  // 汇报视图
  image: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="8" cy="8" r="2" />
      <path d="M4 18l6-6 4 4 6-6" />
    </>
  ),
  doc: (
    <>
      <path d="M6 4h8l4 4v12H6z" />
      <path d="M14 4v4h4" />
      <path d="M10 12h4M10 16h4" />
    </>
  ),
  expand: <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />,
  // 状态兜底（B-1 先落图标，接线见 B-2）
  refresh: (
    <>
      <path d="M4 12a8 8 0 1 1 2.3 5.6" />
      <path d="M4 4v6h6" />
    </>
  ),
  offline: (
    <>
      <path d="M4 4l16 16" />
      <path d="M8 16a6 6 0 0 1 8 0" />
      <path d="M5 12a11 11 0 0 1 4-2.4" />
      <path d="M16 9.6A11 11 0 0 1 19 12" />
      <path d="M12 20v.01" />
    </>
  ),
  // 主题切换（外观三态）
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />,
  display: (
    <>
      <rect x="2" y="4" width="20" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  // 词元页（WO-20261007-17）：叠币造型
  token: (
    <>
      <circle cx="9" cy="9" r="6" />
      <path d="M14.8 6.6a6 6 0 1 1-8.2 8.2" />
      <path d="M9 6.5v5M6.8 9h4.4" />
    </>
  ),
  // 单据 ID 复制（WO-20261007-11）
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
    </>
  ),
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'width' | 'height'> {
  name: IconName;
  size?: number;
}

/** 统一图标：viewBox 24×24 · stroke 1.5 · currentColor · 圆头圆角 · aria-hidden。 */
export function Icon({ name, size = 18, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
