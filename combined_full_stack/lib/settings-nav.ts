export const SCROLL_SETTINGS_SECTION_EVENT = "forge:scroll-settings-section";
export const OPEN_LLM_PROVIDERS_EVENT = "forge:open-llm-providers";

export function scrollToSettingsSection(sectionId: string): void {
  window.dispatchEvent(new CustomEvent(SCROLL_SETTINGS_SECTION_EVENT, { detail: { sectionId } }));
}

export function openLlmProvidersSettings(): void {
  window.dispatchEvent(new CustomEvent(OPEN_LLM_PROVIDERS_EVENT));
}

export function openSettingsProvidersSection(onOpenSettings?: () => void): void {
  onOpenSettings?.();
  openLlmProvidersSettings();
}
