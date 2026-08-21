import { Space, Tooltip, Typography } from 'antd';
import type { Channel } from '../types';
import { FAMILY_ORDER, channelFamily } from '../types';
import { palette } from '../theme';

// ─── 渠道光谱（签名元素）───────────────────────────────────────────────
// 一个产品铺在 29 个渠道上，是产品库最有特点的结构。
// 行内不再堆砌多行渠道名，而是按端分族收敛成微标：APP×2 PC×5 小程序×3
// 悬停展开该族的完整渠道名。色彩编码与渠道选择器一致。

export function ChannelSpectrum({ channelIds, channels }: {
  channelIds: string[];
  channels: Channel[];
}) {
  const byFamily = new Map<string, string[]>();
  for (const id of channelIds) {
    const ch = channels.find(c => c.ID === id);
    if (!ch) continue;
    const fam = channelFamily(ch.Name);
    if (!byFamily.has(fam)) byFamily.set(fam, []);
    byFamily.get(fam)!.push(ch.Name);
  }
  const families = FAMILY_ORDER.filter(f => byFamily.has(f));

  if (!families.length) return <Typography.Text type="secondary">—</Typography.Text>;

  return (
    <Space size={4} wrap>
      {families.map(fam => {
        const names = byFamily.get(fam)!;
        const color = palette.family[fam];
        return (
          <Tooltip
            key={fam}
            title={
              <div style={{ lineHeight: 1.9 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{fam}端 · {names.length} 个渠道</div>
                {names.map(n => <div key={n}>{n}</div>)}
              </div>
            }
          >
            <span
              style={{
                display: 'inline-flex', alignItems: 'baseline', gap: 3,
                padding: '1px 7px', borderRadius: 4,
                backgroundColor: `${color}14`,
                color, fontSize: 12, fontWeight: 500,
                cursor: 'default', whiteSpace: 'nowrap',
              }}
            >
              {fam}
              <span style={{ fontSize: 11, fontWeight: 600 }}>{names.length}</span>
            </span>
          </Tooltip>
        );
      })}
    </Space>
  );
}
