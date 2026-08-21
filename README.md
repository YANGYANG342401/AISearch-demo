# musearch-admin-next

东航电商搜索后台 · 产品库-产品管理 改版前端。

## 运行

```bash
npm install
npm run dev -- --port 5199   # http://localhost:5199
```

## 数据来源切换

`src/api/index.ts` 中 `USE_MOCK`：

- `true`（默认）：内存 mock，种子数据来自 UAT 真实响应样本（`src/api/fixtures.ts`）。
  删除操作密码为 `admin`；导出会真实生成 CSV 下载。
- `false`：直连 UAT 真实接口（同签名客户端已实现）。需在 `vite.config.ts` 配代理：

```ts
server: { proxy: { '/api': { target: 'http://ecsearch-admin2.uat.k8s.ec', changeOrigin: true } } }
```

## 结构

- `src/types.ts` — 领域类型与渠道分族（渠道光谱）
- `src/api/` — ApiClient 接口 + mock 实现 + 真实客户端
- `src/components/` — ChannelSpectrum（行内渠道微标）、ChannelPicker（分组多选）、
  FilterBar、ProductTable、ProductDrawer（两步式：基础信息 → 渠道配置）
- `src/pages/ProductManagement.tsx` — 列表页编排（筛选/分页/批量操作/权限）
- `src/theme.ts` — 夜航蓝设计 token（AntD ConfigProvider）

## 行为对齐说明

- 修改保存后进入渠道配置步骤（同原版）；删除需操作密码；停用批量确认；
  工具栏按 featureCode 权限码渲染；管理员开关在页头。
- 渠道配置的模板表单为简化演示版，完整模板结构见
  `~/musearch-recon/template_{pc,mobile,api,other}.html`。

## 需求文档

接口契约与页面行为清单：`~/musearch-recon/产品管理模块规格文档.md`
