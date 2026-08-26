import { Button, Checkbox, Input, Select, Space, Tooltip } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { ChannelPicker } from './ChannelPicker';
import type { Channel, Department, QueryParams } from '../types';
import { STATUS_TEXT } from '../types';

// ─── 筛选栏：查询条件一行收纳，输入即查（防抖 400ms）──────────────────
// 产品组/产品经理筛选已移除——归属与操作权改为行内直接展示（见列表操作人列）。

interface Props {
  params: Omit<QueryParams, 'sortField' | 'sortDirection' | 'pageSize' | 'pageIndex'>;
  onChange: (patch: Partial<QueryParams>) => void;
  onReset: () => void;
  channels: Channel[];
  departments: Department[];
  /** 管理员全量可见，勾选置灰 */
  mineOnlyDisabled?: boolean;
}

export function FilterBar({ params, onChange, onReset, channels, departments, mineOnlyDisabled }: Props) {
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
      <Tooltip title={mineOnlyDisabled ? '管理员全量可见，无需筛选' : '显示 owner 是本人、或本人是其组长的条目'}>
        <Checkbox
          checked={!!params.mineOnly}
          disabled={mineOnlyDisabled}
          onChange={e => onChange({ mineOnly: e.target.checked })}
        >
          仅看与自己有关条目
        </Checkbox>
      </Tooltip>
      <Button icon={<ReloadOutlined />} onClick={onReset}>重置</Button>
    </Space>
  );
}
