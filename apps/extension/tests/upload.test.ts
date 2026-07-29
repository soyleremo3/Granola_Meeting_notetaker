import { describe, expect, it } from "vitest";
import {
  BackendUnavailableError,
  createMeeting,
  runUploadPipeline,
  uploadRecording,
  type BackendClient,
} from "../src/lib/upload";
import { BACKEND_UNAVAILABLE_MESSAGE } from "../src/lib/constants";
import type { UploadStage } from "../src/lib/messages";

interface MockRoute {
  method: string;
  path: string;
  respond: () => Response;
}

function mockClient(routes: MockRoute[]): { client: BackendClient; calls: Array<{ method: string; path: string }> } {
  const calls: Array<{ method: string; path: string }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const path = url.replace("http://localhost:8000", "");
    calls.push({ method, path });
    const route = routes.find((r) => r.method === method && r.path === path);
    if (!route) throw new Error(`No mock route for ${method} ${path}`);
    return route.respond();
  }) as typeof fetch;
  return { client: { fetchImpl, backendUrl: "http://localhost:8000" }, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("createMeeting / uploadRecording (successful backend upload)", () => {
  it("posts the meeting payload and returns the created meeting", async () => {
    const { client } = mockClient([
      {
        method: "POST",
        path: "/api/meetings",
        respond: () => jsonResponse({ id: "m1", status: "uploaded" }, 201),
      },
    ]);
    const meeting = await createMeeting(client, "Toplantı Kaydı");
    expect(meeting.id).toBe("m1");
  });

  it("uploads the recording as multipart form data", async () => {
    const { client, calls } = mockClient([
      {
        method: "POST",
        path: "/api/meetings/m1/media",
        respond: () => jsonResponse({ id: "m1", status: "uploaded" }),
      },
    ]);
    const meeting = await uploadRecording(client, "m1", new Blob(["fake-audio"]), "kayit.webm");
    expect(meeting.id).toBe("m1");
    expect(calls).toEqual([{ method: "POST", path: "/api/meetings/m1/media" }]);
  });
});

describe("runUploadPipeline (successful backend upload, full flow)", () => {
  it("walks create -> upload -> process -> poll -> ready, reporting every stage", async () => {
    let statusCallCount = 0;
    const { client } = mockClient([
      { method: "POST", path: "/api/meetings", respond: () => jsonResponse({ id: "m1", status: "uploaded" }, 201) },
      {
        method: "POST",
        path: "/api/meetings/m1/media",
        respond: () => jsonResponse({ id: "m1", status: "uploaded" }),
      },
      {
        method: "POST",
        path: "/api/meetings/m1/process",
        respond: () => jsonResponse({ status: "processing", stage_label: "Dosya hazırlanıyor", error_message: null }),
      },
      {
        method: "GET",
        path: "/api/meetings/m1/status",
        respond: () => {
          statusCallCount += 1;
          if (statusCallCount < 2) {
            return jsonResponse({
              status: "processing",
              stage_label: "Türkçe konuşma metne çevriliyor",
              error_message: null,
            });
          }
          return jsonResponse({ status: "ready", stage_label: "Hazır", error_message: null });
        },
      },
    ]);

    const stages: UploadStage[] = [];
    const result = await runUploadPipeline(
      client,
      new Blob(["fake-audio"]),
      "kayit.webm",
      "Toplantı Kaydı",
      { onStage: (stage) => stages.push(stage) },
      { waitFn: async () => {}, pollIntervalMs: 0 }
    );

    expect(result).toEqual({ meetingId: "m1", finalStatus: "ready", errorMessage: null });
    expect(stages).toEqual([
      "creating-meeting",
      "uploading",
      "starting-processing",
      "processing",
      "processing",
      "ready",
    ]);
  });

  it("resumes from an existing meetingId without re-creating the meeting (retry)", async () => {
    const { client, calls } = mockClient([
      {
        method: "POST",
        path: "/api/meetings/m1/media",
        respond: () => jsonResponse({ id: "m1", status: "uploaded" }),
      },
      {
        method: "POST",
        path: "/api/meetings/m1/process",
        respond: () => jsonResponse({ status: "processing", stage_label: "İşleniyor", error_message: null }),
      },
      {
        method: "GET",
        path: "/api/meetings/m1/status",
        respond: () => jsonResponse({ status: "ready", stage_label: "Hazır", error_message: null }),
      },
    ]);

    const result = await runUploadPipeline(
      client,
      new Blob(["fake-audio"]),
      "kayit.webm",
      "Toplantı Kaydı",
      { onStage: () => {} },
      { existingMeetingId: "m1", waitFn: async () => {}, pollIntervalMs: 0 }
    );

    expect(result.meetingId).toBe("m1");
    expect(calls.some((c) => c.method === "POST" && c.path === "/api/meetings")).toBe(false);
  });
});

describe("runUploadPipeline (backend unavailable state)", () => {
  it("reports backend-unavailable and rejects when fetch itself fails (server not running)", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    const client: BackendClient = { fetchImpl, backendUrl: "http://localhost:8000" };

    const stages: Array<{ stage: UploadStage; errorMessage?: string }> = [];
    await expect(
      runUploadPipeline(
        client,
        new Blob(["fake-audio"]),
        "kayit.webm",
        "Toplantı Kaydı",
        { onStage: (stage, extra) => stages.push({ stage, errorMessage: extra?.errorMessage }) },
        { waitFn: async () => {}, pollIntervalMs: 0 }
      )
    ).rejects.toThrow(BackendUnavailableError);

    expect(stages).toEqual([
      { stage: "creating-meeting", errorMessage: undefined },
      { stage: "backend-unavailable", errorMessage: BACKEND_UNAVAILABLE_MESSAGE },
    ]);
  });
});
