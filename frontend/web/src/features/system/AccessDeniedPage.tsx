import { SystemMessage } from './SystemMessage';

/** SYS-02 */
export function AccessDeniedPage() {
  return (
    <SystemMessage
      code="403"
      title="Access denied"
      body="Your account does not have permission to open this page. Ask your Admin/Head if you need access."
    />
  );
}
