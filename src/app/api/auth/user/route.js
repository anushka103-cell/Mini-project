// API route that proxies to backend
import { headers } from "next/headers";

export async function GET(request) {
  try {
    const headersList = await headers();
    const authHeader = headersList.get("Authorization");

    const res = await fetch("http://localhost:5000/api/auth/user", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader && { Authorization: authHeader }),
      },
    });

    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (error) {
    console.error("Get user error:", error);
    return Response.json({ error: "Failed to get user" }, { status: 500 });
  }
}
