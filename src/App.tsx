import { Layout, Menu, Space, Tag, Typography } from 'antd';
import {
  AppstoreOutlined, BookOutlined, PartitionOutlined,
  UserOutlined, FileZipOutlined,
} from '@ant-design/icons';
import { ProductManagement } from './pages/ProductManagement';
import { USE_MOCK } from './api';
import { palette } from './theme';

const { Header, Sider, Content } = Layout;

// ─── 应用外壳：产品组/产品经理已标签化并入产品数据，不再设管理模块 ────

const PRODUCT_LIBRARY_MENU = [
  { key: 'pl_dept', icon: <AppstoreOutlined />, label: '部门管理', disabled: true },
  { key: 'pl_channel', icon: <BookOutlined />, label: '渠道管理', disabled: true },
  { key: 'pl_product', icon: <AppstoreOutlined />, label: '产品管理' },
  { key: 'pl_template', icon: <FileZipOutlined />, label: '模板管理', disabled: true },
];

export default function App() {
  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{
        height: 52, lineHeight: '52px', paddingInline: 20,
        background: palette.brandDeep, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Space size={12}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: 2,
            background: 'linear-gradient(135deg,#4C7BD9,#8FB0EF)',
          }} />
          <Typography.Text strong style={{ color: '#fff', fontSize: 14.5, letterSpacing: 1 }}>
            东航电商搜索管理平台
          </Typography.Text>
          <Typography.Text style={{ color: '#93A5CF', fontSize: 12 }}>
            MU e-Commerce Search Console
          </Typography.Text>
        </Space>
        <Space size={12}>
          {USE_MOCK && <Tag color="gold" style={{ marginInlineEnd: 0 }}>Mock 数据</Tag>}
          <Typography.Text style={{ color: '#C6D2EC', fontSize: 12.5 }}>
            <UserOutlined style={{ marginRight: 6 }} />yangyang
          </Typography.Text>
        </Space>
      </Header>
      <Layout>
        <Sider width={196} theme="light" style={{ borderRight: `1px solid ${palette.line}` }}>
          <div style={{ padding: '14px 16px 6px' }}>
            <Typography.Text type="secondary" style={{ fontSize: 11, letterSpacing: 2 }}>
              产品库
            </Typography.Text>
          </div>
          <Menu
            mode="inline"
            defaultSelectedKeys={['pl_product']}
            defaultOpenKeys={['pl']}
            style={{ borderInlineEnd: 'none' }}
            items={[{
              key: 'pl',
              icon: <PartitionOutlined />,
              label: '产品库',
              children: PRODUCT_LIBRARY_MENU,
            }]}
          />
        </Sider>
        <Content style={{ overflow: 'auto' }}>
          <ProductManagement />
        </Content>
      </Layout>
    </Layout>
  );
}
