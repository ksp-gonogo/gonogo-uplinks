import {
  createDomainAvailabilityStore,
  DomainAvailabilityContext,
} from "@ksp-gonogo/ui-kit";
import { type ReactNode, useState } from "react";

/** The host's presence store with the Kerbalism Domain announced, which a contribution's `requires` gate reads. */
export function KerbalismPresent({ children }: { children: ReactNode }) {
  const [store] = useState(() => {
    const announced = createDomainAvailabilityStore();
    announced.setAvailable("kerbalism", true);
    return announced;
  });
  return (
    <DomainAvailabilityContext.Provider value={store}>
      {children}
    </DomainAvailabilityContext.Provider>
  );
}
