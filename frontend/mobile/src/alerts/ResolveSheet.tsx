import { useState } from 'react';
import { OUTCOMES, resolveRequestSchema, type IncidentDetail } from '@elderguard/shared';
import { Button } from '../components/Button';
import { Choice } from '../components/Choice';
import { Notice } from '../components/Notice';
import { Sheet } from '../components/Sheet';
import { TextField } from '../components/TextField';
import { errorMessage } from '../errorMessage';
import { useResolve } from '../queries';

/** M-17 Resolve: the outcome and, optionally, what was done. */
export function ResolveSheet({
  open,
  incident,
  onClose,
}: {
  open: boolean;
  incident: IncidentDetail;
  onClose: () => void;
}) {
  const resolve = useResolve(incident.code);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [outcomeError, setOutcomeError] = useState<string>();

  const close = () => {
    setOutcome(null);
    setSummary('');
    setOutcomeError(undefined);
    resolve.reset();
    onClose();
  };

  const submit = () => {
    const parsed = resolveRequestSchema.safeParse({ outcome: outcome ?? '', responseSummary: summary });
    if (!parsed.success) {
      setOutcomeError(parsed.error.issues.find((i) => i.path[0] === 'outcome')?.message);
      return;
    }
    setOutcomeError(undefined);
    const { outcome: chosen, responseSummary } = parsed.data;
    resolve.mutate(
      { outcome: chosen, ...(responseSummary ? { responseSummary } : {}) },
      { onSuccess: close },
    );
  };

  return (
    <Sheet open={open} title="Resolve alert" onClose={close}>
      <Choice
        label="Outcome"
        value={outcome}
        onChange={setOutcome}
        error={outcomeError}
        options={OUTCOMES.map((o) => ({ value: o, label: o }))}
      />
      <TextField
        label="What was done (optional)"
        multiline
        value={summary}
        onChangeText={setSummary}
        maxLength={1000}
      />
      {resolve.isError && <Notice tone="error">{errorMessage(resolve.error)}</Notice>}
      <Button label="Resolve" onPress={submit} loading={resolve.isPending} />
      <Button label="Cancel" variant="text" onPress={close} disabled={resolve.isPending} />
    </Sheet>
  );
}
