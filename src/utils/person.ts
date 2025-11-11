import { Datum } from "../types/data"

// formatPersonName creates a display-friendly name using a datum's first and last names.
// Falls back to the datum id or a placeholder when both names are missing.
export function formatPersonName(input: Pick<Datum, "id" | "data"> | Datum | null | undefined): string {
  if (!input) return ""

  // Normalize input into an object with `id` and `data` without using `any`.
  const asUnknown = input as unknown
  const datum: Pick<Datum, "id" | "data"> = (asUnknown && typeof (asUnknown as Datum).data === "object")
    ? (asUnknown as Datum)
    : ({ id: ((asUnknown as { id?: unknown })?.id as string) ?? "", data: (asUnknown as { data?: unknown })?.data ?? {} } as unknown as Pick<Datum, "id" | "data">)

  const rawFirst = datum.data?.["first name"]
  const rawLast = datum.data?.["last name"]

  const first = typeof rawFirst === "string" ? rawFirst.trim() : ""
  const last = typeof rawLast === "string" ? rawLast.trim() : ""

  const parts = [first, last].filter(Boolean)
  if (parts.length > 0) return parts.join(" ")

  const fallbackId = typeof datum.id === "string" && datum.id.trim().length > 0 ? datum.id.trim() : ""
  return fallbackId ? `Profil ${fallbackId}` : "Profil sans nom"
}

