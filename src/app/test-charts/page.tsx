"use client"

import { TestRechartsBasic, TestRechartsDynamicWrapper } from "@/components/analytics/test-recharts-dynamic-wrapper"
import { TestRechartsSimple } from "@/components/analytics/test-recharts-simple"

export default function TestChartsPage() {
  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">🧪 Recharts Diagnostics</h1>
        <p className="text-muted-foreground">
          This page tests if Recharts is working in your Next.js app.
        </p>
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold mb-4">Test 1: Basic Client Component</h2>
          <p className="text-sm text-muted-foreground mb-4">
            This component uses &quot;use client&quot; but NO dynamic import.
            If Recharts works at all, you should see a chart here.
          </p>
          <TestRechartsBasic />
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4">Test 2: Dynamically Loaded Component</h2>
          <p className="text-sm text-muted-foreground mb-4">
            This component uses next/dynamic with ssr: false.
            This is how your Volume Chart and Channel Breakdown are loaded.
          </p>
          <TestRechartsDynamicWrapper />
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4">Test 3: Fixed Size (No ResponsiveContainer)</h2>
          <p className="text-sm text-muted-foreground mb-4">
            This test uses a fixed 600x300px chart WITHOUT ResponsiveContainer.
            If this works, ResponsiveContainer is the problem.
          </p>
          <TestRechartsSimple />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold mb-2">📋 Diagnostic Checklist</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <input type="checkbox" id="check1" className="mt-1" />
              <label htmlFor="check1">
                <strong>Test 1 shows a line chart</strong> - Recharts library is installed and working
              </label>
            </div>
            <div className="flex items-start gap-2">
              <input type="checkbox" id="check2" className="mt-1" />
              <label htmlFor="check2">
                <strong>Test 2 shows a line chart</strong> - Dynamic import is working correctly
              </label>
            </div>
            <div className="flex items-start gap-2">
              <input type="checkbox" id="check3" className="mt-1" />
              <label htmlFor="check3">
                <strong>No errors in browser console</strong> - No JavaScript errors
              </label>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-bold mb-2">🔍 What to Check</h3>
          <ol className="list-decimal ml-4 space-y-1 text-sm">
            <li>Do you see TWO charts on this page (one blue border, one green border)?</li>
            <li>Open Developer Tools (F12) → Console tab - any errors?</li>
            <li>If both charts work here but not on analytics page, the issue is with data/API</li>
            <li>If charts don&apos;t work here, the issue is with Recharts installation</li>
          </ol>
        </div>

        <div className="bg-gray-100 border border-gray-300 rounded-lg p-6">
          <h3 className="font-bold mb-2">🛠️ Next Steps Based on Results</h3>
          <div className="space-y-3 text-sm">
            <div>
              <strong className="text-green-600">✅ If both tests show charts:</strong>
              <p className="ml-4">Recharts works! Issue is in analytics page data/API. Check Network tab.</p>
            </div>
            <div>
              <strong className="text-red-600">❌ If Test 1 fails (blank):</strong>
              <p className="ml-4">Recharts not working. Run: npm install recharts@2.12.2</p>
            </div>
            <div>
              <strong className="text-orange-600">⚠️ If Test 1 works but Test 2 fails:</strong>
              <p className="ml-4">Dynamic import issue. Problem with next/dynamic setup.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
