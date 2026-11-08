export function absolutise(
  target: string,
  ctx: { repo: string; ref: string; readmePath: string },
  kind: "image" | "link",
): string;
export function renderDescription(
  markdown: string,
  ctx: {
    repo: string;
    ref: string;
    readmePath: string;
    modId?: string;
    version?: string;
  },
): string;
export function parseEditForm(html: string): [string, string][];
export function buildEditFields(
  fields: [string, string][],
  change: { description: string; short?: string },
): [string, string][];
export function main(
  argv: string[],
  env?: Record<string, string | undefined>,
): Promise<number>;
export function inspectEditForm(html: string): {
  fields: [string, string][];
  controls: Set<string>;
};
export function certifyEditForm(
  form: { fields: [string, string][]; controls: Set<string> },
  listing: Record<string, string | null | undefined>,
): void;
export function extractShort(markdown: string): string | undefined;
export function sync(o: {
  readme: string;
  ctx: { repo: string; ref: string; readmePath: string };
  modId: string;
  short?: string;
  dryRun?: boolean;
  env: Record<string, string | undefined>;
  base?: string;
}): Promise<number>;
export function certifyMl(
  form: { fields: [string, string][] },
  modPageHtml: string,
): void;
export function segments(markdown: string): { code: boolean; text: string }[];
