/**
 * Offline Indicator Component
 *
 * Shows when the app is offline and can still function as a PWA
 */

import React, { useState, useEffect } from 'react';
import { Alert } from '@mantine/core';
import { IconWifi, IconWifiOff } from '@tabler/icons-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineMessage(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Show message if already offline
    if (!navigator.onLine) {
      setShowOfflineMessage(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showOfflineMessage) {
    return null;
  }

  return (
    <Alert
      icon={<IconWifiOff size={16} />}
      color='yellow'
      variant='light'
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        maxWidth: '300px',
      }}
      withCloseButton
      onClose={() => setShowOfflineMessage(false)}
    >
      <div>
        <strong>Offline Mode</strong>
        <div style={{ fontSize: '0.875rem', marginTop: '4px' }}>
          You're offline, but the app continues to work!
        </div>
      </div>
    </Alert>
  );
};

export default OfflineIndicator;
