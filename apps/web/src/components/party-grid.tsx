import type { Party } from "@/types/parties"
import { PartyCard } from "@/components/party-card"

export function PartyGrid({
  parties,
  isPending,
}: {
  parties: Party[]
  isPending: boolean
}) {
  return (
    <section className="mt-8">
      <h2 className="text-muted-foreground mb-3 text-sm font-medium">
        Your parties
      </h2>
      {isPending ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : parties.length === 0 ? (
        <p className="text-muted-foreground text-sm">No parties yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {parties.map((party) => (
            <PartyCard key={party.id} party={party} />
          ))}
        </ul>
      )}
    </section>
  )
}
