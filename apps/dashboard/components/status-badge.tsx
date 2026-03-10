export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ').toLowerCase();
  return <span className={`status ${status.toLowerCase()}`}>{label}</span>;
}
