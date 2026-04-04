// API route that proxies to backend
export async function POST(request) {
  try {
    const res = await fetch("http://localhost:5000/api/auth/guest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (error) {
    console.error("Guest login error:", error);
    return Response.json({ error: "Failed to authenticate" }, { status: 500 });
  }
}
