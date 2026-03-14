import type { AiProviderConfig } from "$lib/shared/types/ai_provider_config";

export function preferred_ai_backend_order(
  default_provider_id: string,
  providers: AiProviderConfig[],
): AiProviderConfig[] {
  if (default_provider_id === "auto") {
    return [...providers];
  }

  const match = providers.find((p) => p.id === default_provider_id);
  return match ? [match] : [...providers];
}

export async function resolve_auto_ai_backend(input: {
  providers: AiProviderConfig[];
  check_availability: (config: AiProviderConfig) => Promise<boolean>;
}): Promise<AiProviderConfig | null> {
  for (const provider of input.providers) {
    if (await input.check_availability(provider)) {
      return provider;
    }
  }

  return null;
}
