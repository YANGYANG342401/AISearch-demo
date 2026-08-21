import { Button, Select, Space, Typography } from 'antd';
import type { SelectProps } from 'antd';
import { ClearOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import type { Channel } from '../types';
import { FAMILY_ORDER, channelFamily } from '../types';

// ─── 渠道选择器：29 个渠道按端分组，替代原来平铺半屏的复选框墙 ────────
// 支持：组内滚动、关键字搜索、按端全选/清空、表单与筛选两用。

interface Props {
  value?: string[];
  onChange?: (ids: string[]) => void;
  channels: Channel[];
  placeholder?: string;
  style?: React.CSSProperties;
}

export function ChannelPicker({ value = [], onChange, channels, placeholder = '按渠道筛选（可多选）', style }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, Channel[]>();
    for (const ch of channels) {
      const fam = channelFamily(ch.Name);
      if (!map.has(fam)) map.set(fam, []);
      map.get(fam)!.push(ch);
    }
    const options: SelectProps['options'] = FAMILY_ORDER
      .filter(f => map.has(f))
      .map(fam => ({
        key: fam,
        label: `${fam}端`,
        options: map.get(fam)!.map(ch => ({
          value: ch.ID,
          label: ch.SubName ? `${ch.Name}（${ch.SubName}）` : ch.Name,
        })),
      }));
    return options;
  }, [channels]);

  const selected = new Set(value);

  const familyIds = (fam: string) =>
    channels.filter(c => channelFamily(c.Name) === fam).map(c => c.ID);

  const toggleFamily = (fam: string) => {
    const ids = familyIds(fam);
    const allIn = ids.every(id => selected.has(id));
    const next = allIn
      ? value.filter(id => !ids.includes(id))
      : [...new Set([...value, ...ids])];
    onChange?.(next);
  };

  const families = FAMILY_ORDER.filter(f => channels.some(c => channelFamily(c.Name) === f));

  return (
    <Select
      mode="multiple"
      value={value}
      onChange={onChange}
      options={grouped}
      placeholder={placeholder}
      style={{ minWidth: 260, ...style }}
      maxTagCount="responsive"
      allowClear
      showSearch
      optionFilterProp="label"
      popupMatchSelectWidth={false}
      listHeight={264}
      dropdownRender={menu => (
        <div>
          <div
            style={{
              display: 'flex', flexWrap: 'wrap', gap: 4,
              padding: '8px 10px', borderBottom: '1px solid #EDF0F5',
              position: 'sticky', top: 0, background: '#fff', zIndex: 1,
            }}
          >
            <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: '24px', marginRight: 2 }}>
              按端全选
            </Typography.Text>
            {families.map(fam => {
              const ids = familyIds(fam);
              const allIn = ids.every(id => selected.has(id));
              return (
                <Button
                  key={fam}
                  size="small"
                  type={allIn ? 'primary' : 'default'}
                  onClick={() => toggleFamily(fam)}
                  style={{ height: 24, fontSize: 12, padding: '0 8px' }}
                >
                  {fam}
                </Button>
              );
            })}
            {value.length > 0 && (
              <Button
                size="small" type="text" danger
                icon={<ClearOutlined />}
                onClick={() => onChange?.([])}
                style={{ height: 24, fontSize: 12, padding: '0 6px' }}
              >
                清空
              </Button>
            )}
          </div>
          {menu}
        </div>
      )}
    />
  );
}

// 表单里使用的整块版本：横排分组 + 每组可选
export function ChannelPickerFormBlock({ value = [], onChange, channels }: Props) {
  const families = FAMILY_ORDER
    .map(fam => ({ fam, list: channels.filter(c => channelFamily(c.Name) === fam) }))
    .filter(g => g.list.length);

  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      {families.map(({ fam, list }) => {
        const ids = list.map(c => c.ID);
        const allIn = ids.every(id => value.includes(id));
        return (
          <div key={fam} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Button
              size="small"
              type={allIn ? 'primary' : 'dashed'}
              onClick={() => {
                const next = allIn
                  ? value.filter(id => !ids.includes(id))
                  : [...new Set([...value, ...ids])];
                onChange?.(next);
              }}
              style={{ minWidth: 64, marginTop: 2 }}
            >
              {fam}端{allIn ? '✓' : ''}
            </Button>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 0' }}>
              {list.map(ch => {
                const checked = value.includes(ch.ID);
                return (
                  <Typography.Text
                    key={ch.ID}
                    onClick={() => {
                      onChange?.(checked ? value.filter(id => id !== ch.ID) : [...value, ch.ID]);
                    }}
                    style={{
                      cursor: 'pointer', userSelect: 'none',
                      padding: '2px 10px', fontSize: 12.5,
                      color: checked ? '#fff' : '#3D4A6B',
                      backgroundColor: checked ? '#1B3B8B' : 'transparent',
                      borderRadius: 4,
                      border: '1px solid #E3E8F0',
                      marginRight: 4, marginBottom: 4,
                    }}
                  >
                    {ch.Name}
                  </Typography.Text>
                );
              })}
            </div>
          </div>
        );
      })}
    </Space>
  );
}
