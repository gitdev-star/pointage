import React from "react";

export default function NavSection({ title, children }) {
  return (
    <div className="mt-2">
      <div className="text-[0.7rem] font-bold uppercase tracking-[1.2px] text-white/40 px-5 pt-3 pb-1">
        {title}
      </div>
      <ul className="list-none p-0 m-0">
        {children}
      </ul>
    </div>
  );
}
