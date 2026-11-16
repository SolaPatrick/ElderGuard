import { StyleSheet, Text, View } from 'react-native';
import {
  CAMERA_STATUS_LABEL,
  INCIDENT_STATUS_LABEL,
  type CameraStatus,
  type IncidentStatus,
} from '@elderguard/shared';
import { radius, space, useColors } from '../theme';

const TOKEN = {
  new: 'incidentNew',
  acknowledged: 'incidentAcknowledged',
  confirmed: 'incidentConfirmed',
  false_alarm: 'incidentFalseAlarm',
  resolved: 'incidentResolved',
} as const satisfies Record<IncidentStatus, string>;

const CAMERA_TOKEN = {
  online: 'cameraOnline',
  offline: 'cameraOffline',
  error: 'cameraError',
  paused: 'cameraPaused',
  connecting: 'cameraConnecting',
} as const satisfies Record<CameraStatus, string>;

export function StatusChip({ status }: { status: IncidentStatus }) {
  return <Chip token={TOKEN[status]} label={INCIDENT_STATUS_LABEL[status]} />;
}

export function CameraChip({ status }: { status: CameraStatus }) {
  return <Chip token={CAMERA_TOKEN[status]} label={CAMERA_STATUS_LABEL[status]} />;
}

type Token = (typeof TOKEN)[IncidentStatus] | (typeof CAMERA_TOKEN)[CameraStatus];

function Chip({ token: t, label }: { token: Token; label: string }) {
  const c = useColors();
  return (
    <View style={[styles.chip, { backgroundColor: c.status[`${t}Bg`], borderColor: c.status[`${t}Border`] }]}>
      <Text style={[styles.label, { color: c.status[`${t}Fg`] }]}>{label}</Text>
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
