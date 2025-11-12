import { Datum } from "../types/data"

const DATE_COLLAPSED_KEYWORDS = new Set([
  "birthday",
  "birthdate",
  "birth",
  "death",
  "deathdate",
  "burial",
  "burialdate",
  "baptism",
  "baptismdate",
  "uniondate",
  "marriagedate",
  "weddingdate",
  "divorcedate",
  "engagementdate",
  "anniversary",
  "anniversarydate"
])

const DATE_TOKEN_KEYWORDS = new Set([
  "date",
  "birth",
  "birthday",
  "death",
  "burial",
  "baptism",
  "marriage",
  "wedding",
  "union",
  "divorce",
  "engagement",
  "anniversary",
  "naissance",
  "deces"
])

const DATE_EXCLUDED_COLLAPSED = new Set([
  "update",
  "updatedate",
  "lastupdate",
  "birthplace",
  "deathplace",
  "unionplace",
  "marriageplace",
  "weddingplace",
  "baptismplace",
  "burialplace"
])

function normalizeFieldId(fieldId: string): string {
  return fieldId.split("__ref__")[0].trim()
}

function collapseLetters(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "")
}

function tokenizeLetters(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z]+/g)
    .filter(Boolean)
}

export function shouldNormalizeDateField(fieldId: string): boolean {
  if (!fieldId || typeof fieldId !== "string") return false
  const base = normalizeFieldId(fieldId)
  if (!base) return false
  const normalized = base.toLowerCase()
  if (normalized.includes("place") || normalized.includes("location")) return false
  const collapsed = collapseLetters(base)
  if (!collapsed) return false
  if (DATE_EXCLUDED_COLLAPSED.has(collapsed)) return false
  if (DATE_COLLAPSED_KEYWORDS.has(collapsed)) return true
  if (collapsed.endsWith("date") && !DATE_EXCLUDED_COLLAPSED.has(collapsed)) return true
  const tokens = tokenizeLetters(base)
  if (!tokens.length) return false
  for (const token of tokens) {
    if (DATE_TOKEN_KEYWORDS.has(token)) return true
  }
  return false
}

const ALLOWED_DATE_CONTENT = /^[0-9xX./\-\s]+$/

function sanitizeDateInput(raw: string): { approx: string; payload: string } {
  let value = raw.trim()
  if (!value) return { approx: "", payload: "" }
  let approx = ""
  const prefix = value[0]
  if (prefix === "<" || prefix === ">") {
    approx = prefix
    value = value.slice(1).trim()
  }
  if (!value) return { approx, payload: "" }
  value = value.replace(/\b(?:approx|approximativement|circa|vers|env\.?|environ|ca)\b/gi, " ")
  value = value.replace(/\?/g, "X")
  if (!ALLOWED_DATE_CONTENT.test(value)) {
    value = value.replace(/[^0-9xX./\-\s]/g, " ").trim()
  }
  return { approx, payload: value }
}

function isYearToken(token: string): boolean {
  if (!token) return false
  if (/^[xX]{3,4}$/.test(token)) return true
  return /^\d{3,4}$/.test(token)
}

function normalizeDayMonthToken(token: string): string {
  if (!token) return "XX"
  if (/^[xX]{1,2}$/.test(token)) return token.toUpperCase()
  if (/^\d{1,2}$/.test(token)) return token.padStart(2, "0")
  if (/^\d{3,}$/.test(token)) return token.slice(0, 2).padStart(2, "0")
  return token
}

function normalizeYearToken(token: string): string {
  if (!token) return "XXXX"
  if (/^[xX]{1,4}$/.test(token)) {
    const upper = token.toUpperCase()
    if (upper.length >= 4) return upper.slice(0, 4)
    return upper.padEnd(4, "X")
  }
  if (/^\d{4}$/.test(token)) return token
  if (/^\d{1,4}$/.test(token)) return token.padStart(4, "0").slice(-4)
  return token
}

function fillDateParts(tokens: string[]): [string, string, string] {
  const clean = tokens.filter(Boolean)
  const result: [string, string, string] = ["", "", ""]
  if (clean.length === 0) return ["", "", ""]
  if (clean.length >= 3) {
    result[0] = clean[0]
    result[1] = clean[1]
    result[2] = clean[2]
    return result
  }
  if (clean.length === 1) {
    if (isYearToken(clean[0])) {
      result[2] = clean[0]
    } else {
      result[0] = clean[0]
    }
    return result
  }
  if (clean.length === 2) {
    const [first, second] = clean
    if (isYearToken(second)) {
      result[1] = first
      result[2] = second
    } else if (isYearToken(first)) {
      result[2] = first
    } else {
      result[0] = first
      result[1] = second
    }
    return result
  }
  return result
}

export function normalizeDateValue(raw: unknown): string {
  if (raw === null || raw === undefined) return ""
  const str = typeof raw === "string" ? raw : String(raw)
  const { approx, payload } = sanitizeDateInput(str)
  if (!payload) return approx
  const parts = payload.split(/[.\-/\s]+/g).filter(Boolean).map(part => part.replace(/[^0-9xX]/g, ""))
  if (parts.length === 0) return approx ? approx + payload : payload
  const [dayToken, monthToken, yearToken] = (() => {
    const filled = fillDateParts(parts)
    return [filled[0], filled[1], filled[2]]
  })()
  const day = normalizeDayMonthToken(dayToken)
  const month = normalizeDayMonthToken(monthToken)
  const year = normalizeYearToken(yearToken)
  return `${approx}${day || "XX"}.${month || "XX"}.${year || "XXXX"}`
}

export function normalizeDatumDateFields(datum: Pick<Datum, "data"> | null | undefined): void {
  if (!datum || !datum.data || typeof datum.data !== "object") return
  Object.entries(datum.data).forEach(([key, value]) => {
    if (typeof value !== "string") return
    if (!shouldNormalizeDateField(key)) return
    const normalized = normalizeDateValue(value)
    datum.data[key] = normalized
  })
}
