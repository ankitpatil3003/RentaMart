import { NotificationList } from "@/components/notifications/NotificationList";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotificationsPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f5f1_0%,#ffffff_40%)]">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
          Notifications
        </h1>
        <p className="mt-2 text-neutral-600">
          Updates about your applications and payments.
        </p>
        <div className="mt-8">
          <NotificationList />
        </div>
      </div>
    </main>
  );
}
