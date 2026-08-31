// ─── Mock 实现：种子数据来自 UAT 真实响应样本，行为对齐真实接口 ────────

import type { ApiClient } from './index';
import { channels, departments, groups, seedProducts } from './fixtures';
import type {
  Activity, Channel, Department, FeatureCode, LogEntry, MissedWordWeekly,
  OrgGroup, PresetWord, ProductRow, ProductStatus,
} from '../types';
import { PRESET_SCOPE_TEXT } from '../types';

// 当前身份（演示切换用；真实系统来自 SSO 登录态）
let mockUser = '杨阳';
export function setMockUser(name: string) { mockUser = name; }

// 50 条真实样本 → 合成到 116 条（与 UAT 数据量一致）
function buildStore(): ProductRow[] {
  const store = [...seedProducts];
  const variants = ['PLUS', 'MAX', 'Lite', 'Pro', 'Mini', '旗舰版', '标准版', '体验版'];
  const managerNames = [...new Set(seedProducts.flatMap(p => p.ProductManagerList.map(m => m.Name)))];
  // owner 分配：杨阳多分一些方便演示，其余轮转；末尾留两个"离职无主"
  const owners = ['杨阳', '李四', '张三', '王五', '钱大', '刘二', '何小', '高远', '马越', '丁一'];
  const assign = (i: number) => (i === 9 ? '吴九（离职）' : i === 21 ? '褚三（离职）' : owners[i % owners.length]);
  for (let i = 0; i < store.length; i++) {
    store[i] = { ...store[i], CreatedBy: assign(i) };
  }
  for (let i = seedProducts.length; i < 116; i++) {
    const base = seedProducts[i % seedProducts.length];
    const v = variants[Math.floor(i / seedProducts.length) % variants.length];
    const status: ProductStatus = i % 4 === 0 ? 'PullOffShelves' : 'PutOnShelves';
    const mgr = managerNames[i % managerNames.length];
    const grp = groups[i % groups.length];
    store.push({
      ...base,
      ID: `mock${String(i).padStart(19, '0')}`,
      ProductName: `${base.ProductName}-${v}`,
      CreatedBy: assign(i),
      Status: status,
      MusearchShow: i % 3 !== 0,
      ChannelID: base.ChannelID.slice(0, Math.max(1, (i % 5) + 1)),
      ProductManagerList: [{ ID: mgr, Name: mgr }],
      ProductManagerName: mgr,
      DepartmentID: departments[i % departments.length].ID,
      DepartmentName: departments[i % departments.length].Name,
      ProductGroupID: '',
      ProductGroupName: grp.Name,
    });
  }
  return store;
}

let store = buildStore();

// 活动库：完整模块，权限原则与产品一致（owner/组长/管理员/转让/无主）
let activityStore: Activity[] = (() => {
  const dept = (n: string) => departments.find(d => d.Name === n);
  const base = [
    { name: '暑期亲子游专场', dept: '直销业务部', kw: '亲子|亲子游|暑期出游' },
    { name: '双十一积分翻倍', dept: '平台运营部', kw: '双11|积分翻倍|双十一' },
    { name: '会员日直减活动', dept: '直销业务部', kw: '会员日|直减|会员优惠' },
    { name: '春节返乡特惠', dept: '集成产品部', kw: '返乡|春节特惠|回家' },
    { name: '五一出行礼包', dept: '技术开发部', kw: '五一|礼包|出行优惠' },
    { name: '积分兑换周', dept: '平台运营部', kw: '积分|兑换|积分兑换' },
    { name: '金秋旅游节', dept: '直销业务部', kw: '金秋|旅游节|秋游' },
    { name: '开学季机票立减', dept: '集成产品部', kw: '开学|学生票|立减' },
    { name: '跨年环球折扣', dept: '平台运营部', kw: '跨年|环球|折扣' },
  ];
  const variants = ['', '-加场', '-返场', '-升级版'];
  const owners = ['杨阳', '李四', '王五', '钱大', '刘二', '何小', '高远', '马越', '丁一'];
  const pms = [...new Set(seedProducts.map(p => p.ProjectManager).filter(Boolean))];
  const list: Activity[] = [];
  for (let i = 0; i < 30; i++) {
    const b = base[i % base.length];
    const v = variants[Math.floor(i / base.length) % variants.length];
    const d = dept(b.dept);
    list.push({
      ID: `act_${String(i).padStart(3, '0')}`,
      Name: b.name + v,
      CreatedBy: i === 12 ? '吴九（离职）' : owners[i % owners.length],
      Status: (i % 5 === 0 ? 'Inactive' : 'Active') as Activity['Status'],
      Description: `${b.name}营销活动`,
      StartTime: `2026-0${(i % 8) + 1}-01 00:00:00`,
      EndTime: `2026-1${(i % 2) + 1}-${String((i % 27) + 1).padStart(2, '0')} 23:59:59`,
      ChannelID: channels.slice(i % 4, (i % 4) + 2 + (i % 4)).map(c => c.ID),
      OtherChannelDesc: '',
      MusearchShow: i % 3 !== 0,
      Keyword: b.kw,
      DepartmentID: d?.ID ?? '',
      DepartmentName: d?.Name ?? '',
      ProjectManager: pms[i % pms.length] ?? '',
      Remark: '',
      LandingUrl: i % 3 === 0 ? `https://m.ceair.com/act/act${i}` : '',
      LandingIconUrl: i % 3 === 0 ? `https://cdn.ceair.com/icon/act${i}.png` : '',
      NativePage: i === 0 ? {
        Parent: { Link: 'ceairapp://activity/double11', IconUrl: 'https://cdn.ceair.com/icon/d11.png' },
        Overrides: { 安卓: { Link: 'ceairapp://activity/double11?os=android', IconUrl: 'https://cdn.ceair.com/icon/d11-android.png' } },
      } : undefined,
      CreateTime: '2026-06-15 10:00:00',
      LastUpdateTime: '2026-08-01 09:00:00',
      IsDeleted: false,
    });
  }
  return list;
})();

// 字典配置的可变存储（配置菜单维护）
let departmentStore: Department[] = departments.map(d => ({ ...d }));
let channelStore: Channel[] = channels.map(c => ({ ...c }));
// 项目经理字典：外部技术部门人员（不参与产品组权限链），仅管理员维护
let projectManagerStore: { ID: string; Name: string; LastUpdateTime?: string }[] = (() => {
  const names = [...new Set(seedProducts.map(p => p.ProjectManager).filter(Boolean))];
  return names.map((n, i) => ({ ID: `pjm_${i}`, Name: n, LastUpdateTime: nowStr() }));
})();

// 组织结构：权限锚点 + 身份带出来源
let orgStore: OrgGroup[] = [
  { ID: 'og_1', Name: '机票组', Leader: '张三', Members: ['杨阳', '李四', '王五'], Departed: ['吴九（离职）'] },
  { ID: 'og_2', Name: '积分组', Leader: '赵六', Members: ['钱大', '刘二', '石坚'], Departed: ['褚三（离职）'] },
  { ID: 'og_3', Name: '活动组', Leader: '孙七', Members: ['何小', '高远'] },
  { ID: 'og_4', Name: 'MAVS组', Leader: '郑十', Members: ['马越', '白云'] },
  { ID: 'og_5', Name: '辅营产品组', Leader: '冯一', Members: ['丁一', '任平', '方圆'] },
  { ID: 'og_6', Name: '积分公共组', Leader: '陈二', Members: [] },
  { ID: 'og_7', Name: 'AI营销组', Leader: '', Members: [] },
];

// 系统日志（全局留痕；条目日志 = 按 TargetID 过滤）
let logStore: LogEntry[] = [];
let logSeq = 0;
function log(action: string, targetType: LogEntry['TargetType'], targetID: string, targetName: string, detail: string) {
  logStore.unshift({
    ID: `log_${++logSeq}`,
    Time: nowStr(),
    User: mockUser,
    TargetType: targetType,
    TargetID: targetID,
    TargetName: targetName,
    Action: action,
    Detail: detail,
  });
}

function newDictId(prefix: string) {
  return prefix + newId().slice(0, 12);
}

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


// ─── 预设搜索词：默认库 + 渠道覆盖，时间窗自动上下线 ──────────────────

let presetWordStore: PresetWord[] = [
  // 默认库（五端共享）
  { ID: 'pw_01', Word: '前程万里', Scope: 'default', SortValue: 1, LinkType: 'search', Source: 'manual', CreatedBy: '杨阳', Remark: '常驻品牌词', CreateTime: '2026-08-01 10:00:00', LastUpdateTime: '2026-08-01 10:00:00' },
  { ID: 'pw_02', Word: '积分商城', Scope: 'default', SortValue: 2, LinkType: 'search', Source: 'manual', CreatedBy: '杨阳', CreateTime: '2026-08-01 10:00:00', LastUpdateTime: '2026-08-01 10:00:00' },
  { ID: 'pw_03', Word: '会员日', Scope: 'default', SortValue: 3, LinkType: 'search', Source: 'hot', CreatedBy: '李四', Remark: '来自热词榜导入', CreateTime: '2026-08-05 14:00:00', LastUpdateTime: '2026-08-05 14:00:00' },
  { ID: 'pw_04', Word: '电子发票', Scope: 'default', SortValue: 4, LinkType: 'search', Source: 'manual', CreatedBy: '王五', CreateTime: '2026-08-02 09:00:00', LastUpdateTime: '2026-08-02 09:00:00' },
  { ID: 'pw_05', Word: '付费选座', Scope: 'default', SortValue: 5, LinkType: 'search', Source: 'manual', CreatedBy: '钱大', CreateTime: '2026-08-02 09:30:00', LastUpdateTime: '2026-08-02 09:30:00' },
  { ID: 'pw_06', Word: '贵宾室', Scope: 'default', SortValue: 6, LinkType: 'search', Source: 'manual', CreatedBy: '刘二', CreateTime: '2026-08-03 11:00:00', LastUpdateTime: '2026-08-03 11:00:00' },
  { ID: 'pw_07', Word: '行李托运规定', Scope: 'default', SortValue: 7, LinkType: 'search', Source: 'missed', CreatedBy: '杨阳', Remark: '未命中高频词转化：用户常搜但无结果', CreateTime: '2026-08-10 16:00:00', LastUpdateTime: '2026-08-10 16:00:00' },
  // 时间窗示例：已过期（暑期）/ 生效中（双十一预热）/ 未开始（元旦）
  { ID: 'pw_08', Word: '暑期亲子游', Scope: 'default', SortValue: 8, LinkType: 'jump', LinkUrl: 'https://m.ceair.com/act/summer', Source: 'manual', CreatedBy: '李四', StartTime: '2026-07-01 00:00:00', EndTime: '2026-08-31 23:59:59', Remark: '已过期示例：到期自动下线', CreateTime: '2026-06-25 10:00:00', LastUpdateTime: '2026-06-25 10:00:00' },
  { ID: 'pw_09', Word: '双十一积分翻倍', Scope: 'default', SortValue: 9, LinkType: 'jump', LinkUrl: 'https://m.ceair.com/act/double11', Source: 'manual', CreatedBy: '杨阳', StartTime: '2026-08-20 00:00:00', EndTime: '2026-11-12 23:59:59', Remark: '生效中示例：带时间窗的活动词', CreateTime: '2026-08-18 10:00:00', LastUpdateTime: '2026-08-18 10:00:00' },
  { ID: 'pw_10', Word: '元旦特惠', Scope: 'default', SortValue: 10, LinkType: 'search', Source: 'manual', CreatedBy: '王五', StartTime: '2026-12-28 00:00:00', EndTime: '2027-01-03 23:59:59', Remark: '未开始示例', CreateTime: '2026-08-20 10:00:00', LastUpdateTime: '2026-08-20 10:00:00' },
  // 渠道覆盖示例
  { ID: 'pw_11', Word: '双十一积分翻倍', Scope: 'app', SortValue: 1, LinkType: 'jump', LinkUrl: 'ceairapp://activity/double11', Source: 'manual', CreatedBy: '杨阳', Remark: 'APP 覆盖默认库同名词：直达 App 活动页', CreateTime: '2026-08-18 10:30:00', LastUpdateTime: '2026-08-18 10:30:00' },
  { ID: 'pw_12', Word: '周三领券', Scope: 'wechat', SortValue: 1, LinkType: 'jump', LinkUrl: 'https://app.ceair.com/wx/coupon-wed', Source: 'manual', CreatedBy: '何小', Remark: '微信小程序专属', CreateTime: '2026-08-06 09:00:00', LastUpdateTime: '2026-08-06 09:00:00' },
  { ID: 'pw_13', Word: '支付立减', Scope: 'alipay', SortValue: 2, LinkType: 'search', Source: 'manual', CreatedBy: '高远', CreateTime: '2026-08-07 09:00:00', LastUpdateTime: '2026-08-07 09:00:00' },
  { ID: 'pw_14', Word: '官网专享', Scope: 'pc', SortValue: 1, LinkType: 'search', Source: 'manual', CreatedBy: '丁一', CreateTime: '2026-08-08 09:00:00', LastUpdateTime: '2026-08-08 09:00:00' },
];


// ─── 未命中搜索词：周度汇总种子（8 周，词频有涨落）────────────────────

const missedWordWeeklies: MissedWordWeekly[] = (() => {
  // 生成近 8 周（含本周），每周一组按频次降序的词
  const pool = [
    '宠物托运', '无陪儿童', '无人机携带规定', '护照过期了怎么办', '里程兑换酒店',
    '机票行程单', '轮椅服务预约', '学生票认证', '儿童餐食预订', '超重行李收费标准',
    '航班动态短信提醒', '会员等级权益', '跨航司中转',
  ];
  const weekOf = (monday: Date) => {
    const end = new Date(monday); end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { WeekStart: fmt(monday), WeekEnd: fmt(end) };
  };
  const list: MissedWordWeekly[] = [];
  const today = new Date();
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  for (let w = 7; w >= 0; w--) {
    const monday = new Date(thisMonday);
    monday.setDate(thisMonday.getDate() - w * 7);
    const drift = (i: number, seed: number) => Math.round((0.8 + 0.4 * (((seed * 7 + i * 13 + w * 5) % 10) / 10)) * (1 + (7 - w) * 0.02));
    const words = pool
      .map((word, i) => ({ Word: word, Count: Math.round((380 - i * 26) * drift(i, 11)) }))
      .sort((a, b) => b.Count - a.Count);
    list.push({ ...weekOf(monday), Words: words });
  }
  return list.reverse(); // 最新周在前
})();

export const mockApi: ApiClient = {
  async searchProducts(params) {
    await latency();
    const q = params.productName.trim().toLowerCase();
    let rows = store.filter(p => !p.IsDeleted);
    if (q) rows = rows.filter(p =>
      p.ProductName.toLowerCase().includes(q) || p.Description.toLowerCase().includes(q));
    if (params.status) rows = rows.filter(p => p.Status === params.status);
    if (params.productGroupName) rows = rows.filter(p => p.ProductGroupName === params.productGroupName);
    if (params.departmentID) rows = rows.filter(p => p.DepartmentID === params.departmentID);
    if (params.productManagerName) rows = rows.filter(p =>
      p.ProductManagerName.includes(params.productManagerName));
    if (params.channelIDAry.length) rows = rows.filter(p =>
      params.channelIDAry.some(id => p.ChannelID.includes(id)));
    if (params.mineOnly && mockUser !== '系统管理员') {
      rows = rows.filter(p => {
        const owner = p.CreatedBy ?? '';
        if (owner === mockUser) return true;
        const g = orgStore.find(x => x.Leader === owner || x.Members.includes(owner) || x.Departed?.includes(owner));
        return !!g && g.Leader === mockUser;
      });
    }

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
    const row = { ...product, ID: newId(), CreateTime: nowStr(), LastUpdateTime: nowStr() };
    store = [row, ...store];
    log('创建', '产品', row.ID, row.ProductName, `新建产品，负责人 ${row.CreatedBy || mockUser}`);
  },

  async updateProduct(product) {
    await latency();
    const i = store.findIndex(p => p.ID === product.ID);
    if (i < 0) throw new Error('产品不存在');
    const prev = store[i];
    store[i] = { ...prev, ...product, LastUpdateTime: nowStr() };
    if (product.CreatedBy && product.CreatedBy !== prev.CreatedBy) {
      log('补充操作员', '产品', product.ID, product.ProductName, `操作员 ${prev.CreatedBy || '（无）'} → ${product.CreatedBy}`);
    }
    log('修改', '产品', product.ID, product.ProductName, '保存产品信息');
  },

  async disableProducts(ids) {
    await latency();
    store = store.map(p => {
      if (!ids.includes(p.ID)) return p;
      log('停用', '产品', p.ID, p.ProductName, '产品下所有数据将不可被使用');
      return { ...p, Status: 'PullOffShelves' as ProductStatus, LastUpdateTime: nowStr() };
    });
  },

  async deleteProducts(ids) {
    await latency();
    for (const id of ids) {
      const p = store.find(x => x.ID === id);
      if (p) log('删除', '产品', p.ID, p.ProductName, `删除产品（原负责人 ${p.CreatedBy}），日志保留于系统日志`);
    }
    store = store.filter(p => !ids.includes(p.ID));
  },

  async transferOwnership(productId, toMember) {
    await latency();
    const p = store.find(x => x.ID === productId);
    if (!p) throw new Error('产品不存在');
    const target = orgStore.find(g => g.Members.includes(toMember) || g.Leader === toMember);
    if (!target) throw new Error('目标不是任何组的成员');
    const from = p.CreatedBy;
    p.CreatedBy = toMember;
    p.LastUpdateTime = nowStr();
    log('转让', '产品', p.ID, p.ProductName, `操作权 ${from ?? '（无主）'} → ${toMember}（${target.Name}）`);
  },

  async importProducts(file) {
    await latency();
    void file;
    return { imported: Math.floor(3 + Math.random() * 10) };
  },

  async exportProducts(params, ids) {
    await latency();
    const { rows } = ids && ids.length
      ? { rows: store.filter(p => ids.includes(p.ID) && !p.IsDeleted) }
      : await this.searchProducts({ ...params, pageIndex: 0, pageSize: 9999 });
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

  async getChannels() { await latency(); return channelStore.map(c => ({ ...c })); },
  async getDepartments() { await latency(); return departmentStore.map(d => ({ ...d })); },
  // 标签化：选项从产品数据 distinct，字典表不再是数据源
  async getGroupNames() {
    await latency();
    const names = [...new Set(store.map(p => p.ProductGroupName).filter((n): n is string => !!n))];
    return names.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  },
  async getManagerNames() {
    await latency();
    const names = new Set<string>();
    for (const p of store) {
      for (const m of p.ProductManagerList ?? []) names.add(m.Name);
      p.ProductManagerName.split(',').forEach(n => n.trim() && names.add(n.trim()));
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  },
  async getFeatureCodes() {
    await latency();
    return [
      'productLibrary_add', 'productLibrary_update', 'productLibrary_disable',
      'productLibrary_import', 'productLibrary_export', 'productLibrary_delete',
    ] as FeatureCode[];
  },

  // ─── 字典配置 CRUD：删除时校验产品引用，防脏数据；全部动作入日志 ──

  async addDepartment(d) {
    await latency();
    if (departmentStore.some(x => x.Name === d.Name.trim())) throw new Error('部门名称已存在');
    const row = { ID: newDictId('dep_'), Name: d.Name.trim(), LastUpdateTime: nowStr() };
    departmentStore.push(row);
    log('新增', '部门', row.ID, row.Name, '新增部门');
  },
  async updateDepartment(d) {
    await latency();
    const i = departmentStore.findIndex(x => x.ID === d.ID);
    if (i < 0) throw new Error('部门不存在');
    const old = departmentStore[i].Name;
    departmentStore[i] = { ...departmentStore[i], Name: d.Name.trim(), LastUpdateTime: nowStr() };
    log('修改', '部门', d.ID, d.Name.trim(), `部门名称 ${old} → ${d.Name.trim()}`);
  },
  async deleteDepartment(id) {
    await latency();
    const d = departmentStore.find(x => x.ID === id);
    const used = store.filter(p => p.DepartmentID === id).length;
    const usedAct = activityStore.filter(a => a.DepartmentID === id).length;
    if (used || usedAct) {
      throw new Error(`该部门被 ${used} 个产品、${usedAct} 个活动引用，无法删除`);
    }
    departmentStore = departmentStore.filter(x => x.ID !== id);
    if (d) log('删除', '部门', id, d.Name, '删除部门');
  },
  async addChannel(c) {
    await latency();
    if (channelStore.some(x => x.Name === c.Name.trim())) throw new Error('渠道名称已存在');
    const row = { ...c, ID: newDictId('ch_'), Name: c.Name.trim(), LastUpdateTime: nowStr() };
    channelStore.push(row);
    log('新增', '渠道', row.ID, row.Name, `新增渠道（${row.TemplateName}）`);
  },
  async updateChannel(c) {
    await latency();
    const i = channelStore.findIndex(x => x.ID === c.ID);
    if (i < 0) throw new Error('渠道不存在');
    channelStore[i] = { ...channelStore[i], ...c, Name: c.Name.trim(), LastUpdateTime: nowStr() };
    log('修改', '渠道', c.ID, c.Name.trim(), '修改渠道信息');
  },
  async deleteChannel(id) {
    await latency();
    const c = channelStore.find(x => x.ID === id);
    const used = store.filter(p => p.ChannelID.includes(id)).length;
    const usedAct = activityStore.filter(a => a.ChannelID.includes(id)).length;
    if (used || usedAct) {
      throw new Error(`该渠道被 ${used} 个产品、${usedAct} 个活动引用，无法删除`);
    }
    channelStore = channelStore.filter(x => x.ID !== id);
    if (c) log('删除', '渠道', id, c.Name, '删除渠道');
  },

  // ─── 组织结构：权限锚点，改动同步产品数据并入日志 ──────────────────

  async getOrgGroups() {
    await latency();
    return orgStore.map(g => ({ ...g, Members: [...g.Members] }));
  },
  async saveOrgGroup(g, isCreate) {
    await latency();
    const name = g.Name.trim();
    if (isCreate) {
      if (orgStore.some(x => x.Name === name)) throw new Error('产品组名称已存在');
      orgStore.push({ ...g, Name: name, Members: [...g.Members] });
      log('新增', '组织', g.ID, name, `新增产品组，组长 ${g.Leader || '（空缺）'}，组员 ${g.Members.length} 人`);
      return;
    }
    const i = orgStore.findIndex(x => x.ID === g.ID);
    if (i < 0) throw new Error('产品组不存在');
    const prev = orgStore[i];
    const departed = [...(prev.Departed ?? [])].filter(d => !g.Members.includes(d) && g.Leader.trim() !== d);
    // 新移除的成员进离职档案（原组长保留其名下条目的操作权）
    const known = [prev.Leader, ...prev.Members, ...(prev.Departed ?? [])];
    const currentNames = [g.Leader.trim(), ...g.Members];
    const newlyDeparted = known.filter(n => n && !currentNames.includes(n) && !(prev.Departed ?? []).includes(n));
    orgStore[i] = { ...prev, Name: name, Leader: g.Leader.trim(), Members: [...g.Members], Departed: [...departed, ...newlyDeparted] };
    // 人名改动同步：项目经理字段 + 产品 owner（保持引用一致）
    for (const oldName of newlyDeparted) {
      const owned = store.filter(p => (p.CreatedBy ?? '') === oldName).length
        + activityStore.filter(a => (a.CreatedBy ?? '') === oldName).length;
      log('成员离职', '组织', g.ID, name, `${oldName} 移入离职档案，其名下 ${owned} 条数据为无主（原组长可操作）`);
    }
    log('修改', '组织', g.ID, name,
      `组长 ${prev.Leader || '空缺'} → ${g.Leader || '空缺'}，组员 ${prev.Members.length} → ${g.Members.length} 人`);
  },
  async deleteOrgGroup(id) {
    await latency();
    const g = orgStore.find(x => x.ID === id);
    if (!g) return;
    const usedByName = store.filter(p => p.ProductGroupName === g.Name).length;
    const ownedByMembers = store.filter(p =>
      g.Members.includes(p.CreatedBy ?? '') || (g.Departed ?? []).includes(p.CreatedBy ?? '') || p.CreatedBy === g.Leader).length;
    if (usedByName || ownedByMembers) {
      throw new Error(`该组被 ${usedByName} 个产品的业务归属引用、${ownedByMembers} 个产品的操作人挂靠，无法删除`);
    }
    orgStore = orgStore.filter(x => x.ID !== id);
    log('删除', '组织', id, g.Name, '删除产品组');
  },

  async getProjectManagers() {
    await latency();
    return projectManagerStore.map(m => ({ ...m }) as Department);
  },
  async addProjectManager(name) {
    await latency();
    if (projectManagerStore.some(m => m.Name === name.trim())) throw new Error('项目经理已存在');
    const row = { ID: newDictId('pjm_'), Name: name.trim(), LastUpdateTime: nowStr() };
    projectManagerStore.push(row);
    log('新增', '项目经理', row.ID, row.Name, '新增项目经理（外部技术部门）');
  },
  async updateProjectManager(id, name) {
    await latency();
    const m = projectManagerStore.find(x => x.ID === id);
    if (!m) throw new Error('项目经理不存在');
    const old = m.Name;
    m.Name = name.trim();
    m.LastUpdateTime = nowStr();
    // 改名同步产品上的项目经理字段（字典一处改，全局生效）
    store = store.map(p => p.ProjectManager === old ? { ...p, ProjectManager: m.Name } : p);
    log('修改', '项目经理', id, m.Name, `项目经理改名 ${old} → ${m.Name}，已同步产品数据`);
  },
  async deleteProjectManager(id) {
    await latency();
    const m = projectManagerStore.find(x => x.ID === id);
    if (!m) return;
    const used = store.filter(p => p.ProjectManager === m.Name).length;
    const usedAct = activityStore.filter(a => a.ProjectManager === m.Name).length;
    if (used || usedAct) {
      throw new Error(`「${m.Name}」被 ${used} 个产品、${usedAct} 个活动引用，无法删除`);
    }
    projectManagerStore = projectManagerStore.filter(x => x.ID !== id);
    log('删除', '项目经理', id, m.Name, '删除项目经理');
  },

  async getLogs() {
    await latency();
    return logStore.map(l => ({ ...l }));
  },

  async getActivities() {
    await latency();
    return activityStore.filter(a => !a.IsDeleted).map(a => ({ ...a }));
  },

  // ─── 活动管理：权限原则与产品一致 ────────────────────────────────────

  async searchActivities(params) {
    await latency();
    const q = params.name.trim().toLowerCase();
    let rows = activityStore.filter(a => !a.IsDeleted);
    if (q) rows = rows.filter(a =>
      a.Name.toLowerCase().includes(q) || a.Description.toLowerCase().includes(q));
    if (params.status) rows = rows.filter(a => a.Status === params.status);
    if (params.departmentID) rows = rows.filter(a => a.DepartmentID === params.departmentID);
    if (params.channelIDAry.length) rows = rows.filter(a =>
      params.channelIDAry.some(id => a.ChannelID.includes(id)));
    if (params.mineOnly && mockUser !== '系统管理员') {
      rows = rows.filter(a => {
        const owner = a.CreatedBy ?? '';
        if (owner === mockUser) return true;
        const g = orgStore.find(x => x.Leader === owner || x.Members.includes(owner) || x.Departed?.includes(owner));
        return !!g && g.Leader === mockUser;
      });
    }
    const dir = params.sortDirection === 'Desc' ? -1 : 1;
    const field = params.sortField as keyof Activity;
    rows = [...rows].sort((a, b) =>
      String(a[field] ?? '').localeCompare(String(b[field] ?? ''), 'zh-Hans-CN') * dir);
    const start = params.pageIndex * params.pageSize;
    return { rows: rows.slice(start, start + params.pageSize), total: rows.length };
  },

  async addActivity(a) {
    await latency();
    const row = { ...a, ID: newId(), CreateTime: nowStr(), LastUpdateTime: nowStr() };
    activityStore = [row, ...activityStore];
    log('创建', '活动', row.ID, row.Name, `新建活动，负责人 ${row.CreatedBy || mockUser}`);
  },

  async updateActivity(a) {
    await latency();
    const i = activityStore.findIndex(x => x.ID === a.ID);
    if (i < 0) throw new Error('活动不存在');
    const prev = activityStore[i];
    activityStore[i] = { ...prev, ...a, LastUpdateTime: nowStr() };
    if (a.CreatedBy && a.CreatedBy !== prev.CreatedBy) {
      log('补充操作员', '活动', a.ID, a.Name, `操作员 ${prev.CreatedBy || '（无）'} → ${a.CreatedBy}`);
    }
    log('修改', '活动', a.ID, a.Name, '保存活动信息');
  },

  async disableActivities(ids) {
    await latency();
    activityStore = activityStore.map(a => {
      if (!ids.includes(a.ID)) return a;
      log('停用', '活动', a.ID, a.Name, '活动下线，不再参与搜索');
      return { ...a, Status: 'Inactive' as Activity['Status'], LastUpdateTime: nowStr() };
    });
  },

  async deleteActivities(ids) {
    await latency();
    for (const id of ids) {
      const a = activityStore.find(x => x.ID === id);
      if (a) log('删除', '活动', id, a.Name, `删除活动（原负责人 ${a.CreatedBy}），日志保留于系统日志`);
    }
    activityStore = activityStore.filter(a => !ids.includes(a.ID));
  },

  async transferActivityOwnership(activityId, toMember) {
    await latency();
    const a = activityStore.find(x => x.ID === activityId);
    if (!a) throw new Error('活动不存在');
    const target = orgStore.find(g => g.Members.includes(toMember) || g.Leader === toMember);
    if (!target) throw new Error('目标不是任何组的成员');
    const from = a.CreatedBy;
    a.CreatedBy = toMember;
    a.LastUpdateTime = nowStr();
    log('转让', '活动', a.ID, a.Name, `操作权 ${from ?? '（无主）'} → ${toMember}（${target.Name}）`);
  },

  async exportActivities(params, ids) {
    await latency();
    const { rows } = ids && ids.length
      ? { rows: activityStore.filter(a => ids.includes(a.ID) && !a.IsDeleted) }
      : await this.searchActivities({ ...params, pageIndex: 0, pageSize: 9999 });
    const header = ['活动名称', '描述', '状态', '开始时间', '结束时间', '上线渠道', '对大搜展示', '关联词', '业务归属', '项目经理', '操作人'];
    const lines = rows.map(a => [
      a.Name, a.Description, a.Status === 'Active' ? '进行中' : '已停用',
      a.StartTime, a.EndTime,
      a.ChannelID.map(id => channelStore.find(c => c.ID === id)?.Name ?? id).join(','),
      a.MusearchShow ? '是' : '否', a.Keyword,
      departmentStore.find(d => d.ID === a.DepartmentID)?.Name ?? '',
      a.ProjectManager, a.CreatedBy ?? '',
    ].map(csvEscape).join(','));
    const blob = new Blob(['\ufeff' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `活动导出_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async getPresetWords() {
    await latency();
    return presetWordStore.filter(w => !w.IsDeleted).map(w => ({ ...w }));
  },
  async addPresetWord(w) {
    await latency();
    if (presetWordStore.some(x => !x.IsDeleted && x.Word === w.Word && x.Scope === w.Scope)) {
      throw new Error('该投放范围内已存在同名词（同范围同名会互相覆盖，请直接编辑原词）');
    }
    const row = { ...w, ID: newDictId('pw_'), CreateTime: nowStr(), LastUpdateTime: nowStr() };
    presetWordStore = [row, ...presetWordStore];
    log('新增', '预设词', row.ID, `${w.Word}（${PRESET_SCOPE_TEXT[w.Scope]}）`, `排序 ${w.SortValue}，${w.LinkType === 'jump' ? '直跳 ' + (w.LinkUrl ?? '') : '点击搜索'}${w.StartTime ? `，时间窗 ${w.StartTime} ~ ${w.EndTime ?? '长期'}` : '，长期'}`);
  },
  async updatePresetWord(w) {
    await latency();
    const i = presetWordStore.findIndex(x => x.ID === w.ID);
    if (i < 0) throw new Error('预设词不存在');
    presetWordStore[i] = { ...presetWordStore[i], ...w, LastUpdateTime: nowStr() };
    log('修改', '预设词', w.ID, `${w.Word}（${PRESET_SCOPE_TEXT[w.Scope]}）`, '保存预设词配置');
  },
  async deletePresetWord(id) {
    await latency();
    const w = presetWordStore.find(x => x.ID === id);
    if (!w) return;
    presetWordStore = presetWordStore.filter(x => x.ID !== id);
    log('删除', '预设词', id, `${w.Word}（${PRESET_SCOPE_TEXT[w.Scope]}）`, '删除预设词');
  },

  async getMissedWordWeeklies() {
    await latency();
    return missedWordWeeklies.map(w => ({ ...w, Words: w.Words.map(x => ({ ...x })) }));
  },
  async sendMissedWordEmail(weekStart, recipients, subject, body) {
    await latency();
    const week = missedWordWeeklies.find(w => w.WeekStart === weekStart);
    log('发送邮件', '系统', weekStart, `未命中词周报（${week?.WeekStart ?? ''} ~ ${week?.WeekEnd ?? ''}）`,
      `收件人 ${recipients.join('、')}；主题「${subject}」；正文 ${body.length} 字`);
  },
};
