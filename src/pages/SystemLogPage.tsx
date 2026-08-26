import { Button, Card, Input, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { LogEntry } from '../types';
import { palette } from '../theme';

// ─── 系统日志：全局留痕，条目删除后历史仍可查 ────────────────────────
// 条目日志 = 本表按 TargetID 过滤（产品行"日志"入口）。

const ACTION_COLORS: Record<string, string> = {
  创建: 'green', 修改: 'blue', 停用: 'orange', 删除: 'red',
  转让: 'purple', 补充操作员: 'cyan', 移除成员: 'orange', 新增: 'green',
};

export function SystemLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [action, setAction] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        setLogs(await api.getLogs());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const k = keyword.trim();
    return logs.filter(l =>
      (!k || l.TargetName.includes(k) || l.Detail.includes(k) || l.User.includes(k)) &&
      (!action || l.Action === action),
    );
  }, [logs, keyword, action]);

  const columns: ColumnsType<LogEntry> = [
    {
      title: '时间', dataIndex: 'Time', width: 155,
      render: (v: string) => <span className="tabular" style={{ fontSize: 12.5, color: palette.inkSoft }}>{v}</span>,
    },
    { title: '操作人', dataIndex: 'User', width: 110 },
    {
      title: '动作', dataIndex: 'Action', width: 100, align: 'center',
      render: (v: string) => <Tag color={ACTION_COLORS[v] ?? 'default'} bordered={false}>{v}</Tag>,
    },
    {
      title: '对象', dataIndex: 'TargetName', width: 180,
      render: (_, l) => (
        <span style={{ fontSize: 12.5 }}>
          <Tag bordered={false} style={{ fontSize: 11, marginRight: 6 }}>{l.TargetType}</Tag>
          {l.TargetName}
        </span>
      ),
    },
    { title: '详情', dataIndex: 'Detail', render: (v: string) => <span style={{ fontSize: 12.5, color: palette.inkSoft }}>{v}</span> },
  ];

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>系统日志</Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
          所有操作全局留痕；条目被删除后，其历史仍在此可查
        </Typography.Text>
      </div>
      <Card size="small" style={{ overflow: 'auto', flex: 1 }} styles={{ body: { padding: '0 8px 8px' } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 8px' }}>
          <Space size={8}>
            <Input
              allowClear size="small"
              prefix={<SearchOutlined style={{ color: '#8A94AD' }} />}
              placeholder="搜索对象 / 详情 / 操作人"
              style={{ width: 220 }}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
            <Select
              allowClear size="small" placeholder="动作"
              style={{ width: 120 }}
              value={action}
              onChange={setAction}
              options={[...new Set(logs.map(l => l.Action))].map(a => ({ value: a, label: a }))}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12, alignSelf: 'center' }}>
              {keyword || action ? `${filtered.length} / ${logs.length}` : `共 ${logs.length} 条`}
            </Typography.Text>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={() => void api.getLogs().then(setLogs)} title="刷新" />
        </div>
        <Table<LogEntry>
          rowKey="ID" size="small" loading={loading}
          columns={columns} dataSource={filtered}
          pagination={{ pageSize: 20, size: 'small', showTotal: t => `共 ${t} 条` }}
        />
      </Card>
    </div>
  );
}
