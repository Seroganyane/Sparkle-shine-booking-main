export const edgeFunctionError = async (error: Error): Promise<Error> => {
  const response = "context" in error ? error.context : undefined;
  if (!(response instanceof Response)) return error;

  try {
    const body: unknown = await response.clone().json();
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return new Error(body.error);
    }
    if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
      return new Error(body.message);
    }
  } catch {
    // Gateway errors do not always contain JSON.
  }

  return new Error(`Server request failed (${response.status}). Please try again.`);
};
