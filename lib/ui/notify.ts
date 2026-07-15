"use client";

import { toast } from "sonner";

type ConfirmToastOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Деструктивное действие — красная кнопка подтверждения. */
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
};

/** Тост-подтверждение: не исчезает, пока пользователь не нажмёт кнопку. */
export function confirmToast(options: ConfirmToastOptions): string | number {
  const toastId = toast(options.title, {
    description: options.description,
    duration: Infinity,
    closeButton: false,
    action: {
      label: options.confirmLabel ?? "Подтвердить",
      onClick: () => {
        void (async () => {
          try {
            await options.onConfirm();
          } finally {
            toast.dismiss(toastId);
          }
        })();
      },
    },
    cancel: {
      label: options.cancelLabel ?? "Отмена",
      onClick: () => {
        toast.dismiss(toastId);
      },
    },
  });

  return toastId;
}

/** Сообщение об ошибке для пользователя (без английского жаргона из runtime). */
export function russianErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message.trim()) {
    return fallback;
  }

  const message = error.message.trim();

  if (/cannot be converted to a BigInt/i.test(message)) {
    return "Не удалось сохранить раскрой из‑за ошибки округления площадей. Попробуйте ещё раз.";
  }
  if (/Connection terminated|ECONNREFUSED|Can't reach database/i.test(message)) {
    return "Нет связи с базой данных. Проверьте, что Postgres запущен.";
  }
  if (/Панель не найдена|не найден|Выберите материал|Добавьте/i.test(message)) {
    return message;
  }
  // Уже по-русски
  if (/[а-яё]/i.test(message)) {
    return message;
  }

  return fallback;
}
