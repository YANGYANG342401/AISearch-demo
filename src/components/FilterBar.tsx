import { Button, Input, Select, Space } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { ChannelPicker } from './ChannelPicker';
import type { Channel, Department, ProductGroup, ProductManager, QueryParams } from '../types';
import { STATUS_TEXT } from '../types';

// ─── 筛选栏：7 个查询条件一行收纳，输入即查（防抖 400ms）──────────────

interface Props {
  params: Omit<QueryParams, 'sortField' | 'sortDirection' | 'pageSize' | 'pageIndex'>;
  onChange: (patch: Partial<QueryParams>) => void;
  onReset: () => void;
  channels: Channel[];
  departments: Department[];
  groups: ProductGroup[];
  managers: ProductManager[];
}

export function FilterBar({ params, onChange, onReset, channels, departments, groups, managers }: Props) {
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
        value={params.productGroupID || undefined}
        style={{ width: 130 }}
        options={groups.map(g => ({ value: g.ID, label: g.Name }))}
        onChange={v => onChange({ productGroupID: v ?? '' })}
      />
      <Select
        allowClear
        showSearch
        placeholder="产品经理"
        value={params.productManagerName || undefined}
        style={{ width: 130 }}
        options={managers.map(m => ({ value: m.Name, label: m.Name }))}
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
