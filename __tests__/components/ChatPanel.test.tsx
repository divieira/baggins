import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ChatPanel from "@/components/ChatPanel";

describe("ChatPanel", () => {
  it("renders with placeholder text", () => {
    render(<ChatPanel tripId="test-trip" />);
    expect(screen.getByText("Ask me anything about your trip!")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ask about your trip/i)).toBeInTheDocument();
  });

  it("disables send button when input is empty", () => {
    render(<ChatPanel tripId="test-trip" />);
    expect(screen.getByText("Send")).toBeDisabled();
  });

  it("enables send button when input has content", () => {
    render(<ChatPanel tripId="test-trip" />);
    const input = screen.getByPlaceholderText(/ask about your trip/i);
    fireEvent.change(input, { target: { value: "Hello" } });
    expect(screen.getByText("Send")).not.toBeDisabled();
  });

  it("displays the title", () => {
    render(<ChatPanel tripId="test-trip" />);
    expect(screen.getByText("Travel Assistant")).toBeInTheDocument();
  });
});
