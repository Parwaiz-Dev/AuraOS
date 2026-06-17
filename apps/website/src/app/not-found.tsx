export default function NotFound() {
  return (
    <main style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Restaurant not found</h1>
      <p style={{ opacity: 0.6 }}>No restaurant is configured for this address.</p>
    </main>
  );
}
