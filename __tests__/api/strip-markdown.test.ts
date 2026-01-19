/**
 * Tests for JSON markdown fence stripping utility
 */

function stripMarkdownCodeFences(text: string): string {
  const trimmed = text.trim()

  // Check for ```json ... ``` or ``` ... ```
  const jsonFenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (jsonFenceMatch) {
    return jsonFenceMatch[1].trim()
  }

  return trimmed
}

describe('stripMarkdownCodeFences', () => {
  test('strips ```json code fences', () => {
    const input = '```json\n{"key": "value"}\n```'
    const expected = '{"key": "value"}'
    expect(stripMarkdownCodeFences(input)).toBe(expected)
  })

  test('strips ``` code fences without json label', () => {
    const input = '```\n{"key": "value"}\n```'
    const expected = '{"key": "value"}'
    expect(stripMarkdownCodeFences(input)).toBe(expected)
  })

  test('handles no code fences', () => {
    const input = '{"key": "value"}'
    const expected = '{"key": "value"}'
    expect(stripMarkdownCodeFences(input)).toBe(expected)
  })

  test('handles multi-line JSON', () => {
    const input = '```json\n{\n  "key": "value",\n  "nested": {\n    "field": true\n  }\n}\n```'
    const expected = '{\n  "key": "value",\n  "nested": {\n    "field": true\n  }\n}'
    expect(stripMarkdownCodeFences(input)).toBe(expected)
  })

  test('handles whitespace before/after fences', () => {
    const input = '  ```json\n{"key": "value"}\n```  '
    const expected = '{"key": "value"}'
    expect(stripMarkdownCodeFences(input)).toBe(expected)
  })

  test('validates against actual error case', () => {
    // This is the actual format that caused the error
    const input = '```json\n{\n  "attractions": [],\n  "restaurants": []\n}\n```'
    const result = stripMarkdownCodeFences(input)

    // Should parse without error now
    expect(() => JSON.parse(result)).not.toThrow()
    const parsed = JSON.parse(result)
    expect(parsed).toHaveProperty('attractions')
    expect(parsed).toHaveProperty('restaurants')
  })
})
