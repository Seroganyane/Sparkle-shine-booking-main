import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, tabIndex, readOnly, ...props }, ref) => {
  return (
    <textarea
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : tabIndex}
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-[hsl(var(--field))] px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 read-only:cursor-default read-only:border-border read-only:bg-[hsl(var(--field-inactive))] read-only:text-[hsl(var(--field-inactive-foreground))] disabled:cursor-not-allowed disabled:border-border disabled:bg-[hsl(var(--field-inactive))] disabled:text-[hsl(var(--field-inactive-foreground))] disabled:opacity-100",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
