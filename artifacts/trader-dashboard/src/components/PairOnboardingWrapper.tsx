import { useState, useEffect } from "react";
import { useBackground } from "@/contexts/BackgroundContext";
import { useUpdateUserSettings, getGetUserSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PairSelectionModal } from "./PairSelectionModal";

export function PairOnboardingWrapper() {
  const { selectedPairs, setSelectedPairs, settingsLoaded } = useBackground();
  const [show, setShow] = useState(false);
  const updateMutation = useUpdateUserSettings();
  const qc = useQueryClient();

  useEffect(() => {
    if (settingsLoaded && selectedPairs.length === 0) {
      setShow(true);
    }
  }, [settingsLoaded, selectedPairs.length]);

  const handleConfirm = async (pairs: string[]) => {
    setSelectedPairs(pairs);
    setShow(false);
    try {
      await updateMutation.mutateAsync({ data: { selectedPairs: pairs } });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
    } catch (err) {
      console.error("Failed to save selected pairs:", err);
    }
  };

  return (
    <PairSelectionModal
      open={show}
      onConfirm={handleConfirm}
      initialPairs={selectedPairs}
      dismissible={false}
    />
  );
}
