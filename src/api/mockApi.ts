// ─── Mock 实现：种子数据来自 UAT 真实响应样本，行为对齐真实接口 ────────

import type { ApiClient } from './index';
import { channels, departments, groups, managers, seedProducts } from './fixtures';
import type { FeatureCode, ProductRow, ProductStatus } from '../types';

// 50 条真实样本 → 合成到 116 条（与 UAT 数据量一致）
function buildStore(): ProductRow[] {
  const store = [...seedProducts];
  const variants = ['PLUS', 'MAX', 'Lite', 'Pro', 'Mini', '旗舰版', '标准版', '体验版'];
  for (let i = seedProducts.length; i < 116; i++) {
    const base = seedProducts[i % seedProducts.length];
    const v = variants[Math.floor(i / seedProducts.length) % variants.length];
    const status: ProductStatus = i % 4 === 0 ? 'PullOffShelves' : 'PutOnShelves';
    store.push({
      ...base,
      ID: `mock${String(i).padStart(19, '0')}`,
      ProductName: `${base.ProductName}-${v}`,
      Status: status,
      MusearchShow: i % 3 !== 0,
      ChannelID: base.ChannelID.slice(0, Math.max(1, (i % 5) + 1)),
      ProductManagerList: [managers[i % managers.length]],
      ProductManagerName: managers[i % managers.length].Name,
      DepartmentID: departments[i % departments.length].ID,
      DepartmentName: departments[i % departments.length].Name,
      ProductGroupID: groups[i % groups.length].ID,
      ProductGroupName: groups[i % groups.length].Name,
    });
  }
  return store;
}

let store = buildStore();

const latency = () => new Promise(r => setTimeout(r, 180 + Math.random() * 220));

function nowStr() {
  const p = (n: number) => String(n).padStart(2, '0');
  const d = new Date();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function newId() {
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 24; i++) s += hex[Math.floor(Math.random() * 16)];
  return s;
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const mockApi: ApiClient = {
  async searchProducts(params) {
    await latency();
    const q = params.productName.trim().toLowerCase();
    let rows = store.filter(p => !p.IsDeleted);
    if (q) rows = rows.filter(p =>
      p.ProductName.toLowerCase().includes(q) || p.Description.toLowerCase().includes(q));
    if (params.status) rows = rows.filter(p => p.Status === params.status);
    if (params.productGroupID) rows = rows.filter(p => p.ProductGroupID === params.productGroupID);
    if (params.departmentID) rows = rows.filter(p => p.DepartmentID === params.departmentID);
    if (params.productManagerName) rows = rows.filter(p =>
      p.ProductManagerName.includes(params.productManagerName));
    if (params.channelIDAry.length) rows = rows.filter(p =>
      params.channelIDAry.some(id => p.ChannelID.includes(id)));

    const dir = params.sortDirection === 'Desc' ? -1 : 1;
    const field = params.sortField as keyof ProductRow;
    rows = [...rows].sort((a, b) => {
      const av = String(a[field] ?? ''), bv = String(b[field] ?? '');
      return av.localeCompare(bv, 'zh-Hans-CN') * dir;
    });

    const start = params.pageIndex * params.pageSize;
    return { rows: rows.slice(start, start + params.pageSize), total: rows.length };
  },

  async getProductById(id) {
    await latency();
    return store.find(p => p.ID === id) ?? null;
  },

  async addProduct(product) {
    await latency();
    store = [{ ...product, ID: newId(), CreateTime: nowStr(), LastUpdateTime: nowStr() }, ...store];
  },

  async updateProduct(product) {
    await latency();
    const i = store.findIndex(p => p.ID === product.ID);
    if (i < 0) throw new Error('产品不存在');
    store[i] = { ...store[i], ...product, LastUpdateTime: nowStr() };
  },

  async disableProducts(ids) {
    await latency();
    store = store.map(p =>
      ids.includes(p.ID) ? { ...p, Status: 'PullOffShelves' as ProductStatus, LastUpdateTime: nowStr() } : p);
  },

  async deleteProducts(ids, operatingPassword) {
    await latency();
    if (!operatingPassword) throw new Error('操作密码不能为空');
    if (operatingPassword !== 'admin') throw new Error('操作密码不正确（mock 密码：admin）');
    store = store.filter(p => !ids.includes(p.ID));
  },

  async importProducts(file) {
    await latency();
    void file;
    return { imported: Math.floor(3 + Math.random() * 10) };
  },

  async exportProducts(params) {
    await latency();
    const { rows } = await this.searchProducts({ ...params, pageIndex: 0, pageSize: 9999 });
    const header = ['产品名称', '产品描述', '状态', '上线时间', '下线时间', '上线渠道', '对大搜展示', '关联词', '业务归属', '产品组', '产品经理'];
    const lines = rows.map(p => [
      p.ProductName, p.Description, p.Status === 'PutOnShelves' ? '已上架' : '已下架',
      p.StartTime, p.EndTime,
      p.ChannelID.map(id => channels.find(c => c.ID === id)?.Name ?? id).join(','),
      p.MusearchShow ? '是' : '否', p.Keyword,
      departments.find(d => d.ID === p.DepartmentID)?.Name ?? '',
      groups.find(g => g.ID === p.ProductGroupID)?.Name ?? '',
      p.ProductManagerName,
    ].map(csvEscape).join(','));
    const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `产品库导出_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async getStats() {
    await latency();
    const alive = store.filter(p => !p.IsDeleted);
    return {
      total: alive.length,
      onShelves: alive.filter(p => p.Status === 'PutOnShelves').length,
      offShelves: alive.filter(p => p.Status === 'PullOffShelves').length,
    };
  },

  async getChannels() { await latency(); return channels; },
  async getDepartments() { await latency(); return departments; },
  async getGroups() { await latency(); return groups; },
  async getManagers() { await latency(); return managers; },
  async getFeatureCodes() {
    await latency();
    return [
      'productLibrary_add', 'productLibrary_update', 'productLibrary_disable',
      'productLibrary_import', 'productLibrary_export', 'productLibrary_delete',
    ] as FeatureCode[];
  },
};
