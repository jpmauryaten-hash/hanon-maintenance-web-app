import BreakdownTable from '../BreakdownTable';

const mockBreakdowns = [
  {
    id: 1,
    date: '2025-10-07',
    shift: 'A',
    line: 'Line 1',
    machine: 'CNC-101',
    problem: 'Motor failure',
    status: 'open' as const,
    totalMinutes: 120,
    attendBy: 'John Doe'
  },
  {
    id: 2,
    date: '2025-10-07',
    shift: 'B',
    line: 'Line 2',
    machine: 'LATHE-205',
    problem: 'Belt broken',
    status: 'closed' as const,
    totalMinutes: 45,
    attendBy: 'Jane Smith'
  }
];

export default function BreakdownTableExample() {
  return (
    <div className="p-6">
      <BreakdownTable 
        breakdowns={mockBreakdowns}
        canEdit={true}
        onEdit={(id) => console.log('Edit breakdown:', id)}
        onDelete={(id) => console.log('Delete breakdown:', id)}
      />
    </div>
  );
}
