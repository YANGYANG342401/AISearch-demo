import { App, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { OrgGroup, ProductRow, QueryParams } from '../types';
import { palette } from '../theme';

// ─── 组织结构：产品组 + 组长 + 组员 ───────────────────────────────────
// 权限锚点：owner 不在 → 组长顶上；组长不在 → 管理员兜底。
// 移除成员 = 该成员名下产品自动无主（列表 ⚠，编辑时强制补操作员）。
// 组名/人名改动会同步产品的业务归属与操作人字段。

async function loadAllProducts(): Promise<ProductRow[]> {
  const pr = await api.searchProducts({
    productName: '', status: null, productGroupName: '', productManagerName: '',
    departmentID: '', channelIDAry: [], sortField: 'ProductName',
    sortDirection: 'Asc', pageSize: 9999, pageIndex: 0,
  } as QueryParams);
  return pr.rows;
}

export function OrgStructurePage({ isAdmin }: { isAdmin: boolean }) {
  const { message: msg } = App.useApp();
  const [groups, setGroups] = useState<OrgGroup[]>([]);
  const [usage, setUsage] = useState<Map<string, { biz: number; owned: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; group: OrgGroup | null }>({ open: false, group: null });
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{ Name: string; Leader: string; Members: string[] }>();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [gs, products] = await Promise.all([api.getOrgGroups(), loadAllProducts()]);
      setGroups(gs);
      const m = new Map<string, { biz: number; owned: number }>();
      for (const g of gs) {
        m.set(g.ID, {
          biz: products.filter(p => p.ProductGroupName === g.Name).length,
          owned: products.filter(p => p.CreatedBy === g.Leader || g.Members.includes(p.CreatedBy ?? '')).length,
        });
      }
      setUsage(m);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const openAdd = () => {
    form.resetFields();
    setModal({ open: true, group: null });
  };
  const openEdit = (g: OrgGroup) => {
    form.setFieldsValue({ Name: g.Name, Leader: g.Leader, Members: g.Members });
    setModal({ open: true, group: g });
  };

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const g = modal.group;
      await api.saveOrgGroup({
        ID: g?.ID ?? '', Name: v.Name, Leader: (v.Leader ?? '').trim(), Members: v.Members ?? [],
      }, !g);
      msg.success(g ? '已保存' : '已新增');
      setModal({ open: false, group: null });
      await refresh();
    } catch (e) {
      msg.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<OrgGroup> = [
    {
      title: '产品组', dataIndex: 'Name', width: 150,
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: '组长', dataIndex: 'Leader', width: 130,
      render: (v: string) => v
        ? <Tag color="blue" bordered={false}>{v}</Tag>
        : <Typography.Text type="secondary">空缺</Typography.Text>,
    },
    {
      title: '组员', dataIndex: 'Members',
      render: (v: string[], g) => (
        <Space size={4} wrap>
          {v.map(m => <Tag key={m} bordered={false}>{m}</Tag>)}
          {(g.Departed ?? []).map(m => (
            <Tag key={m} bordered={false} style={{ color: palette.inkFaint, background: '#F3F5F8' }}>
              ⚠ {m}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '业务归属引用', dataIndex: 'biz', width: 110, align: 'center',
      render: (_, g) => <span className="tabular" style={{ fontWeight: 600 }}>{usage.get(g.ID)?.biz ?? 0}</span>,
    },
    {
      title: '组内操作产品', dataIndex: 'owned', width: 110, align: 'center',
      render: (_, g) => <span className="tabular" style={{ fontWeight: 600 }}>{usage.get(g.ID)?.owned ?? 0}</span>,
    },
    ...(isAdmin ? [{
      title: '操作', key: 'op', width: 110, align: 'center' as const,
      render: (_: unknown, g: OrgGroup) => (
        <Space size={12}>
          <a onClick={() => openEdit(g)} style={{ fontSize: 12.5 }}>编辑</a>
          <Popconfirm
            title="确认删除该产品组？"
            description="有业务引用或成员挂靠的组会被拦截"
            okText="删除" okButtonProps={{ danger: true }} cancelText="取消"
            onConfirm={async () => {
              try {
                await api.deleteOrgGroup(g.ID);
                msg.success('已删除');
                await refresh();
              } catch (e) {
                msg.error(e instanceof Error ? e.message : '删除失败');
              }
            }}
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
        <Typography.Title level={4} style={{ margin: 0 }}>产品组管理</Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
          权限链的数据源：操作人不在岗由组长接手；成员移出进离职档案，其名下数据为无主、原组长仍可操作
        </Typography.Text>
      </div>
      <Card size="small" style={{ overflow: 'auto', flex: 1 }} styles={{ body: { padding: '0 8px 8px' } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 8px' }}>
          <Space size={8}>
            {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>新增产品组</Button>}
            {!isAdmin && (
              <Typography.Text type="secondary" style={{ fontSize: 12, alignSelf: 'center' }}>
                🔒 产品组为低频变更配置，由系统管理员统一维护，如需调整请联系管理员
              </Typography.Text>
            )}
            <Typography.Text type="secondary" style={{ fontSize: 12, alignSelf: 'center' }}>共 {groups.length} 组</Typography.Text>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={() => void refresh()} title="刷新" />
        </div>
        <Table<OrgGroup> rowKey="ID" size="small" loading={loading} columns={columns} dataSource={groups} pagination={false} />
      </Card>

      <Modal
        open={modal.open}
        title={modal.group ? `编辑 · ${modal.group.Name}` : '新增产品组'}
        okText="保存" cancelText="取消" confirmLoading={saving} onOk={save}
        onCancel={() => setModal({ open: false, group: null })}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="Name" label="产品组名称" rules={[{ required: true, message: '请填写产品组名称' }]}>
            <Input placeholder="如：机票组" />
          </Form.Item>
          <Form.Item name="Leader" label="组长（单人）" extra="owner 不在岗时由组长接手操作">
            <Input placeholder="组长姓名" />
          </Form.Item>
          <Form.Item
            name="Members" label="组员"
            extra="回车添加；移除组员会移入离职档案（⚠），其名下数据为无主、原组长仍可操作，编辑时需补充新操作员"
          >
            <Select mode="tags" placeholder="输入姓名回车添加" tokenSeparators={[',']} allowClear />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
