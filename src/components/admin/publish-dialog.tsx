"use client";
/** Publish now / schedule. */
import { useState } from "react";
import { Loader2, Send, CalendarClock, Mail } from "lucide-react";
import { clsx } from "clsx";
import { Dialog } from "./dialog";
import { formatDateTime, timeZoneLabel } from "./time";

type Props = {
  open: boolean;
  onClose: () => void;
  /** current state of the post */
  status: "draft" | "published" | "scheduled";
  publishedAt: string | null;
  /** ISO: when the subscriber email was sent (past) or is scheduled (future); null = never emailed. */
  newsletterSentAt: string | null;
  /** false = Brevo campaigns aren't configured on the server; undefined = unknown (new post). */
  newsletterConfigured?: boolean;
  busy: boolean;
  onPublish: (input: { publishAt?: string; notify: boolean }) => void;
};

/** yyyy-MM-ddTHH:mm in local time, for <input type="datetime-local">. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PublishDialog(props: Props) {
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={props.status === "draft" ? "Публикация" : "Дата публикации"}
      description={props.status === "draft" ? "Запись появится на сайте." : undefined}
      size="md"
    >
      {props.open ? <PublishForm {...props} /> : null}
    </Dialog>
  );
}

function PublishForm({ status, publishedAt, newsletterSentAt, newsletterConfigured, busy, onPublish, onClose }: Props) {
  // Snapshot "now" when the dialog opens (the form remounts on every open).
  const [openedAt] = useState(() => Date.now());
  const emailScheduled = !!newsletterSentAt && Date.parse(newsletterSentAt) > openedAt;
  const emailSent = !!newsletterSentAt && !emailScheduled;
  const notConfigured = newsletterConfigured === false;
  // A post that is already live (published before emails were automatic) isn't emailed unless asked explicitly.
  const [notify, setNotify] = useState(() => !notConfigured && (status !== "published" || emailScheduled));
  const [when, setWhen] = useState<"now" | "later">(status === "scheduled" ? "later" : "now");
  const [at, setAt] = useState(() => {
    if (publishedAt && status === "scheduled") return toLocalInput(new Date(publishedAt));
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    d.setHours(9, 0, 0, 0);
    return toLocalInput(d);
  });
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (when === "later") {
      const date = new Date(at);
      if (Number.isNaN(date.getTime())) {
        setError("Укажите дату и время.");
        return;
      }
      if (date.getTime() < Date.now() + 60_000) {
        setError("Это время уже прошло — выберите время в будущем или «Сейчас».");
        return;
      }
      onPublish({ publishAt: date.toISOString(), notify: notify && !notConfigured });
    } else {
      onPublish({ notify: notify && !notConfigured });
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-5"
    >
      <fieldset>
        <legend className="admin-label">Когда</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["now", "later"] as const).map((value) => (
            <label
              key={value}
              className={clsx(
                "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm transition-colors",
                when === value ? "border-accent bg-surface-hover text-fg-strong" : "border-border text-fg-muted hover:border-border-strong",
              )}
            >
              <input
                type="radio"
                name="when"
                value={value}
                checked={when === value}
                onChange={() => {
                  setWhen(value);
                  setError(null);
                }}
                className="accent-[var(--accent)]"
              />
              {value === "now" ? "Сейчас" : "Запланировать"}
            </label>
          ))}
        </div>
      </fieldset>

      {when === "later" ? (
        <div>
          <label htmlFor="publish-at" className="admin-label">
            Дата и время
          </label>
          <input
            id="publish-at"
            type="datetime-local"
            className="admin-input"
            value={at}
            onChange={(e) => {
              setAt(e.target.value);
              setError(null);
            }}
            aria-invalid={!!error}
            aria-describedby="publish-tz"
          />
          <p id="publish-tz" className="admin-hint">
            Ваш часовой пояс: {timeZoneLabel()}. Запись появится автоматически.
          </p>
        </div>
      ) : null}

      <div>
        {emailSent ? (
          <p className="admin-hint flex items-center gap-2">
            <Mail className="size-4 shrink-0" aria-hidden />
            Письмо уже отправлено {formatDateTime(newsletterSentAt!)} — повторно оно не уйдёт.
          </p>
        ) : (
          <>
            <label
              className={clsx(
                "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm transition-colors",
                notConfigured ? "cursor-not-allowed border-border text-fg-subtle" : "cursor-pointer",
                !notConfigured && (notify ? "border-accent bg-surface-hover text-fg-strong" : "border-border text-fg-muted hover:border-border-strong"),
              )}
            >
              <input
                type="checkbox"
                checked={notify && !notConfigured}
                disabled={notConfigured}
                onChange={(e) => setNotify(e.target.checked)}
                className="mt-0.5 accent-[var(--accent)]"
                aria-describedby="publish-notify-hint"
              />
              <span>Отправить письмо подписчикам</span>
            </label>
            <p id="publish-notify-hint" className="admin-hint">
              {notConfigured
                ? "Рассылка не настроена (см. /api/newsletter/check)."
                : emailScheduled
                  ? `Письмо запланировано на ${formatDateTime(newsletterSentAt!)}. При смене даты оно перенесётся; снимите галочку, чтобы отменить.`
                  : when === "later"
                    ? "Письмо уйдёт автоматически в момент публикации. Подписчики получат его один раз."
                    : "Письмо уйдёт сразу после публикации. Подписчики получат его один раз."}
            </p>
          </>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[var(--tc-red)]">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>
          Отмена
        </button>
        <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : when === "now" ? <Send className="size-4" aria-hidden /> : <CalendarClock className="size-4" aria-hidden />}
          {busy ? "Публикую…" : when === "now" ? "Опубликовать" : "Запланировать"}
        </button>
      </div>
    </form>
  );
}
