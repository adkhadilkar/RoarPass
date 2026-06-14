import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { z } from "zod";
import { validate, getParsed } from "./validate";

function mockReq(data: Record<string, unknown>, target = "body"): Request {
  return { [target]: data, headers: {} } as unknown as Request;
}

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

const TestSchema = z.object({
  name: z.string().min(1),
  age: z.coerce.number().int().positive(),
});

describe("validate middleware", () => {
  it("passes valid data and attaches parsed result", () => {
    const req = mockReq({ name: "Alice", age: "25" });
    const res = mockRes();
    const next = vi.fn();

    validate("body", TestSchema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(getParsed(req, "body")).toEqual({ name: "Alice", age: 25 });
  });

  it("returns 422 for invalid data", () => {
    const req = mockReq({ name: "", age: "abc" });
    const res = mockRes();
    const next = vi.fn();

    validate("body", TestSchema)(req, res, next);

    expect((res.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(422);
    expect(next).not.toHaveBeenCalled();
  });

  it("validates query params", () => {
    const req = { query: { age: "30" }, body: {}, params: {}, headers: {} } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    validate("query", z.object({ age: z.coerce.number().int() }))(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(getParsed(req, "query")).toEqual({ age: 30 });
  });
});