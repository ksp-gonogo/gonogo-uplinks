import { registerSetting, registerSettingsTab } from "@ksp-gonogo/sitrep-sdk";
import { KerbcastSettingsTab } from "./KerbcastSettingsTab.js";

registerSetting({
  // Gates ambient crew facecams; the Facecam Wall widget is exempt, since placing it is the opt-in.
  id: "kerbcast.embeddedFacecams",
  type: "boolean",
  defaultValue: true,
  category: "Kerbcast",
  label: "Embedded facecams",
  description:
    "Show live crew faces in CrewStatus avatars. Off means no ambient facecam streams; the dedicated Facecam Wall widget still works.",
  screens: ["main"],
});

registerSettingsTab({
  id: "kerbcast",
  label: "Kerbcast",
  component: KerbcastSettingsTab,
  screens: ["main"],
});
