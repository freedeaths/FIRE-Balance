/**
 * PWA Install Button Component
 *
 * Provides users with an install button for the PWA when available.
 * Handles the beforeinstallprompt event and manages install state.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@mantine/core";
import { IconDownload, IconCheck } from "@tabler/icons-react";
import { getI18n } from "../../core/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt(): PromiseLike<void>;
  userChoice: PromiseLike<{ outcome: "accepted" | "dismissed" }>;
}

export const PWAInstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // i18n
  const i18n = getI18n();
  const t = useCallback(
    (key: string, variables?: Record<string, unknown>): string =>
      i18n.t(key, variables),
    [i18n],
  );

  useEffect(() => {
    // Check if app is already installed
    const checkIfInstalled = () => {
      const isStandalone = window.matchMedia(
        "(display-mode: standalone)",
      ).matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;

      if (isStandalone) {
        console.log(
          "❌ App already installed (standalone mode) - Install button will be HIDDEN",
        );
        setIsInstalled(true);
        return;
      }

      if (isIOSStandalone) {
        console.log(
          "❌ App already installed (iOS standalone) - Install button will be HIDDEN",
        );
        setIsInstalled(true);
        return;
      }
    };

    checkIfInstalled();

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log("App installed");
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    console.log("Install button clicked", { deferredPrompt });

    if (!deferredPrompt) {
      alert("No install prompt available");
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      console.log("User choice:", choiceResult);
      setDeferredPrompt(null);
    } catch (error) {
      console.error("Error during PWA installation:", error);
    }
  };

  // Show install button when available
  return (
    <>
      {deferredPrompt && (
        <Button
          leftSection={<IconDownload size={16} />}
          variant="light"
          color="blue"
          size="sm"
          onClick={handleInstallClick}
        >
          {t("pwa.install_app")}
        </Button>
      )}
    </>
  );
};

export default PWAInstallButton;
