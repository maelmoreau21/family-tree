import { Datum } from "../types/data"

// formatPersonName creates a display-friendly name using a datum's first and last names.
// Falls back to the datum id or a placeholder when both names are missing.
export function formatPersonName(input: Pick<Datum, "id" | "data"> | Datum | null | undefined): string {
  if (!input) return ""

  const datum: Pick<Datum, "id" | "data"> = (typeof (input as Datum).data === "object")
    ? (input as Datum)
    : { id: (input as any)?.id ?? "", data: (input as any) }

  const rawFirst = datum.data?.["first name"]
  const rawLast = datum.data?.["last name"]

  const first = typeof rawFirst === "string" ? rawFirst.trim() : ""
  const last = typeof rawLast === "string" ? rawLast.trim() : ""

  const parts = [first, last].filter(Boolean)
  if (parts.length > 0) return parts.join(" ")

  const fallbackId = typeof datum.id === "string" && datum.id.trim().length > 0 ? datum.id.trim() : ""
  return fallbackId ? `Profil ${fallbackId}` : "Profil sans nom"
}

