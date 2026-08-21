import {
  Button, Col, DatePicker, Divider, Drawer, Form, Input, Modal,
  Radio, Row, Select, Space, Steps, Switch, Tabs, Typography, message,
} from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { ChannelPickerFormBlock } from './ChannelPicker';
import type {
  Channel, Department, ProductGroup, ProductManager, ProductRow,
} from '../types';
import { STATUS_TEXT } from '../types';
import { palette } from '../theme';

// ─── 两步式抽屉：① 基础信息（24 字段）→ ② 渠道配置（分渠道模板）──────
// 行为对齐原版：修改保存后进入渠道配置步骤。

const DT = 'YYYY-MM-DD HH:mm:ss';

interface OptionData {
  channels: Channel[];
  departments: Department[];
  groups: ProductGroup[];
  managers: ProductManager[];
}

interface Props {
  open: boolean;
  mode: 'add' | 'edit';
  initStep: 1 | 2;
  product: ProductRow | null;
  options: OptionData;
  onClose: () => void;
  onSave: (product: ProductRow) => Promise<void>;
}

type FormValues = {
  ProductName: string;
  Status: ProductRow['Status'];
  range: [Dayjs, Dayjs];
  Description: string;
  Keyword: string;
  MusearchShow: boolean;
  ChannelID: string[];
  OtherChannelDesc: string;
  DepartmentID: string;
  OtherDepartmentDesc: string;
  ProductGroupID: string;
  ProductManagerIds: string[];
  ProjectManager: string; UE: string; UI: string;
  BackendDeveloper: string; FrontendDeveloper: string; Tester: string;
  ExternalDependencies: boolean;
  ExternaldependencyDepartment: string; ExternaldependencyPo: string; ExternaldependencyPm: string;
  OperationManual: string;
  Remark: string;
};

const EMPTY: FormValues = {
  ProductName: '', Status: 'PutOnShelves',
  range: [dayjs('2026-01-01 00:00:00'), dayjs('2099-12-31 00:00:00')],
  Description: '', Keyword: '', MusearchShow: true,
  ChannelID: [], OtherChannelDesc: '',
  DepartmentID: '', OtherDepartmentDesc: '', ProductGroupID: '', ProductManagerIds: [],
  ProjectManager: '', UE: '', UI: '', BackendDeveloper: '', FrontendDeveloper: '', Tester: '',
  ExternalDependencies: false, ExternaldependencyDepartment: '', ExternaldependencyPo: '', ExternaldependencyPm: '',
  OperationManual: '', Remark: '',
};

function toFormValues(p: ProductRow | null, managers: ProductManager[]): FormValues {
  if (!p) return EMPTY;
  return {
    ProductName: p.ProductName,
    Status: p.Status,
    range: [dayjs(p.StartTime), dayjs(p.EndTime)],
    Description: p.Description ?? '',
    Keyword: p.Keyword ?? '',
    MusearchShow: !!p.MusearchShow,
    ChannelID: p.ChannelID ?? [],
    OtherChannelDesc: p.OtherChannelDesc ?? '',
    DepartmentID: p.DepartmentID ?? '',
    OtherDepartmentDesc: p.OtherDepartmentDesc ?? '',
    ProductGroupID: p.ProductGroupID ?? '',
    ProductManagerIds: (p.ProductManagerList ?? []).map(m => m.ID),
    ProjectManager: p.ProjectManager ?? '', UE: p.UE ?? '', UI: p.UI ?? '',
    BackendDeveloper: p.BackendDeveloper ?? '', FrontendDeveloper: p.FrontendDeveloper ?? '',
    Tester: p.Tester ?? '',
    ExternalDependencies: !!p.ExternalDependencies,
    ExternaldependencyDepartment: p.ExternaldependencyDepartment ?? '',
    ExternaldependencyPo: p.ExternaldependencyPo ?? '',
    ExternaldependencyPm: p.ExternaldependencyPm ?? '',
    OperationManual: p.OperationManual ?? '',
    Remark: p.Remark ?? '',
  };
  void managers;
}

function SectionTitle({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px' }}>
      <span style={{
        fontSize: 11, fontWeight: 700, color: palette.brand,
        backgroundColor: palette.brandWash, borderRadius: 4, padding: '1px 7px',
      }}>{n}</span>
      <Typography.Text strong style={{ fontSize: 13 }}>{children}</Typography.Text>
    </div>
  );
}

export function ProductDrawer({ open, mode, initStep, product, options, onClose, onSave }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [step, setStep] = useState<1 | 2>(initStep);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [channelConfigs, setChannelConfigs] = useState<Record<string, ChannelConfig>>({});
  const [activeChannel, setActiveChannel] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep(initStep);
      setSavedId(product?.ID ?? null);
      setChannelConfigs({});
      setActiveChannel(product?.ChannelID?.[0] ?? null);
    }
  }, [open, product, initStep]);

  const otherChannelId = options.channels.find(c => c.Name.includes('其他'))?.ID;
  const otherDeptId = options.departments.find(d => d.Name.includes('其他'))?.ID;

  const finishStep1 = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const mgrs = v.ProductManagerIds.map(id => {
        const m = options.managers.find(x => x.ID === id);
        return { ID: id, Name: m?.Name ?? id };
      });
      const next: ProductRow = {
        ...(product ?? ({} as ProductRow)),
        ID: product?.ID ?? savedId ?? '',
        ProductName: v.ProductName.trim(),
        Status: v.Status,
        StartTime: v.range[0].format(DT),
        EndTime: v.range[1].format(DT),
        Description: v.Description?.trim() ?? '',
        Keyword: v.Keyword?.trim() ?? '',
        MusearchShow: v.MusearchShow,
        ChannelID: v.ChannelID,
        OtherChannelDesc: v.OtherChannelDesc ?? '',
        DepartmentID: v.DepartmentID,
        OtherDepartmentDesc: v.OtherDepartmentDesc ?? '',
        ProductGroupID: v.ProductGroupID,
        ProductManagerList: mgrs,
        ProductManagerName: mgrs.map(m => m.Name).join(','),
        ProjectManager: v.ProjectManager, UE: v.UE, UI: v.UI,
        BackendDeveloper: v.BackendDeveloper, FrontendDeveloper: v.FrontendDeveloper,
        Tester: v.Tester,
        ExternalDependencies: v.ExternalDependencies,
        ExternaldependencyDepartment: v.ExternaldependencyDepartment ?? '',
        ExternaldependencyPo: v.ExternaldependencyPo ?? '',
        ExternaldependencyPm: v.ExternaldependencyPm ?? '',
        OperationManual: v.OperationManual, Remark: v.Remark ?? '',
        CreateTime: product?.CreateTime ?? '',
        LastUpdateTime: product?.LastUpdateTime ?? '',
        IsDeleted: false,
        InternalBusiness: product?.InternalBusiness ?? '',
        ExternalBusiness: product?.ExternalBusiness ?? '',
      };
      await onSave(next);
      setSavedId(next.ID);
      message.success(mode === 'add' ? '产品已创建，请继续配置各渠道' : '基础信息已保存');
      setStep(2);
      setActiveChannel(next.ChannelID[0] ?? null);
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const finishStep2 = () => {
    message.success('渠道配置已保存');
    onClose();
  };

  const selectedChannels = useMemo(
    () => options.channels.filter(c => {
      const ids: string[] = form.getFieldValue('ChannelID') ?? product?.ChannelID ?? [];
      return ids.includes(c.ID);
    }),
    [step, options.channels, product, form],
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={760}
      title={
        <Space size={12}>
          <span>{mode === 'add' ? '新增产品' : `修改产品 · ${product?.ProductName ?? ''}`}</span>
        </Space>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Steps
            size="small" current={step - 1} style={{ flex: 1, marginRight: 16 }}
            items={[{ title: '基础信息' }, { title: '渠道配置' }]}
          />
          <Space>
            {step === 2 && <Button onClick={() => setStep(1)}>上一步</Button>}
            {step === 1
              ? <Button type="primary" loading={saving} onClick={finishStep1}>保存并配置渠道</Button>
              : <Button type="primary" icon={<CheckOutlined />} onClick={finishStep2}>完成</Button>}
          </Space>
        </div>
      }
    >
      {step === 1 ? (
        <Form
          form={form}
          key={`${mode}-${product?.ID ?? 'new'}`}
          layout="vertical"
          initialValues={toFormValues(product, options.managers)}
          requiredMark="optional"
        >
          <SectionTitle n="01">基本信息</SectionTitle>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="ProductName" label="产品名称" rules={[
                { required: true, message: '请输入产品名称' },
                { max: 50, message: '不超过 50 字' },
              ]}>
                <Input placeholder="如：餐食预订" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="Status" label="状态" rules={[{ required: true }]}>
                <Radio.Group>
                  {Object.entries(STATUS_TEXT).map(([v, t]) => (
                    <Radio key={v} value={v}>{t}</Radio>
                  ))}
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="MusearchShow" label="对大搜展示" valuePropName="checked">
                <Switch checkedChildren="展示" unCheckedChildren="不展示" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="range" label="上线 / 下线时间" rules={[{ required: true, message: '请选择生命周期' }]}>
                <DatePicker.RangePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="Description" label="产品描述">
                <Input.TextArea rows={2} placeholder="一句话说明该产品是什么" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="Keyword" label="全渠道关联词"
                extra="用 | 分隔，总计不超过 200 字"
                rules={[{ max: 200, message: '关联词总计不可超过 200 字' }]}
              >
                <Input.TextArea
                  rows={2}
                  placeholder="餐食|订餐|飞机餐|特殊餐食"
                  showCount={{ formatter: ({ value }) => `${(value ?? '').length}/200` }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '4px 0 16px' }} />
          <SectionTitle n="02">上线渠道</SectionTitle>
          <Form.Item
            name="ChannelID" rules={[{ required: true, message: '至少选择一个渠道' }]}
            style={{ marginBottom: 8 }}
          >
            <ChannelPickerFormBlock channels={options.channels} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.ChannelID !== b.ChannelID}>
            {({ getFieldValue }) => getFieldValue('ChannelID')?.includes(otherChannelId) ? (
              <Form.Item name="OtherChannelDesc" label="其他形式说明" style={{ marginTop: 4 }}
                rules={[{ required: true, message: '勾选“其他形式”后需填写具体内容' }]}>
                <Input placeholder="多项用 | 分隔" style={{ maxWidth: 400 }} />
              </Form.Item>
            ) : null}
          </Form.Item>

          <Divider style={{ margin: '4px 0 16px' }} />
          <SectionTitle n="03">归属</SectionTitle>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="DepartmentID" label="业务归属" rules={[{ required: true, message: '请选择业务归属' }]}>
                <Select showSearch optionFilterProp="label" placeholder="部门"
                  options={options.departments.map(d => ({ value: d.ID, label: d.Name }))} />
              </Form.Item>
            </Col>
            <Form.Item noStyle shouldUpdate={(a, b) => a.DepartmentID !== b.DepartmentID}>
              {({ getFieldValue }) => getFieldValue('DepartmentID') === otherDeptId ? (
                <Col span={8}>
                  <Form.Item name="OtherDepartmentDesc" label="其他归属说明"
                    rules={[{ required: true, message: '选“其他”后需填写具体内容' }]}>
                    <Input placeholder="具体部门" />
                  </Form.Item>
                </Col>
              ) : null}
            </Form.Item>
            <Col span={8}>
              <Form.Item name="ProductGroupID" label="产品组" rules={[{ required: true, message: '请选择产品组' }]}>
                <Select placeholder="产品组"
                  options={options.groups.map(g => ({ value: g.ID, label: g.Name }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ProductManagerIds" label="产品经理（可多选）">
                <Select mode="multiple" showSearch optionFilterProp="label" placeholder="产品经理"
                  options={options.managers.map(m => ({ value: m.ID, label: m.Name }))} />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '4px 0 16px' }} />
          <SectionTitle n="04">团队</SectionTitle>
          <Row gutter={16}>
            {([['ProjectManager', '项目经理'], ['UE', 'UE'], ['UI', 'UI'],
               ['BackendDeveloper', '后端开发'], ['FrontendDeveloper', '前端开发'], ['Tester', '测试']] as const)
              .map(([name, label]) => (
                <Col span={8} key={name}>
                  <Form.Item name={name} label={label}>
                    <Input placeholder={label} />
                  </Form.Item>
                </Col>
              ))}
          </Row>

          <Divider style={{ margin: '4px 0 16px' }} />
          <SectionTitle n="05">外部依赖</SectionTitle>
          <Form.Item name="ExternalDependencies" valuePropName="checked" style={{ marginBottom: 8 }}>
            <Switch checkedChildren="有外部依赖" unCheckedChildren="无外部依赖" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.ExternalDependencies !== b.ExternalDependencies}>
            {({ getFieldValue }) => getFieldValue('ExternalDependencies') ? (
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="ExternaldependencyDepartment" label="依赖部门">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="ExternaldependencyPo" label="依赖 PO">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="ExternaldependencyPm" label="依赖 PM">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            ) : null}
          </Form.Item>

          <Divider style={{ margin: '4px 0 16px' }} />
          <SectionTitle n="06">补充</SectionTitle>
          <Form.Item name="OperationManual" label="操作手册链接">
            <Input placeholder="http://…（原系统的手册上传入口保留于此）" />
          </Form.Item>
          <Form.Item name="Remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      ) : (
        <ChannelConfigStep
          product={product}
          channels={selectedChannels}
          configs={channelConfigs}
          onConfigsChange={setChannelConfigs}
          activeKey={activeChannel}
          onActiveChange={setActiveChannel}
        />
      )}
    </Drawer>
  );
}

// ─── 渠道配置：每个已选渠道一个页签，按端类型渲染对应模板字段 ──────────
// PC端 → 页面链接/图标/关键词；移动端 → 安卓/iOS/鸿蒙矩阵；API → 接口地址。

export interface ChannelConfig {
  ChannelProductName: string;
  Link: string;
  IconUrl: string;
  Keyword: string;
  MusearchShow: boolean;
  Remark: string;
}

function ChannelConfigStep({ product, channels, configs, onConfigsChange, activeKey, onActiveChange }: {
  product: ProductRow | null;
  channels: Channel[];
  configs: Record<string, ChannelConfig>;
  onConfigsChange: (c: Record<string, ChannelConfig>) => void;
  activeKey: string | null;
  onActiveChange: (k: string) => void;
}) {
  if (!channels.length) {
    return (
      <Typography.Text type="secondary">
        该产品尚未选择渠道。回到「基础信息」步骤勾选后再配置。
      </Typography.Text>
    );
  }
  const DEFAULT_CC: ChannelConfig = {
    ChannelProductName: '', Link: '', IconUrl: '', Keyword: '',
    MusearchShow: true, Remark: '',
  };
  const patch = (id: string, p: Partial<ChannelConfig>) =>
    onConfigsChange({
      ...configs,
      [id]: { ...DEFAULT_CC, ...configs[id], ...p },
    });

  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12.5 }}>
        {product?.ProductName} · 共 {channels.length} 个渠道。PC 端配页面链接，移动端按系统分别配置，API 渠道填接口地址。
      </Typography.Paragraph>
      <Tabs
        activeKey={activeKey ?? undefined}
        onChange={onActiveChange}
        tabPosition="left"
        style={{ minHeight: 420 }}
        items={channels.map(ch => ({
          key: ch.ID,
          label: (
            <span style={{ fontSize: 12.5 }}>
              {ch.Name}
              <span style={{
                marginLeft: 6, fontSize: 10.5, padding: '0 4px', borderRadius: 3,
                backgroundColor: palette.brandWash, color: palette.brand,
              }}>{ch.TemplateName}</span>
            </span>
          ),
          children: <ChannelTemplateForm
            channel={ch}
            value={configs[ch.ID]}
            onChange={p => patch(ch.ID, p)}
          />,
        }))}
      />
    </div>
  );
}

function ChannelTemplateForm({ channel, value, onChange }: {
  channel: Channel;
  value: ChannelConfig | undefined;
  onChange: (p: Partial<ChannelConfig>) => void;
}) {
  const v: ChannelConfig = value ?? {
    ChannelProductName: '', Link: '', IconUrl: '', Keyword: '', MusearchShow: true, Remark: '',
  };
  const isApi = channel.TemplateName === 'API';
  const isMobile = channel.TemplateName === '移动端';

  return (
    <Form layout="vertical" style={{ maxWidth: 460 }}>
      <Form.Item label="渠道内产品名" extra="若无单独名称则不填写">
        <Input value={v.ChannelProductName} onChange={e => onChange({ ChannelProductName: e.target.value })} />
      </Form.Item>
      <Form.Item label={isApi ? 'API 地址' : isMobile ? '落地页地址' : 'PC 页面地址'}>
        <Input
          value={v.Link}
          onChange={e => onChange({ Link: e.target.value })}
          placeholder={isApi ? 'https://…/api/…' : 'https://…'}
        />
      </Form.Item>
      {!isApi && (
        <Form.Item label="图标地址" extra={isMobile ? '移动端按 安卓 / iOS / 鸿蒙 分别上传' : undefined}>
          <Input value={v.IconUrl} onChange={e => onChange({ IconUrl: e.target.value })} placeholder="图标 URL 或点击上传" />
        </Form.Item>
      )}
      <Form.Item label="渠道关联词" extra="留空则继承全渠道关联词">
        <Input.TextArea rows={2} value={v.Keyword} onChange={e => onChange({ Keyword: e.target.value })} />
      </Form.Item>
      <Form.Item label="对大搜展示">
        <Switch
          checked={v.MusearchShow}
          onChange={b => onChange({ MusearchShow: b })}
          checkedChildren="展示" unCheckedChildren="不展示"
        />
      </Form.Item>
      <Form.Item label="渠道备注">
        <Input.TextArea rows={2} value={v.Remark} onChange={e => onChange({ Remark: e.target.value })} />
      </Form.Item>
    </Form>
  );
}

// ─── 删除确认：对齐原版需输入操作密码的物理删除 ────────────────────────

export function DeletePasswordModal({ open, count, onConfirm, onCancel, loading }: {
  open: boolean; count: number;
  onConfirm: (pwd: string) => void; onCancel: () => void; loading: boolean;
}) {
  const [pwd, setPwd] = useState('');
  useEffect(() => { if (open) setPwd(''); }, [open]);
  return (
    <Modal
      open={open}
      title={<span style={{ color: palette.red }}>删除 {count} 个产品</span>}
      okText="确认删除" okButtonProps={{ danger: true, loading }}
      cancelText="取消"
      onOk={() => onConfirm(pwd)}
      onCancel={onCancel}
    >
      <Typography.Paragraph>
        删除后不可恢复。请输入操作密码确认（mock 密码：<Typography.Text code>admin</Typography.Text>）。
      </Typography.Paragraph>
      <Input.Password value={pwd} onChange={e => setPwd(e.target.value)} placeholder="操作密码" autoFocus />
    </Modal>
  );
}
