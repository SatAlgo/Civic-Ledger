/**
 * Deterministic department → color mapping.
 *
 * We don't store a color on the Department document (would require a migration
 * and a color picker UI). Instead we hash the dept id into an HSL hue and pin
 * the saturation/lightness so every color reads well on the paper background.
 *
 * Same dept id always yields the same color, across reloads and across users.
 *
 * The "unassigned" bucket (issues with no department yet) has a fixed neutral
 * color so it stands out from the colored department pins.
 */

const UNASSIGNED_COLOR = '#6b6b6b';
const UNASSIGNED_LABEL = 'Unassigned';

// FNV-1a hash — small, fast, decent distribution
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

export function colorForDepartment(deptId: string | null | undefined): string {
  if (!deptId) return UNASSIGNED_COLOR;
  // Hue in 0-359, skipping a small range near pure red to keep distinct from
  // the rust accent (#b8442e ~ hue 13). And avoiding bright yellows which are
  // hard to read on paper.
  const hue = hash(deptId) % 320; // 0-319
  const adjusted = hue < 30 ? hue + 30 : hue; // skip 0-29 (reds)
  return `hsl(${adjusted}, 55%, 42%)`;
}

export function labelForDepartment(
  dept: { name?: string; code?: string } | null | undefined
): string {
  if (!dept) return UNASSIGNED_LABEL;
  return dept.code ? `${dept.code} — ${dept.name}` : dept.name ?? UNASSIGNED_LABEL;
}

export { UNASSIGNED_COLOR, UNASSIGNED_LABEL };
