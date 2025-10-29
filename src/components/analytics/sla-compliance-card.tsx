import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CheckCircle, AlertCircle, XCircle, Target, Info } from "lucide-react"

interface SLAComplianceCardProps {
  compliance: number
  threshold: string
  target?: number // Target compliance percentage from SLA config
  totalChats?: number
  compliantChats?: number
  tooltip?: string
}

export function SLAComplianceCard({
  compliance,
  threshold,
  target = 95, // Default target if not provided
  totalChats,
  compliantChats,
  tooltip
}: SLAComplianceCardProps) {
  const getStatusIcon = () => {
    if (compliance >= target) {
      return <CheckCircle className="h-5 w-5 text-green-600" />
    } else if (compliance >= target - 15) {
      return <AlertCircle className="h-5 w-5 text-yellow-600" />
    } else {
      return <XCircle className="h-5 w-5 text-red-600" />
    }
  }

  const getStatusColor = () => {
    if (compliance >= target) return "text-green-600"
    if (compliance >= target - 15) return "text-yellow-600"
    return "text-red-600"
  }

  const getProgressColor = () => {
    if (compliance >= target) return "bg-green-600"
    if (compliance >= target - 15) return "bg-yellow-600"
    return "bg-red-600"
  }

  const getStatusMessage = () => {
    if (compliance >= target) {
      return "Excellent! Meeting SLA targets"
    } else if (compliance >= target - 15) {
      return `Close to target (${target}%), but room for improvement`
    } else {
      return `Action needed to reach target (${target}%)`
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">SLA Compliance</CardTitle>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[300px]">
                <p className="text-xs whitespace-pre-line">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <Target className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className={`text-2xl font-bold ${getStatusColor()}`}>
              {compliance}%
            </span>
          </div>

          <Progress
            value={compliance}
            className="h-2"
          />

          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Threshold:</span>
              <span className="font-medium">{threshold}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Target:</span>
              <span className="font-medium">{target}%</span>
            </div>
            {totalChats !== undefined && compliantChats !== undefined && (
              <div className="flex justify-between text-muted-foreground">
                <span>Compliant:</span>
                <span className="font-medium">
                  {compliantChats} / {totalChats} chats
                </span>
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            {getStatusMessage()}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}