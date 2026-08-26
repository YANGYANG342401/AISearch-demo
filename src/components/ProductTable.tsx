import { Button, Dropdown, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { DeleteOutlined, DownOutlined, EditOutlined, StopOutlined, WarningOutlined } from '@ant-design/icons';

type SortOrder = 'ascend' | 'descend' | null;
import { useState } from 'react';
import { ChannelSpectrum } from './ChannelSpectrum';
import type { Channel, Department, Identity, OrgGroup, ProductRow, QueryParams } from '../types';
import { STATUS_TEXT, canOperate, isOrphan, operatingGroupOf } from '../types';
import { palette } from '../theme';

// ─── 产品列表：高密度表格，渠道光谱列，行级权限（owner/组长/管理员）───

interface Props {
  rows: ProductRow[];
  total: number;
  loading: boolean;
  params: QueryParams;
  onParamsChange: (patch: Partial<QueryParams>) => void;
  channels: Channel[];
  departments: Department[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  identity: Identity;
  orgGroups: OrgGroup[];
  onEdit: (row: ProductRow, step: 1 | 2) => void;
  onViewLog: (row: ProductRow) => void;
  onDisable: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
}

const ellipsis = { ellipsis: true } as const;

export function ProductTable({
  rows, total, loading, params, onParamsChange, channels, departments,
  selectedIds, onSelectedIdsChange, identity, orgGroups,
  onEdit, onViewLog, onDisable, onDelete,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorterOf = (field: string): { sortOrder?: SortOrder; onHeaderCell: () => { onClick: () => void } } => ({
    sortOrder: params.sortField === field
      ? (params.sortDirection === 'Asc' ? 'ascend' : 'descend')
      : undefined,
    onHeaderCell: () => ({
      onClick: () => {
        if (params.sortField !== field) {
          onParamsChange({ sortField: field, sortDirection: 'Asc' });
        } else {
          onParamsChange({ sortDirection: params.sortDirection === 'Asc' ? 'Desc' : 'Asc' });
        }
      },
    }),
  });

  const columns: ColumnsType<ProductRow> = [
    {
      title: '产品', dataIndex: 'ProductName', width: 220,
      ...ellipsis, ...sorterOf('ProductName'),
      render: (_, r) => (
        <div style={{ lineHeight: 1.45 }}>
          <a onClick={() => onEdit(r, 1)} style={{ fontWeight: 600 }}>{r.ProductName}</a>
          <div style={{ fontSize: 11.5, color: palette.inkFaint }} className="mono">
            {r.ID}
          </div>
        </div>
      ),
    },
    {
      title: '状态', dataIndex: 'Status', width: 84, align: 'center', ...sorterOf('Status'),
      render: (s: ProductRow['Status']) => (
        <span style={{
          display: 'inline-block', padding: '1px 8px', borderRadius: 4, fontSize: 12,
          backgroundColor: s === 'PutOnShelves' ? palette.greenWash : '#EEF0F4',
          color: s === 'PutOnShelves' ? palette.green : palette.inkFaint,
          fontWeight: 500,
        }}>
          {STATUS_TEXT[s]}
        </span>
      ),
    },
    {
      title: '上线渠道', dataIndex: 'ChannelID', width: 210,
      render: (_, r) => <ChannelSpectrum channelIds={r.ChannelID} channels={channels} />,
    },
    {
      title: '大搜展示', dataIndex: 'MusearchShow', width: 88, align: 'center', ...sorterOf('MusearchShow'),
      render: (v: boolean) => v
        ? <span style={{ color: palette.brand, fontWeight: 600 }}>展示</span>
        : <span style={{ color: palette.inkFaint }}>不展示</span>,
    },
    {
      title: '关联词', dataIndex: 'Keyword', width: 170,
      render: (v: string) => {
        if (!v || v === '无') return <Typography.Text type="secondary">—</Typography.Text>;
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
      title: '业务归属', dataIndex: 'DepartmentID', width: 110, ...ellipsis,
      render: (_, r) => {
        const name = r.DepartmentName
          ?? departments.find(d => d.ID === r.DepartmentID)?.Name;
        const isOther = departments.find(d => d.ID === r.DepartmentID)?.Name?.includes('其他');
        return <span style={{ fontSize: 12.5 }}>
          {(isOther && r.OtherDepartmentDesc) ? r.OtherDepartmentDesc : (name || '—')}
        </span>;
      },
    },
    {
      title: '产品组', dataIndex: 'ProductGroupID', width: 95, align: 'center', ...ellipsis,
      render: (_, r) => <Tag bordered={false} style={{ fontSize: 12 }}>{r.ProductGroupName || ''}</Tag>,
    },
    {
      title: '产品经理', dataIndex: 'ProductManagerName', width: 110, ...ellipsis,
      render: (v: string) => <span style={{ fontSize: 12.5 }}>{v}</span>,
    },
    {
      title: '操作人 / 可操作', dataIndex: 'CreatedBy', width: 135, ...sorterOf('CreatedBy'),
      render: (_, r) => {
        const owner = r.CreatedBy ?? '';
        const orphan = isOrphan(owner, orgGroups);
        const leader = operatingGroupOf(owner, orgGroups)?.Leader;
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
      title: '配置', key: 'config', width: 96, align: 'center',
      render: (_, r) => (
        <Space size={0} split={<span style={{ color: '#D4DAE6', padding: '0 4px' }}>/</span>}>
          <a onClick={() => onEdit(r, 1)} style={{ fontSize: 12 }}>通用</a>
          <a onClick={() => onEdit(r, 2)} style={{ fontSize: 12 }}>渠道</a>
        </Space>
      ),
    },
    {
      title: '操作', key: 'actions', width: 76, align: 'center', fixed: 'right',
      render: (_, r) => {
        const allowed = canOperate(r.CreatedBy ?? '', identity, orgGroups);
        return (
          <Space size={4}>
            <Button type="text" size="small" icon={<EditOutlined />}
              disabled={!allowed}
              onClick={() => onEdit(r, 1)}
              title={allowed ? '修改' : '仅操作人/组长/管理员可修改'} style={{ color: allowed ? palette.brand : undefined }} />
            <Dropdown
              menu={{
                items: [
                  { key: 'log', label: '查看日志', onClick: () => onViewLog(r) },
                  {
                    key: 'disable', label: '停用', danger: true, icon: <StopOutlined />,
                    disabled: !allowed || r.Status === 'PullOffShelves',
                    onClick: () => onDisable([r.ID]),
                  },
                  {
                    key: 'delete', label: '删除', danger: true, icon: <DeleteOutlined />,
                    disabled: !allowed,
                    onClick: () => onDelete([r.ID]),
                  },
                ],
              }}
              trigger={['click']}
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
    pageSizeOptions: [20, 50, 100],
    showTotal: t => `共 ${t} 条`,
    onChange: (page, size) => onParamsChange({ pageIndex: page - 1, pageSize: size }),
  };

  return (
    <Table<ProductRow>
      rowKey="ID"
      size="small"
      loading={loading}
      columns={columns}
      dataSource={rows}
      rowSelection={{
        selectedRowKeys: selectedIds,
        onChange: keys => onSelectedIdsChange(keys as string[]),
        columnWidth: 36,
      }}
      pagination={pagination}
      expandable={{
        rowExpandable: () => true,
        expandedRowKeys: expandedId ? [expandedId] : [],
        onExpand: (expanded, record) => setExpandedId(expanded ? record.ID : null),
        expandedRowRender: r => (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '6px 32px', padding: '4px 8px',
          }}>
            <Desc label="产品描述" value={r.Description} wide />
            <Desc label="完整关联词" value={r.Keyword} />
            <Desc label="备注" value={r.Remark} />
            <Desc label="操作手册" value={r.OperationManual ? '已上传' : '—'} />
            <Desc label="项目经理" value={r.ProjectManager} />
            <Desc label="创建时间" value={r.CreateTime} />
            <Desc label="最后修改" value={r.LastUpdateTime} />
          </div>
        ),
      }}
      scroll={{ x: 1420 }}
    />
  );
}

function Desc({ label, value, wide }: { label: string; value?: string; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined, fontSize: 12.5, lineHeight: 1.6 }}>
      <span style={{ color: palette.inkFaint }}>{label}：</span>
      <span style={{ color: palette.inkSoft }}>{value || '—'}</span>
    </div>
  );
}
