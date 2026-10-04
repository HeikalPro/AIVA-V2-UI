import { Alert } from "@/components/ui/alert";

type Props = {
  message: string | null | undefined;
  className?: string;
};

/** Inline error banner (login, chat, forms). Renders nothing without a message. */
export function ErrorAlert({ message, className }: Props) {
  if (!message) return null;
  return (
    <Alert tone="danger" className={className}>
      {message}
    </Alert>
  );
}
