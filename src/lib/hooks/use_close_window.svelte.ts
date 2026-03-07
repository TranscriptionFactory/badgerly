import { getCurrentWindow } from "@tauri-apps/api/window";

export function make_close_window_handler() {
  return (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "w") {
      event.preventDefault();
      void getCurrentWindow().close();
    }
  };
}
