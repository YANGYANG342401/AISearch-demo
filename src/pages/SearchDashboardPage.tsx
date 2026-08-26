import { Button, Space, Tooltip, Typography } from 'antd';
import { CompressOutlined, ExpandOutlined, ReloadOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import { palette } from '../theme';

// ─── 搜索数据看板：iframe 嵌入自包含看板（public/dashboard/index.html）──
// 支持一键全屏（Fullscreen API），全屏下看板铺满整屏。

export function SearchDashboardPage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    const handler = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFull = () => {
    if (!document.fullscreenElement) {
      void wrapRef.current?.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  };

  return (
    <div
      ref={wrapRef}
      style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        background: isFull ? '#0B1220' : palette.canvas,
      }}
    >
      {!isFull && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          padding: '16px 20px 10px',
        }}>
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>搜索数据看板</Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
              搜索词分类分布 · 热搜排行 · 飙升趋势 · 热门城市 · 自动洞察
            </Typography.Text>
          </div>
          <Space size={8}>
            <Tooltip title="重新加载看板">
              <Button icon={<ReloadOutlined />} onClick={() => {
                if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
              }} />
            </Tooltip>
            <Button type="primary" icon={<ExpandOutlined />} onClick={toggleFull}>
              全屏展示
            </Button>
          </Space>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={`${import.meta.env.BASE_URL}dashboard/index.html`}
        title="搜索数据看板"
        style={{
          flex: 1, width: '100%', border: 'none',
          borderRadius: isFull ? 0 : 10,
          margin: isFull ? 0 : '0 20px 16px',
          boxShadow: isFull ? 'none' : '0 1px 6px rgba(15,30,61,0.10)',
          background: '#0B1220',
        }}
        allowFullScreen
      />
      {isFull && (
        <Button
          type="primary" ghost icon={<CompressOutlined />}
          onClick={toggleFull}
          style={{ position: 'absolute', top: 16, right: 20, zIndex: 10 }}
        >
          退出全屏
        </Button>
      )}
    </div>
  );
}
