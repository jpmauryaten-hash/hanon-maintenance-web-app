import BreakdownForm from '../BreakdownForm';

export default function BreakdownFormExample() {
  return (
    <div className="p-6">
      <BreakdownForm 
        onSubmit={(data) => console.log('Form submitted:', data)}
        onCancel={() => console.log('Form cancelled')}
      />
    </div>
  );
}
