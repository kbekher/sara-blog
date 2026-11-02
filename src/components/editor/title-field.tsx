"use client";
/**
 * Auto-growing serif title / italic subtitle fields. Enter moves on (title → subtitle → body);
 * newlines are never inserted (pasted line breaks become spaces).
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  onBlur?: () => void;
  variant: "title" | "excerpt";
  lang: string;
  placeholder: string;
  label: string;
  maxLength?: number;
};

export const TitleField = forwardRef<HTMLTextAreaElement, Props>(function TitleField(
  { value, onChange, onEnter, onBlur, variant, lang, placeholder, label, maxLength },
  forwarded,
) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(forwarded, () => ref.current as HTMLTextAreaElement);

  // Fallback auto-grow for browsers without `field-sizing: content`.
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el || CSS.supports?.("field-sizing", "content")) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useEffect(() => {
    resize();
  }, [value, resize]);
  useEffect(() => {
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      lang={lang}
      spellCheck
      autoCapitalize="sentences"
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={label}
      className={variant === "title" ? "editor-title" : "editor-excerpt"}
      onChange={(e) => onChange(e.target.value.replace(/[\r\n]+/g, " "))}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onEnter();
        }
      }}
    />
  );
});
