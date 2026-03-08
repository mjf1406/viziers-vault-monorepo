import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { generateId } from "@workspace/db"
import { CreatePartyCredenza } from "@/components/create-party-credenza"
import { PartyGrid } from "@/components/party-grid"
import type { NewPartyPayload, Party } from "@/types/parties"

export const Route = createFileRoute("/parties")({
  component: PartiesPage,
})

function PartiesPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: parties = [], isPending } = useQuery<Party[]>({
    queryKey: ["parties"],
    queryFn: async () => {
      const res = await fetch("/api/parties")
      if (!res.ok) throw new Error("Failed to fetch parties")
      return res.json()
    },
  })

  const mutation = useMutation({
    mutationFn: async (payload: NewPartyPayload) => {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to create party")
      return res.json() as Promise<Party>
    },
    onMutate: async (newParty) => {
      await queryClient.cancelQueries({ queryKey: ["parties"] })
      const previous = queryClient.getQueryData<Party[]>(["parties"])
      queryClient.setQueryData<Party[]>(["parties"], (old = []) => [
        ...old,
        {
          id: newParty.id,
          name: newParty.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          partyCharacters: newParty.characters.map((ch) => ({
            id: ch.id,
            partyId: newParty.id,
            level: ch.level,
            quantity: ch.quantity,
          })),
        },
      ])
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous != null) {
        queryClient.setQueryData(["parties"], ctx.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] })
    },
    onSuccess: () => {
      setCreateOpen(false)
    },
  })

  return (
    <div className="flex min-h-svh flex-col p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-medium">Parties</h1>
          <p className="text-muted-foreground text-sm">
            Create parties with character levels and quantities. Add multiple
            rows for different level/quantity combinations.
          </p>
        </div>
        <CreatePartyCredenza
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={(name, rows) => {
            const partyId = generateId("party")
            mutation.mutate({
              id: partyId,
              name,
              characters: rows.map((r) => ({
                id: generateId("pchar"),
                level: r.level,
                quantity: r.quantity,
              })),
            })
          }}
          isPending={mutation.isPending}
        />
      </div>

      <PartyGrid parties={parties} isPending={isPending} />
    </div>
  )
}
