import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper to parse Stripe error messages returned from API responses
export function parseStripeError(error: unknown): string {
  const defaultMessage = "Failed to authorize payment";

  if (
    typeof error !== "object" ||
    error === null ||
    !("message" in error) ||
    typeof (error as any).message !== "string"
  ) {
    return defaultMessage;
  }

  let errorMessage = defaultMessage;
  const message = (error as { message: string }).message;

  try {
    const errorData = JSON.parse(message.split(": ")[1] || "{}");
    if (errorData.details) {
      errorMessage = errorData.details;
    } else if (errorData.message) {
      errorMessage = errorData.message;
    }
  } catch {
    if (message.includes(":")) {
      const parts = message.split(": ");
      if (parts.length > 1) {
        errorMessage = parts[1];
      }
    }
  }

  return errorMessage;
}
