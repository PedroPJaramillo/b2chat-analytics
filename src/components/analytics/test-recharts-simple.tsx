"use client"

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const testData = [
  { name: 'Jan', value: 400 },
  { name: 'Feb', value: 300 },
  { name: 'Mar', value: 600 },
  { name: 'Apr', value: 800 },
  { name: 'May', value: 500 }
]

export function TestRechartsSimple() {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    console.log('🧪 TestRechartsSimple mounted')
  }, [])

  if (!isMounted) {
    return (
      <Card className="border-4 border-purple-500">
        <CardHeader>
          <CardTitle className="text-purple-600">
            🧪 Test 3: Without ResponsiveContainer (Fixed Size)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>⏳ Mounting...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-4 border-purple-500">
      <CardHeader>
        <CardTitle className="text-purple-600">
          🧪 Test 3: Without ResponsiveContainer (Fixed Size)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm mb-4 space-y-1">
          <p>✅ Component is mounted</p>
          <p className="font-bold text-purple-600">
            This test uses a FIXED SIZE chart (no ResponsiveContainer)
          </p>
          <p>If you see a chart below, ResponsiveContainer is the problem!</p>
        </div>

        <div className="border-4 border-orange-500 p-4 bg-orange-50">
          <p className="mb-2 font-bold text-orange-700">ORANGE BOX: Chart with fixed 600x300 size</p>
          <LineChart width={600} height={300} data={testData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
          </LineChart>
        </div>

        <div className="mt-4 p-3 bg-yellow-100 rounded text-sm">
          <strong>Diagnosis:</strong>
          <ul className="list-disc ml-4 mt-1">
            <li>If chart shows: ResponsiveContainer is the issue</li>
            <li>If blank: Recharts itself has a rendering problem</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
