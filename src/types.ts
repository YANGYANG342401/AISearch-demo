// ─── 领域类型：对齐 UAT 环境真实 API 契约 ──────────────────────────────

export interface Channel {
  ID: string;
  Name: string;
  SubName: string;
  TemplateName: 'PC端' | '移动端' | 'API' | '其它';
  SortValue: number;
}

export interface Department { ID: string; Name: string; }
export interface ProductGroup { ID: string; Name: string; }
export interface ProductManager { ID: string; Name: string; }
export interface ProductManagerRef { ID: string; Name: string; }

export type ProductStatus = 'PutOnShelves' | 'PullOffShelves';

export interface ProductRow {
  ID: string;
  ProductName: string;
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
