import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import VersionNavigator from "@/components/VersionNavigator";
import type { PlanVersion } from "@/types/database";

const mockVersions: PlanVersion[] = [
  {
    id: "v1",
    trip_id: "t1",
    city_id: "c1",
    version_number: 1,
    summary: "Initial plan",
    plan_data: {},
    created_by: "u1",
    created_at: "2026-01-01",
  },
  {
    id: "v2",
    trip_id: "t1",
    city_id: "c1",
    version_number: 2,
    summary: "Modified plan",
    plan_data: {},
    created_by: "u1",
    created_at: "2026-01-02",
  },
  {
    id: "v3",
    trip_id: "t1",
    city_id: "c1",
    version_number: 3,
    summary: "Final plan",
    plan_data: {},
    created_by: "u1",
    created_at: "2026-01-03",
  },
];

describe("VersionNavigator", () => {
  it("returns null when only one version exists", () => {
    const { container } = render(
      <VersionNavigator versions={[mockVersions[0]]} currentVersion={1} onVersionChange={jest.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("displays current version number and total", () => {
    render(
      <VersionNavigator versions={mockVersions} currentVersion={2} onVersionChange={jest.fn()} />
    );
    expect(screen.getByText("Version 2 of 3")).toBeInTheDocument();
  });

  it("disables Prev button on first version", () => {
    render(
      <VersionNavigator versions={mockVersions} currentVersion={1} onVersionChange={jest.fn()} />
    );
    expect(screen.getByText("Prev")).toBeDisabled();
    expect(screen.getByText("Next")).not.toBeDisabled();
  });

  it("disables Next button on last version", () => {
    render(
      <VersionNavigator versions={mockVersions} currentVersion={3} onVersionChange={jest.fn()} />
    );
    expect(screen.getByText("Prev")).not.toBeDisabled();
    expect(screen.getByText("Next")).toBeDisabled();
  });

  it("calls onVersionChange with correct params when clicking Next", () => {
    const handler = jest.fn();
    render(
      <VersionNavigator versions={mockVersions} currentVersion={1} onVersionChange={handler} />
    );
    fireEvent.click(screen.getByText("Next"));
    expect(handler).toHaveBeenCalledWith("v2", 2);
  });

  it("calls onVersionChange with correct params when clicking Prev", () => {
    const handler = jest.fn();
    render(
      <VersionNavigator versions={mockVersions} currentVersion={3} onVersionChange={handler} />
    );
    fireEvent.click(screen.getByText("Prev"));
    expect(handler).toHaveBeenCalledWith("v2", 2);
  });
});
