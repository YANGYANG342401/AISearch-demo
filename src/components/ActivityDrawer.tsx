import {
  Button, Col, DatePicker, Divider, Drawer, Form, Input, Radio,
  Row, Select, Switch, Typography, message,
} from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { ChannelPickerFormBlock } from './ChannelPicker';
import { DEFAULT_NATIVE_STATE, NativePageConfigurator, type NativePageState } from './NativePageConfigurator';
import type { Activity, Channel, Department, Identity, OrgGroup } from '../types';
import { ACTIVITY_STATUS_TEXT, canOperate, isOrphan } from '../types';
import { palette } from '../theme';

// ─── 活动编辑抽屉：单步表单，权限原则与产品一致 ────────────────────────
// 身份带出：项目经理=本人（锁）；归属区含 owner 说明与转让入口。

const DT = 'YYYY-MM-DD HH:mm:ss';

interface Props {
  open: boolean;
  mode: 'add' | 'edit';
  activity: Activity | null;
  options: {
    channels: Channel[];
    departments: Department[];
    projectManagerNames: string[];
    orgGroups: OrgGroup[];
  };
  identity: Identity;
  onClose: () => void;
  onSave: (a: Activity) => Promise<void>;
  onTransfer?: (a: Activity) => void;
}

type FormValues = {
  Name: string;
  Status: Activity['Status'];
  MusearchShow: boolean;
  range: [Dayjs, Dayjs];
  Description: string;
  Keyword: string;
  ChannelID: string[];
  OtherChannelDesc: string;
  DepartmentID: string;
  ProjectManager: string;
  NewOperator?: string;
  LandingUrl: string;
  LandingIconUrl: string;
  NativePage: NativePageState;
  Remark: string;
};

function toValues(a: Activity | null, identity: Identity): FormValues {
  if (!a) return {
    Name: '', Status: 'Active', MusearchShow: true,
    range: [dayjs('2026-09-01 00:00:00'), dayjs('2026-10-31 23:59:59')],
    Description: '', Keyword: '', ChannelID: [], OtherChannelDesc: '',
    DepartmentID: '', ProjectManager: identity.isAdmin ? '' : identity.name,
    LandingUrl: '', LandingIconUrl: '', NativePage: DEFAULT_NATIVE_STATE,
    Remark: '',
  };
  return {
    Name: a.Name,
    Status: a.Status,
    MusearchShow: a.MusearchShow,
    range: [dayjs(a.StartTime), dayjs(a.EndTime)],
    Description: a.Description ?? '',
    Keyword: a.Keyword ?? '',
    ChannelID: a.ChannelID ?? [],
    OtherChannelDesc: a.OtherChannelDesc ?? '',
    DepartmentID: a.DepartmentID ?? '',
    ProjectManager: a.ProjectManager ?? '',
    LandingUrl: a.LandingUrl ?? '',
    LandingIconUrl: a.LandingIconUrl ?? '',
    NativePage: a.NativePage ?? DEFAULT_NATIVE_STATE,
    Remark: a.Remark ?? '',
  };
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

export function ActivityDrawer({ open, mode, activity, options, identity, onClose, onSave, onTransfer }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue(toValues(activity, identity));
    }
  }, [open, activity, identity, form]);

  const otherChannelId = options.channels.find(c => c.Name.includes('其他'))?.ID;

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const owner = v.NewOperator?.trim() || activity?.CreatedBy || identity.name;
      const next: Activity = {
        ...(activity ?? ({} as Activity)),
        ID: activity?.ID ?? '',
        Name: v.Name.trim(),
        CreatedBy: owner,
        Status: v.Status,
        MusearchShow: v.MusearchShow,
        StartTime: v.range[0].format(DT),
        EndTime: v.range[1].format(DT),
        Description: v.Description?.trim() ?? '',
        Keyword: v.Keyword?.trim() ?? '',
        ChannelID: v.ChannelID,
        OtherChannelDesc: v.OtherChannelDesc ?? '',
        DepartmentID: v.DepartmentID,
        ProjectManager: v.ProjectManager ?? '',
        LandingUrl: v.LandingUrl.trim(),
        LandingIconUrl: v.LandingIconUrl.trim(),
        NativePage: v.NativePage,
        Remark: v.Remark ?? '',
        CreateTime: activity?.CreateTime ?? '',
        LastUpdateTime: activity?.LastUpdateTime ?? '',
        IsDeleted: false,
      };
      await onSave(next);
      message.success(mode === 'add' ? '活动已创建' : '活动已保存');
      onClose();
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={640}
      title={mode === 'add' ? '新增活动' : `编辑活动 · ${activity?.Name ?? ''}`}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Button type="primary" icon={<CheckOutlined />} loading={saving} onClick={save}>
            保存
          </Button>
        </div>
      }
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        <SectionTitle n="01">基本信息</SectionTitle>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="Name" label="活动名称" rules={[
              { required: true, message: '请输入活动名称' },
              { max: 50, message: '不超过 50 字' },
            ]}>
              <Input placeholder="如：双十一积分翻倍" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="Status" label="状态" rules={[{ required: true }]}>
              <Radio.Group>
                {Object.entries(ACTIVITY_STATUS_TEXT).map(([v, t]) => (
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
            <Form.Item name="range" label="起止时间" rules={[{ required: true, message: '请选择起止时间' }]}>
              <DatePicker.RangePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="Description" label="活动描述">
              <Input.TextArea rows={2} placeholder="一句话说明活动内容" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="Keyword" label="关联词" extra="用 | 分隔，总计不超过 200 字"
              rules={[{ max: 200, message: '关联词总计不可超过 200 字' }]}>
              <Input.TextArea rows={2} placeholder="双11|积分翻倍|双十一" />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '4px 0 16px' }} />
        <SectionTitle n="02">上线渠道</SectionTitle>
        <Form.Item name="ChannelID" rules={[{ required: true, message: '至少选择一个渠道' }]}
          style={{ marginBottom: 8 }}>
          <ChannelPickerFormBlock channels={options.channels} />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(a, b) => a.ChannelID !== b.ChannelID}>
          {({ getFieldValue }) => getFieldValue('ChannelID')?.includes(otherChannelId) ? (
            <Form.Item name="OtherChannelDesc" label="其他形式说明"
              rules={[{ required: true, message: '勾选"其他形式"后需填写具体内容' }]}>
              <Input placeholder="多项用 | 分隔" style={{ maxWidth: 400 }} />
            </Form.Item>
          ) : null}
        </Form.Item>

        <Divider style={{ margin: '4px 0 16px' }} />
        <SectionTitle n="03">落地页与图标</SectionTitle>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="LandingUrl" label="通用落地页（H5）"
              extra="M站 / 小程序 / PC 使用；APP 原生页在下方配置">
              <Input placeholder="https://m.ceair.com/act/…" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="LandingIconUrl" label="通用图标">
              <Input placeholder="图标 URL" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="APP 原生页（iOS / 安卓 / 鸿蒙）"
              extra="原生页面地址与图标可能各端不同：三端一致只填共用，某端不同关掉该端'与共用一致'改差异字段">
              <Form.Item noStyle shouldUpdate={(a, b) => a.NativePage !== b.NativePage}>
                {({ getFieldValue, setFieldsValue }) => (
                  <NativePageConfigurator
                    value={getFieldValue('NativePage') ?? DEFAULT_NATIVE_STATE}
                    onChange={nv => setFieldsValue({ NativePage: nv })}
                  />
                )}
              </Form.Item>
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '4px 0 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionTitle n="04">归属</SectionTitle>
          {mode === 'edit' && activity && onTransfer
            && canOperate(activity.CreatedBy ?? '', identity, options.orgGroups)
            && !isOrphan(activity.CreatedBy ?? '', options.orgGroups) && (
            <a onClick={() => onTransfer(activity)} style={{ fontSize: 12.5 }}>转让操作权 →</a>
          )}
        </div>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: -6, marginBottom: 12 }}>
          创建人为当前条目的 owner，创建人及其所在组长可以对当前数据进行操作。
        </Typography.Paragraph>
        {mode === 'edit' && activity && isOrphan(activity.CreatedBy ?? '', options.orgGroups) && (
          <Form.Item
            name="NewOperator" label="补充操作员（必填）"
            extra="该活动当前无主（原操作人已不在组织结构中），保存前需指定新的操作员"
            rules={[{ required: true, message: '无主条目必须补充新操作员才能保存' }]}
          >
            <Select
              showSearch optionFilterProp="label" placeholder="从组织成员中选择新操作员"
              options={options.orgGroups.flatMap(g => {
                const people = [g.Leader, ...g.Members].filter(Boolean);
                return people.map(p => ({ value: p, label: `${p}（${g.Name}）` }));
              })}
            />
          </Form.Item>
        )}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="DepartmentID" label="业务归属" rules={[{ required: true, message: '请选择业务归属' }]}>
              <Select showSearch optionFilterProp="label" placeholder="部门"
                options={options.departments.map(d => ({ value: d.ID, label: d.Name }))} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="ProjectManager" label="项目经理"
              extra={identity.isAdmin ? '管理员可调整' : '由登录身份自动带出（创建人本人）'}
            >
              <Select
                showSearch allowClear placeholder="项目经理"
                disabled={!identity.isAdmin}
                options={options.projectManagerNames.map(n => ({ value: n, label: n }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '4px 0 16px' }} />
        <SectionTitle n="05">补充</SectionTitle>
        <Form.Item name="Remark" label="备注">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
