"use client";

import * as React from "react";
import type { AppUser } from "@/lib/types";

const MemberContext = React.createContext<AppUser | null>(null);

export function MemberProvider({
  member,
  children,
}: {
  member: AppUser;
  children: React.ReactNode;
}) {
  return (
    <MemberContext.Provider value={member}>{children}</MemberContext.Provider>
  );
}

/** Current signed-in member (display only; attribution is server-side). */
export function useMember(): AppUser {
  const member = React.useContext(MemberContext);
  if (!member) {
    throw new Error("useMember must be used within a MemberProvider");
  }
  return member;
}
