# 东航电商搜索管理平台（改版前端）

React 19 + TypeScript + Vite + Ant Design 6。Mock 数据驱动，API 层与真实接口同签名，一处开关切换。

## 运行

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5199   # http://localhost:5199，--host 后局域网可访问
```

右上角身份切换器可切三种视角：杨阳（组员）/ 张三（组长）/ 管理员——用于演示行级权限差异。

## 功能结构

```
搜索数据
 ├ 搜索数据看板        iframe 嵌入自包含看板（public/dashboard/index.html）
 ├ 预设搜索词配置      默认库+五端覆盖 / 时间窗自动上下线 / 直跳词 / 手机实时预览
 └ 未命中搜索词        周度 TOP5 汇总 / 邮件通知业务与产品部门
搜索内容
 ├ 产品配置            产品库 CRUD + 两步式抽屉（基础信息→渠道配置）
 └ 活动配置            活动库 CRUD（权限原则与产品一致）
配置管理               仅管理员可配置（其他角色只读）
 ├ 产品组管理          组织结构：组长/组员/离职档案 —— 权限锚点
 ├ 业务部门管理        业务归属字典
 ├ 渠道管理            渠道 + 模板类型绑定
 └ 项目经理管理        外部技术部门人员名录
系统
 └ 系统日志            全局操作留痕（条目日志 = 按 TargetID 过滤）
```

## 权限模型（核心）

- **权限链**：owner（创建人）→ 其组长（含离职成员的原组长）→ 管理员（仅应急）
- 行级权限：编辑/停用/删除/转让 限 owner/组长/管理员；无权限按钮置灰
- **批量安全**：无批量删除；批量停用仅限自己名下；删除逐条强确认
- **导出**：勾选导出，限有操作权限的条目；管理员全选 = 全量
- **转让**：抽屉 03 归属区发起，接收人（及其组长）成为操作人
- **无主条目**：owner 离职（移入离职档案）→ ⚠ 标记 + 原组长可操作 + 编辑时强制补操作员
- **身份带出**：新建时产品经理=本人、产品组=本组，锁定（管理员可调）

详见《开发交接文档-搜索后台改版.md》第二章。

## 代码结构

- `src/types.ts` — 领域模型 + 权限函数（canOperate/isOrphan/effectivePresetWords 等）
- `src/api/` — `index.ts`（ApiClient 接口 + USE_MOCK 开关 + realApi）、`mockApi.ts`、`fixtures.ts`（UAT 真实样本种子，人名已脱敏）
- `src/pages/` — 各页面（ProductManagement / ActivityManagement / PresetWords / MissedWords / OrgPage / ConfigPages / SystemLog / SearchDashboard）
- `src/components/` — ProductDrawer（两步抽屉+转让+删除确认）、ActivityDrawer、ChannelPicker/ChannelSpectrum（渠道光谱）、ProductTable、FilterBar
- `src/theme.ts` — 夜航蓝设计 token（AntD ConfigProvider）

## 切换真实接口

`src/api/index.ts` 中 `USE_MOCK = false`，并在 `vite.config.ts` 配代理：

```ts
server: { proxy: { '/api': { target: 'http://ecsearch-admin2.uat.k8s.ec', changeOrigin: true } } }
```

未对接的真实接口以 `throw new Error('真实接口待对接：…')` 占位，清单见交接文档第四章。
