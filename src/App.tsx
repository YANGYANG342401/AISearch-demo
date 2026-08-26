import { Dropdown, Layout, Menu, Space, Tag, Typography } from 'antd';
import {
  AppstoreOutlined, BookOutlined, DashboardOutlined, PartitionOutlined,
  SettingOutlined, UserOutlined, FileDoneOutlined, FileTextOutlined,
  TagOutlined, QuestionCircleOutlined,
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { api } from './api';
import type { OrgGroup } from './types';
import { ProductManagement } from './pages/ProductManagement';
import { ActivityManagement } from './pages/ActivityManagement';
import { SearchDashboardPage } from './pages/SearchDashboardPage';
import { MissedWordsPage } from './pages/MissedWordsPage';
import { PresetWordsPage } from './pages/PresetWordsPage';
import {
  ChannelConfigPage, DepartmentConfigPage, ProjectManagerConfigPage,
} from './pages/ConfigPages';
import { OrgStructurePage } from './pages/OrgPage';
import { SystemLogPage } from './pages/SystemLogPage';
import { setMockUser } from './api/mockApi';
import { IDENTITIES, type Identity } from './types';
import { USE_MOCK } from './api';
import { palette } from './theme';

const { Header, Sider, Content } = Layout;

// ─── 应用外壳：产品库 / 配置 / 系统 三组导航 + 身份切换 ────────────────

type PageKey =
  | 'search_dash' | 'preset_words' | 'missed_words'
  | 'product' | 'activity'
  | 'cfg_org' | 'cfg_dept' | 'cfg_channel' | 'cfg_pm' | 'sys_log';

export default function App() {
  const [page, setPage] = useState<PageKey>('product');
  const [identityKey, setIdentityKey] = useState<Identity['key']>('yangyang');
  const [orgGroups, setOrgGroups] = useState<OrgGroup[]>([]);
  const identity = IDENTITIES.find(i => i.key === identityKey)!;
  setMockUser(identity.isAdmin ? '系统管理员' : identity.name);

  useEffect(() => { void api.getOrgGroups().then(setOrgGroups); }, []);

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
        <Space size={14}>
          {USE_MOCK && (
            <Dropdown
              trigger={['click']}
              menu={{
                selectedKeys: [identityKey],
                onClick: e => setIdentityKey(e.key as Identity['key']),
                items: IDENTITIES.map(i => ({
                  key: i.key,
                  label: <span style={{ fontSize: 12.5 }}>{i.label}{i.key === identityKey ? ' ✓' : ''}</span>,
                })),
              }}
            >
              <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <UserOutlined style={{ color: '#C6D2EC' }} />
                <Typography.Text style={{ color: '#C6D2EC', fontSize: 12.5 }}>
                  {identity.label}
                </Typography.Text>
              </span>
            </Dropdown>
          )}
          {USE_MOCK && <Tag color="gold" style={{ marginInlineEnd: 0 }}>Mock 数据</Tag>}
        </Space>
      </Header>
      <Layout>
        <Sider width={196} theme="light" style={{ borderRight: `1px solid ${palette.line}` }}>
          <Menu
            mode="inline"
            selectedKeys={[page]}
            defaultOpenKeys={['pl', 'sd', 'cfg', 'sys']}
            onClick={e => setPage(e.key as PageKey)}
            style={{ borderInlineEnd: 'none', paddingTop: 8 }}
            items={[
              {
                key: 'sd',
                icon: <DashboardOutlined />,
                label: '搜索数据',
                children: [
                  { key: 'search_dash', icon: <DashboardOutlined />, label: '搜索数据看板' },
                  { key: 'preset_words', icon: <TagOutlined />, label: '预设搜索词配置' },
                  { key: 'missed_words', icon: <QuestionCircleOutlined />, label: '未命中搜索词' },
                ],
              },
              {
                key: 'pl',
                icon: <PartitionOutlined />,
                label: '搜索内容',
                children: [
                  { key: 'product', icon: <AppstoreOutlined />, label: '产品配置' },
                  { key: 'activity', icon: <FileDoneOutlined />, label: '活动配置' },
                ],
              },
              {
                key: 'cfg',
                icon: <SettingOutlined />,
                label: '配置管理',
                children: [
                  { key: 'cfg_org', icon: <FileDoneOutlined />, label: '产品组管理' },
                  { key: 'cfg_dept', icon: <AppstoreOutlined />, label: '业务部门管理' },
                  { key: 'cfg_channel', icon: <BookOutlined />, label: '渠道管理' },
                  { key: 'cfg_pm', icon: <FileDoneOutlined />, label: '项目经理管理' },
                ],
              },
              {
                key: 'sys',
                icon: <FileTextOutlined />,
                label: '系统',
                children: [
                  { key: 'sys_log', icon: <FileTextOutlined />, label: '系统日志' },
                ],
              },
            ]}
          />
        </Sider>
        <Content style={{ overflow: 'auto' }}>
          {page === 'product' && <ProductManagement key={identityKey} identity={identity} />}
          {page === 'activity' && <ActivityManagement key={identityKey} identity={identity} />}
          {page === 'search_dash' && <SearchDashboardPage />}
          {page === 'preset_words' && <PresetWordsPage identity={identity} orgGroups={orgGroups} />}
          {page === 'missed_words' && <MissedWordsPage />}
          {page === 'cfg_org' && <OrgStructurePage isAdmin={identity.isAdmin} />}
          {page === 'cfg_dept' && <DepartmentConfigPage isAdmin={identity.isAdmin} />}
          {page === 'cfg_channel' && <ChannelConfigPage isAdmin={identity.isAdmin} />}
          {page === 'cfg_pm' && <ProjectManagerConfigPage isAdmin={identity.isAdmin} />}
          {page === 'sys_log' && <SystemLogPage />}
        </Content>
      </Layout>
    </Layout>
  );
}
