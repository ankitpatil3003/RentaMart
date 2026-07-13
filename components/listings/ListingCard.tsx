import Link from "next/link";
import { formatUsdFromCents } from "@/lib/format";
import type { Id } from "@/convex/_generated/dataModel";

type ListingCardProps = {
  id: Id<"listings">;
  title: string;
  city: string;
  state: string;
  rentCents: number;
  beds: number;
  baths: number;
  photoUrls: string[];
};

export function ListingCard({
  id,
  title,
  city,
  state,
  rentCents,
  beds,
  baths,
  photoUrls,
}: ListingCardProps) {
  const photo = photoUrls[0];
  return (
    <Link
      href={`/listings/${id}`}
      className="group block border-b border-neutral-200 py-6 transition-colors hover:bg-neutral-50"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="h-40 w-full overflow-hidden bg-neutral-100 sm:h-28 sm:w-40 sm:shrink-0">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : null}
        </div>
        <div>
          <h2 className="text-xl font-medium tracking-tight text-neutral-900">
            {title}
          </h2>
          <p className="mt-1 text-neutral-600">
            {city}, {state}
          </p>
          <p className="mt-2 text-neutral-900">
            {formatUsdFromCents(rentCents)}
            <span className="text-neutral-500"> / month</span>
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {beds} bed · {baths} bath
          </p>
        </div>
      </div>
    </Link>
  );
}
