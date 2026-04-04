// API route that proxies to backend
import { headers } from "next/headers";

export async function POST(request) {
  try {
    const headersList = await headers();
    const authHeader = headersList.get("Authorization");
    const body = await request.json();

    const res = await fetch("http://localhost:5000/api/chat", {
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
