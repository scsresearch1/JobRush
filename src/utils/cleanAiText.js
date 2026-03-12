/**
 * Clean AI-generated text to fix formatting issues:
 * - Remove blank/orphaned bullet points (*, •, • *, etc.)
 * - Strip stray asterisks
 * - Filter empty lines
 */

const BLANK_BULLET_PATTERNS = /^\s*[•*]\s*[*]?\s*$/  // "• *", "*", " • ", etc.
const EMPTY_OR_WHITESPACE = /^\s*$/

/**
 * Check if a line is blank/empty (no meaningful content)
 */
export function isBlankLine(line) {
  if (!line || typeof line !== 'string') return true
  const trimmed = line.trim()
  if (EMPTY_OR_WHITESPACE.test(trimmed)) return true
  if (BLANK_BULLET_PATTERNS.test(trimmed)) return true
  if (/^[•*\-]\s*$/.test(trimmed)) return true  // just "•" or "*" or "-"
  if (/^\*+\s*$/.test(trimmed)) return true    // just asterisks
  return false
}

/**
 * Clean a single line - strip markdown bold, orphaned asterisks
 */
export function cleanLine(line) {
  if (!line || typeof line !== 'string') return ''
  let out = line
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold** -> bold
    .replace(/\*\s*\*\s*/g, '')          // stray " * * " 
    .replace(/^\s*[•*\-]\s*\*\s*/, '')   // "• *" at start
    .replace(/^\s*[•*\-]\s*/, '')        // leading bullet
    .trim()
  return out
}

/**
 * Clean multi-line AI text - filter blank lines, clean each line
 */
export function cleanAiText(text) {
  if (!text || typeof text !== 'string') return ''
  return text
    .split(/\r?\n/)
    .map(line => cleanLine(line))
    .filter(line => !isBlankLine(line) && line.length > 0)
}

/**
 * Clean a line for display - remove ALL asterisks, markdown, leading bullets/numbers
 */
function cleanLineForDisplay(line) {
  if (!line || typeof line !== 'string') return ''
  return line
    .replace(/\*\*([^*]+)\*\*/g, '$1')           // **bold** -> bold
    .replace(/\*/g, '')                          // remove ALL asterisks
    .replace(/^\s*[•\-]\s*/, '')                 // leading • or -
    .replace(/^\s*\d+\.\s*/, '')                 // leading "1. " "2. " etc.
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Get cleaned lines for display - no asterisks, no redundant numbers, proper bullets
 */
export function getDisplayLines(text) {
  if (!text || typeof text !== 'string') return []
  return text
    .split(/\r?\n/)
    .map(cleanLineForDisplay)
    .filter(line => line.length > 0 && !/^[•\-]+$/.test(line))
}
