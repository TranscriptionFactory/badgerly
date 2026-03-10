<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";

  interface Props {
    open: boolean;
    url: string;
    is_loading: boolean;
    error: string | null;
    on_update_url: (value: string) => void;
    on_confirm: () => void;
    on_cancel: () => void;
  }

  let {
    open,
    url,
    is_loading,
    error,
    on_update_url,
    on_confirm,
    on_cancel,
  }: Props = $props();

  function can_submit() {
    return url.trim().length > 0 && !is_loading;
  }

  function handle_keydown(event: KeyboardEvent) {
    if (event.key !== "Enter" || !can_submit()) {
      return;
    }

    event.preventDefault();
    on_confirm();
  }
</script>

<Dialog.Root
  {open}
  onOpenChange={(value: boolean) => {
    if (!value && !is_loading) on_cancel();
  }}
>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>Add Git Remote</Dialog.Title>
      <Dialog.Description>
        Connect this vault to a remote repository. SSH and HTTPS URLs are
        supported.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-3 py-2">
      <Input
        type="text"
        placeholder="git@github.com:owner/repo.git"
        value={url}
        oninput={(event: Event & { currentTarget: HTMLInputElement }) => {
          on_update_url(event.currentTarget.value);
        }}
        onkeydown={handle_keydown}
        disabled={is_loading}
        autofocus
      />

      {#if error}
        <p class="text-sm text-destructive">{error}</p>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={on_cancel} disabled={is_loading}>
        Cancel
      </Button>
      <Button onclick={on_confirm} disabled={!can_submit()}>
        {is_loading ? "Adding..." : "Add Remote"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
