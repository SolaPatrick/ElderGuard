import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatTime } from '@elderguard/shared';
import { ApiError } from '../api';
import { useActiveIncidents } from '../queries';
import { space, useColors } from '../theme';

const BACK_ONLINE_MS = 3_000;

/** Why alerts can't arrive right now, or null when the last check for alerts worked. */
function problem(error: Error | null): 'offline' | 'server' | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 0) return 'offline';
  if (error.status >= 500) return 'server';
  return null;
}

/**
 * M-33: while the phone can't reach ElderGuard, say so above every screen. The app checks for
 * alerts every few seconds, so this is also when new alerts stop arriving. Those checks keep
 * going, and the banner turns into "Connected again" once one works.
 */
function Banner() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { error, isError, dataUpdatedAt } = useActiveIncidents();
  const now = isError ? problem(error) : null;
  const [backOnline, setBackOnline] = useState(false);
  // React's "adjust state when a value changes" pattern: compare with the last render's value.
  const [last, setLast] = useState(now);
  if (last !== now) {
    setLast(now);
    setBackOnline(last !== null && now === null);
  }

  useEffect(() => {
    if (!backOnline) return;
    const t = setTimeout(() => setBackOnline(false), BACK_ONLINE_MS);
    return () => clearTimeout(t);
  }, [backOnline]);

  if (!now && !backOnline) return null;

  const title = backOnline
    ? 'Connected again'
    : now === 'offline'
      ? 'No connection to ElderGuard'
      : 'ElderGuard’s server has a problem';
  const detail = backOnline
    ? 'New alerts will reach this phone again.'
    : `New alerts can’t reach this phone until this is fixed. Trying again every few seconds.${
        dataUpdatedAt ? ` Last update ${formatTime(new Date(dataUpdatedAt).toISOString())}.` : ''
      }`;
  return (
    <View
      role={backOnline ? 'status' : 'alert'}
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        {
          paddingTop: insets.top + space.space8,
          backgroundColor: backOnline ? c.sys.successContainer : c.sys.warningContainer,
        },
      ]}
    >
      <Text
        style={[styles.title, { color: backOnline ? c.sys.onSuccessContainer : c.sys.onWarningContainer }]}
      >
        {title}
      </Text>
      <Text style={{ color: backOnline ? c.sys.onSuccessContainer : c.sys.onWarningContainer }}>
        {detail}
      </Text>
    </View>
  );
}

/**
 * Puts the banner above the screens. The banner takes the status bar's space, so the screens
 * below get no top inset while it shows. The tree stays the same whether it shows or not, so
 * screens are never rebuilt.
 */
export function ConnectionArea({ watch, children }: { watch: boolean; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [bannerShown, setBannerShown] = useState(false);
  return (
    <View style={styles.fill}>
      <View onLayout={(e) => setBannerShown(e.nativeEvent.layout.height > 0)}>{watch && <Banner />}</View>
      <SafeAreaInsetsContext.Provider value={bannerShown ? { ...insets, top: 0 } : insets}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  banner: { paddingHorizontal: space.space16, paddingBottom: space.space12, gap: space.space4 },
  title: { fontSize: 16, fontWeight: '600' },
});
