"use client";

import { useEffect, useState } from "react";
import Avatar3D from "@/components/Avatar3D";

export default function AvatarPage() {
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    const handleMessage = (event) => {
      const data = event.data;

      if (data?.source === "readyplayerme") {
        if (data.eventName === "v1.avatar.exported") {
          const url = data.data.url;

          setAvatarUrl(url);

          saveAvatar(url);
        }
      }
    };

    window.addEventListener("message", handleMessage);

    loadAvatar();

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  async function saveAvatar(url) {
    const token = localStorage.getItem("token");

    await fetch("http://localhost:5000/api/avatar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        avatar3D: url,
      }),
    });
  }

  async function loadAvatar() {
    const token = localStorage.getItem("token");

    const res = await fetch("http://localhost:5000/api/avatar", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (data.avatar?.avatar3D) {
      setAvatarUrl(data.avatar.avatar3D);
    }
  }

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold mb-6">Avatar Studio</h1>

      {/* Avatar Creator */}
      <iframe
        src="https://demo.readyplayer.me/avatar"
        className="w-full h-[600px] rounded-xl mb-10"
        allow="camera *; microphone *"
      />

      {/* Avatar Preview */}
      {avatarUrl && (
        <div>
          <h2 className="text-xl mb-4">Your Avatar</h2>
          <Avatar3D url={avatarUrl} />
        </div>
      )}
    </div>
  );
}
