import { colors } from "@/lib/colors";

interface ToastProps {
  message: string | null;
  /** Bottom offset in lines (default: 2, above footer) */
  bottom?: number;
}

export function Toast({ message, bottom = 2 }: ToastProps) {
  if (!message) return null;

  const isError = message.startsWith("Error:");

  return (
    <box
      style={{
        position: "absolute",
        bottom,
        left: 0,
        right: 0,
        zIndex: 1000,
        paddingLeft: 1,
      }}
    >
      <text fg={isError ? colors.error : colors.success}>{message}</text>
    </box>
  );
}
