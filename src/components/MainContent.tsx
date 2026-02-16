import { Card, CardHeader, CardTitle, CardDescription } from './ui/card'

export default function MainContent() {
  return (
    <div className="flex-1 bg-white text-gray-900 overflow-auto">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">Welcome to Your Workspace</h1>
        <p className="text-gray-600 mb-6">
          Start by selecting a file from the explorer or create a new file.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Quick Start</CardTitle>
              <CardDescription>
                Open a file from the explorer to get started with editing.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Files</CardTitle>
              <CardDescription>
                No recent files yet.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  )
}
