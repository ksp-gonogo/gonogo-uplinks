import type { ConfigComponentProps } from "@ksp-gonogo/sitrep-sdk";
import {
  librationPairLabel,
  librationPairsOf,
} from "@ksp-gonogo/sitrep-sdk/frames";
import {
  ConfigForm,
  Field,
  FieldHint,
  FieldLabel,
  Select,
  useModalSaveBar,
} from "@ksp-gonogo/ui-kit";
import { useMemo, useState } from "react";
import { AUTO_PAIR, type LibrationPointsConfig } from "./config.js";
import { useCatalogue } from "./useCatalogue.js";

export function LibrationPointsConfigForm({
  config,
  onSave,
}: Readonly<ConfigComponentProps<LibrationPointsConfig>>) {
  const facts = useCatalogue();
  const candidates = useMemo(() => librationPairsOf(facts), [facts]);
  const [pair, setPair] = useState(config?.pair ?? AUTO_PAIR);
  const candidate = useMemo<LibrationPointsConfig>(() => ({ pair }), [pair]);

  useModalSaveBar({
    onSave: () => onSave(candidate),
    value: candidate,
    saved: config ?? {},
  });

  return (
    <ConfigForm>
      <Field>
        <FieldLabel htmlFor="libration-pair">Body pair</FieldLabel>
        <Select
          id="libration-pair"
          value={pair}
          onChange={(e) => setPair(e.target.value)}
        >
          <option value={AUTO_PAIR}>
            Auto (the in-game pair, else the nearest)
          </option>
          {candidates.map((p) => (
            <option key={p.secondaryIndex} value={p.secondaryName ?? ""}>
              {librationPairLabel(p)}
            </option>
          ))}
        </Select>
        <FieldHint>
          The pair sets the frame the picture holds still. Auto follows the
          in-game view when it turns with a pair, else the pair nearest the
          craft.
        </FieldHint>
      </Field>
    </ConfigForm>
  );
}
