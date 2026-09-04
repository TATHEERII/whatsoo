const DOT = "•";
const MAX_DOTS = 3;

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

export function addDots(text: string): string {
  if (text.length === 0) return text;

  const textLen = text.length;
  const positions: Set<number> = new Set();

  while (positions.size < MAX_DOTS) {
    positions.add(randomInt(textLen));
  }

  const sortedPositions = Array.from(positions).sort((a, b) => a - b);

  let result = "";
  let prev = 0;
  for (const pos of sortedPositions) {
    result += text.slice(prev, pos);
    result += DOT;
    prev = pos;
  }
  result += text.slice(prev);

  return result;
}
