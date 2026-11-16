import { useState } from 'react';
import { classifyRequestSchema, FALSE_ALARM_REASONS, type IncidentDetail } from '@elderguard/shared';
import { Button } from '../components/Button';
import { Choice } from '../components/Choice';
import { Notice } from '../components/Notice';
import { Sheet } from '../components/Sheet';
import { errorMessage } from '../errorMessage';
import { useClassify } from '../queries';

type Kind = 'confirmed' | 'false_alarm';

/** M-16 Classify: a confirmed fall (or real emergency) or a false alarm with a reason. */
export function ClassifySheet({
  open,
  incident,
  onClose,
}: {
  open: boolean;
  incident: IncidentDetail;
  onClose: () => void;
}) {
  const classify = useClassify(incident.code);
  const [kind, setKind] = useState<Kind>('confirmed');
  const [reason, setReason] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string>();

  const close = () => {
    setKind('confirmed');
    setReason(null);
    setReasonError(undefined);
    classify.reset();
    onClose();
  };

  const submit = () => {
    const parsed = classifyRequestSchema.safeParse(
      kind === 'confirmed'
        ? { classification: 'confirmed' }
        : { classification: kind, falseAlarmReason: reason ?? '' },
    );
    if (!parsed.success) {
      setReasonError(parsed.error.issues[0]?.message);
      return;
    }
    setReasonError(undefined);
    classify.mutate(parsed.data, { onSuccess: close });
  };

  return (
    <Sheet open={open} title="Classify alert" onClose={close}>
      <Choice<Kind>
        label="What happened?"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'confirmed', label: incident.type === 'sos' ? 'Real emergency' : 'Confirmed fall' },
          { value: 'false_alarm', label: 'False alarm' },
        ]}
      />
      {kind === 'false_alarm' && (
        <Choice
          label="Reason"
          value={reason}
          onChange={setReason}
          error={reasonError}
          options={FALSE_ALARM_REASONS.map((r) => ({ value: r, label: r }))}
        />
      )}
      {classify.isError && <Notice tone="error">{errorMessage(classify.error)}</Notice>}
      <Button label="Save" onPress={submit} loading={classify.isPending} />
      <Button label="Cancel" variant="text" onPress={close} disabled={classify.isPending} />
    </Sheet>
  );
}
