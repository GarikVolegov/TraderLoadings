import { useGetRandomQuote } from "@workspace/api-client-react";
import { Quote } from "lucide-react";

export function QuoteWidget() {
  const { data: quote } = useGetRandomQuote({ query: { staleTime: 3600_000 } });

  if (!quote) return null;

  return (
    <div className="relative rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm px-5 sm:px-8 py-4 sm:py-6 overflow-hidden">
      <div className="absolute top-3 left-4 opacity-10 pointer-events-none">
        <Quote className="w-10 h-10 text-primary" />
      </div>

      <p className="text-base sm:text-lg italic text-foreground/85 leading-relaxed relative z-10">
        &ldquo;{quote.text}&rdquo;
      </p>
      {quote.author && (
        <p className="text-sm text-accent/70 mt-2 font-medium relative z-10">
          — {quote.author}
        </p>
      )}
    </div>
  );
}
