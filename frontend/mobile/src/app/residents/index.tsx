import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FALL_RISK_LABEL, type FallRisk } from '@elderguard/shared';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { errorMessage } from '../../errorMessage';
import { useResidents } from '../../queries';
import { radius, space, useColors } from '../../theme';

const RISK_TOKEN = { low: 'riskLow', moderate: 'riskModerate', high: 'riskHigh' } as const satisfies Record<
  FallRisk,
  string
>;

/** M-22 Residents: read-only list with search. Adding and editing residents stays on the web. */
export default function ResidentsScreen() {
  const c = useColors();
  const query = useResidents();
  const [search, setSearch] = useState('');

  if (query.isPending)
    return (
      <Screen underHeader centered>
        <ActivityIndicator accessibilityLabel="Loading residents" color={c.sys.primary} />
      </Screen>
    );
  if (query.isError)
    return (
      <Screen underHeader>
        <Notice tone="error">{errorMessage(query.error)}</Notice>
        <Button label="Try again" variant="outlined" onPress={() => void query.refetch()} />
      </Screen>
    );

  const term = search.trim().toLowerCase();
  const shown = query.data
    .filter(
      (r) => !term || r.fullName.toLowerCase().includes(term) || r.room?.name.toLowerCase().includes(term),
    )
    .toSorted((a, b) => a.fullName.localeCompare(b.fullName));

  return (
    <Screen underHeader>
      <TextField label="Search by name or room" value={search} onChangeText={setSearch} />
      <Text style={{ color: c.sys.onSurfaceVariant }}>
        {shown.length} {shown.length === 1 ? 'resident' : 'residents'}
      </Text>
      {shown.map((r) => {
        const t = RISK_TOKEN[r.fallRisk];
        return (
          <Pressable
            key={r.id}
            onPress={() => router.push(`/residents/${r.id}`)}
            accessibilityRole="link"
            accessibilityLabel={`${r.fullName}, ${r.room?.name ?? 'no room'}, ${FALL_RISK_LABEL[r.fallRisk]}`}
            style={[styles.card, { backgroundColor: c.sys.surfaceContainerLow }]}
          >
            <View style={styles.main}>
              <Text style={[styles.name, { color: c.sys.onSurface }]}>{r.fullName}</Text>
              <Text style={{ color: c.sys.onSurfaceVariant }}>
                {[r.room?.name ?? 'No room', r.age === null ? null : `${r.age} years`]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {r.hasActiveAlert && (
                <Text style={{ color: c.sys.critical, fontWeight: '600' }}>Open alert</Text>
              )}
            </View>
            <View
              style={[
                styles.risk,
                { backgroundColor: c.status[`${t}Bg`], borderColor: c.status[`${t}Border`] },
              ]}
            >
              <Text style={{ color: c.status[`${t}Fg`], fontSize: 12, fontWeight: '600' }}>
                {FALL_RISK_LABEL[r.fallRisk]}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {shown.length === 0 && (
        <Text style={{ color: c.sys.onSurfaceVariant, textAlign: 'center', padding: space.space24 }}>
          {term ? 'No residents match your search.' : 'No residents yet.'}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.radiusMd,
    padding: space.space16,
    gap: space.space8,
  },
  main: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '600' },
  risk: {
    borderWidth: 1,
    borderRadius: radius.radiusSm,
    paddingHorizontal: space.space8,
    paddingVertical: 2,
  },
});
