export type PlacedObject = {
  id: string;
  objectId: string;
  src: string;
  name: string;
  x: number;
  y: number;
  xPct?: number;
  yPct?: number;
  sizeXPct?: number;
  sizeYPct?: number;
  sizePct?: number;
};

export function isPlacedObject(value: unknown): value is PlacedObject {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<PlacedObject>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.objectId === 'string' &&
    typeof candidate.src === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.x === 'number' &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === 'number' &&
    Number.isFinite(candidate.y)
  );
}

export function isPlacedObjectArray(value: unknown): value is PlacedObject[] {
  return Array.isArray(value) && value.every(isPlacedObject);
}