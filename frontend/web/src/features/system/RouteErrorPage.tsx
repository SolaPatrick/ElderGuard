import { Button } from '@mui/material';
import { useRouteError } from 'react-router';
import { SystemMessage } from './SystemMessage';

/** SYS-03: shown instead of a blank page if a screen crashes. */
export function RouteErrorPage() {
  const error = useRouteError();
  console.error(error);
  return (
    <SystemMessage
      code="500"
      title="Something went wrong"
      body="This screen hit an unexpected error. Reload the page to try again. If it keeps happening, tell your Admin/Head."
      action={
        <Button variant="contained" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      }
    />
  );
}
