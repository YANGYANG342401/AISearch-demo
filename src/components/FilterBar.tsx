import { Button, Input, Select, Space } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { ChannelPicker } from './ChannelPicker';
import type { Channel, Department, QueryParams } from '../types';
import { STATUS_TEXT } from '../types';

// ─── 筛选栏：查询条件一行收纳，输入即查（防抖 400ms）──────────────────
// 产品组/产品经理选项从产品数据 distinct（标签化，不再依赖字典表）。

interface Props {
  params: Omit<QueryParams, 'sortField' | 'sortDirection' | 'pageSize' | 'pageIndex'>;
  onChange: (patch: Partial<QueryParams>) => void;
  onReset: () => void;
  channels: Channel[];
  departments: Department[];
  groupNames: string[];
  managerNames: string[];
}

export function FilterBar({ params, onChange, onReset, channels, departments, groupNames, managerNames }: Props) {
  return (
    <Space size={[8, 8]} wrap style={{ alignItems: 'center' }}>
      <Input
        allowClear
        prefix={<SearchOutlined style={{ color: '#8A94AD' }} />}
        placeholder="搜索产品名称 / 描述"
        value={params.productName}
        style={{ width: 220 }}
        onChange={e => onChange({ productName: e.target.value })}
      />
      <Select<QueryParams['status']>
        allowClear
        placeholder="状态"
        value={params.status ?? undefined}
        style={{ width: 110 }}
        options={Object.entries(STATUS_TEXT).map(([v, t]) => ({ value: v as QueryParams['status'], label: t }))}
        onChange={v => onChange({ status: v ?? null })}
      />
      <Select
        allowClear
        placeholder="产品组"
        value={params.productGroupName || undefined}
        style={{ width: 130 }}
        options={groupNames.map(n => ({ value: n, label: n }))}
        onChange={v => onChange({ productGroupName: v ?? '' })}
      />
      <Select
        allowClear
        showSearch
        placeholder="产品经理"
        value={params.productManagerName || undefined}
        style={{ width: 130 }}
        options={managerNames.map(n => ({ value: n, label: n }))}
        optionFilterProp="label"
        onChange={v => onChange({ productManagerName: v ?? '' })}
      />
      <Select
        allowClear
        showSearch
        placeholder="业务归属"
        value={params.departmentID || undefined}
        style={{ width: 140 }}
        options={departments.map(d => ({ value: d.ID, label: d.Name }))}
        optionFilterProp="label"
        onChange={v => onChange({ departmentID: v ?? '' })}
      />
      <ChannelPicker
        value={params.channelIDAry}
        channels={channels}
        onChange={ids => onChange({ channelIDAry: ids })}
      />
      <Button icon={<ReloadOutlined />} onClick={onReset}>重置</Button>
    </Space>
  );
}
