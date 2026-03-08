import { PlusIcon, Trash2 } from "lucide-react"
import { useState } from "react"
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

const inputClassName =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

export type CreatePartyRow = { level: number; quantity: number }

export function CreatePartyCredenza({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string, rows: CreatePartyRow[]) => void
  isPending: boolean
}) {
  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaTrigger asChild>
        <Button><PlusIcon className="size-4" /> Create Party</Button>
      </CredenzaTrigger>
      <CredenzaContent className="max-w-xl">
        <CredenzaHeader>
          <CredenzaTitle>Create Party</CredenzaTitle>
          <CredenzaDescription>
            Enter a name and add character rows with level (1–20) and quantity.
          </CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody>
          <CreatePartyForm onSubmit={onSubmit} isPending={isPending} />
        </CredenzaBody>
        <CredenzaFooter>
          <CredenzaClose asChild>
            <Button variant="outline">Cancel</Button>
          </CredenzaClose>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  )
}

function CreatePartyForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (name: string, rows: CreatePartyRow[]) => void
  isPending: boolean
}) {
  const [name, setName] = useState("")
  const [rows, setRows] = useState<CreatePartyRow[]>([{ level: 1, quantity: 1 }])

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

  const updateRow = (
    index: number,
    field: "level" | "quantity",
    value: number
  ) => {
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
                  updateRow(index, "quantity", parseInt(v, 10) || 1)
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
