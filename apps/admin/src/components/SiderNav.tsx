import { Avatar, Menu } from 'antd';
import type { MenuProps } from 'antd';
import { SafetyCertificateOutlined, ExportOutlined } from '@ant-design/icons';

/**
 * Содержимое сайдбара админки. Один компонент для десктопного `Sider` и
 * мобильного `Drawer` — раньше эта разметка дублировалась целиком в App.tsx.
 */
export function SiderNav({
  variant,
  collapsed = false,
  selectedKey,
  menuItems,
  onSelect,
  userDisplayName,
  userMetaLine,
}: {
  variant: 'desktop' | 'mobile';
  collapsed?: boolean;
  selectedKey: string;
  menuItems: MenuProps['items'];
  onSelect: (key: string) => void;
  userDisplayName: string;
  userMetaLine: string;
}) {
  const isMobile = variant === 'mobile';
  // На десктопе в свёрнутом состоянии оставляем только иконки меню.
  const expanded = isMobile || !collapsed;
  const avatarLetter = userDisplayName.slice(0, 1).toUpperCase();

  return (
    <div className={`admin-sider-stage${isMobile ? ' admin-sider-stage--mobile' : ''}`}>
      <div className="admin-sider-brand">
        <div className="admin-sider-logo">{!isMobile && collapsed ? 'MT' : 'M'}</div>
        {expanded && (
          <div className="admin-sider-brand-text">
            <div className="admin-sider-brand-title">MyTest Control</div>
            <div className="admin-sider-brand-sub">операционная панель</div>
          </div>
        )}
      </div>

      {expanded && (
        <div className="admin-sider-summary">
          <span className="admin-sider-summary-kicker">Production workspace</span>
          <p className="admin-sider-summary-copy">
            {isMobile
              ? 'Быстрые переходы, продуктовые срезы и контент-команды в одном месте.'
              : 'Команда, контент и продуктовая аналитика в одном потоке без лишнего шума.'}
          </p>
          {!isMobile && (
            <div className="admin-sider-summary-pills">
              <span className="admin-sider-summary-pill">
                <SafetyCertificateOutlined />
                Admin
              </span>
              <a
                className="admin-sider-summary-link"
                href="https://my-test.kz"
                target="_blank"
                rel="noreferrer"
              >
                Открыть сайт
                <ExportOutlined />
              </a>
            </div>
          )}
        </div>
      )}

      <Menu
        theme="light"
        mode="inline"
        selectedKeys={[selectedKey]}
        onClick={({ key }) => onSelect(key)}
        className="admin-sider-menu"
        items={menuItems}
      />

      {expanded && (
        <div className="admin-sider-footer">
          <div className="admin-sider-user-card">
            <Avatar className="admin-sider-user-avatar">{avatarLetter}</Avatar>
            <div className="admin-sider-user-copy">
              <div className="admin-sider-user-name">{userDisplayName}</div>
              <div className="admin-sider-user-meta">{userMetaLine}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
