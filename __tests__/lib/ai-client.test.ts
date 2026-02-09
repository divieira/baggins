import { parseJsonResponse } from "@/lib/ai/parse-json";

describe("parseJsonResponse", () => {
  it("parses plain JSON", () => {
    const result = parseJsonResponse<{ name: string }>('{"name": "test"}');
    expect(result).toEqual({ name: "test" });
  });

  it("parses JSON wrapped in markdown code blocks", () => {
    const input = '```json\n{"name": "test"}\n```';
    const result = parseJsonResponse<{ name: string }>(input);
    expect(result).toEqual({ name: "test" });
  });

  it("parses JSON wrapped in plain code blocks", () => {
    const input = '```\n{"name": "test"}\n```';
    const result = parseJsonResponse<{ name: string }>(input);
    expect(result).toEqual({ name: "test" });
  });

  it("handles complex nested JSON", () => {
    const input = JSON.stringify({
      cities: [{ name: "Tokyo", country: "Japan" }],
      travelers: [{ name: "Alice", age: 25 }],
    });
    const result = parseJsonResponse<{ cities: { name: string }[]; travelers: { name: string }[] }>(input);
    expect(result.cities).toHaveLength(1);
    expect(result.cities[0].name).toBe("Tokyo");
    expect(result.travelers[0].name).toBe("Alice");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseJsonResponse("not json")).toThrow();
  });

  it("handles JSON with leading/trailing whitespace", () => {
    const result = parseJsonResponse<{ a: number }>('  {"a": 1}  ');
    expect(result).toEqual({ a: 1 });
  });
});
