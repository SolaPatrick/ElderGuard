import { useState } from 'react';
import { addNoteRequestSchema, type IncidentDetail } from '@elderguard/shared';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { Sheet } from '../components/Sheet';
import { TextField } from '../components/TextField';
import { errorMessage } from '../errorMessage';
import { useAddNote } from '../queries';

/** M-18 Add note. */
export function NoteSheet({
  open,
  incident,
  onClose,
}: {
  open: boolean;
  incident: IncidentDetail;
  onClose: () => void;
}) {
  const addNote = useAddNote(incident.code);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string>();

  const close = () => {
    setBody('');
    setError(undefined);
    addNote.reset();
    onClose();
  };

  const submit = () => {
    const parsed = addNoteRequestSchema.safeParse({ body });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    addNote.mutate(parsed.data, { onSuccess: close });
  };

  return (
    <Sheet open={open} title="Add note" onClose={close}>
      <TextField label="Note" multiline value={body} onChangeText={setBody} error={error} maxLength={1000} />
      {addNote.isError && <Notice tone="error">{errorMessage(addNote.error)}</Notice>}
      <Button label="Save note" onPress={submit} loading={addNote.isPending} />
      <Button label="Cancel" variant="text" onPress={close} disabled={addNote.isPending} />
    </Sheet>
  );
}
