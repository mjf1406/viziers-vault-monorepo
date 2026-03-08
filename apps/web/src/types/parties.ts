export type PartyCharacter = {
  id: string
  partyId: string
  level: number
  quantity: number
}

export type Party = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  partyCharacters: PartyCharacter[]
}

export type NewPartyPayload = {
  id: string
  name: string
  characters: { id: string; level: number; quantity: number }[]
}

export function formatPartySummary(party: Party): string {
  if (!party.partyCharacters?.length) return "No characters"
  const parts = party.partyCharacters.map(
    (c) => `${c.quantity} level ${c.level} characters`
  )
  return parts.join(", ")
}
