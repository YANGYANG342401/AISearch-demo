import { App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { Channel, Department, ProductRow, QueryParams } from '../types';
import { palette } from '../theme';

// ─── 配置菜单：通用字典管理页（部门 / 渠道 / 项目经理）────────────────
// 后台列表规范：标准表格 + 被引用产品数列（引用=0 即失真条目，一眼可见）
// + 名称列撑满 + 工具栏搜索。删除有引用校验，防脏数据。

type FieldType = 'text' | 'number' | 'select';

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  colWidth?: number;
  align?: 'left' | 'center';
  /** 计数列：0 值弱化显示 */
  isCount?: boolean;
  /** 只读列（如时间戳），不进编辑表单，弱化显示 */
  readonly?: boolean;
  extra?: string;
}

interface DictRow {
  ID: string;
  [k: string]: unknown;
}

interface DictPageProps {
  title: string;
  description: string;
  fields: FieldDef[];
  /** 窄字典限宽：字段少的表收窄画布，避免大量留白 */
  maxWidth?: number;
  /** false = 只读模式（如仅管理员可维护的字典对普通用户只读） */
  canEdit?: boolean;
  /** 只读模式的提示文案 */
  readOnlyNote?: string;
  load: () => Promise<DictRow[]>;
  add: (values: Record<string, unknown>) => Promise<void>;
  update: (row: DictRow, values: Record<string, unknown>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function DictPage({ title, description, fields, maxWidth, canEdit = true, readOnlyNote, load, add, update, remove }: DictPageProps) {
  const { message: msg } = App.useApp();
  const [rows, setRows] = useState<DictRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [modal, setModal] = useState<{ open: boolean; row: DictRow | null }>({ open: false, row: null });
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await load());
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => { void refresh(); }, [refresh]);

  const nameKey = fields[0].key;
  const filtered = useMemo(() => {
    const k = keyword.trim();
    if (!k) return rows;
    return rows.filter(r => String(r[nameKey] ?? '').includes(k));
  }, [rows, keyword, nameKey]);

  const openAdd = () => {
    form.resetFields();
    setModal({ open: true, row: null });
  };
  const openEdit = (row: DictRow) => {
    form.setFieldsValue(row);
    setModal({ open: true, row });
  };

  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (modal.row) await update(modal.row, values);
      else await add(values);
      msg.success(modal.row ? '已保存' : '已新增');
      setModal({ open: false, row: null });
      await refresh();
    } catch (e) {
      msg.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const doRemove = async (id: string) => {
    try {
      await remove(id);
      msg.success('已删除');
      await refresh();
    } catch (e) {
      msg.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const columns: ColumnsType<DictRow> = [
    ...fields.map<ColumnsType<DictRow>[number]>(f => ({
      title: f.label,
      dataIndex: f.key,
      width: f.colWidth,
      align: f.align ?? (f.isCount ? 'center' : 'left'),
      render: (v: unknown) => {
        if (f.isCount) {
          const n = Number(v ?? 0);
          return n === 0
            ? <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>0</Typography.Text>
            : <span className="tabular" style={{ fontWeight: 600 }}>{n}</span>;
        }
        if (f.readonly) {
          return <span className="tabular" style={{ fontSize: 12, color: '#8A94AD' }}>{String(v ?? '—') || '—'}</span>;
        }
        if (f.type === 'select') {
          return <span style={{ fontSize: 12.5 }}>{String(v ?? '—')}</span>;
        }
        const s = String(v ?? '');
        return s
          ? <span style={{ fontSize: 13 }}>{s}</span>
          : <Typography.Text type="secondary">—</Typography.Text>;
      },
    })),
    ...(canEdit ? [{
      title: '操作', key: 'op', width: 110, align: 'center' as const,
      render: (_: unknown, row: DictRow) => (
        <Space size={12}>
          <a onClick={() => openEdit(row)} style={{ fontSize: 12.5 }}>编辑</a>
          <Popconfirm
            title="确认删除？"
            description="被产品引用的条目会被拦截"
            okText="删除" okButtonProps={{ danger: true }} cancelText="取消"
            onConfirm={() => doRemove(row.ID)}
          >
            <a style={{ fontSize: 12.5, color: palette.red }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>{title}</Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>{description}</Typography.Text>
      </div>
      <Card size="small" style={{ overflow: 'auto', flex: 1 }} styles={{ body: { padding: '0 8px 8px' } }}>
        <div style={maxWidth ? { maxWidth } : undefined}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 8px' }}>
          <Space size={8}>
            {canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>新增</Button>}
            {!canEdit && readOnlyNote && (
              <Typography.Text type="secondary" style={{ fontSize: 12, alignSelf: 'center' }}>
                🔒 {readOnlyNote}
              </Typography.Text>
            )}
            <Input
              allowClear
              size="small"
              prefix={<SearchOutlined style={{ color: '#8A94AD' }} />}
              placeholder={`搜索${fields[0].label}`}
              style={{ width: 180 }}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12, alignSelf: 'center' }}>
              {keyword ? `${filtered.length} / ${rows.length}` : `共 ${rows.length} 项`}
            </Typography.Text>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={() => void refresh()} title="刷新" />
        </div>
        <Table<DictRow>
          rowKey="ID"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={filtered}
          pagination={filtered.length > 20 ? { pageSize: 20, size: 'small' } : false}
        />
        </div>
      </Card>

      <Modal
        open={modal.open}
        title={modal.row ? `编辑 · ${title}` : `新增 · ${title}`}
        okText="保存" cancelText="取消"
        confirmLoading={saving}
        onOk={save}
        onCancel={() => setModal({ open: false, row: null })}
        width={460}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          {fields.filter(f => !f.isCount && !f.readonly).map(f => (
            <Form.Item
              key={f.key}
              name={f.key}
              label={f.label}
              extra={f.extra}
              rules={f.required ? [{ required: true, message: `请填写${f.label}` }] : undefined}
            >
              {f.type === 'text' ? <Input placeholder={f.placeholder} />
                : f.type === 'number' ? <InputNumber style={{ width: '100%' }} placeholder={f.placeholder} />
                : <Select allowClear placeholder={f.placeholder} options={f.options} />}
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  );
}

// ─── 用量统计：拉全量产品，按字典 key 计引用数 ────────────────────────

async function loadAllProducts(): Promise<ProductRow[]> {
  const pr = await api.searchProducts({
    productName: '', status: null, productGroupName: '', productManagerName: '',
    departmentID: '', channelIDAry: [], sortField: 'ProductName',
    sortDirection: 'Asc', pageSize: 9999, pageIndex: 0,
  } as QueryParams);
  return pr.rows;
}

// ─── 三个实例 ─────────────────────────────────────────────────────────

export function ProjectManagerConfigPage({ isAdmin }: { isAdmin: boolean }) {
  return (
    <DictPage
      title="项目经理管理"
      description="外部技术部门人员名录，产品表单「项目经理」下拉的数据源；改名会同步产品数据"
      maxWidth={880}
      canEdit={isAdmin}
      readOnlyNote="项目经理名录由系统管理员统一维护，如需调整请联系管理员"
      fields={[
        { key: 'Name', label: '项目经理姓名', type: 'text', required: true, placeholder: '如：钱大', colWidth: 220 },
        { key: '_usage', label: '被引用产品', type: 'number', isCount: true, colWidth: 110 },
        { key: '_usageAct', label: '被引用活动', type: 'number', isCount: true, colWidth: 110 },
        { key: 'LastUpdateTime', label: '最后修改', type: 'text', readonly: true, colWidth: 150 },
      ]}
      load={async () => {
        const [pms, products, activities] = await Promise.all([
          api.getProjectManagers(), loadAllProducts(), api.getActivities(),
        ]);
        return (pms as unknown as DictRow[]).map(m => ({
          ...m,
          _usage: products.filter(p => p.ProjectManager === m.Name).length,
          _usageAct: activities.filter(a => a.ProjectManager === m.Name).length,
        }));
      }}
      add={v => api.addProjectManager(String(v.Name))}
      update={(row, v) => api.updateProjectManager(row.ID, String(v.Name))}
      remove={id => api.deleteProjectManager(id)}
    />
  );
}

export function DepartmentConfigPage({ isAdmin }: { isAdmin: boolean }) {
  return (
    <DictPage
      title="业务部门管理"
      description="产品「业务归属」下拉的数据源；被引用数为 0 的部门即失真条目，可考虑清理"
      maxWidth={880}
      canEdit={isAdmin}
      readOnlyNote="部门为低频变更配置，由系统管理员统一维护"
      fields={[
        { key: 'Name', label: '部门名称', type: 'text', required: true, placeholder: '如：直销业务部', colWidth: 220 },
        { key: '_usage', label: '被引用产品', type: 'number', isCount: true, colWidth: 110 },
        { key: '_usageAct', label: '被引用活动', type: 'number', isCount: true, colWidth: 110 },
        { key: 'LastUpdateTime', label: '最后修改', type: 'text', readonly: true, colWidth: 150 },
      ]}
      load={async () => {
        const [deps, products, activities] = await Promise.all([
          api.getDepartments(), loadAllProducts(), api.getActivities(),
        ]);
        return (deps as unknown as DictRow[]).map(d => ({
          ...d,
          _usage: products.filter(p => p.DepartmentID === d.ID).length,
          _usageAct: activities.filter(a => a.DepartmentID === d.ID).length,
        }));
      }}
      add={v => api.addDepartment(v as unknown as Department)}
      update={(row, v) => api.updateDepartment({ ...(v as unknown as Department), ID: row.ID })}
      remove={id => api.deleteDepartment(id)}
    />
  );
}

export function ChannelConfigPage({ isAdmin }: { isAdmin: boolean }) {
  return (
    <DictPage
      title="渠道管理"
      description="产品上线渠道与模板类型的绑定；被产品引用的渠道不可删除"
      canEdit={isAdmin}
      readOnlyNote="渠道与模板绑定由系统管理员统一维护"
      fields={[
        { key: 'Name', label: '渠道名称', type: 'text', required: true, placeholder: '如：APP-中文', colWidth: 190 },
        { key: 'SubName', label: '操作系统', type: 'text', placeholder: '如：安卓|苹果|鸿蒙', colWidth: 170 },
        { key: 'TemplateName', label: '模板类型', type: 'select', required: true, colWidth: 100, align: 'center',
          options: ['PC端', '移动端', 'API', '其它'].map(v => ({ value: v, label: v })) },
        { key: 'SortValue', label: '排序值', type: 'number', colWidth: 80, align: 'center' },
        { key: '_usage', label: '被引用产品', type: 'number', isCount: true, colWidth: 100 },
        { key: '_usageAct', label: '被引用活动', type: 'number', isCount: true, colWidth: 100 },
        { key: 'LastUpdateTime', label: '最后修改', type: 'text', readonly: true, colWidth: 140 },
      ]}
      load={async () => {
        const [chs, products, activities] = await Promise.all([
          api.getChannels(), loadAllProducts(), api.getActivities(),
        ]);
        return (chs as unknown as DictRow[]).map(c => ({
          ...c,
          _usage: products.filter(p => p.ChannelID.includes(c.ID)).length,
          _usageAct: activities.filter(a => a.ChannelID.includes(c.ID)).length,
        }));
      }}
      add={v => api.addChannel(v as unknown as Channel)}
      update={(row, v) => api.updateChannel({ ...(v as unknown as Channel), ID: row.ID })}
      remove={id => api.deleteChannel(id)}
    />
  );
}

