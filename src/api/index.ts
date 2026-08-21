// ─── API 层：mock 与真实接口同签名，一处开关切换 ──────────────────────
// USE_MOCK=false 时走 UAT 真实接口。注意：跨域与登录态依赖同域部署
// 或开发代理（vite.config.ts 中 /api → http://ecsearch-admin2.uat.k8s.ec）。

import type {
  Channel, Department, FeatureCode, PagedResult, ProductGroup,
  ProductManager, ProductRow, QueryParams, Stats,
} from '../types';
export type {
  Channel, Department, FeatureCode, PagedResult, ProductGroup,
  ProductManager, ProductRow, QueryParams, Stats,
} from '../types';
import { mockApi } from './mockApi';

export const USE_MOCK = true;

export interface ApiClient {
  searchProducts(params: QueryParams): Promise<PagedResult<ProductRow>>;
  getProductById(id: string): Promise<ProductRow | null>;
  addProduct(product: ProductRow): Promise<void>;
  updateProduct(product: ProductRow): Promise<void>;
  disableProducts(ids: string[]): Promise<void>;
  deleteProducts(ids: string[], operatingPassword: string): Promise<void>;
  importProducts(file: File): Promise<{ imported: number }>;
  exportProducts(params: QueryParams): Promise<void>;
  getStats(): Promise<Stats>;
  getChannels(): Promise<Channel[]>;
  getDepartments(): Promise<Department[]>;
  getGroups(): Promise<ProductGroup[]>;
  getManagers(): Promise<ProductManager[]>;
  getFeatureCodes(): Promise<FeatureCode[]>;
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
  deleteProducts(ids, operatingPassword) { return jsonPost('/api/productlibrary/deleteProductFromDB', { ids, operatingPassword }).then(() => {}); },
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
  async exportProducts(params) {
    const data = await jsonPost<{ RedirectUrl: string }>(
      '/api/productlibrary/exportProductInfo', params);
    if (data.RedirectUrl) window.open(data.RedirectUrl);
  },
  async getStats() {
    // 真实后端无独立统计接口：取全量第一页推算
    const pr = await this.searchProducts({
      productName: '', status: null, productGroupID: '', productManagerName: '',
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
  async getGroups() {
    const d = await jsonPost<{ list: ProductGroup[] }>('/api/productgroup/productgrouplist', {});
    return d.list;
  },
  async getManagers() {
    const d = await jsonPost<{ list: ProductManager[] }>('/api/productmanager/productManagerList', {});
    return d.list;
  },
  async getFeatureCodes() {
    const d = await jsonPost<{ featureCodeList: string[] }>('/api/User/featureCodeList', {});
    return d.featureCodeList as FeatureCode[];
  },
};

export const api: ApiClient = USE_MOCK ? mockApi : realApi;
