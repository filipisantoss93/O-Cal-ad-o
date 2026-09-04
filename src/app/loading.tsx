export default function Loading() {
  return (
    <main
      className="min-h-screen bg-canvas px-4 py-12 sm:px-6 lg:px-8"
      aria-busy="true"
      aria-label="Carregando conteúdo"
    >
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="h-4 w-28 rounded-full bg-line" />
        <div className="mt-4 h-10 max-w-xl rounded-2xl bg-line" />
        <div className="mt-3 h-5 max-w-md rounded-xl bg-line" />
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-96 rounded-3xl border border-line bg-surface"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
