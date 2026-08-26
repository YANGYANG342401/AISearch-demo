import {
  App, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Popconfirm,
  Radio, Select, Space, Table, Tag, Tooltip, Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowRightOutlined, DeleteOutlined, EditOutlined, FireOutlined,
  PlusOutlined, ReloadOutlined, SearchOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import type { Identity, OrgGroup, PresetScope, PresetWord, PresetWordStatus } from '../types';
import {
  PRESET_CHANNELS, PRESET_SCOPE_TEXT, canOperate,
  effectivePresetWords, presetWordStatus,
} from '../types';
import { palette } from '../theme';

// ─── 预设搜索词配置：默认库 + 渠道覆盖 + 时间窗 + 直跳 + 实时预览 ──────
// 权限沿用内容模型：owner / 组长 / 管理员；全部动作入系统日志。

const DT = 'YYYY-MM-DD HH:mm:ss';
const SOURCE_TEXT = { manual: '手动', hot: '热词榜', missed: '未命中转化' } as const;
const STATUS_META: Record<PresetWordStatus, { text: string; color: string; bg: string }> = {
  active: { text: '生效中', color: palette.green, bg: palette.greenWash },
  pending: { text: '未开始', color: palette.brand, bg: palette.brandWash },
  expired: { text: '已过期', color: palette.inkFaint, bg: '#EEF0F4' },
};

type FormValues = {
  Word: string;
  Scope: PresetScope;
  SortValue: number;
  LinkType: 'search' | 'jump';
  LinkUrl?: string;
  range?: [Dayjs | null, Dayjs | null];
  Remark?: string;
};

export function PresetWordsPage({ identity, orgGroups }: { identity: Identity; orgGroups: OrgGroup[] }) {
  const { message: msg } = App.useApp();
  const [words, setWords] = useState<PresetWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [scope, setScope] = useState<PresetScope | 'all'>('all');
  const [status, setStatus] = useState<PresetWordStatus | 'all'>('all');
  const [modal, setModal] = useState<{ open: boolean; word: PresetWord | null }>({ open: false, word: null });
  const [saving, setSaving] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<PresetScope>('app');
  const [form] = Form.useForm<FormValues>();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setWords(await api.getPresetWords());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const k = keyword.trim();
    return words.filter(w =>
      (!k || w.Word.includes(k)) &&
      (scope === 'all' || w.Scope === scope) &&
      (status === 'all' || presetWordStatus(w) === status),
    ).sort((a, b) => (PRESET_SCOPE_TEXT[a.Scope].localeCompare(PRESET_SCOPE_TEXT[b.Scope], 'zh') || a.SortValue - b.SortValue));
  }, [words, keyword, scope, status]);

  const effective = useMemo(
    () => effectivePresetWords(words, previewChannel),
    [words, previewChannel]);

  const stats = useMemo(() => ({
    active: words.filter(w => presetWordStatus(w) === 'active').length,
    pending: words.filter(w => presetWordStatus(w) === 'pending').length,
    expired: words.filter(w => presetWordStatus(w) === 'expired').length,
  }), [words]);

  const allowed = useCallback((w: PresetWord) =>
    canOperate(w.CreatedBy ?? '', identity, orgGroups), [identity, orgGroups]);

  const openAdd = (presetScope?: PresetScope) => {
    form.resetFields();
    form.setFieldsValue({ Scope: presetScope ?? 'default', SortValue: filtered.length + 1, LinkType: 'search' });
    setModal({ open: true, word: null });
  };
  const openEdit = (w: PresetWord) => {
    form.setFieldsValue({
      Word: w.Word,
      Scope: w.Scope,
      SortValue: w.SortValue,
      LinkType: w.LinkType,
      LinkUrl: w.LinkUrl,
      range: w.StartTime ? [dayjs(w.StartTime), dayjs(w.EndTime ?? '2099-12-31 23:59:59')] : undefined,
      Remark: w.Remark,
    });
    setModal({ open: true, word: w });
  };

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const base: PresetWord = {
        ...(modal.word ?? ({} as PresetWord)),
        ID: modal.word?.ID ?? '',
        Word: v.Word.trim(),
        Scope: v.Scope,
        SortValue: v.SortValue,
        LinkType: v.LinkType,
        LinkUrl: v.LinkType === 'jump' ? (v.LinkUrl ?? '').trim() : '',
        StartTime: v.range?.[0] ? v.range[0].format(DT) : '',
        EndTime: v.range?.[1] ? v.range[1].format(DT) : '',
        Source: modal.word?.Source ?? 'manual',
        CreatedBy: modal.word?.CreatedBy ?? identity.name,
        Remark: v.Remark ?? '',
        CreateTime: modal.word?.CreateTime ?? '',
        LastUpdateTime: modal.word?.LastUpdateTime ?? '',
      };
      if (modal.word) await api.updatePresetWord(base);
      else await api.addPresetWord(base);
      msg.success(modal.word ? '已保存' : '已新增');
      setModal({ open: false, word: null });
      await refresh();
    } catch (e) {
      msg.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (id: string) => {
    try {
      await api.deletePresetWord(id);
      msg.success('已删除');
      await refresh();
    } catch (e) {
      msg.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const columns: ColumnsType<PresetWord> = [
    {
      title: '预设词', dataIndex: 'Word', width: 170,
      render: (v: string, w) => (
        <Space size={6}>
          <span style={{ fontWeight: 600 }}>{v}</span>
          {w.LinkType === 'jump' && (
            <Tooltip title={`直跳：${w.LinkUrl || '（未填链接）'}`}>
              <ArrowRightOutlined style={{ color: palette.brand, fontSize: 11 }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '投放范围', dataIndex: 'Scope', width: 130,
      render: (v: PresetScope) => v === 'default'
        ? <Tag bordered={false}>默认库 · 五端共享</Tag>
        : <Tag color="blue" bordered={false}>{PRESET_SCOPE_TEXT[v]}</Tag>,
    },
    { title: '排序', dataIndex: 'SortValue', width: 70, align: 'center',
      render: (v: number) => <span className="tabular">{v}</span> },
    {
      title: '时间窗', key: 'window', width: 210,
      render: (_, w) => w.StartTime
        ? <span className="tabular" style={{ fontSize: 11.5, color: palette.inkSoft }}>
            {w.StartTime?.slice(0, 10)} ~ {w.EndTime?.slice(0, 10) ?? '长期'}
          </span>
        : <Typography.Text type="secondary" style={{ fontSize: 12 }}>长期</Typography.Text>,
    },
    {
      title: '状态', key: 'status', width: 84, align: 'center',
      render: (_, w) => {
        const m = STATUS_META[presetWordStatus(w)];
        return <span style={{
          padding: '1px 8px', borderRadius: 4, fontSize: 12,
          backgroundColor: m.bg, color: m.color, fontWeight: 500,
        }}>{m.text}</span>;
      },
    },
    {
      title: '词源', dataIndex: 'Source', width: 100, align: 'center',
      render: (v: PresetWord['Source']) => (
        <Tag bordered={false} style={{ fontSize: 11 }}>{SOURCE_TEXT[v]}</Tag>
      ),
    },
    {
      title: '操作人', dataIndex: 'CreatedBy', width: 90,
      render: (v: string) => <span style={{ fontSize: 12.5 }}>{v || '—'}</span>,
    },
    {
      title: '操作', key: 'op', width: 90, align: 'center',
      render: (_, w) => {
        const ok = allowed(w);
        return (
          <Space size={4}>
            <Button type="text" size="small" icon={<EditOutlined />} disabled={!ok}
              onClick={() => openEdit(w)} title={ok ? '编辑' : '仅操作人/组长/管理员可修改'}
              style={{ color: ok ? palette.brand : undefined }} />
            <Popconfirm title={`删除「${w.Word}」？`} okText="删除" cancelText="取消"
              okButtonProps={{ danger: true }} onConfirm={() => doDelete(w.ID)}>
              <Button type="text" size="small" icon={<DeleteOutlined />} disabled={!ok}
                title={ok ? '删除' : '仅操作人/组长/管理员可删除'} danger />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>预设搜索词配置</Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
            搜索框引导词：默认库五端共享，各渠道可同名覆盖；支持直跳与时间窗自动上下线
          </Typography.Text>
        </div>
        <Space size={16}>
          {(['active', 'pending', 'expired'] as const).map(k => (
            <div key={k} style={{ textAlign: 'right' }}>
              <div className="tabular" style={{
                fontSize: 20, fontWeight: 700, color: STATUS_META[k].color, lineHeight: 1.1,
              }}>{stats[k]}</div>
              <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>{STATUS_META[k].text}</Typography.Text>
            </div>
          ))}
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {/* 左：管理区 */}
        <Card size="small" style={{ flex: 1, overflow: 'auto' }} styles={{ body: { padding: '0 8px 8px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 8px', flexWrap: 'wrap', gap: 8 }}>
            <Space size={8} wrap>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openAdd()}>新增预设词</Button>
              <Input
                allowClear size="small"
                prefix={<SearchOutlined style={{ color: '#8A94AD' }} />}
                placeholder="搜索预设词"
                style={{ width: 160 }}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
              />
              <Select<PresetScope | 'all'>
                size="small" style={{ width: 130 }} value={scope} onChange={setScope}
                options={[
                  { value: 'all', label: '全部范围' },
                  { value: 'default', label: '默认库' },
                  ...PRESET_CHANNELS.map(c => ({ value: c.key as PresetScope, label: c.name })),
                ]}
              />
              <Select<PresetWordStatus | 'all'>
                size="small" style={{ width: 100 }} value={status} onChange={setStatus}
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'active', label: '生效中' },
                  { value: 'pending', label: '未开始' },
                  { value: 'expired', label: '已过期' },
                ]}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {filtered.length} / {words.length}
              </Typography.Text>
            </Space>
            <Button icon={<ReloadOutlined />} onClick={() => void refresh()} title="刷新" />
          </div>
          <Table<PresetWord>
            rowKey="ID" size="small" loading={loading}
            columns={columns} dataSource={filtered}
            pagination={false}
          />
        </Card>

        {/* 右：实时预览 */}
        <Card size="small" style={{ width: 320, flexShrink: 0, overflow: 'auto' }}
          title={<span style={{ fontSize: 13 }}>实时预览</span>}
          styles={{ body: { padding: 14 } }}>
          <Select<PresetScope>
            value={previewChannel} onChange={setPreviewChannel}
            style={{ width: '100%', marginBottom: 12 }}
            options={PRESET_CHANNELS.map(c => ({ value: c.key as PresetScope, label: `预览端：${c.name}` }))}
          />
          <PhonePreview words={effective} channelName={PRESET_SCOPE_TEXT[previewChannel]} />
          <Typography.Paragraph type="secondary" style={{ fontSize: 11.5, marginTop: 12, marginBottom: 0 }}>
            生效词 = 默认库（未被覆盖）+ 本端词，共 {effective.length} 条，按排序值取前 8 展示。
            带 ↗ 的词为直跳词。
          </Typography.Paragraph>
        </Card>
      </div>

      <Modal
        open={modal.open}
        title={modal.word ? `编辑预设词 · ${modal.word.Word}` : '新增预设词'}
        okText="保存" cancelText="取消" confirmLoading={saving}
        onOk={save} onCancel={() => setModal({ open: false, word: null })}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="Word" label="预设词" rules={[
            { required: true, message: '请输入预设词' },
            { max: 20, message: '不超过 20 字' },
          ]}>
            <Input placeholder="如：双十一积分翻倍" />
          </Form.Item>
          <Form.Item name="Scope" label="投放范围"
            extra="默认库五端共享；选具体渠道则为差异覆盖（同名词在本端优先）">
            <Select options={[
              { value: 'default', label: '默认库（五端共享）' },
              ...PRESET_CHANNELS.map(c => ({ value: c.key as PresetScope, label: c.name })),
            ]} />
          </Form.Item>
          <Form.Item name="SortValue" label="排序值" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="LinkType" label="点击行为">
            <Radio.Group>
              <Radio value="search">执行搜索</Radio>
              <Radio value="jump">直跳链接</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.LinkType !== b.LinkType}>
            {({ getFieldValue }) => getFieldValue('LinkType') === 'jump' ? (
              <Form.Item name="LinkUrl" label="跳转链接" rules={[{ required: true, message: '直跳词必须填链接' }]}>
                <Input placeholder="https://… 或 App scheme" />
              </Form.Item>
            ) : null}
          </Form.Item>
          <Form.Item name="range" label="投放时间窗" extra="留空 = 长期生效；到期自动下线">
            <DatePicker.RangePicker style={{ width: '100%' }} showTime />
          </Form.Item>
          <Form.Item name="Remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ─── 手机预览：搜索框 placeholder 轮播（打字机）+ 热词标签流 ───────────

function PhonePreview({ words, channelName }: { words: PresetWord[]; channelName: string }) {
  const top = words.slice(0, 8);
  const rotation = words.slice(0, 5).map(w => w.Word);
  const [typed, setTyped] = useState('');
  const stateRef = useRef({ idx: 0, char: 0, deleting: false });

  useEffect(() => {
    if (!rotation.length) { setTyped(''); return; }
    const timer = window.setInterval(() => {
      const st = stateRef.current;
      const word = rotation[st.idx % rotation.length];
      if (!st.deleting) {
        st.char++;
        if (st.char > word.length) { st.deleting = true; st.char = word.length; }
      } else {
        st.char--;
        if (st.char <= 0) { st.deleting = false; st.idx++; st.char = 0; }
      }
      setTyped(word.slice(0, st.char));
    }, 260);
    return () => window.clearInterval(timer);
  }, [rotation.join('|')]);

  return (
    <div style={{
      border: '6px solid #1E2430', borderRadius: 26, padding: '18px 14px 16px',
      background: 'linear-gradient(180deg,#F7F9FC 0%,#EEF2F8 100%)',
      minHeight: 330, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ textAlign: 'center', fontSize: 11, color: palette.inkFaint }}>
        {channelName} · 搜索首页
      </div>
      {/* 搜索框 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#fff', borderRadius: 20, padding: '9px 14px',
        border: `1px solid ${palette.line}`, boxShadow: '0 2px 8px rgba(15,30,61,0.08)',
      }}>
        <SearchOutlined style={{ color: palette.brand }} />
        <span style={{ fontSize: 13, color: palette.inkFaint, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {typed || ' '}
          <span className="preview-cursor">|</span>
        </span>
      </div>
      {/* 热词标签流 */}
      <div>
        <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 8 }}>
          <FireOutlined style={{ color: '#E8632C', marginRight: 4 }} />猜你想搜
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {top.map((w, i) => (
            <span key={w.ID} style={{
              fontSize: 12, padding: '3px 12px', borderRadius: 14,
              background: i < 3 ? palette.brandWash : '#fff',
              color: i < 3 ? palette.brand : palette.inkSoft,
              border: `1px solid ${i < 3 ? '#C6D5F2' : palette.line}`,
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              {w.Word}
              {w.LinkType === 'jump' && <ArrowRightOutlined style={{ fontSize: 10 }} />}
            </span>
          ))}
          {!top.length && (
            <span style={{ fontSize: 12, color: palette.inkFaint }}>（当前端无生效词）</span>
          )}
        </div>
      </div>
    </div>
  );
}
