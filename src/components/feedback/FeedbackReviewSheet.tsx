import type { ReactNode } from "react";
import { MessageSquareText, ThumbsDown, ThumbsUp, UserRound } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSessionMessages } from "@/hooks/useChat";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SkeletonText } from "@/components/ui/skeleton";
import type { ChatMessage, MessageRating } from "@/types/api";

export function agentLabel(row: MessageRating): string {
  const name = [row.agent_first_name, row.agent_last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  return row.agent_email ?? `Agent #${row.agent_user_id}`;
}

/** Thumb icon + text; never colour-only. */
export function RatingLabel({ rating, className }: { rating: MessageRating["rating"]; className?: string }) {
  const up = rating === "up";
  const Icon = up ? ThumbsUp : ThumbsDown;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-ui", className)}>
      <Icon aria-hidden="true" className={cn("h-3.5 w-3.5", up ? "text-success" : "text-danger")} />
      <span className="text-foreground">{up ? "Helpful" : "Not helpful"}</span>
    </span>
  );
}

/** The agent's question: the last user message before the rated answer in the same session. */
function questionFor(messages: ChatMessage[] | undefined, messageId: number): string | null {
  if (!messages) return null;
  const index = messages.findIndex((m) => m.id === messageId);
  if (index < 0) return null;
  for (let i = index - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if ((m.sender_type ?? "").toLowerCase() === "user" && m.message_text?.trim()) return m.message_text;
  }
  return null;
}

function Block({ title, icon: Icon, children }: { title: string; icon?: typeof UserRound; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5" />}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Fact({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 break-words text-foreground", mono ? "font-mono text-xs" : "text-ui")}>{children}</dd>
    </div>
  );
}

type Props = {
  rating: MessageRating | null;
  /** The viewer may read chat history (Super Admin / chat permission); otherwise the question is not loaded. */
  canLoadQuestion: boolean;
  onClose: () => void;
};

/** Review panel for one rated answer: question (when readable), full answer, rating, comment and metadata. */
export function FeedbackReviewSheet({ rating, canLoadQuestion, onClose }: Props) {
  const history = useSessionMessages(rating && canLoadQuestion ? rating.session_id : null);
  const question = rating ? questionFor(history.data, rating.message_id) : null;
  // Hidden (no error banner) when the history can't be read or the question isn't found.
  const showQuestion = canLoadQuestion && rating != null && (history.isLoading || question != null);

  return (
    <Sheet open={rating != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent size="lg">
        {rating && (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
                Answer feedback
                <RatingLabel rating={rating.rating} className="text-sm font-normal" />
              </SheetTitle>
              <SheetDescription>
                <bdi>{agentLabel(rating)}</bdi> · <bdi>{rating.account_name ?? `Account #${rating.account_id}`}</bdi> ·{" "}
                {formatDateTime(rating.rated_at)}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-5">
              {showQuestion && (
                <Block title="Question" icon={UserRound}>
                  {history.isLoading ? (
                    <SkeletonText lines={2} />
                  ) : (
                    <p
                      dir="auto"
                      className="whitespace-pre-wrap break-words rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-foreground [unicode-bidi:plaintext]"
                    >
                      {question}
                    </p>
                  )}
                </Block>
              )}

              <Block title="AI answer">
                <div
                  dir="auto"
                  className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border px-3 py-2 text-sm leading-relaxed text-foreground [unicode-bidi:plaintext]"
                >
                  {rating.message_text}
                </div>
              </Block>

              <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <Block title="Rating">
                  <RatingLabel rating={rating.rating} />
                </Block>
                <Block title="Agent comment" icon={MessageSquareText}>
                  {rating.feedback?.trim() ? (
                    <p dir="auto" className="whitespace-pre-wrap break-words text-sm text-foreground">
                      {rating.feedback}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No comment.</p>
                  )}
                </Block>
              </div>

              <section className="space-y-2 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground">Details</h3>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <Fact label="Agent">
                    <bdi>{agentLabel(rating)}</bdi>
                    {rating.agent_email && rating.agent_email !== agentLabel(rating) && (
                      <span className="block text-xs text-muted-foreground">{rating.agent_email}</span>
                    )}
                  </Fact>
                  <Fact label="Rated">{formatDateTime(rating.rated_at)}</Fact>
                  <Fact label="Account">
                    <bdi>{rating.account_name ?? `Account #${rating.account_id}`}</bdi>
                  </Fact>
                  <Fact label="Organization">
                    <bdi>{rating.organization_name ?? `Org #${rating.organization_id}`}</bdi>
                  </Fact>
                  <Fact label="Queues in chat">
                    {rating.active_queues.length ? (
                      <span className="flex flex-wrap gap-1">
                        {rating.active_queues.map((q) => (
                          <Badge key={q} variant="neutral">
                            {q}
                          </Badge>
                        ))}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">All queues (not narrowed)</span>
                    )}
                  </Fact>
                  <Fact label="Session ID" mono>
                    #{rating.session_id}
                  </Fact>
                  <Fact label="Message ID" mono>
                    #{rating.message_id}
                  </Fact>
                </dl>
              </section>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
