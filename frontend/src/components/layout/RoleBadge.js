import React from "react";

export default function RoleBadge({ hrProfile }) {
  if (!hrProfile) return null;

  const color = hrProfile.is_director ? "#f44336" : "#1976d2";

  return (
    <div
      className="mx-4 my-2 px-3 py-2 rounded-lg border flex flex-col gap-0.5"
      style={{ borderColor: color }}
    >
      <span className="text-sm font-semibold text-white flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        {hrProfile.username}
      </span>
      <small className="text-xs text-white/55 pl-[18px]">
        {hrProfile.is_director ? "Directeur RH" : hrProfile.job_title || "RH"}
      </small>
    </div>
  );
}
