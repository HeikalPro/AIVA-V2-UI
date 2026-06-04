type Props = {
  message: string | null | undefined;
  className?: string;
};

/** Inline error banner (login, chat, forms). */
export function ErrorAlert({ message, className = "" }: Props) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={`rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 ${className}`.trim()}
    >
      {message}
    </div>
  );
}
