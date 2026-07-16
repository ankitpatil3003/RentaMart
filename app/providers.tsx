"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient, useConvexAuth, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useEffect, type ReactNode } from "react";
import { api } from "../convex/_generated/api";
import { NotificationToasts } from "@/components/notifications/NotificationToasts";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
}

const convex = new ConvexReactClient(convexUrl);

function EnsureUser({ children }: { children: ReactNode }) {
  // Wait until Convex has validated the Clerk JWT, not only Clerk session.
  const { isAuthenticated, isLoading } = useConvexAuth();
  const ensureUser = useMutation(api.users.ensureUser);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    void ensureUser({});
  }, [isAuthenticated, isLoading, ensureUser]);

  return children;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <EnsureUser>
          {children}
          <NotificationToasts />
        </EnsureUser>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
