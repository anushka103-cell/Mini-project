"use client";

export default function AvatarError({ error, reset }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Avatar Unavailable
        </h2>
        <p className="text-gray-600 mb-6">
          The 3D avatar could not load. This may be due to a missing model file
          or your browser not supporting WebGL.
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-indigo-600 px-6 py-3 text-white font-semibold hover:bg-indigo-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
