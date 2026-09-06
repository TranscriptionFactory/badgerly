/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import AssistantSessionTabView from "$lib/features/assistant/ui/assistant_session_tab_view.svelte";
import type { AssistantSession } from "$lib/features/assistant";
import {
  flushSync,
  mount,
  unmount,
} from "../../../helpers/svelte_client_runtime";
import {
  make_session,
  make_session_message,
} from "../../../helpers/assistant_session_fixtures";

// The view takes the session as a prop and never reads the app context, so it
// mounts without any store or context wiring.
type ViewProps = {
  on_open_path?: (path: string) => void;
  on_open_url?: (href: string) => void;
};

function render(session: AssistantSession | null, props: ViewProps = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(AssistantSessionTabView, {
    target,
    props: { session, ...props },
  });
  flushSync();
  return {
    target,
    cleanup() {
      void unmount(app);
      target.remove();
      flushSync();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("assistant_session_tab_view", () => {
  it("renders a friendly empty state when the session is gone", () => {
    const view = render(null);

    const empty = view.target.querySelector('[data-testid="empty-message"]');
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toContain(
      "This conversation is no longer available",
    );
    expect(
      view.target.querySelector('[data-testid="assistant-session-message"]'),
    ).toBeNull();

    view.cleanup();
  });

  it("renders the session title and kind", () => {
    const view = render(
      make_session({ title: "How do backlinks work?", kind: "chat" }),
    );

    expect(
      view.target.querySelector('[data-testid="assistant-session-title"]')
        ?.textContent,
    ).toContain("How do backlinks work?");
    expect(
      view.target.querySelector('[data-testid="assistant-session-kind"]')
        ?.textContent,
    ).toContain("chat");

    view.cleanup();
  });

  it("renders each message in the transcript with its role", () => {
    const view = render(
      make_session({
        messages: [
          make_session_message({
            role: "user",
            content: "What is a backlink?",
          }),
          make_session_message({
            role: "assistant",
            content: "A link pointing back to this note.",
          }),
        ],
      }),
    );

    const messages = view.target.querySelectorAll(
      '[data-testid="assistant-session-message"]',
    );
    expect(messages).toHaveLength(2);
    expect(messages[0]?.getAttribute("data-role")).toBe("user");
    expect(messages[0]?.textContent).toContain("What is a backlink?");
    expect(messages[1]?.getAttribute("data-role")).toBe("assistant");
    expect(messages[1]?.textContent).toContain(
      "A link pointing back to this note.",
    );

    view.cleanup();
  });

  it("hides tool replay messages from the transcript", () => {
    const view = render(
      make_session({
        messages: [
          make_session_message({ role: "user", content: "Search my notes" }),
          make_session_message({ role: "tool", content: "raw tool payload" }),
        ],
      }),
    );

    const messages = view.target.querySelectorAll(
      '[data-testid="assistant-session-message"]',
    );
    expect(messages).toHaveLength(1);
    expect(view.target.textContent).not.toContain("raw tool payload");

    view.cleanup();
  });

  it("shows an empty transcript state for a session with no messages", () => {
    const view = render(make_session({ messages: [] }));

    expect(
      view.target.querySelector('[data-testid="empty-message"]')?.textContent,
    ).toContain("No messages yet");

    view.cleanup();
  });
});

describe("assistant_session_tab_view markdown", () => {
  function transcript_message(content: string, role: "user" | "assistant") {
    const view = render(
      make_session({ messages: [make_session_message({ role, content })] }),
    );
    const message = view.target.querySelector<HTMLElement>(
      '[data-testid="assistant-session-message"]',
    );
    if (!message) throw new Error("no transcript message rendered");
    return { view, message };
  }

  it("renders assistant replies as markdown", () => {
    const { view, message } = transcript_message(
      "**Bold** and `code`\n\n- first\n- second",
      "assistant",
    );

    expect(message.querySelector("strong")?.textContent).toBe("Bold");
    expect(message.querySelector("code")?.textContent).toBe("code");
    expect(message.querySelectorAll("li")).toHaveLength(2);
    expect(message.textContent).not.toContain("**Bold**");

    view.cleanup();
  });

  it("keeps what the user typed verbatim", () => {
    const { view, message } = transcript_message(
      "**not bold** in my # note",
      "user",
    );

    expect(message.querySelector("strong")).toBeNull();
    expect(message.textContent).toContain("**not bold** in my # note");

    view.cleanup();
  });

  it("routes transcript links instead of navigating the webview", () => {
    const on_open_path = vi.fn();
    const on_open_url = vi.fn();
    const view = render(
      make_session({
        messages: [
          make_session_message({
            role: "assistant",
            content:
              "See [the note](Some%20Note.md) and [docs](https://example.com).",
          }),
        ],
      }),
      { on_open_path, on_open_url },
    );

    const anchors = view.target.querySelectorAll("a");
    expect(anchors).toHaveLength(2);
    for (const anchor of anchors) {
      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      anchor.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }

    expect(on_open_path).toHaveBeenCalledWith("Some Note.md");
    expect(on_open_url).toHaveBeenCalledWith("https://example.com");

    view.cleanup();
  });
});
