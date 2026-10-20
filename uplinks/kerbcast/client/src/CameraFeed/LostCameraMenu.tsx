import type { CameraState } from "@ksp-gonogo/kerbcast";
import {
  ActionMenu,
  Button,
  Floating,
} from "@ksp-gonogo/ui-kit";
import { useRef, useState } from "react";
import { buildCameraLabeler } from "../cameraLabels.js";

export interface LostCameraMenuProps {
  /** The destroyed cameras the picker leaves out, in registry order. */
  cameras: readonly CameraState[];
  onSelect: (flightId: number) => void;
}

/**
 * One button folding every destroyed camera the picker leaves out, labelled
 * with how many there are. Opening it lists them; choosing one selects it and
 * shows its last frame under SIGNAL LOST. Useful for keeping a vessel's
 * destroyed cameras reachable without crowding the live ones. Used by the
 * camera feed's header.
 */
export function LostCameraMenu({
  cameras,
  onSelect,
}: Readonly<LostCameraMenuProps>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  if (cameras.length === 0) return null;

  const labelOf = buildCameraLabeler(cameras);
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <>
      <Button
        ref={buttonRef}
        size="sm"
        variant="ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {cameras.length} signal lost
      </Button>
      {open && (
        <Floating
          anchor={() => {
            const box = buttonRef.current?.getBoundingClientRect();
            return box ? { x: box.left, y: box.bottom } : null;
          }}
        >
          <ActionMenu
            aria-label="Signal lost cameras"
            style={{ position: "static" }}
            items={cameras.map((c) => ({
              key: String(c.flightId),
              label: `${labelOf(c)} (${c.vesselName})`,
            }))}
            onSelect={(key) => {
              onSelect(Number(key));
              close();
            }}
            onDismiss={close}
          />
        </Floating>
      )}
    </>
  );
}
