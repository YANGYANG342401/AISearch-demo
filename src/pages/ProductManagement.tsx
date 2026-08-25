import {
  App, Button, Card, Popconfirm, Space, Switch, Tag, Typography, Upload,
} from 'antd';
import {
  CloudUploadOutlined, DownloadOutlined,
  PlusOutlined, ReloadOutlined, StopOutlined,
} from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, USE_MOCK } from '../api';
import { ProductTable } from '../components/ProductTable';
import { DeletePasswordModal, ProductDrawer } from '../components/ProductDrawer';
import { FilterBar } from '../components/FilterBar';
import type {
  Channel, Department, FeatureCode,
  ProductRow, QueryParams, Stats,
} from '../types';
import { palette } from '../theme';

// ─── 产品管理页：筛选 → 列表 → 增删改，行为对齐原版 ────────────────────

const DEFAULT_PARAMS: QueryParams = {
  productName: '', status: null, productGroupName: '', productManagerName: '',
  departmentID: '', channelIDAry: [], sortField: 'ProductName', sortDirection: 'Asc',
  pageSize: 50, pageIndex: 0,
};

export function ProductManagement() {
  const { message: msg, modal } = App.useApp();
  const [params, setParams] = useState<QueryParams>(DEFAULT_PARAMS);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>({ total: 0, onShelves: 0, offShelves: 0 });
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<{
    channels: Channel[]; departments: Department[];
    groupNames: string[]; managerNames: string[];
  }>({ channels: [], departments: [], groupNames: [], managerNames: [] });
  const [features, setFeatures] = useState<FeatureCode[]>([]);
  const [isAdmin, setIsAdmin] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [drawer, setDrawer] = useState<{
    open: boolean; mode: 'add' | 'edit'; step: 1 | 2; product: ProductRow | null;
  }>({ open: false, mode: 'add', step: 1, product: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });
  const [deleting, setDeleting] = useState(false);

  const can = useCallback((code: FeatureCode) => features.includes(code), [features]);

  useEffect(() => {
    void (async () => {
      const [channels, departments, groupNames, managerNames, featureCodes] = await Promise.all([
        api.getChannels(), api.getDepartments(), api.getGroupNames(), api.getManagerNames(),
        api.getFeatureCodes(),
      ]);
      setOptions({ channels, departments, groupNames, managerNames });
      setFeatures(featureCodes);
    })();
  }, []);

  const query = useCallback(async (p: QueryParams) => {
    setLoading(true);
    try {
      const pr = await api.searchProducts(p);
      setRows(pr.rows);
      setTotal(pr.total);
    } finally {
      setLoading(false);
    }
  }, []);

  // 名称搜索防抖；其余条件变化回到第 1 页；仅切换排序方向保留当前页
  const debounceRef = useRef<number | undefined>(undefined);
  const patchParams = useCallback((patch: Partial<QueryParams>) => {
    setParams(prev => {
      const next = { ...prev, ...patch };
      const keys = Object.keys(patch);
      if (patch.productName !== undefined) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => void query(next), 400);
      } else if (keys.length === 1 && keys[0] === 'sortDirection') {
        void query(next);
      } else if (!keys.includes('pageIndex')) {
        next.pageIndex = 0;
        void query(next);
      } else {
        void query(next);
      }
      return next;
    });
  }, [query]);

  const refresh = useCallback(async (keepSelection = false) => {
    await query(params);
    api.getStats().then(setStats);
    // 标签化：新产品可能引入新的组名/人名，选项随数据刷新
    const [groupNames, managerNames] = await Promise.all([api.getGroupNames(), api.getManagerNames()]);
    setOptions(o => ({ ...o, groupNames, managerNames }));
    if (!keepSelection) setSelectedIds([]);
  }, [params, query]);

  useEffect(() => {
    void query(DEFAULT_PARAMS);
    api.getStats().then(setStats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 增删改 ──
  const openAdd = () => setDrawer({ open: true, mode: 'add', step: 1, product: null });
  const openEdit = (row: ProductRow, step: 1 | 2) =>
    setDrawer({ open: true, mode: 'edit', step, product: row });
  const openLog = (row: ProductRow) =>
    modal.info({
      title: `「${row.ProductName}」操作日志`,
      content: '此处对接原系统「操作日志」模块，展示该产品的变更历史。',
    });

  const saveProduct = async (p: ProductRow) => {
    if (drawer.mode === 'add') await api.addProduct(p);
    else await api.updateProduct(p);
    await refresh(true);
  };

  const confirmDisable = (ids: string[]) => {
    modal.confirm({
      title: `停用选中的 ${ids.length} 个产品？`,
      content: '停用后该产品下所有产品数据将不可被使用。',
      okText: '停用', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: async () => {
        await api.disableProducts(ids);
        msg.success(`已停用 ${ids.length} 个产品`);
        await refresh();
      },
    });
  };

  const doDelete = async (pwd: string) => {
    setDeleting(true);
    try {
      await api.deleteProducts(deleteModal.ids, pwd);
      msg.success(`已删除 ${deleteModal.ids.length} 个产品`);
      setDeleteModal({ open: false, ids: [] });
      await refresh();
    } catch (e) {
      msg.error(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const doImport = async (file: File) => {
    try {
      const { imported } = await api.importProducts(file);
      msg.success(`${USE_MOCK ? '[Mock] ' : ''}导入完成：${imported} 条`);
      await refresh();
    } catch (e) {
      msg.error(e instanceof Error ? e.message : '导入失败');
    }
    return false;
  };

  const doExport = async () => {
    try {
      await api.exportProducts(params);
      msg.success('导出文件已生成');
    } catch (e) {
      msg.error(e instanceof Error ? e.message : '导出失败');
    }
  };

  const statChips = useMemo(() => ([
    { label: '全部产品', value: stats.total, color: palette.ink },
    { label: '已上架', value: stats.onShelves, color: palette.green },
    { label: '已下架', value: stats.offShelves, color: palette.amber },
  ]), [stats]);

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* 页头：标题 + 实时统计 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>产品管理</Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
            维护搜索产品库：渠道覆盖、关联词与生命周期
          </Typography.Text>
        </div>
        <Space size={20}>
          {statChips.map(s => (
            <div key={s.label} style={{ textAlign: 'right' }}>
              <div className="tabular" style={{
                fontSize: 22, fontWeight: 700, color: s.color,
                fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
              }}>{loading && s.label === '全部产品' ? '–' : s.value}</div>
              <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>{s.label}</Typography.Text>
            </div>
          ))}
          <div style={{ textAlign: 'right', borderLeft: '1px solid #E3E8F0', paddingLeft: 20 }}>
            <div style={{ fontSize: 11.5, marginBottom: 2 }}>
              <Typography.Text type="secondary">管理员视图</Typography.Text>
            </div>
            <Switch size="small" checked={isAdmin} onChange={setIsAdmin} />
          </div>
        </Space>
      </div>

      {/* 筛选栏 */}
      <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
        <FilterBar
          params={params}
          onChange={patchParams}
          onReset={() => { setParams(DEFAULT_PARAMS); void query(DEFAULT_PARAMS); }}
          channels={options.channels}
          departments={options.departments}
          groupNames={options.groupNames}
          managerNames={options.managerNames}
        />
      </Card>

      {/* 工具栏 + 表格 */}
      <Card size="small" styles={{ body: { padding: '0 8px 8px' } }} style={{ overflow: 'auto', flex: 1 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 8px',
        }}>
          <Space size={8}>
            {can('productLibrary_add') && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>新增产品</Button>
            )}
            {can('productLibrary_import') && (
              <Upload accept=".xlsx" showUploadList={false} beforeUpload={doImport} maxCount={1}>
                <Button icon={<CloudUploadOutlined />}>导入</Button>
              </Upload>
            )}
            {can('productLibrary_export') && (
              <Button icon={<DownloadOutlined />} onClick={doExport}>导出</Button>
            )}
          </Space>
          <Space size={8}>
            {selectedIds.length > 0 && (
              <>
                <Tag color="blue" style={{ marginInlineEnd: 0 }}>已选 {selectedIds.length} 项</Tag>
                {can('productLibrary_disable') && (
                  <Popconfirm
                    title={`停用选中的 ${selectedIds.length} 个产品？`}
                    description="停用后该产品下所有产品数据将不可被使用"
                    okText="停用" cancelText="取消" okButtonProps={{ danger: true }}
                    onConfirm={() => confirmDisable(selectedIds)}
                  >
                    <Button danger icon={<StopOutlined />}>批量停用</Button>
                  </Popconfirm>
                )}
                {isAdmin && (
                  <Button danger ghost onClick={() => setDeleteModal({ open: true, ids: selectedIds })}>
                    批量删除
                  </Button>
                )}
              </>
            )}
            <Button icon={<ReloadOutlined />} onClick={() => void refresh(true)} title="刷新" />
          </Space>
        </div>
        <ProductTable
          rows={rows} total={total} loading={loading}
          params={params} onParamsChange={patchParams}
          channels={options.channels} departments={options.departments}
          selectedIds={selectedIds} onSelectedIdsChange={setSelectedIds}
          isAdmin={isAdmin}
          onEdit={openEdit} onViewLog={openLog}
          onDisable={confirmDisable}
          onDelete={ids => setDeleteModal({ open: true, ids })}
        />
      </Card>

      <ProductDrawer
        open={drawer.open}
        mode={drawer.mode}
        initStep={drawer.step}
        product={drawer.product}
        options={options}
        onClose={() => setDrawer(d => ({ ...d, open: false }))}
        onSave={saveProduct}
      />

      <DeletePasswordModal
        open={deleteModal.open}
        count={deleteModal.ids.length}
        loading={deleting}
        onConfirm={doDelete}
        onCancel={() => setDeleteModal({ open: false, ids: [] })}
      />
    </div>
  );
}
