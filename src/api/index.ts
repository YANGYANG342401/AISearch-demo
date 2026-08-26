// ─── API 层：mock 与真实接口同签名，一处开关切换 ──────────────────────
// USE_MOCK=false 时走 UAT 真实接口。注意：跨域与登录态依赖同域部署
// 或开发代理（vite.config.ts 中 /api → http://ecsearch-admin2.uat.k8s.ec）。

import type {
  Activity, ActivityQueryParams, Channel, Department, FeatureCode, LogEntry, MissedWordWeekly,
  OrgGroup, PagedResult, PresetWord, ProductRow, QueryParams, Stats,
} from '../types';
export type {
  Activity, ActivityQueryParams, Channel, Department, FeatureCode, LogEntry, MissedWordWeekly,
  OrgGroup, PagedResult, PresetWord, ProductRow, QueryParams, Stats,
} from '../types';
import { mockApi } from './mockApi';

export const USE_MOCK = true;

export interface ApiClient {
  searchProducts(params: QueryParams): Promise<PagedResult<ProductRow>>;
  getProductById(id: string): Promise<ProductRow | null>;
  addProduct(product: ProductRow): Promise<void>;
  updateProduct(product: ProductRow): Promise<void>;
  disableProducts(ids: string[]): Promise<void>;
  deleteProducts(ids: string[]): Promise<void>;
  /** 转让所有权（仅跨组）：owner/组长/管理员可发起 */
  transferOwnership(productId: string, toMember: string): Promise<void>;
  importProducts(file: File): Promise<{ imported: number }>;
  /** ids 提供时仅导出所选条目；否则按筛选条件全量导出（全量仅管理员） */
  exportProducts(params: QueryParams, ids?: string[]): Promise<void>;
  getStats(): Promise<Stats>;
  getChannels(): Promise<Channel[]>;
  getDepartments(): Promise<Department[]>;
  /** 标签化：产品组选项从产品数据 distinct，不再依赖字典表 */
  getGroupNames(): Promise<string[]>;
  /** 标签化：产品经理选项从产品数据 distinct，不再依赖字典表 */
  getManagerNames(): Promise<string[]>;
  getFeatureCodes(): Promise<FeatureCode[]>;

  // ─── 字典配置 CRUD（配置菜单）────────────────────────────────────
  // 部门/渠道真实接口存在（读），写接口命名待技术确认；
  // 组织结构与日志为新增能力，后端需新增接口（见改动说明单）。
  addDepartment(d: Department): Promise<void>;
  updateDepartment(d: Department): Promise<void>;
  deleteDepartment(id: string): Promise<void>;
  addChannel(c: Channel): Promise<void>;
  updateChannel(c: Channel): Promise<void>;
  deleteChannel(id: string): Promise<void>;
  getProjectManagers(): Promise<Department[]>;
  /** 项目经理字典（外部技术部门人员）：仅管理员可维护 */
  addProjectManager(name: string): Promise<void>;
  updateProjectManager(id: string, name: string): Promise<void>;
  deleteProjectManager(id: string): Promise<void>;
  getOrgGroups(): Promise<OrgGroup[]>;
  saveOrgGroup(g: OrgGroup, isCreate: boolean): Promise<void>;
  deleteOrgGroup(id: string): Promise<void>;
  getLogs(): Promise<LogEntry[]>;
  /** 活动库：字典页"被引用活动"计数 */
  getActivities(): Promise<Activity[]>;

  // ─── 活动管理（权限原则与产品一致）────────────────────────────────
  searchActivities(params: ActivityQueryParams): Promise<PagedResult<Activity>>;
  addActivity(a: Activity): Promise<void>;
  updateActivity(a: Activity): Promise<void>;
  disableActivities(ids: string[]): Promise<void>;
  deleteActivities(ids: string[]): Promise<void>;
  transferActivityOwnership(activityId: string, toMember: string): Promise<void>;
  /** ids 提供时仅导出所选条目（权限同产品：行级可操作） */
  exportActivities(params: ActivityQueryParams, ids?: string[]): Promise<void>;

  // ─── 预设搜索词（默认库 + 渠道覆盖，时间窗自动上下线）──────────────
  getPresetWords(): Promise<PresetWord[]>;
  addPresetWord(w: PresetWord): Promise<void>;
  updatePresetWord(w: PresetWord): Promise<void>;
  deletePresetWord(id: string): Promise<void>;

  // ─── 未命中搜索词：周度汇总 + 邮件提醒 ────────────────────────────
  getMissedWordWeeklies(): Promise<MissedWordWeekly[]>;
  sendMissedWordEmail(weekStart: string, recipients: string[], subject: string, body: string): Promise<void>;
}

async function jsonPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const envelope = await res.json();
  if (envelope.Code !== 200) throw new Error(envelope.Msg || '接口调用失败');
  return envelope.Data as T;
}

// 真实接口客户端（切换开关后启用；响应壳剥包规则按契约实现）
const realApi: ApiClient = {
  async searchProducts(params) {
    const data = await jsonPost<{ PagingResult: PagedResult<ProductRow> }>(
      '/api/productlibrary/searchProductFromDB', params);
    return data.PagingResult;
  },
  async getProductById(id) {
    const data = await jsonPost<{ productInfo: ProductRow }>(
      '/api/productlibrary/searchProductInfoByIDFromDB', { id });
    return data.productInfo;
  },
  addProduct(p) { return jsonPost('/api/productlibrary/addProductInfoToDB', p).then(() => {}); },
  updateProduct(p) { return jsonPost('/api/productlibrary/updateProductInfoToDB', p).then(() => {}); },
  disableProducts(ids) { return jsonPost('/api/productlibrary/disableProductInfoToDB', { ids }).then(() => {}); },
  deleteProducts(ids) { return jsonPost('/api/productlibrary/deleteProductFromDB', { ids, operatingPassword: '' }).then(() => {}); },
  async transferOwnership() { throw new Error('真实接口待对接：所有权转让'); },
  async importProducts(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/productlibrary/importProductInfo', {
      method: 'POST', credentials: 'include', body: fd,
    });
    const envelope = await res.json();
    if (envelope.Code !== 200) throw new Error(envelope.Msg);
    return { imported: envelope.Data?.importedCount ?? 0 };
  },
  async exportProducts(params, ids) {
    const data = await jsonPost<{ RedirectUrl: string }>(
      '/api/productlibrary/exportProductInfo', { ...params, ids });
    if (data.RedirectUrl) window.open(data.RedirectUrl);
  },
  async getStats() {
    // 真实后端无独立统计接口：取全量第一页推算
    const pr = await this.searchProducts({
      productName: '', status: null, productGroupName: '', productManagerName: '',
      departmentID: '', channelIDAry: [], sortField: 'ProductName',
      sortDirection: 'Asc', pageSize: 1, pageIndex: 0,
    });
    return { total: pr.total, onShelves: -1, offShelves: -1 };
  },
  async getChannels() {
    const d = await jsonPost<{ channelList: Channel[] }>('/api/channel/channelList', {});
    return d.channelList;
  },
  async getDepartments() {
    const d = await jsonPost<{ list: Department[] }>('/api/department/departmentList', {});
    return d.list;
  },
  async getGroupNames() {
    // 过渡桥接：字典接口仍在时取名字；后端标签化后改为全量产品 distinct
    const d = await jsonPost<{ list: { Name: string }[] }>('/api/productgroup/productgrouplist', {});
    return d.list.map(g => g.Name);
  },
  async getManagerNames() {
    const d = await jsonPost<{ list: { Name: string }[] }>('/api/productmanager/productManagerList', {});
    return d.list.map(m => m.Name);
  },
  // 字典写操作：真实端点命名待技术确认（约定推测为 addXxxInfoToDB 风格），先占位
  async addDepartment() { throw new Error('真实接口待对接：部门新增'); },
  async updateDepartment() { throw new Error('真实接口待对接：部门修改'); },
  async deleteDepartment() { throw new Error('真实接口待对接：部门删除'); },
  async addChannel() { throw new Error('真实接口待对接：渠道新增'); },
  async updateChannel() { throw new Error('真实接口待对接：渠道修改'); },
  async deleteChannel() { throw new Error('真实接口待对接：渠道删除'); },
  async getProjectManagers() {
    // 过渡桥接：组织结构落地前先走旧字典接口取名字
    const d = await jsonPost<{ list: { Name: string }[] }>('/api/productmanager/productManagerList', {});
    return d.list.map(m => ({ Name: m.Name }) as Department);
  },
  async addProjectManager() { throw new Error('真实接口待对接：项目经理新增'); },
  async updateProjectManager() { throw new Error('真实接口待对接：项目经理修改'); },
  async deleteProjectManager() { throw new Error('真实接口待对接：项目经理删除'); },
  async getOrgGroups() { throw new Error('真实接口待对接：组织结构'); },
  async saveOrgGroup() { throw new Error('真实接口待对接：组织结构保存'); },
  async deleteOrgGroup() { throw new Error('真实接口待对接：组织结构删除'); },
  async getLogs() { throw new Error('真实接口待对接：系统日志'); },
  async getActivities() { throw new Error('真实接口待对接：活动列表'); },
  async searchActivities() { throw new Error('真实接口待对接：活动查询'); },
  async addActivity() { throw new Error('真实接口待对接：活动新增'); },
  async updateActivity() { throw new Error('真实接口待对接：活动修改'); },
  async disableActivities() { throw new Error('真实接口待对接：活动停用'); },
  async deleteActivities() { throw new Error('真实接口待对接：活动删除'); },
  async transferActivityOwnership() { throw new Error('真实接口待对接：活动转让'); },
  async exportActivities() { throw new Error('真实接口待对接：活动导出'); },
  async getPresetWords() { throw new Error('真实接口待对接：预设词列表'); },
  async addPresetWord() { throw new Error('真实接口待对接：预设词新增'); },
  async updatePresetWord() { throw new Error('真实接口待对接：预设词修改'); },
  async deletePresetWord() { throw new Error('真实接口待对接：预设词删除'); },
  async getMissedWordWeeklies() { throw new Error('真实接口待对接：未命中词周汇总'); },
  async sendMissedWordEmail() { throw new Error('真实接口待对接：周报邮件发送'); },
  async getFeatureCodes() {
    const d = await jsonPost<{ featureCodeList: string[] }>('/api/User/featureCodeList', {});
    return d.featureCodeList as FeatureCode[];
  },
};

export const api: ApiClient = USE_MOCK ? mockApi : realApi;
