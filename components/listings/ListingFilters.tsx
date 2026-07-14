"use client";

type ListingFiltersProps = {
  city: string;
  maxRent: string;
  minBeds: string;
  onCityChange: (value: string) => void;
  onMaxRentChange: (value: string) => void;
  onMinBedsChange: (value: string) => void;
};

export function ListingFilters({
  city,
  maxRent,
  minBeds,
  onCityChange,
  onMaxRentChange,
  onMinBedsChange,
}: ListingFiltersProps) {
  return (
    <form
      className="mt-8 grid gap-4 sm:grid-cols-3"
      onSubmit={(event) => event.preventDefault()}
    >
      <label className="block text-sm text-neutral-600">
        City
        <input
          value={city}
          onChange={(event) => onCityChange(event.target.value)}
          placeholder="Austin"
          className="mt-1 w-full border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-neutral-900"
        />
      </label>
      <label className="block text-sm text-neutral-600">
        Max rent (USD)
        <input
          value={maxRent}
          onChange={(event) => onMaxRentChange(event.target.value)}
          inputMode="numeric"
          placeholder="2500"
          className="mt-1 w-full border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-neutral-900"
        />
      </label>
      <label className="block text-sm text-neutral-600">
        Min beds
        <input
          value={minBeds}
          onChange={(event) => onMinBedsChange(event.target.value)}
          inputMode="numeric"
          placeholder="1"
          className="mt-1 w-full border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-neutral-900"
        />
      </label>
    </form>
  );
}
