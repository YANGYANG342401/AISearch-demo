import { Input, Space, Switch, Tag, Typography } from 'antd';
import type { OsKey } from '../types';
import { OS_KEYS } from '../types';
import { palette } from '../theme';

// ─── 原生页三端配置器：iOS / 安卓 / 鸿蒙 ─────────────────────────────
// 共用配置 + 三端开关覆盖：三端一致时只填一份；
// 某端不同→关掉"与共用一致"→表单预填共用值→只改差异字段。
// 链接与图标牵涉原生页面，三端地址可能不一样。

export interface NativePageValues {
  Link: string;
  IconUrl: string;
}

export interface NativePageState {
  /** 三端共用的原生页配置 */
  Parent: NativePageValues;
  /** 关闭"与共用一致"的端，覆盖配置（生效值 = 覆盖 ?? 共用） */
  Overrides: Partial<Record<OsKey, NativePageValues>>;
}

export const DEFAULT_NATIVE_STATE: NativePageState = {
  Parent: { Link: '', IconUrl: '' },
  Overrides: {},
};

const OS_LABEL: Record<OsKey, string> = { iOS: 'iOS', 安卓: '安卓', 鸿蒙: '鸿蒙' };

export function NativePageConfigurator({
  value, onChange, linkLabel = '原生页地址',
}: {
  value: NativePageState;
  onChange: (v: NativePageState) => void;
  linkLabel?: string;
}) {
  const patchOverride = (os: OsKey, p: Partial<NativePageValues>) => {
    const prev = value.Overrides[os] ?? { ...value.Parent };
    onChange({ ...value, Overrides: { ...value.Overrides, [os]: { ...prev, ...p } } });
  };

  const toggleOs = (os: OsKey, follow: boolean) => {
    if (follow) {
      // 重新跟随共用：丢弃该端覆盖
      const next = { ...value.Overrides };
      delete next[os];
      onChange({ ...value, Overrides: next });
    } else {
      // 开始自定义：预填共用值，用户只改差异字段
      onChange({
        ...value,
        Overrides: { ...value.Overrides, [os]: { ...value.Parent } },
      });
    }
  };

  const overridden = OS_KEYS.filter(os => value.Overrides[os]);

  return (
    <div style={{
      border: `1px solid ${palette.line}`, borderRadius: 8,
      padding: '12px 14px', background: '#FAFBFD',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Typography.Text strong style={{ fontSize: 13 }}>原生页配置（iOS / 安卓 / 鸿蒙）</Typography.Text>
        <Space size={4}>
          {OS_KEYS.map(os => (
            <Tag key={os} bordered={false} style={{ fontSize: 11 }}
              color={value.Overrides[os] ? 'blue' : undefined}>
              {OS_LABEL[os]}·{value.Overrides[os] ? '自定义' : '共用'}
            </Tag>
          ))}
        </Space>
      </div>

      {/* 共用配置 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>共用 · {linkLabel}</Typography.Text>
          <Input size="small" placeholder="三端一致的地址填这里"
            value={value.Parent.Link}
            onChange={e => onChange({ ...value, Parent: { ...value.Parent, Link: e.target.value } })} />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>共用 · 图标地址</Typography.Text>
          <Input size="small" placeholder="三端一致的图标填这里"
            value={value.Parent.IconUrl}
            onChange={e => onChange({ ...value, Parent: { ...value.Parent, IconUrl: e.target.value } })} />
        </div>
      </div>

      {/* 三端覆盖 */}
      {OS_KEYS.map(os => {
        const ov = value.Overrides[os];
        return (
          <div key={os} style={{ borderTop: `1px dashed ${palette.line}`, marginTop: 8, paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: ov ? 8 : 0 }}>
              <Typography.Text style={{ fontSize: 12.5, fontWeight: ov ? 600 : 400 }}>{OS_LABEL[os]}</Typography.Text>
              <Space size={6}>
                <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>与共用一致</Typography.Text>
                <Switch size="small" checked={!ov} onChange={v => toggleOs(os, v)} />
              </Space>
            </div>
            {ov && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Input size="small" addonBefore={linkLabel} placeholder="仅当与共用不同才改"
                  value={ov.Link} onChange={e => patchOverride(os, { Link: e.target.value })} />
                <Input size="small" addonBefore="图标" placeholder="仅当与共用不同才改"
                  value={ov.IconUrl} onChange={e => patchOverride(os, { IconUrl: e.target.value })} />
              </div>
            )}
          </div>
        );
      })}

      <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginTop: 8 }}>
        {overridden.length
          ? `${overridden.map(os => OS_LABEL[os]).join('、')} 使用自定义配置，其余端跟随共用`
          : '三端全部跟随共用配置'}
      </Typography.Text>
    </div>
  );
}
