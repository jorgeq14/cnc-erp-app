import { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { getCurrentUser } from '../../lib/auth';
import { useNavigate } from 'react-router-dom';

export function NotificationBell() {
  const user = getCurrentUser();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(user?.id);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleNotificationClick = (notif: any) => {
    if (!notif.is_read) markAsRead(notif.id);
    if (notif.route) navigate(notif.route);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative',
          padding: '8px',
          borderRadius: '50%',
          border: 'none',
          background: 'transparent',
          color: 'var(--color-text-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s'
        }}
        className="nav-btn"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            background: 'var(--color-danger)',
            color: 'white',
            fontSize: '10px',
            fontWeight: 'bold',
            minWidth: '16px',
            height: '16px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div 
            style={{ position: 'fixed', inset: 0, zIndex: 998 }} 
            onClick={() => setOpen(false)} 
          />
          
          <div style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 10px)',
            width: '320px',
            maxHeight: '400px',
            zIndex: 999,
            overflowY: 'auto',
            borderRadius: '16px',
            border: '1px solid var(--color-border)',
            background: 'rgba(23, 23, 23, 0.9)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '0.875rem', fontWeight: '700', flex: 1 }}>Notificaciones</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <CheckCheck size={14} /> Marcar todas
                </button>
              )}
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  No tienes notificaciones
                </div>
              ) : (
                notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 16px',
                      background: !notif.is_read ? 'rgba(255,255,255,0.03)' : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--color-border)',
                      borderLeft: !notif.is_read ? '3px solid var(--color-primary)' : '3px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ 
                          margin: 0, 
                          fontSize: '0.85rem', 
                          fontWeight: !notif.is_read ? '600' : '400',
                          color: !notif.is_read ? 'var(--color-text)' : 'var(--color-text-muted)'
                        }}>
                          {notif.title}
                        </p>
                        {notif.message && (
                          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                            {notif.message}
                          </p>
                        )}
                      </div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {timeAgo(notif.created_at)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
