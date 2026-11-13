import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, usePathname } from 'expo-router';
import {
  FALL_RISK_LABEL,
  formatElapsed,
  formatTime,
  incidentPersonName,
  incidentTitle,
  numbers,
  secondsBetween,
  type Incident,
} from '@elderguard/shared';
import { useCurrentUser } from '../auth/authContext';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { Snapshot } from '../components/Snapshot';
import { errorMessage } from '../errorMessage';
import { useAlarm } from '../hooks/useAlarm';
import { useNow } from '../hooks/useNow';
import { useAcknowledge } from '../queries';
import { size, space, useColors } from '../theme';

/**
 * M-14 Incoming fall alert: covers the app with sound and vibration until someone acknowledges
 * or closes it. Several waiting alerts share one screen ("Alert 1 of 3"), and closing hides all of
 * them on this phone; they stay in the Alerts tab, and a new alert opens the screen again.
 */
export function IncomingAlert({ incidents }: { incidents: Incident[] }) {
  const c = useColors();
  const pathname = usePathname();
  const userId = useCurrentUser().id;
  const now = useNow();
  const acknowledge = useAcknowledge();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [selected, setSelected] = useState<string | null>(null);

  const pending = useMemo(
    () =>
      incidents
        .filter((i) => i.status === 'new' && !hidden.has(i.code))
        // The sender of an SOS already knows about it.
        .filter((i) => i.sentBy?.id !== userId)
        // Do not cover the alert the user is already looking at.
        .filter((i) => pathname !== `/alerts/${i.code}`)
        .toSorted((a, b) => Date.parse(a.detectedAt) - Date.parse(b.detectedAt)),
    [incidents, hidden, pathname, userId],
  );
  const index = Math.max(
    0,
    pending.findIndex((i) => i.code === selected),
  );
  const current = pending.at(index);
  useAlarm(current !== undefined);

  if (!current) return null;

  const many = pending.length > 1;
  const hide = (codes: string[]) => {
    acknowledge.reset();
    setHidden((prev) => new Set([...prev, ...codes]));
  };
  const show = (next: number) => {
    acknowledge.reset();
    setSelected(pending.at(next)?.code ?? null);
  };
  const openDetail = () => {
    hide([current.code]);
    router.push(`/alerts/${current.code}`);
  };
  const isSos = current.type === 'sos';
  const resident = current.resident;

  return (
    <Modal visible animationType="fade" onRequestClose={() => hide(pending.map((i) => i.code))}>
      <SafeAreaView style={[styles.fill, { backgroundColor: c.sys.surface }]}>
        <View role="alertdialog" aria-label={incidentTitle(current)} style={styles.fill}>
          <View style={[styles.header, { backgroundColor: c.comp.takeoverHeader }]}>
            <View style={styles.headerText}>
              <Text role="heading" style={[styles.title, { color: c.comp.takeoverHeaderLabel }]}>
                {isSos ? `SOS · ${current.room.name}` : incidentTitle(current)}
              </Text>
              <Text style={{ color: c.comp.takeoverHeaderLabel }}>
                Alarm sounding until someone acknowledges
              </Text>
            </View>
            <Pressable
              onPress={() => hide(pending.map((i) => i.code))}
              accessibilityRole="button"
              accessibilityLabel={many ? `Close all ${pending.length} alerts` : 'Close alert'}
              style={styles.iconButton}
            >
              <MaterialIcons name="close" size={28} color={c.comp.takeoverHeaderLabel} />
            </Pressable>
          </View>

          {many && (
            <View style={[styles.pager, { borderColor: c.sys.outlineVariant }]}>
              <Pressable
                onPress={() => show(index - 1)}
                disabled={index === 0}
                accessibilityRole="button"
                accessibilityLabel="Previous alert"
                accessibilityState={{ disabled: index === 0 }}
                style={[styles.iconButton, index === 0 && styles.disabled]}
              >
                <MaterialIcons name="chevron-left" size={28} color={c.sys.onSurface} />
              </Pressable>
              <Text accessibilityLiveRegion="polite" style={[styles.pagerText, { color: c.sys.onSurface }]}>
                Alert {index + 1} of {pending.length}
              </Text>
              <Pressable
                onPress={() => show(index + 1)}
                disabled={index === pending.length - 1}
                accessibilityRole="button"
                accessibilityLabel="Next alert"
                accessibilityState={{ disabled: index === pending.length - 1 }}
                style={[styles.iconButton, index === pending.length - 1 && styles.disabled]}
              >
                <MaterialIcons name="chevron-right" size={28} color={c.sys.onSurface} />
              </Pressable>
            </View>
          )}

          <ScrollView contentContainerStyle={styles.body}>
            <Snapshot
              uri={current.snapshotUrl}
              alerting
              caption={
                current.camera ? `Camera snapshot · ${current.camera.code}` : 'No camera for this alert'
              }
            />
            <Text style={[styles.person, { color: c.sys.onSurface }]}>
              {isSos
                ? `Sent by ${incidentPersonName(current)}`
                : resident
                  ? [resident.fullName, resident.age, FALL_RISK_LABEL[resident.fallRisk]]
                      .filter((x) => x !== null)
                      .join(' · ')
                  : 'Unknown resident'}
            </Text>
            <Text style={{ color: c.sys.onSurfaceVariant, fontSize: 16 }}>
              {[current.room.name, current.room.wing].filter(Boolean).join(' · ')} ·{' '}
              {formatTime(current.detectedAt)}
            </Text>
            <View style={[styles.elapsed, { backgroundColor: c.sys.surfaceContainerLow }]}>
              <Text style={{ color: c.sys.onSurfaceVariant }}>Elapsed</Text>
              <Text style={[styles.elapsedValue, { color: c.sys.onSurface }]}>
                {formatElapsed(secondsBetween(current.detectedAt, now))}
              </Text>
            </View>
            {acknowledge.isError && <Notice tone="error">{errorMessage(acknowledge.error)}</Notice>}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={() => acknowledge.mutate(current.code, { onSuccess: openDetail })}
              disabled={acknowledge.isPending}
              accessibilityRole="button"
              accessibilityLabel="Acknowledge"
              accessibilityState={{ busy: acknowledge.isPending }}
              style={({ pressed }) => [
                styles.urgent,
                { backgroundColor: c.comp.buttonFilledContainer, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.urgentLabel, { color: c.comp.buttonFilledLabel }]}>
                {acknowledge.isPending ? 'Acknowledging…' : 'Acknowledge'}
              </Text>
            </Pressable>
            <Button label="View details" variant="outlined" onPress={openDetail} />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: numbers.layout.mobileMargin,
    paddingVertical: space.space16,
    gap: space.space8,
  },
  headerText: { flex: 1, gap: space.space4 },
  title: { fontSize: 22, fontWeight: '700' },
  iconButton: {
    minWidth: size.targetMobile,
    minHeight: size.targetMobile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.38 },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    gap: space.space8,
  },
  pagerText: { fontSize: 16, fontWeight: '600' },
  body: { padding: numbers.layout.mobileMargin, gap: space.space12 },
  person: { fontSize: 20, fontWeight: '600' },
  elapsed: { borderRadius: 12, padding: space.space16 },
  elapsedValue: { fontSize: 40 },
  actions: { padding: numbers.layout.mobileMargin, gap: space.space12 },
  urgent: {
    minHeight: size.targetUrgent,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgentLabel: { fontSize: 20, fontWeight: '700' },
});
