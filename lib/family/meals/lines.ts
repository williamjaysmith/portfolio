/**
 * Add to List's raw material (006 FR-631–FR-633, R610): a recipe's text as
 * the lines a person ticks. Split on any line break, trimmed, blanks dropped,
 * each cut to an item's 200 characters with the cut marked so the sheet can
 * say so beside it. No parsing, no guessing which lines are ingredients —
 * that is the person's tick.
 */

export const ITEM_TEXT_LIMIT = 200;

export interface RecipeLine {
  text: string;
  /** The line ran past an item's length and was cut. */
  truncated: boolean;
}

export function linesOf(text: string): RecipeLine[] {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({ text: line.slice(0, ITEM_TEXT_LIMIT), truncated: line.length > ITEM_TEXT_LIMIT }));
}
