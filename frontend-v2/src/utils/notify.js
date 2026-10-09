const APP_NOTIFY_EVENT = 'app:notify';

export function notify(message, type = 'success', duration = 3200) {
  if (!message) return;
  window.dispatchEvent(
    new CustomEvent(APP_NOTIFY_EVENT, {
      detail: { message, type, duration },
    }),
  );
}

export function notifySuccess(message, duration) {
  notify(message, 'success', duration);
}

export function notifyError(message, duration) {
  notify(message, 'error', duration);
}

export { APP_NOTIFY_EVENT };
