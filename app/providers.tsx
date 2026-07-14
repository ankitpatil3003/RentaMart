"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useMutation } from "convex/react";
import { useEffect, type ReactNode } from "react";
import { api } from "../convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
}

const convex = new ConvexReactClient(convexUrl);

function EnsureUser({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const ensureUser = useMutation(api.users.ensureUser);

  useEffect(() => {
    if (!isSignedIn) return;
    void ensureUser({});
  }, [isSignedIn, ensureUser]);

  return children;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <EnsureUser>{children}</EnsureUser>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
