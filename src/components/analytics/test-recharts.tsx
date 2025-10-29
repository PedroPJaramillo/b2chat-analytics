"use client"

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Minimal test to verify Recharts is working
 */

const testData = [
  { name: 'Jan', value: 400 },
  { name: 'Feb', value: 300 },
  { name: 'Mar', value: 600 },
  { name: 'Apr', value: 800 },
  { name: 'May', value: 500 }
]

export function TestRechartsBasic() {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    console.log('🧪 TestRechartsBasic mounted on client')
  }, [])

  console.log('🧪 TestRechartsBasic rendering, isMounted:', isMounted)
  console.log('📊 Test data:', testData)

  if (!isMounted) {
    return (
      <Card className="border-4 border-blue-500">
        <CardHeader>
          <CardTitle className="text-blue-600">
            🧪 Recharts Basic Test (Client Component)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm mb-4">
            <p>⏳ Waiting for client-side mount...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-4 border-blue-500">
      <CardHeader>
        <CardTitle className="text-blue-600">
          🧪 Recharts Basic Test (Client Component)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm mb-4">
          <p>✅ If you see this text, React is working</p>
          <p>✅ If you see the blue border, Card component is working</p>
          <p>⬇️ Below should be a line chart with 5 data points</p>
        </div>

        <div className="border-2 border-red-500 p-4">
          <p className="text-red-600 mb-2">RED BOX: Chart should render inside this box</p>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={testData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-4 text-xs bg-yellow-100 p-2 rounded">
          <strong>What you should see:</strong>
          <ul className="list-disc ml-4 mt-1">
            <li>A line chart with 5 points (Jan through May)</li>
            <li>Values ranging from 300 to 800</li>
            <li>Grid lines in the background</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

export function TestRechartsDynamic() {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    console.log('🧪 TestRechartsDynamic mounted on client')
  }, [])

  console.log('🧪 TestRechartsDynamic rendering, isMounted:', isMounted)

  if (!isMounted) {
    return (
      <Card className="border-4 border-green-500">
        <CardHeader>
          <CardTitle className="text-green-600">
            🧪 Recharts Dynamic Test (Dynamically Loaded)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm mb-4">
            <p>⏳ Waiting for client-side mount...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-4 border-green-500">
      <CardHeader>
        <CardTitle className="text-green-600">
          🧪 Recharts Dynamic Test (Dynamically Loaded)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm mb-4">
          <p>✅ If you see this, the dynamic wrapper loaded</p>
        </div>

        <div className="w-full h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={testData}>
              <Line type="monotone" dataKey="value" stroke="#82ca9d" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
