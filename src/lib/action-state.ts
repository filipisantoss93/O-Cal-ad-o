export type ActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialActionState: ActionState = { status: "idle" };

export function actionError(
  message: string,
  field?: string,
): ActionState {
  return {
    status: "error",
    message,
    fieldErrors: field ? { [field]: [message] } : undefined,
  };
}
