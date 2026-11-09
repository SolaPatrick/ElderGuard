import { SystemMessage } from './SystemMessage';

/** Placeholder for screens that are designed in Figma but not built yet. */
export function ComingSoonPage({ title }: { title: string }) {
  return <SystemMessage title={title} body="This screen is designed and is next on the build list." />;
}
