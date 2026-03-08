import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { Party } from "@/types/parties"
import { formatPartySummary } from "@/types/parties"

export function PartyCard({ party }: { party: Party }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{party.name}</CardTitle>
        <CardDescription>{formatPartySummary(party)}</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  )
}
