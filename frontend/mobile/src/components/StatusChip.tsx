import { StyleSheet, Text, View } from 'react-native';
import { INCIDENT_STATUS_LABEL, type IncidentStatus } from '@elderguard/shared';
import { radius, space, useColors } from '../theme';

const TOKEN = {
  new: 'incidentNew',
  acknowledged: 'incidentAcknowledged',
  confirmed: 'incidentConfirmed',
  false_alarm: 'incidentFalseAlarm',
  resolved: 'incidentResolved',
} as const satisfies Record<IncidentStatus, string>;

export function StatusChip({ status }: { status: IncidentStatus }) {
  const c = useColors();
  const t = TOKEN[status];
  return (
    <View style={[styles.chip, { backgroundColor: c.status[`${t}Bg`], borderColor: c.status[`${t}Border`] }]}>
      <Text style={[styles.label, { color: c.status[`${t}Fg`] }]}>{INCIDENT_STATUS_LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.radiusSm,
    paddingHorizontal: space.space8,
    paddingVertical: 2,
  },
  label: { fontSize: 12, fontWeight: '600' },
});
