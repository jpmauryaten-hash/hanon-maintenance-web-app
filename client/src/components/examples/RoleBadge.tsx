import RoleBadge from '../RoleBadge';

export default function RoleBadgeExample() {
  return (
    <div className="p-6 flex gap-4">
      <RoleBadge role="admin" />
      <RoleBadge role="supervisor" />
      <RoleBadge role="engineer" />
      <RoleBadge role="viewer" />
    </div>
  );
}
