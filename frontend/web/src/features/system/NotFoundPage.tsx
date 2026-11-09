import { SystemMessage } from './SystemMessage';

/** SYS-01 */
export function NotFoundPage() {
  return (
    <SystemMessage
      code="404"
      title="Page not found"
      body="The page or record you are looking for does not exist or was moved."
    />
  );
}
