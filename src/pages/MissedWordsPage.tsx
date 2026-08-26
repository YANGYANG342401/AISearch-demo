import { App, Button, Card, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { MailOutlined, ReloadOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { MissedWordCount, MissedWordWeekly } from '../types';
import { palette } from '../theme';

// ─── 未命中搜索词：周度汇总 TOP5 + 邮件提醒 ──────────────────────────
// 职责边界：只做展示与通知。词的处理是人工的事——对应产品经理
// 收到邮件后自行在产品库/活动库补配，系统不做转化、不代劳。

const DEFAULT_RECIPIENTS = ['业务部门 <business@ceair.com>', '产品部门 <product@ceair.com>'];

export function MissedWordsPage() {
  const { message: msg } = App.useApp();
  const [weeks, setWeeks] = useState<MissedWordWeekly[]>([]);
  const [current, setCurrent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [emailModal, setEmailModal] = useState(false);
  const [recipients, setRecipients] = useState<string[]>(DEFAULT_RECIPIENTS);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const ws = await api.getMissedWordWeeklies();
      setWeeks(ws);
      setCurrent(c => (ws.some(w => w.WeekStart === c) ? c : (ws[0]?.WeekStart ?? '')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const week = useMemo(() => weeks.find(w => w.WeekStart === current), [weeks, current]);
  const top5 = useMemo(() => week?.Words.slice(0, 5) ?? [], [week]);
  const maxCount = top5[0]?.Count ?? 1;
  const total = useMemo(() => week?.Words.reduce((s, x) => s + x.Count, 0) ?? 0, [week]);

  const emailSubject = week
    ? `【搜索周报】未命中搜索词 TOP5（${week.WeekStart.slice(5).replace('-', '.')} - ${week.WeekEnd.slice(5).replace('-', '.')}）`
    : '';
  const emailBody = useMemo(() => {
    if (!week || !top5.length) return '';
    const lines = top5.map((w, i) => `${i + 1}. ${w.Word}（${w.Count} 次）`).join('\n');
    return `各位好：\n\n本周（${week.WeekStart} ~ ${week.WeekEnd}）用户搜索但无结果的词 TOP5 如下：\n\n${lines}\n\n建议关注对应的内容覆盖或产品能力补齐；详细数据见搜索管理后台「未命中搜索词」。`;
  }, [week, top5]);

  const sendEmail = async () => {
    if (!week) return;
    setSending(true);
    try {
      await api.sendMissedWordEmail(week.WeekStart, recipients, emailSubject, emailBody);
      msg.success(`周报已发送至 ${recipients.length} 个收件人（系统日志可查）`);
      setEmailModal(false);
    } catch (e) {
      msg.error(e instanceof Error ? e.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  const columns: ColumnsType<MissedWordCount> = [
    { title: '排名', key: 'rank', width: 70, align: 'center',
      render: (_, r) => {
        const idx = week?.Words.findIndex(x => x.Word === r.Word) ?? -1;
        const top = idx >= 0 && idx < 5;
        return <span style={{ fontWeight: 700, color: top ? palette.brand : palette.inkFaint }}>{idx + 1}</span>;
      } },
    { title: '未命中词', dataIndex: 'Word', width: 220,
      render: (v: string, r) => {
        const idx = week?.Words.findIndex(x => x.Word === r.Word) ?? -1;
        return (
          <Space size={6}>
            <span style={{ fontSize: 13 }}>{v}</span>
            {idx >= 0 && idx < 5 && <Tag color="red" bordered={false} style={{ fontSize: 11 }}>TOP5</Tag>}
          </Space>
        );
      } },
    { title: '搜索次数', dataIndex: 'Count', width: 110, align: 'right',
      render: (v: number) => <span className="tabular" style={{ fontWeight: 600 }}>{v}</span> },
    { title: '占比', key: 'pct', width: 90, align: 'right',
      render: (_, r) => <span className="tabular" style={{ fontSize: 12, color: palette.inkFaint }}>
        {total ? ((r.Count / total) * 100).toFixed(1) : 0}%
      </span> },
  ];

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>未命中搜索词</Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
            用户搜了但没有结果的词 · 每周汇总 · 邮件提醒业务与产品部门
          </Typography.Text>
        </div>
        <Space size={8}>
          <Select
            value={current}
            onChange={setCurrent}
            style={{ width: 210 }}
            loading={loading}
            options={weeks.map(w => ({
              value: w.WeekStart,
              label: `${w.WeekStart.slice(5).replace('-', '.')} - ${w.WeekEnd.slice(5).replace('-', '.')}${w === weeks[0] ? '（本周）' : ''}`,
            }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void refresh()} title="刷新" />
        </Space>
      </div>

      {/* TOP5 汇总条 */}
      <Card size="small" styles={{ body: { padding: '14px 16px' } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            本周 TOP5{week ? `（${week.WeekStart} ~ ${week.WeekEnd}）` : ''}
          </Typography.Text>
          <Button type="primary" icon={<MailOutlined />} onClick={() => setEmailModal(true)} disabled={!top5.length}>
            发送周报邮件
          </Button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {top5.map((w, i) => (
            <div key={w.Word} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 22, textAlign: 'center', fontSize: 12, fontWeight: 700,
                color: i === 0 ? '#E8632C' : palette.brand,
              }}>{i + 1}</span>
              <span style={{ width: 130, fontSize: 13, textAlign: 'right' }}>{w.Word}</span>
              <div style={{ flex: 1, height: 18, background: '#F0F3F9', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: `${(w.Count / maxCount) * 100}%`, height: '100%',
                  background: i === 0 ? 'linear-gradient(90deg,#E8632C,#F2A25C)' : 'linear-gradient(90deg,#1B3B8B,#4C7BD9)',
                  borderRadius: 4, transition: 'width .4s',
                }} />
              </div>
              <span className="tabular" style={{ width: 60, fontSize: 13, fontWeight: 600 }}>{w.Count}</span>
            </div>
          ))}
          {!top5.length && <Typography.Text type="secondary">暂无数据</Typography.Text>}
        </div>
      </Card>

      {/* 全量明细 */}
      <Card size="small" style={{ overflow: 'auto', flex: 1 }} styles={{ body: { padding: '0 8px 8px' } }}>
        <div style={{ padding: '10px 8px' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            全部未命中词 {week?.Words.length ?? 0} 个 · 合计 {total} 次搜索 · 处理方式：邮件通知对应产品经理在产品库/活动库补配
          </Typography.Text>
        </div>
        <Table<MissedWordCount>
          rowKey="Word"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={week?.Words ?? []}
          pagination={false}
        />
      </Card>

      {/* 邮件弹窗 */}
      <Modal
        open={emailModal}
        title="发送未命中词周报"
        okText="发送" cancelText="取消"
        confirmLoading={sending}
        onOk={sendEmail}
        onCancel={() => setEmailModal(false)}
        width={600}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>收件人</Typography.Text>
            <Select
              mode="tags" style={{ width: '100%' }} value={recipients}
              onChange={setRecipients} tokenSeparators={[',', ';']}
              placeholder="输入邮箱地址回车添加"
            />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>主题（自动生成）</Typography.Text>
            <Input value={emailSubject} readOnly />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>正文（自动生成，可直接复制使用）</Typography.Text>
            <Input.TextArea rows={9} value={emailBody} readOnly style={{ fontFamily: 'inherit' }} />
          </div>
        </div>
      </Modal>

    </div>
  );
}
