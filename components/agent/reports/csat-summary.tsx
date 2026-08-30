import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { RATING_VALUES } from "@/lib/validation/feedback"

export function CsatSummary({
  csat,
}: {
  csat: { average: number | null; count: number; distribution: Record<number, number> }
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>Customer satisfaction</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <span className="text-metric tabular-nums">
            {csat.average === null ? "No ratings yet" : csat.average.toFixed(1)}
          </span>
          {csat.average !== null ? (
            <p className="text-label text-muted-foreground">out of 5 · {csat.count} responses</p>
          ) : null}
        </div>

        <div className="space-y-1">
          {RATING_VALUES.map((rating) => (
            <div key={rating} className="flex items-center gap-2 text-label text-muted-foreground">
              <span className="w-4">{rating}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-chart-1"
                  style={{
                    width:
                      csat.count === 0
                        ? "0%"
                        : `${((csat.distribution[rating] ?? 0) / csat.count) * 100}%`,
                  }}
                />
              </div>
              <span className="w-6 text-right">{csat.distribution[rating] ?? 0}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
