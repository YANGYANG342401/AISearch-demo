import {
  App, Button, Card, Checkbox, Dropdown, Input, Modal, Popconfirm, Select, Space,
  Table, Tag, Tooltip, Typography,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  DeleteOutlined, DownOutlined, DownloadOutlined, EditOutlined, PlusOutlined, ReloadOutlined, StopOutlined, WarningOutlined,
} from '@ant-design/icons';
import { SearchOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { ActivityDrawer } from '../components/ActivityDrawer';
import { DeleteConfirmModal, TransferModal } from '../components/ProductDrawer';
import { ChannelPicker } from '../components/ChannelPicker';
import { ChannelSpectrum } from '../components/ChannelSpectrum';
import type {
  Activity, ActivityQueryParams, Channel, Department, Identity, LogEntry, OrgGroup,
} from '../types';
import { ACTIVITY_STATUS_TEXT, canOperate, isOrphan, operatingGroupOf } from '../types';
import { palette } from '../theme';

// ─── 活动管理：权限原则与产品一致（owner/组长/管理员、转让、无主、仅看自己、批量停用限本人）───

type SortOrder = 'ascend' | 'descend' | null;

const DEFAULT_PARAMS: ActivityQueryParams = {
  name: '', status: null, departmentID: '', channelIDAry: [], mineOnly: false,
  sortField: 'Name', sortDirection: 'Asc', pageSize: 20, pageIndex: 0,
};

export function ActivityManagement({ identity }: { identity: Identity }) {
  const { message: msg, modal } = App.useApp();
  const [params, setParams] = useState<ActivityQueryParams>(DEFAULT_PARAMS);
  const [rows, setRows] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<{
    channels: Channel[]; departments: Department[];
    projectManagerNames: string[]; orgGroups: OrgGroup[];
  }>({ channels: [], departments: [], projectManagerNames: [], orgGroups: [] });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [drawer, setDrawer] = useState<{ open: boolean; mode: 'add' | 'edit'; activity: Activity | null }>({
    open: false, mode: 'add', activity: null,
  });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });
  const [deleting, setDeleting] = useState(false);
  const [transferModal, setTransferModal] = useState<{ open: boolean; activity: Activity | null }>({
    open: false, activity: null,
  });
  const [transferring, setTransferring] = useState(false);
  const [logModal, setLogModal] = useState<{ open: boolean; activity: Activity | null; logs: LogEntry[] }>({
    open: false, activity: null, logs: [],
  });

  useEffect(() => {
    void (async () => {
      const [channels, departments, projectManagers, orgGroups] = await Promise.all([
        api.getChannels(), api.getDepartments(), api.getProjectManagers(), api.getOrgGroups(),
      ]);
      setOptions({
        channels, departments,
        projectManagerNames: projectManagers.map(m => m.Name),
        orgGroups,
      });
    })();
  }, []);

  const query = useCallback(async (p: ActivityQueryParams) => {
    setLoading(true);
    try {
      const pr = await api.searchActivities(p);
      setRows(pr.rows);
      setTotal(pr.total);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshStats = useCallback(() => {
    void api.getActivities().then(all => {
      const alive = all.filter(a => !a.IsDeleted);
      setStats({
        total: alive.length,
        active: alive.filter(a => a.Status === 'Active').length,
        inactive: alive.filter(a => a.Status === 'Inactive').length,
      });
    });
  }, []);

  const debounceRef = useRef<number | undefined>(undefined);
  const patchParams = useCallback((patch: Partial<ActivityQueryParams>) => {
    setParams(prev => {
      const next = { ...prev, ...patch };
      if (patch.name !== undefined) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => void query(next), 400);
      } else if (!Object.keys(patch).includes('pageIndex')) {
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
    refreshStats();
    if (!keepSelection) setSelectedIds([]);
  }, [params, query, refreshStats]);

  useEffect(() => {
    void query(DEFAULT_PARAMS);
    refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allowed = useCallback((a: Activity) =>
    canOperate(a.CreatedBy ?? '', identity, options.orgGroups), [identity, options.orgGroups]);

  const openAdd = () => setDrawer({ open: true, mode: 'add', activity: null });
  const openEdit = (a: Activity) => {
    if (!allowed(a)) {
      msg.warning(`「${a.Name}」的操作人是 ${a.CreatedBy || '（无主）'}，仅操作人本人、其组长或管理员可修改`);
      return;
    }
    setDrawer({ open: true, mode: 'edit', activity: a });
  };
  const openLog = async (a: Activity) => {
    const logs = (await api.getLogs()).filter(l => l.TargetID === a.ID);
    setLogModal({ open: true, activity: a, logs });
  };

  const saveActivity = async (a: Activity) => {
    if (drawer.mode === 'add') await api.addActivity(a);
    else await api.updateActivity(a);
    await refresh(true);
  };

  const confirmDisable = (ids: string[]) => {
    modal.confirm({
      title: `停用选中的 ${ids.length} 个活动？`,
      content: '停用后活动下线，不再参与搜索。',
      okText: '停用', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: async () => {
        await api.disableActivities(ids);
        msg.success(`已停用 ${ids.length} 个活动`);
        await refresh();
      },
    });
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteActivities(deleteModal.ids);
      msg.success(`已删除 ${deleteModal.ids.length} 个活动（系统日志可查）`);
      setDeleteModal({ open: false, ids: [] });
      await refresh();
    } catch (e) {
      msg.error(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const doTransfer = async (toMember: string) => {
    if (!transferModal.activity) return;
    setTransferring(true);
    try {
      await api.transferActivityOwnership(transferModal.activity.ID, toMember);
      msg.success(`已转让给 ${toMember}，其组长同步获得操作权限`);
      setTransferModal({ open: false, activity: null });
      setDrawer(d => ({ ...d, open: false }));
      await refresh(true);
    } catch (e) {
      msg.error(e instanceof Error ? e.message : '转让失败');
    } finally {
      setTransferring(false);
    }
  };

  const selectedRows = rows.filter(r => selectedIds.includes(r.ID));
  const batchDisableAllowed = selectedRows.length > 0
    && selectedRows.every(r => (r.CreatedBy ?? '') === identity.name);
  const exportAllowed = selectedRows.length > 0 && selectedRows.every(allowed);

  const doExport = async () => {
    try {
      await api.exportActivities(params, selectedIds);
      msg.success(`已导出所选 ${selectedIds.length} 条`);
    } catch (e) {
      msg.error(e instanceof Error ? e.message : '导出失败');
    }
  };

  const sorterOf = (field: string): { sortOrder?: SortOrder; onHeaderCell: () => { onClick: () => void } } => ({
    sortOrder: params.sortField === field
      ? (params.sortDirection === 'Asc' ? 'ascend' : 'descend')
      : undefined,
    onHeaderCell: () => ({
      onClick: () => {
        if (params.sortField !== field) patchParams({ sortField: field, sortDirection: 'Asc' });
        else patchParams({ sortDirection: params.sortDirection === 'Asc' ? 'Desc' : 'Asc' });
      },
    }),
  });

  const columns: ColumnsType<Activity> = [
    {
      title: '活动', dataIndex: 'Name', width: 200,
      render: (_, r) => (
        <div style={{ lineHeight: 1.45 }}>
          <a onClick={() => openEdit(r)} style={{ fontWeight: 600 }}>{r.Name}</a>
          <div style={{ fontSize: 11.5, color: palette.inkFaint }} className="mono">{r.ID}</div>
        </div>
      ),
    },
    {
      title: '状态', dataIndex: 'Status', width: 84, align: 'center',
      render: (s: Activity['Status']) => (
        <span style={{
          display: 'inline-block', padding: '1px 8px', borderRadius: 4, fontSize: 12,
          backgroundColor: s === 'Active' ? palette.greenWash : '#EEF0F4',
          color: s === 'Active' ? palette.green : palette.inkFaint,
          fontWeight: 500,
        }}>
          {ACTIVITY_STATUS_TEXT[s]}
        </span>
      ),
    },
    {
      title: '上线渠道', dataIndex: 'ChannelID', width: 190,
      render: (_, r) => <ChannelSpectrum channelIds={r.ChannelID} channels={options.channels} />,
    },
    {
      title: '大搜展示', dataIndex: 'MusearchShow', width: 88, align: 'center',
      render: (v: boolean) => v
        ? <span style={{ color: palette.brand, fontWeight: 600 }}>展示</span>
        : <span style={{ color: palette.inkFaint }}>不展示</span>,
    },
    {
      title: '关联词', dataIndex: 'Keyword', width: 160,
      render: (v: string) => {
        if (!v) return <Typography.Text type="secondary">—</Typography.Text>;
        const words = v.split('|');
        return (
          <Tooltip title={words.join(' · ')}>
            <span style={{ fontSize: 12 }}>
              {words.slice(0, 3).join(' · ')}
              {words.length > 3 && <span style={{ color: palette.inkFaint }}> +{words.length - 3}</span>}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: '业务归属', dataIndex: 'DepartmentName', width: 105,
      render: (_, r) => <span style={{ fontSize: 12.5 }}>
        {r.DepartmentName ?? options.departments.find(d => d.ID === r.DepartmentID)?.Name ?? '—'}
      </span>,
    },
    {
      title: '项目经理', dataIndex: 'ProjectManager', width: 90,
      render: (v: string) => <span style={{ fontSize: 12.5 }}>{v || '—'}</span>,
    },
    {
      title: '操作人 / 可操作', dataIndex: 'CreatedBy', width: 135, ...sorterOf('CreatedBy'),
      render: (_, r) => {
        const owner = r.CreatedBy ?? '';
        const orphan = isOrphan(owner, options.orgGroups);
        const leader = operatingGroupOf(owner, options.orgGroups)?.Leader;
        return (
          <div style={{ lineHeight: 1.5 }}>
            {orphan ? (
              <Tooltip title="原操作人已离职（无主）：其原组长仍可操作，编辑时需补充新操作员">
                <span style={{ color: palette.amber, fontSize: 12.5 }}>
                  <WarningOutlined style={{ marginRight: 4 }} />无主
                </span>
              </Tooltip>
            ) : (
              <span style={{
                fontSize: 12.5, fontWeight: 600,
                color: r.CreatedBy === identity.name ? palette.brand : palette.ink,
              }}>
                owner: {owner}
              </span>
            )}
            <div style={{ fontSize: 11.5, color: palette.inkFaint }}>
              {orphan
                ? (leader ? `可操作：${leader}（原组长）` : '可操作：—（原组未知）')
                : `可操作：${owner}${leader && leader !== owner ? ` ${leader}（组长）` : ''}`}
            </div>
          </div>
        );
      },
    },
    {
      title: '生命周期', dataIndex: 'StartTime', width: 165, ...sorterOf('StartTime'),
      render: (_, r) => (
        <div style={{ fontSize: 12, lineHeight: 1.5 }} className="tabular">
          <div>{r.StartTime?.slice(0, 16)}</div>
          <div style={{ color: palette.inkFaint }}>→ {r.EndTime?.slice(0, 16)}</div>
        </div>
      ),
    },
    {
      title: '操作', key: 'actions', width: 76, align: 'center', fixed: 'right',
      render: (_, r) => {
        const ok = allowed(r);
        return (
          <Space size={4}>
            <Button type="text" size="small" icon={<EditOutlined />}
              disabled={!ok} onClick={() => openEdit(r)}
              title={ok ? '编辑' : '仅操作人/组长/管理员可修改'} style={{ color: ok ? palette.brand : undefined }} />
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'log', label: '查看日志', onClick: () => void openLog(r) },
                  {
                    key: 'disable', label: '停用', danger: true, icon: <StopOutlined />,
                    disabled: !ok || r.Status === 'Inactive',
                    onClick: () => confirmDisable([r.ID]),
                  },
                  {
                    key: 'delete', label: '删除', danger: true, icon: <DeleteOutlined />,
                    disabled: !ok,
                    onClick: () => setDeleteModal({ open: true, ids: [r.ID] }),
                  },
                ],
              }}
            >
              <Button type="text" size="small" icon={<DownOutlined />} title="更多" />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  const pagination: TablePaginationConfig = {
    total,
    pageSize: params.pageSize,
    current: params.pageIndex + 1,
    showSizeChanger: true,
    pageSizeOptions: [20, 50],
    showTotal: t => `共 ${t} 条`,
    onChange: (page, size) => patchParams({ pageIndex: page - 1, pageSize: size }),
  };

  const statChips = [
    { label: '全部活动', value: stats.total, color: palette.ink },
    { label: '进行中', value: stats.active, color: palette.green },
    { label: '已停用', value: stats.inactive, color: palette.amber },
  ];

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>活动配置</Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
            营销活动的搜索内容与渠道覆盖 · 当前身份 {identity.isAdmin ? '管理员' : `${identity.name}（${identity.groupName}）`}
          </Typography.Text>
        </div>
        <Space size={20}>
          {statChips.map(s => (
            <div key={s.label} style={{ textAlign: 'right' }}>
              <div className="tabular" style={{
                fontSize: 22, fontWeight: 700, color: s.color,
                fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
              }}>{s.value}</div>
              <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>{s.label}</Typography.Text>
            </div>
          ))}
        </Space>
      </div>

      <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
        <Space size={[8, 8]} wrap style={{ alignItems: 'center' }}>
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: '#8A94AD' }} />}
            placeholder="搜索活动名称 / 描述"
            value={params.name}
            style={{ width: 210 }}
            onChange={e => patchParams({ name: e.target.value })}
          />
          <Select<ActivityQueryParams['status']>
            allowClear
            placeholder="状态"
            value={params.status ?? undefined}
            style={{ width: 100 }}
            options={Object.entries(ACTIVITY_STATUS_TEXT).map(([v, t]) => ({ value: v as ActivityQueryParams['status'], label: t }))}
            onChange={v => patchParams({ status: v ?? null })}
          />
          <Select
            allowClear showSearch
            placeholder="业务归属"
            value={params.departmentID || undefined}
            style={{ width: 140 }}
            options={options.departments.map(d => ({ value: d.ID, label: d.Name }))}
            optionFilterProp="label"
            onChange={v => patchParams({ departmentID: v ?? '' })}
          />
          <ChannelPicker
            value={params.channelIDAry}
            channels={options.channels}
            onChange={ids => patchParams({ channelIDAry: ids })}
          />
          <Tooltip title={identity.isAdmin ? '管理员全量可见，无需筛选' : '显示 owner 是本人、或本人是其组长的条目'}>
            <Checkbox
              checked={!!params.mineOnly}
              disabled={identity.isAdmin}
              onChange={e => patchParams({ mineOnly: e.target.checked })}
            >
              仅看与自己有关条目
            </Checkbox>
          </Tooltip>
          <Button icon={<ReloadOutlined />} onClick={() => { setParams(DEFAULT_PARAMS); void query(DEFAULT_PARAMS); }}>重置</Button>
        </Space>
      </Card>

      <Card size="small" styles={{ body: { padding: '0 8px 8px' } }} style={{ overflow: 'auto', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 8px' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>新增活动</Button>
          <Space size={8}>
            {selectedIds.length > 0 && (
              <>
                <Tag color="blue" style={{ marginInlineEnd: 0 }}>已选 {selectedIds.length} 项</Tag>
                <Popconfirm
                  title={`停用选中的 ${selectedIds.length} 个活动？`}
                  description="停用后活动下线，不再参与搜索"
                  okText="停用" cancelText="取消" okButtonProps={{ danger: true }}
                  disabled={!batchDisableAllowed}
                  onConfirm={() => confirmDisable(selectedIds)}
                >
                  <Tooltip title={batchDisableAllowed ? '' : '批量停用仅限自己是操作人（owner）的条目；他人条目请逐条处理'}>
                    <Button danger icon={<StopOutlined />} disabled={!batchDisableAllowed}>批量停用</Button>
                  </Tooltip>
                </Popconfirm>
                <Tooltip title={exportAllowed
                  ? `导出所选 ${selectedIds.length} 条`
                  : '仅可导出自己有操作权限的条目（本人名下 / 组员名下）'}>
                  <Button
                    icon={<DownloadOutlined />}
                    disabled={!exportAllowed}
                    onClick={() => void doExport()}
                  >
                    导出所选 {selectedIds.length} 项
                  </Button>
                </Tooltip>
              </>
            )}
            <Button icon={<ReloadOutlined />} onClick={() => void refresh(true)} title="刷新" />
          </Space>
        </div>
        <Table<Activity>
          rowKey="ID" size="small" loading={loading}
          columns={columns} dataSource={rows}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: keys => setSelectedIds(keys as string[]),
            columnWidth: 36,
          }}
          pagination={pagination}
          scroll={{ x: 1250 }}
        />
      </Card>

      <ActivityDrawer
        open={drawer.open}
        mode={drawer.mode}
        activity={drawer.activity}
        options={options}
        identity={identity}
        onClose={() => setDrawer(d => ({ ...d, open: false }))}
        onSave={saveActivity}
        onTransfer={a => setTransferModal({ open: true, activity: a })}
      />

      <DeleteConfirmModal
        open={deleteModal.open}
        count={deleteModal.ids.length}
        channels={new Set(deleteModal.ids.flatMap(id => rows.find(r => r.ID === id)?.ChannelID ?? [])).size}
        loading={deleting}
        onConfirm={doDelete}
        onCancel={() => setDeleteModal({ open: false, ids: [] })}
      />

      <TransferModal
        open={transferModal.open}
        itemName={transferModal.activity?.Name ?? ''}
        ownerId={transferModal.activity?.CreatedBy}
        orgGroups={options.orgGroups}
        loading={transferring}
        onConfirm={doTransfer}
        onCancel={() => setTransferModal({ open: false, activity: null })}
      />

      <Modal
        open={logModal.open}
        title={`操作日志 · ${logModal.activity?.Name ?? ''}`}
        footer={null}
        onCancel={() => setLogModal({ open: false, activity: null, logs: [] })}
        width={680}
      >
        <Table<LogEntry>
          rowKey="ID" size="small" dataSource={logModal.logs}
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
