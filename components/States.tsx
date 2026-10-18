export function Loading() {
  return <p className="text-sm text-muted-foreground">Carregando...</p>;
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-sm text-destructive">{message}</p>
      <button onClick={onRetry} className="rounded-xl bg-secondary px-4 py-2 text-sm font-medium">
        Tentar de novo
      </button>
    </div>
  );
}
