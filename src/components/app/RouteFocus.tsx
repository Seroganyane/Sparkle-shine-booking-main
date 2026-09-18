import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const editableSelector = 'main input:not([type="hidden"]):not([readonly]):not(:disabled), main textarea:not([readonly]):not(:disabled), main select:not(:disabled), main [role="combobox"]:not([aria-disabled="true"]), form input:not([type="hidden"]):not([readonly]):not(:disabled), form textarea:not([readonly]):not(:disabled), form select:not(:disabled), form [role="combobox"]:not([aria-disabled="true"])';

export function RouteFocus() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    const timer = window.setTimeout(() => {
      const fields = Array.from(document.querySelectorAll<HTMLElement>(editableSelector));
      const first = fields.find((field) => field.getClientRects().length > 0);
      if (first) {
        first.focus({ preventScroll: true });
        return;
      }
      const heading = document.querySelector<HTMLElement>("main h1, h1");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
