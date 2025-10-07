import BreakdownStatusBadge from '../BreakdownStatusBadge';

export default function BreakdownStatusBadgeExample() {
  return (
    <div className="p-6 flex gap-4">
      <BreakdownStatusBadge status="open" />
      <BreakdownStatusBadge status="closed" />
      <BreakdownStatusBadge status="pending" />
    </div>
  );
}
