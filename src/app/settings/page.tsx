import type { Metadata } from "next";
import { SettingsPanel } from "@/components/settings/settings-panel";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <p className="type-readout text-muted-foreground">Preferences</p>
      <h1 className="type-display mt-2 text-4xl sm:text-5xl">Settings</h1>
      <div className="mt-8">
        <SettingsPanel />
      </div>
    </div>
  );
}
