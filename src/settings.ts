import { App, PluginSettingTab, Setting } from "obsidian";
import type ReviewPlugin from "./main";

export interface ReviewSettings {
  sidecarLocation: "alongside" | "central";
  centralFolder: string;
  mirrorSourceLifecycle: boolean;
}

export const DEFAULT_SETTINGS: ReviewSettings = {
  sidecarLocation: "alongside",
  centralFolder: "_reviews",
  mirrorSourceLifecycle: true,
};

export class ReviewSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: ReviewPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Sidecar location")
      .setDesc("Where to store <doc>.review.md files.")
      .addDropdown((dd) =>
        dd
          .addOption("alongside", "Alongside the source doc")
          .addOption("central", "In a central folder")
          .setValue(this.plugin.settings.sidecarLocation)
          .onChange(async (value) => {
            this.plugin.settings.sidecarLocation = value as "alongside" | "central";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Central folder")
      .setDesc("Vault-relative folder used when 'In a central folder' is selected.")
      .addText((text) =>
        text
          .setPlaceholder("_reviews")
          .setValue(this.plugin.settings.centralFolder)
          .onChange(async (value) => {
            this.plugin.settings.centralFolder = value || "_reviews";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Mirror source-doc moves and deletes")
      .setDesc(
        "When a source doc is renamed, moved, or deleted, apply the same action to its sidecar."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.mirrorSourceLifecycle)
          .onChange(async (value) => {
            this.plugin.settings.mirrorSourceLifecycle = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
