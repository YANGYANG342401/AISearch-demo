// ─── 领域类型：对齐 UAT 环境真实 API 契约 ──────────────────────────────

export interface Channel {
  ID: string;
  Name: string;
  SubName: string;
  TemplateName: 'PC端' | '移动端' | 'API' | '其它';
  SortValue: number;
  LastUpdateTime?: string;
}

export interface Department { ID: string; Name: string; LastUpdateTime?: string; }
export interface ProductGroup { ID: string; Name: string; }
export interface ProductManager { ID: string; Name: string; }
export interface ProductManagerRef { ID: string; Name: string; }

/** 活动库：搜索内容配置的另一半，权限原则与产品一致 */
export interface Activity {
  ID: string;
  Name: string;
  /** 创建人（owner）。权限链：owner + owner 现任组长 + 管理员 */
  CreatedBy?: string;
  Status: 'Active' | 'Inactive';
  Description: string;
  StartTime: string;
  EndTime: string;
  ChannelID: string[];
  OtherChannelDesc?: string;
  MusearchShow: boolean;
  Keyword: string;
  DepartmentID: string;
  DepartmentName?: string;
  ProjectManager: string;
  Remark?: string;
  /** H5 通用落地页（M站/小程序/PC 用）；APP 原生页见 NativePage */
  LandingUrl?: string;
  LandingIconUrl?: string;
  /** APP 三端（iOS/安卓/鸿蒙）原生页配置：共用 + 覆盖 */
  NativePage?: { Parent: { Link: string; IconUrl: string }; Overrides: Partial<Record<OsKey, { Link: string; IconUrl: string }>> };
  CreateTime: string;
  LastUpdateTime: string;
  IsDeleted?: boolean;
}

export interface ActivityQueryParams {
  name: string;
  status: Activity['Status'] | null;
  departmentID: string;
  channelIDAry: string[];
  /** 仅看与自己有关条目（owner 是本人，或本人是其组长）；管理员全量 */
  mineOnly?: boolean;
  sortField: string;
  sortDirection: 'Asc' | 'Desc';
  pageSize: number;
  pageIndex: number;
}

export const ACTIVITY_STATUS_TEXT: Record<Activity['Status'], string> = {
  Active: '进行中',
  Inactive: '已停用',
};

// ─── 预设搜索词：搜索框引导词，默认库 + 渠道差异覆盖 ──────────────────

/** 预设词投放的端渠道（固定五个，区别于渠道字典的细粒度渠道） */
export const PRESET_CHANNELS = [
  { key: 'app', name: 'APP' },
  { key: 'm', name: 'M站' },
  { key: 'wechat', name: '微信小程序' },
  { key: 'alipay', name: '支付宝小程序' },
  { key: 'pc', name: 'PC（国内官网）' },
] as const;

export type PresetScope = 'default' | (typeof PRESET_CHANNELS)[number]['key'];

export const PRESET_SCOPE_TEXT: Record<PresetScope, string> = {
  default: '默认库',
  app: 'APP',
  m: 'M站',
  wechat: '微信小程序',
  alipay: '支付宝小程序',
  pc: 'PC（国内官网）',
};

// ─── 原生页三端：iOS / 安卓 / 鸿蒙（链接与图标可能不一致）───────────

export const OS_KEYS = ['iOS', '安卓', '鸿蒙'] as const;
export type OsKey = (typeof OS_KEYS)[number];

export interface PresetWord {
  ID: string;
  /** 预设词文本 */
  Word: string;
  /** 投放范围：default=五端共享默认库；其余为指定渠道的差异覆盖 */
  Scope: PresetScope;
  SortValue: number;
  /** 点击行为：search=执行搜索；jump=直跳运营页 */
  LinkType: 'search' | 'jump';
  /** jump 时的目标链接 */
  LinkUrl?: string;
  /** 生效/失效时间（空 = 长期）；到期自动下线 */
  StartTime?: string;
  EndTime?: string;
  /** 词源：manual 手动 / hot 热词榜导入 / missed 未命中词转化 */
  Source: 'manual' | 'hot' | 'missed';
  CreatedBy?: string;
  Remark?: string;
  CreateTime: string;
  LastUpdateTime: string;
  IsDeleted?: boolean;
}

export type PresetWordStatus = 'active' | 'pending' | 'expired';

/** 状态由时间窗派生（相对当前时刻） */
export function presetWordStatus(w: PresetWord, now = Date.now()): PresetWordStatus {
  const start = w.StartTime ? new Date(w.StartTime.replace(/-/g, '/')).getTime() : 0;
  const end = w.EndTime ? new Date(w.EndTime.replace(/-/g, '/')).getTime() : Infinity;
  if (now < start) return 'pending';
  if (now > end) return 'expired';
  return 'active';
}

/** 某渠道的生效词表 = 默认库（未被同名覆盖）+ 该渠道词，按排序值 */
export function effectivePresetWords(all: PresetWord[], channelKey: PresetScope): PresetWord[] {
  const inWindow = all.filter(w => !w.IsDeleted && presetWordStatus(w) === 'active');
  const overrides = inWindow.filter(w => w.Scope === channelKey);
  const overrideTexts = new Set(overrides.map(w => w.Word));
  const defaults = inWindow.filter(w => w.Scope === 'default' && !overrideTexts.has(w.Word));
  return [...defaults, ...overrides].sort((a, b) => a.SortValue - b.SortValue);
}

export interface PresetWordQuery {
  keyword: string;
  scope: PresetScope | 'all';
  status: PresetWordStatus | 'all';
}

// ─── 未命中搜索词：周度汇总 + 邮件提醒 ────────────────────────────────

export interface MissedWordCount {
  Word: string;
  Count: number;
}

/** 一周的未命中词汇总（按频次降序） */
export interface MissedWordWeekly {
  /** 周一日期 yyyy-MM-dd */
  WeekStart: string;
  WeekEnd: string;
  Words: MissedWordCount[];
}

// ─── 组织结构与权限 ───────────────────────────────────────────────────

/** 产品组注册表：权限锚点 + 新建产品的身份带出来源 */
export interface OrgGroup {
  ID: string;
  Name: string;
  Leader: string;
  Members: string[];
  /** 已离职/移出的成员档案：其名下条目为"无主"，但原组长仍可操作 */
  Departed?: string[];
}

/** 当前登录身份（演示用三视角） */
export interface Identity {
  key: 'yangyang' | 'leader' | 'admin';
  name: string;
  groupName: string;
  isAdmin: boolean;
  label: string;
}

export const IDENTITIES: Identity[] = [
  { key: 'yangyang', name: '杨阳', groupName: '机票组', isAdmin: false, label: '杨阳 · 机票组 组员' },
  { key: 'leader', name: '张三', groupName: '机票组', isAdmin: false, label: '张三 · 机票组 组长' },
  { key: 'admin', name: '系统管理员', groupName: '', isAdmin: true, label: '管理员 · 应急全权' },
];

/** owner 所属组（在职：组长或组员） */
export function groupOfOwner(owner: string | undefined, groups: OrgGroup[]): OrgGroup | undefined {
  if (!owner) return undefined;
  return groups.find(g => g.Leader === owner || g.Members.includes(owner));
}

/** 操作组：在职算，离职档案也算——原组长对无主条目仍有操作权 */
export function operatingGroupOf(owner: string | undefined, groups: OrgGroup[]): OrgGroup | undefined {
  if (!owner) return undefined;
  return groups.find(g => g.Leader === owner || g.Members.includes(owner) || g.Departed?.includes(owner));
}

/** 无主 = owner 已不在在职名单（离职档案里仍留组别，组长可接手） */
export function isOrphan(owner: string | undefined, groups: OrgGroup[]): boolean {
  return !groupOfOwner(owner, groups);
}

/** 操作权限：owner 本人 / owner 原组长（含其离职后）/ 管理员 */
export function canOperate(owner: string | undefined, identity: Identity, groups: OrgGroup[]): boolean {
  if (identity.isAdmin) return true;
  if (owner === identity.name) return true;
  const g = operatingGroupOf(owner, groups);
  return !!g && g.Leader === identity.name;
}

// ─── 操作日志（双轨：条目日志按 TargetID 过滤系统日志）───────────────

export interface LogEntry {
  ID: string;
  Time: string;
  User: string;
  TargetType: '产品' | '活动' | '预设词' | '部门' | '渠道' | '组织' | '项目经理' | '系统';
  TargetID: string;
  TargetName: string;
  Action: string;
  Detail: string;
}

export type ProductStatus = 'PutOnShelves' | 'PullOffShelves';

export interface ProductRow {
  ID: string;
  ProductName: string;
  /** 创建人（owner）。权限链：owner + owner 现任组长 + 管理员。种子数据无此字段，由 mock 装配 */
  CreatedBy?: string;
  Status: ProductStatus;
  Description: string;
  StartTime: string;
  EndTime: string;
  ChannelID: string[];
  /** 列表接口随行返回的冗余名（真实后端有） */
  ChannelName?: string;
  OtherChannelDesc: string;
  MusearchShow: boolean;
  Keyword: string;
  DepartmentID: string;
  DepartmentName?: string;
  OtherDepartmentDesc: string;
  InternalBusiness: string;
  ExternalBusiness: string;
  ProductGroupID: string;
  ProductGroupName?: string;
  ProductManagerList: ProductManagerRef[];
  ProductManagerName: string;
  UE: string;
  UI: string;
  ProjectManager: string;
  BackendDeveloper: string;
  FrontendDeveloper: string;
  Tester: string;
  ExternalDependencies: boolean;
  ExternaldependencyDepartment: string;
  ExternaldependencyPo: string;
  ExternaldependencyPm: string;
  OperationManual: string;
  Remark: string;
  CreateTime: string;
  LastUpdateTime: string;
  IsDeleted: boolean;
}

export interface QueryParams {
  productName: string;
  status: ProductStatus | null;
  productGroupName: string;
  productManagerName: string;
  departmentID: string;
  channelIDAry: string[];
  /** 仅看与自己有关条目（owner 是本人，或本人是其组长）；管理员全量 */
  mineOnly?: boolean;
  sortField: string;
  sortDirection: 'Asc' | 'Desc';
  pageSize: number;
  pageIndex: number;
}

export interface PagedResult<T> { rows: T[]; total: number; }

export interface Stats { total: number; onShelves: number; offShelves: number; }

export type FeatureCode =
  | 'productLibrary_add'
  | 'productLibrary_update'
  | 'productLibrary_disable'
  | 'productLibrary_import'
  | 'productLibrary_export'
  | 'productLibrary_delete';

// ─── 渠道光谱：按端分组 ────────────────────────────────────────────────

export type ChannelFamily = 'APP' | 'PC' | 'M站' | '小程序' | 'API' | '其他';

export const FAMILY_ORDER: ChannelFamily[] = ['APP', 'PC', 'M站', '小程序', 'API', '其他'];

export function channelFamily(name: string): ChannelFamily {
  if (name.startsWith('APP')) return 'APP';
  if (name.startsWith('PC')) return 'PC';
  if (name.startsWith('M站')) return 'M站';
  if (name.includes('小程序')) return '小程序';
  if (name === 'API') return 'API';
  return '其他';
}

export const STATUS_TEXT: Record<ProductStatus, string> = {
  PutOnShelves: '已上架',
  PullOffShelves: '已下架',
};
