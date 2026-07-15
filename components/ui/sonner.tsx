"use client";

import { useEffect } from "react";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  IconLoader2,
  IconSquareRoundedX,
} from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  // Крестика нет: тост закрывается правым кликом по нему
  useEffect(() => {
    function onContextMenu(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const toastEl = target?.closest?.("[data-sonner-toast]");
      if (!toastEl) return;
      event.preventDefault();
      toast.dismiss();
    }

    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton={false}
      icons={{
        success: <IconCircleCheck className="size-4" />,
        info: <IconInfoCircle className="size-4" />,
        warning: <IconAlertTriangle className="size-4" />,
        error: <IconSquareRoundedX className="size-4" />,
        loading: <IconLoader2 className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        closeButton: false,
      }}
      {...props}
    />
  );
};

export { Toaster };
