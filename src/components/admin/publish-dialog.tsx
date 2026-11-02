"use client";
/** Publish now / schedule, with the "translate with DeepL" option. */
import { useState } from "react";
import { Loader2, Send, CalendarClock } from "lucide-react";
import { clsx } from "clsx";
import { Dialog } from "./dialog";
import { timeZoneLabel } from "./time";

type Props = {
  open: boolean;
  onClose: () => void;
  /** current state of the post */
  status: "draft" | "published" | "scheduled";
  publishedAt: string | null;
  busy: boolean;
  onPublish: (input: { publishAt?: string; translate: boolean }) => void;
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
      description={props.status === "draft" ? "Запись появится на сайте на трёх языках." : undefined}
      size="md"
    >
      {props.open ? <PublishForm {...props} /> : null}
    </Dialog>
  );
}

function PublishForm({ status, publishedAt, busy, onPublish, onClose }: Props) {
  const [when, setWhen] = useState<"now" | "later">(status === "scheduled" ? "later" : "now");
  const [at, setAt] = useState(() => {
    if (publishedAt && status === "scheduled") return toLocalInput(new Date(publishedAt));
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    d.setHours(9, 0, 0, 0);
    return toLocalInput(d);
  });
  const [translate, setTranslate] = useState(true);
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
      onPublish({ publishAt: date.toISOString(), translate });
    } else {
      onPublish({ translate });
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

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3.5">
        <input
          type="checkbox"
          checked={translate}
          onChange={(e) => setTranslate(e.target.checked)}
          className="mt-1 size-4 accent-[var(--accent)]"
        />
        <span>
          <span className="block text-sm font-medium text-fg">Автоматически перевести на украинский и английский (DeepL)</span>
          <span className="mt-0.5 block text-[0.8125rem] text-fg-subtle">
            Переводятся только отсутствующие и устаревшие версии. Потом их можно поправить вручную.
          </span>
        </span>
      </label>

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
          {busy ? (translate ? "Перевожу и публикую…" : "Публикую…") : when === "now" ? "Опубликовать" : "Запланировать"}
        </button>
      </div>
    </form>
  );
}
