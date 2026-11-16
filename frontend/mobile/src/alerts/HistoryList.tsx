import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CLASSIFICATION_LABEL,
  DATE_LABEL,
  NO_FILTERS,
  TYPE_LABEL,
  drawerCount,
  filterIncidents,
  isActiveStatus,
  pickerOptions,
  type Classification,
  type DatePreset,
  type IncidentFilters,
  type IncidentType,
} from '@elderguard/shared';
import { Button } from '../components/Button';
import { Choice } from '../components/Choice';
import { Notice } from '../components/Notice';
import { Sheet } from '../components/Sheet';
import { TextField } from '../components/TextField';
import { HISTORY_LIMIT } from '../config';
import { errorMessage } from '../errorMessage';
import { useNow } from '../hooks/useNow';
import { useIncidentHistory } from '../queries';
import { radius, size, space, useColors } from '../theme';
import { AlertCard } from './AlertCard';

/** The phone has no date picker, so it offers the presets without "Custom range". */
const DATES: DatePreset[] = ['today', '7d', '30d', 'all'];
const ANY = { value: '', label: 'Any' } as const;

const plural = (n: number) => `${n} ${n === 1 ? 'alert' : 'alerts'}`;

/**
 * M-19 Alerts history: closed alerts with search and date chips. M-20: the filter sheet. Tapping
 * an alert opens its detail (M-21, the same screen as M-15). Filters use the same rules as the
 * web's incident history (shared/src/incidentFilters.ts).
 */
export function HistoryList() {
  const c = useColors();
  const now = useNow();
  const query = useIncidentHistory();
  const [filters, setFilters] = useState<IncidentFilters>(NO_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const set = (patch: Partial<IncidentFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const closed = useMemo(() => (query.data ?? []).filter((i) => !isActiveStatus(i.status)), [query.data]);
  // The clock only matters for the date window, so a minute is precise enough.
  const minute = Math.floor(now / 60_000);
  const shown = useMemo(
    () => filterIncidents(closed, filters, new Date(minute * 60_000)),
    [closed, filters, minute],
  );
  const options = useMemo(() => pickerOptions(closed), [closed]);
  const types = useMemo(() => [...new Set(closed.map((i) => i.type))], [closed]);
  const extra = drawerCount(filters);

  if (query.isPending)
    return <ActivityIndicator accessibilityLabel="Loading history" color={c.sys.primary} />;
  if (query.isError)
    return (
      <>
        <Notice tone="error">{errorMessage(query.error)}</Notice>
        <Button label="Try again" variant="outlined" onPress={() => void query.refetch()} />
      </>
    );
  if (closed.length === 0) return <Empty text="No closed alerts yet." />;

  return (
    <>
      <TextField
        label="Search"
        helper="Resident, room or alert ID"
        value={filters.search}
        onChangeText={(search) => set({ search })}
        returnKeyType="search"
      />
      <View role="radiogroup" aria-label="Dates" style={styles.chips}>
        {DATES.map((d) => {
          const selected = filters.date === d;
          return (
            <Pressable
              key={d}
              role="radio"
              aria-checked={selected}
              aria-label={DATE_LABEL[d]}
              onPress={() => set({ date: d })}
              style={[
                styles.chip,
                { borderColor: selected ? c.sys.primary : c.sys.outline },
                selected && { backgroundColor: c.comp.navActiveIndicator },
              ]}
            >
              <Text
                style={{
                  color: selected ? c.sys.onSurface : c.sys.onSurfaceVariant,
                  fontWeight: selected ? '600' : '400',
                }}
              >
                {DATE_LABEL[d]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Button
        label={extra > 0 ? `More filters (${extra})` : 'More filters'}
        variant="outlined"
        onPress={() => setSheetOpen(true)}
      />
      <Text role="status" style={{ color: c.sys.onSurfaceVariant }}>
        {plural(shown.length)} · {DATE_LABEL[filters.date].toLowerCase()}
        {query.data.length >= HISTORY_LIMIT ? ` · searching the latest ${HISTORY_LIMIT}` : ''}
      </Text>
      {shown.length === 0 ? (
        <>
          <Empty text="No alerts match these filters." />
          <Button
            label="Clear filters"
            variant="text"
            onPress={() => setFilters({ ...NO_FILTERS, date: 'all' })}
          />
        </>
      ) : (
        shown.map((i) => <AlertCard key={i.code} incident={i} now={now} />)
      )}

      <Sheet open={sheetOpen} title="Filter alerts" onClose={() => setSheetOpen(false)}>
        <Choice<Classification | ''>
          label="Outcome"
          options={[
            ANY,
            ...(['confirmed', 'false_alarm'] as const).map((v) => ({
              value: v,
              label: CLASSIFICATION_LABEL[v],
            })),
          ]}
          value={filters.classification}
          onChange={(classification) => set({ classification })}
        />
        {types.length > 1 && (
          <Choice<IncidentType | ''>
            label="Type"
            options={[ANY, ...types.map((t) => ({ value: t, label: TYPE_LABEL[t] }))]}
            value={filters.types[0] ?? ''}
            onChange={(t) => set({ types: t ? [t] : [] })}
          />
        )}
        <Choice
          label="Room or area"
          options={[ANY, ...options.rooms.map((r) => ({ value: r.id, label: r.name }))]}
          value={filters.roomId}
          onChange={(roomId) => set({ roomId })}
        />
        {options.residents.length > 0 && (
          <Choice
            label="Resident"
            options={[ANY, ...options.residents.map((r) => ({ value: r.id, label: r.name }))]}
            value={filters.residentId}
            onChange={(residentId) => set({ residentId })}
          />
        )}
        {options.staff.length > 0 && (
          <Choice
            label="Handled by"
            options={[ANY, ...options.staff.map((s) => ({ value: s.id, label: s.name }))]}
            value={filters.handledById}
            onChange={(handledById) => set({ handledById })}
          />
        )}
        <Button label={`Show ${plural(shown.length)}`} onPress={() => setSheetOpen(false)} />
        <Button
          label="Clear these filters"
          variant="text"
          onPress={() => set({ classification: '', types: [], roomId: '', residentId: '', handledById: '' })}
          disabled={extra === 0}
        />
      </Sheet>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.space8 },
  chip: {
    minHeight: size.targetMobile,
    paddingHorizontal: space.space16,
    borderWidth: 1,
    borderRadius: radius.radiusSm,
    justifyContent: 'center',
  },
});
