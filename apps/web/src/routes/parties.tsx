import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { generateId } from "@workspace/db"
import { Button } from "@workspace/ui/components/button"
import { NumberInput } from "@workspace/ui/components/number-input"
import {
  Credenza,
  CredenzaBody,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
  CredenzaTrigger,
} from "@/components/ui/credenza"
import { PartyGrid } from "@/components/party-grid"
import type { NewPartyPayload, Party } from "@/types/parties"

const inputClassName =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

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
        <Credenza open={createOpen} onOpenChange={setCreateOpen}>
          <CredenzaTrigger asChild>
            <Button>Create Party</Button>
          </CredenzaTrigger>
          <CredenzaContent className="max-w-xl">
            <CredenzaHeader>
              <CredenzaTitle>Create Party</CredenzaTitle>
              <CredenzaDescription>
                Enter a name and add character rows with level (1–20) and
                quantity.
              </CredenzaDescription>
            </CredenzaHeader>
            <CredenzaBody>
              <CreatePartyForm
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
            </CredenzaBody>
            <CredenzaFooter>
              <CredenzaClose asChild>
                <Button variant="outline">Cancel</Button>
              </CredenzaClose>
            </CredenzaFooter>
          </CredenzaContent>
        </Credenza>
      </div>

      <PartyGrid parties={parties} isPending={isPending} />
    </div>
  )
}

type Row = { level: number; quantity: number }

function CreatePartyForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (name: string, rows: Row[]) => void
  isPending: boolean
}) {
  const [name, setName] = useState("")
  const [rows, setRows] = useState<Row[]>([{ level: 1, quantity: 1 }])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const valid = rows.filter((r) => r.level >= 1 && r.level <= 20 && r.quantity >= 1)
    if (valid.length === 0) return
    onSubmit(trimmed, valid)
    setName("")
    setRows([{ level: 1, quantity: 1 }])
  }

  const addRow = () => {
    setRows((prev) => [...prev, { level: 1, quantity: 1 }])
  }

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const updateRow = (index: number, field: "level" | "quantity", value: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="text-muted-foreground mb-1 block text-sm">
          Party name
        </label>
        <input
          type="text"
          className={inputClassName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tuesday group"
          required
        />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-muted-foreground text-sm">
            Characters (level × quantity)
          </span>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            Add row
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground grid grid-cols-[auto_auto_2rem] items-center gap-2 text-xs font-medium">
            <span>Level</span>
            <span>Quantity</span>
            <span />
          </div>
          {rows.map((row, index) => (
            <div
              key={index}
              className="grid grid-cols-[auto_auto_2rem] items-center gap-2"
            >
              <NumberInput
                min={1}
                max={20}
                value={row.level}
                onChange={(v) =>
                  updateRow(index, "level", parseInt(v, 10) || 1)
                }
                aria-label="Level"
              />
              <NumberInput
                min={1}
                value={row.quantity}
                onChange={(v) =>
                  updateRow(
                    index,
                    "quantity",
                    parseInt(v, 10) || 1
                  )
                }
                aria-label="Quantity"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => removeRow(index)}
                disabled={rows.length <= 1}
                aria-label="Remove row"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create Party"}
      </Button>
    </form>
  )
}

