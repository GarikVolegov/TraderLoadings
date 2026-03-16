import { useState, useEffect, useRef } from "react";
import { useBackground } from "@/contexts/BackgroundContext";
import { useUpdateUserSettings, getGetUserSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PairSelectionModal } from "./PairSelectionModal";

export function PairOnboardingWrapper() {
  const { selectedPairs, setSelectedPairs, settingsLoaded } = useBackground();
  const [show, setShow] = useState(false);
  const confirmedRef = useRef(false);
  const updateMutation = useUpdateUserSettings();
  const qc = useQueryClient();

  useEffect(() => {
    // Mostra il modal SOLO se: settings caricati, nessun pair salvato, e l'utente non ha ancora confermato in questa sessione
    if (settingsLoaded && selectedPairs.length === 0 && !confirmedRef.current) {
      setShow(true);
    } else if (selectedPairs.length > 0) {
      setShow(false);
    }
  }, [settingsLoaded, selectedPairs.length]);

  const handleConfirm = async (pairs: string[]) => {
    if (pairs.length === 0) return;
    // Segna come confermato subito per evitare race condition
    confirmedRef.current = true;
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
