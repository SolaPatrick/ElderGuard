import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertCard } from '../../alerts/AlertCard';
import { HistoryList } from '../../alerts/HistoryList';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { errorMessage } from '../../errorMessage';
import { useNow } from '../../hooks/useNow';
import { useAcknowledge, useActiveIncidents } from '../../queries';
import { radius, size, space, useColors } from '../../theme';

type Segment = 'active' | 'history';

/** M-13 Alerts: Active (oldest first, with elapsed timers) and History (M-19, closed alerts). */
export default function AlertsScreen() {
  const c = useColors();
  const [segment, setSegment] = useState<Segment>('active');
  return (
    <Screen underHeader>
      <View role="tablist" style={[styles.segments, { borderColor: c.sys.outline }]}>
        {(['active', 'history'] as const).map((s) => {
          const selected = s === segment;
          return (
            <Pressable
              key={s}
              role="tab"
              aria-selected={selected}
              onPress={() => setSegment(s)}
              style={[styles.segment, selected && { backgroundColor: c.comp.navActiveIndicator }]}
            >
              <Text style={{ color: c.sys.onSurface, fontWeight: selected ? '600' : '400' }}>
                {s === 'active' ? 'Active' : 'History'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {segment === 'active' ? <ActiveList /> : <HistoryList />}
    </Screen>
  );
}

function ActiveList() {
  const c = useColors();
  const now = useNow();
  const query = useActiveIncidents();
  const acknowledge = useAcknowledge();
  if (query.isPending) return <ActivityIndicator accessibilityLabel="Loading alerts" color={c.sys.primary} />;
  if (query.isError)
    return (
      <>
        <Notice tone="error">{errorMessage(query.error)}</Notice>
        <Button label="Try again" variant="outlined" onPress={() => void query.refetch()} />
      </>
    );
  const list = query.data.toSorted((a, b) => Date.parse(a.detectedAt) - Date.parse(b.detectedAt));
  if (list.length === 0) return <Empty text="No active alerts. New alerts show here and sound an alarm." />;
  return (
    <>
      {acknowledge.isError && <Notice tone="error">{errorMessage(acknowledge.error)}</Notice>}
      {list.map((i) => (
        <AlertCard
          key={i.code}
          incident={i}
          now={now}
          onAcknowledge={() => acknowledge.mutate(i.code)}
          acknowledging={acknowledge.isPending && acknowledge.variables === i.code}
        />
      ))}
    </>
  );
}

function Empty({ text }: { text: string }) {
  const c = useColors();
  return (
    <Text style={{ color: c.sys.onSurfaceVariant, textAlign: 'center', padding: space.space24 }}>{text}</Text>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.radiusFull, overflow: 'hidden' },
  segment: { flex: 1, minHeight: size.targetMobile, alignItems: 'center', justifyContent: 'center' },
});
