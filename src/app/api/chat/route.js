// API route that proxies to backend
import { headers } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export async function POST(request) {
  try {
    const headersList = await headers();
    const authHeader = headersList.get("Authorization");
    const body = await request.json();

    const res = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader && { Authorization: authHeader }),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (error) {
    console.error("Chat error:", error);
    return Response.json({ error: "Failed to send message" }, { status: 500 });
  }
}
