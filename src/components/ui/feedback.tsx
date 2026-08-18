"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type Feedback = { kind: "success" | "error"; message: string } | null;

export function FeedbackBanner({
  feedback,
  className,
}: {
  feedback: Feedback;
  className?: string;
}) {
  if (!feedback) return null;

  const isError = feedback.kind === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <p
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-1.5 rounded-md px-3 py-2 text-sm font-ui animate-fade-in",
        isError
          ? "bg-destructive/10 text-destructive"
          : "bg-success/10 text-success",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      {feedback.message}
    </p>
  );
}
