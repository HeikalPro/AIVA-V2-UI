import { Spinner } from "@/components/ui/spinner";

/** Calm full-viewport placeholder while the session is being restored. */
export function FullScreenLoader({ label = "Loading AIVA" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Spinner size="lg" label={label} />
    </div>
  );
}
