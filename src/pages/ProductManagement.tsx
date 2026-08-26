import {
  App, Button, Card, Modal, Popconfirm, Space, Table, Tag, Tooltip, Typography,
} from 'antd';
import {
  DownloadOutlined, PlusOutlined, ReloadOutlined, StopOutlined,
} from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { ProductTable } from '../components/ProductTable';
import { DeleteConfirmModal, ProductDrawer, TransferModal } from '../components/ProductDrawer';
import { FilterBar } from '../components/FilterBar';
import type {
  Channel, Department, FeatureCode, Identity, LogEntry,
  OrgGroup, ProductRow, QueryParams, Stats,
} from '../types';
import { canOperate } from '../types';
import { palette } from '../theme';

// ─── 产品管理页：筛选 → 列表 → 增删改 + 行级权限 + 双轨日志 ───────────

const DEFAULT_PARAMS: QueryParams = {
  productName: '', status: null, productGroupName: '', productManagerName: '',
  departmentID: '', channelIDAry: [], sortField: 'ProductName', sortDirection: 'Asc',
  pageSize: 50, pageIndex: 0,
};

export function ProductManagement({ identity }: { identity: Identity }) {
  const { message: msg, modal } = App.useApp();
  const [params, setParams] = useState<QueryParams>(DEFAULT_PARAMS);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>({ total: 0, onShelves: 0, offShelves: 0 });
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<{
    channels: Channel[]; departments: Department[];
    groupNames: string[]; managerNames: string[]; projectManagerNames: string[];
    orgGroups: OrgGroup[];
  }>({ channels: [], departments: [], groupNames: [], managerNames: [], projectManagerNames: [], orgGroups: [] });
  const [features, setFeatures] = useState<FeatureCode[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [drawer, setDrawer] = useState<{
    open: boolean; mode: 'add' | 'edit'; step: 1 | 2; product: ProductRow | null;
  }>({ open: false, mode: 'add', step: 1, product: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });
  const [deleting, setDeleting] = useState(false);
  const [transferModal, setTransferModal] = useState<{ open: boolean; product: ProductRow | null }>({ open: false, product: null });
  const [transferring, setTransferring] = useState(false);
  const [logModal, setLogModal] = useState<{ open: boolean; product: ProductRow | null; logs: LogEntry[] }>({
    open: false, product: null, logs: [],
  });

  const can = useCallback((code: FeatureCode) => features.includes(code), [features]);

  useEffect(() => {
    void (async () => {
      const [channels, departments, groupNames, managerNames, projectManagers, orgGroups, featureCodes] = await Promise.all([
        api.getChannels(), api.getDepartments(), api.getGroupNames(), api.getManagerNames(),
        api.getProjectManagers(), api.getOrgGroups(), api.getFeatureCodes(),
      ]);
      setOptions({
        channels, departments, groupNames, managerNames,
        projectManagerNames: projectManagers.map(m => m.Name),
        orgGroups,
      });
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
    const [groupNames, managerNames] = await Promise.all([api.getGroupNames(), api.getManagerNames()]);
    setOptions(o => ({ ...o, groupNames, managerNames }));
    if (!keepSelection) setSelectedIds([]);
  }, [params, query]);

  useEffect(() => {
    void query(DEFAULT_PARAMS);
    api.getStats().then(setStats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 权限工具 ──
  const allowed = useCallback((p: ProductRow) =>
    canOperate(p.CreatedBy ?? '', identity, options.orgGroups), [identity, options.orgGroups]);

  // ── 增删改 ──
  const openAdd = () => setDrawer({ open: true, mode: 'add', step: 1, product: null });
  const openEdit = (row: ProductRow, step: 1 | 2) => {
    if (!allowed(row)) {
      msg.warning(`「${row.ProductName}」的操作人是 ${row.CreatedBy || '（无主）'}，仅操作人本人、其组长或管理员可修改`);
      return;
    }
    setDrawer({ open: true, mode: 'edit', step, product: row });
  };
  const openLog = async (row: ProductRow) => {
    const logs = (await api.getLogs()).filter(l => l.TargetID === row.ID);
    setLogModal({ open: true, product: row, logs });
  };

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

  const doDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteProducts(deleteModal.ids);
      msg.success(`已删除 ${deleteModal.ids.length} 个产品（系统日志可查）`);
      setDeleteModal({ open: false, ids: [] });
      await refresh();
    } catch (e) {
      msg.error(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const doTransfer = async (toMember: string) => {
    if (!transferModal.product) return;
    setTransferring(true);
    try {
      await api.transferOwnership(transferModal.product.ID, toMember);
      msg.success(`已转让给 ${toMember}，其组长同步获得操作权限`);
      setTransferModal({ open: false, product: null });
      setDrawer(d => ({ ...d, open: false }));
      await refresh(true);
    } catch (e) {
      msg.error(e instanceof Error ? e.message : '转让失败');
    } finally {
      setTransferring(false);
    }
  };

  const doExport = async (ids?: string[]) => {
    try {
      await api.exportProducts(params, ids);
      msg.success(ids ? `已导出所选 ${ids.length} 条` : '全量导出文件已生成');
    } catch (e) {
      msg.error(e instanceof Error ? e.message : '导出失败');
    }
  };

  const statChips = useMemo(() => ([
    { label: '全部产品', value: stats.total, color: palette.ink },
    { label: '已上架', value: stats.onShelves, color: palette.green },
    { label: '已下架', value: stats.offShelves, color: palette.amber },
  ]), [stats]);

  // 批量操作：仅批量停用（只限自己名下）与勾选导出（限有操作权限的条目；删除一律逐条）
  const selectedRows = rows.filter(r => selectedIds.includes(r.ID));
  const batchDisableAllowed = selectedRows.length > 0
    && selectedRows.every(r => (r.CreatedBy ?? '') === identity.name);
  // 导出权限 = 行级操作权限：管理员全量、组长含组员、本人限自己
  const exportAllowed = selectedRows.length > 0 && selectedRows.every(allowed);
  const deleteChannels = useMemo(() => new Set(
    deleteModal.ids.flatMap(id => rows.find(r => r.ID === id)?.ChannelID ?? []),
  ).size, [deleteModal.ids, rows]);

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* 页头：标题 + 实时统计 + 身份 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>产品配置</Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
            维护搜索产品库：渠道覆盖、关联词与生命周期 · 当前身份 {identity.isAdmin ? '管理员' : `${identity.name}（${identity.groupName}）`}
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
          mineOnlyDisabled={identity.isAdmin}
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
                    disabled={!batchDisableAllowed}
                    onConfirm={() => confirmDisable(selectedIds)}
                  >
                    <Tooltip title={batchDisableAllowed ? '' : '批量停用仅限自己是操作人（owner）的条目；他人条目请逐条处理'}>
                      <Button danger icon={<StopOutlined />} disabled={!batchDisableAllowed}>批量停用</Button>
                    </Tooltip>
                  </Popconfirm>
                )}
                {can('productLibrary_export') && (
                  <Tooltip title={exportAllowed
                    ? `导出所选 ${selectedIds.length} 条（管理员可全选后导出全量）`
                    : '仅可导出自己有操作权限的条目（本人名下 / 组员名下 / 管理员全量）'}>
                    <Button
                      icon={<DownloadOutlined />}
                      disabled={!exportAllowed}
                      onClick={() => void doExport(selectedIds)}
                    >
                      导出所选 {selectedIds.length} 项
                    </Button>
                  </Tooltip>
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
          identity={identity} orgGroups={options.orgGroups}
          onEdit={openEdit} onViewLog={row => void openLog(row)}
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
        identity={identity}
        onClose={() => setDrawer(d => ({ ...d, open: false }))}
        onSave={saveProduct}
        onTransfer={row => setTransferModal({ open: true, product: row })}
      />

      <DeleteConfirmModal
        open={deleteModal.open}
        count={deleteModal.ids.length}
        channels={deleteChannels}
        loading={deleting}
        onConfirm={doDelete}
        onCancel={() => setDeleteModal({ open: false, ids: [] })}
      />

      <TransferModal
        open={transferModal.open}
        itemName={transferModal.product?.ProductName ?? ''}
        ownerId={transferModal.product?.CreatedBy}
        orgGroups={options.orgGroups}
        loading={transferring}
        onConfirm={doTransfer}
        onCancel={() => setTransferModal({ open: false, product: null })}
      />

      <Modal
        open={logModal.open}
        title={`操作日志 · ${logModal.product?.ProductName ?? ''}`}
        footer={null}
        onCancel={() => setLogModal({ open: false, product: null, logs: [] })}
        width={680}
      >
        <Table<LogEntry>
          rowKey="ID" size="small"
          dataSource={logModal.logs}
          columns={[
            { title: '时间', dataIndex: 'Time', width: 150,
              render: (v: string) => <span className="tabular" style={{ fontSize: 12 }}>{v}</span> },
            { title: '操作人', dataIndex: 'User', width: 90 },
            { title: '动作', dataIndex: 'Action', width: 80 },
            { title: '详情', dataIndex: 'Detail', render: (v: string) => <span style={{ fontSize: 12.5 }}>{v}</span> },
          ]}
          pagination={false}
          locale={{ emptyText: '暂无日志记录' }}
        />
      </Modal>
    </div>
  );
}
