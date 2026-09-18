import { useEffect } from "react";

const selector = 'button, [role="button"], [role="combobox"], input:not([type="hidden"]), textarea, select';

function labelFor(control: HTMLElement): string {
  const ariaLabel = control.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();
  const labelledBy = control.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(" ");
    if (text) return text;
  }
  if (control instanceof HTMLInputElement && control.labels?.length) return control.labels[0].textContent?.trim() || "";
  if (control instanceof HTMLTextAreaElement && control.labels?.length) return control.labels[0].textContent?.trim() || "";
  if (control instanceof HTMLSelectElement && control.labels?.length) return control.labels[0].textContent?.trim() || "";
  const nearbyLabel = control.parentElement?.querySelector("label")?.textContent?.trim();
  if (nearbyLabel) return nearbyLabel;
  return control.textContent?.trim() || control.getAttribute("placeholder") || "";
}

function addHint(control: HTMLElement) {
  if (control.hasAttribute("title") && control.dataset.controlHint !== "true") return;
  if (control.matches(":disabled, [aria-disabled='true']")) {
    if (control.dataset.controlHint === "true") control.removeAttribute("title");
    return;
  }
  const label = labelFor(control).replace(/\s+/g, " ").trim();
  if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
    control.title = label ? `Enter ${label.toLowerCase()}.` : "Enter a value in this field.";
  } else if (control instanceof HTMLSelectElement || control.getAttribute("role") === "combobox") {
    control.title = label ? `Choose ${label.toLowerCase()}.` : "Choose an option.";
  } else {
    control.title = label ? `Select to ${label.toLowerCase().replace(/[.!?]+$/, "")}.` : "Select this action.";
  }
  control.dataset.controlHint = "true";
}

export function ControlHints() {
  useEffect(() => {
    const refresh = (root: ParentNode) => root.querySelectorAll<HTMLElement>(selector).forEach(addHint);
    refresh(document);
    let frame = 0;
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        refresh(document);
      });
    });
    observer.observe(document.body, { childList: true, characterData: true, attributes: true, attributeFilter: ["disabled", "aria-disabled"], subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
